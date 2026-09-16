import assert from 'node:assert/strict';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium, expect, type Page } from '@playwright/test';
import { createGuestWebxrDevServer } from '../dev-server.ts';
import { createDemoGuestEntryConfig } from '../src/entry/bootstrap.ts';

const route = createDemoGuestEntryConfig().route!;
const multiStepRoute = {
  ...route,
  anchors: [route.anchors[0], {
    id: 'stairs', label: 'Stair landing', floor: 1,
    position: { x: 4, y: 0, z: 0 }, type: 'landmark' as const,
  }, { ...route.anchors[1], floor: 2 }],
  segments: [
    { id: 'first', fromAnchorId: 'entrance', toAnchorId: 'stairs', instruction: 'Walk to the stairs.', distanceMeters: 4 },
    { id: 'second', fromAnchorId: 'stairs', toAnchorId: 'restroom', instruction: 'Go upstairs to the restroom.', distanceMeters: 6,
      floorTransition: { type: 'stairs' as const, fromFloor: 1, toFloor: 2 } },
  ],
  totalDistanceMeters: 10,
};

async function withGuest(run: (page: Page, origin: string) => Promise<void>) {
  const server = createGuestWebxrDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(4000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await run(page, `http://127.0.0.1:${address.port}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('guest confirms landmarks, goes back, and completes arrival', async () => {
  await withGuest(async (page, origin) => {
    await page.route('**/api/guest/routes?*', (request) => request.fulfill({ json: { ok: true, route: multiStepRoute } }));
    await page.goto(`${origin}/?token=test`);
    await expect(page.getByRole('heading', { name: 'Stair landing', exact: true })).toBeVisible();
    await expect(page.locator('[data-progress]')).toHaveText('Step 1 of 2');
    await expect(page.getByRole('button', { name: 'Previous landmark' })).toBeDisabled();
    await page.getByRole('button', { name: 'Reached this landmark' }).click();
    await expect(page.locator('[data-progress]')).toHaveText('Step 2 of 2');
    await expect(page.locator('[data-floor-transition]')).toContainText('Floor 1 to 2');
    await page.getByRole('button', { name: 'Previous landmark' }).click();
    await expect(page.locator('[data-progress]')).toHaveText('Step 1 of 2');
    await page.getByRole('button', { name: 'Reached this landmark' }).click();
    await page.getByRole('button', { name: 'I have arrived' }).click();
    await expect(page.getByRole('heading', { name: 'You have arrived' })).toBeVisible();
    await page.getByRole('button', { name: 'Previous landmark' }).click();
    await expect(page.locator('[data-progress]')).toHaveText('Step 2 of 2');
    for (const [name, width] of [['mobile', 390], ['desktop', 1280]] as const) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') {
        await page.screenshot({ path: join(tmpdir(), `lechigo-guest-${name}.png`), fullPage: true });
      }
    }
    await page.reload();
    await expect(page.locator('[data-progress]')).toHaveText('Step 1 of 2');
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  });
});

test('real issued guest session supports arrival without an AR device', async () => {
  await withGuest(async (page, origin) => {
    const session = await (await page.request.get(`${origin}/api/dev/guest-session`)).json();
    const payload = await (await page.request.get(`${origin}/api/guest/routes?token=${encodeURIComponent(session.token)}`)).json();
    await page.goto(`${origin}${session.url}`);
    for (let index = 0; index < payload.route.segments.length; index++) {
      await expect(page.locator('[data-current-instruction]')).toHaveText(payload.route.segments[index].instruction);
      await page.getByRole('button', { name: index === payload.route.segments.length - 1 ? 'I have arrived' : 'Reached this landmark' }).click();
    }
    await expect(page.locator('[data-screen="arrived"]')).toBeVisible();
  });
});

test('broken route chains do not produce misleading arrival controls', async () => {
  await withGuest(async (page, origin) => {
    await page.route('**/api/guest/routes?*', (request) => request.fulfill({ json: {
      ok: true, route: { ...multiStepRoute, segments: [multiStepRoute.segments[1], multiStepRoute.segments[0]] },
    } }));
    await page.goto(`${origin}/?token=test`);
    await expect(page.getByRole('heading', { name: 'Route unavailable' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'I have arrived' })).toHaveCount(0);
  });
});
