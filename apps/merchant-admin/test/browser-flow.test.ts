import assert from 'node:assert/strict';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { chromium, expect, type Page } from '@playwright/test';
const jsQR = createRequire(import.meta.url)('jsqr') as typeof import('jsqr').default;
import { createMerchantAdminDevServer } from '../dev-server.ts';

async function withDashboard(
  run: (page: Page, origin: string) => Promise<void>,
  guestOrigin?: string,
) {
  const server = createMerchantAdminDevServer({ guestOrigin });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await run(page, `http://127.0.0.1:${address.port}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('merchant actions work in a real browser and survive reload', async () => {
  await withDashboard(async (page, origin) => {
    await page.goto(origin);
    const screen = page.locator('[data-screen="pilot-route-recording"]');
    await expect(screen).toHaveAttribute('data-stage', 'empty');
    await expect(page.locator('a[data-launch-url]')).toHaveCount(0);
    await expect(page.locator('[data-action-id="generate-guest-url"]').first()).toBeDisabled();
    const click = async (id: string) => {
      const saved = page.waitForResponse((response) =>
        response.url().endsWith('/api/dev/pilot-state') && response.request().method() === 'POST',
      );
      await page.locator(`[data-action-id="${id}"]`).first().click();
      assert.equal((await saved).status(), 200);
    };
    for (const action of ['record-route', 'mark-test-passed', 'activate-route']) {
      await click(action);
    }
    await expect(screen).toHaveAttribute('data-stage', 'active');
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Entrance');
    await page.getByRole('textbox', { name: 'Orientation', exact: true }).fill('Facing hallway');
    await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Local simulation');
    await click('record-qr-placement-evidence');
    await expect(page.locator('[data-qr-placement-evidence-summary]')).toContainText('Entrance');
    await click('mark-staff-fallback-ready');
    await click('generate-guest-url');
    await expect(page.locator('a[data-launch-url]')).toHaveAttribute('href', /\?token=/);
    await click('record-follow-up');
    await click('complete-follow-up');
    await page.reload();
    await expect(screen).toHaveAttribute('data-stage', 'launch-ready');
    await expect(page.locator('[data-follow-ups="completed"] li')).toHaveCount(1);
    await expect(page.locator('[data-qr-placement-location]')).toHaveValue('Entrance');
    await expect(page.getByRole('img', { name: 'Guest route QR code' })).toBeVisible();
    for (const [name, width] of [['desktop', 1280], ['mobile', 390]] as const) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') {
        await page.screenshot({ path: join(tmpdir(), `lechigo-merchant-${name}.png`), fullPage: true });
      }
    }
  });
});

test('failed saves preserve state and drafts, then allow retry', async () => {
  await withDashboard(async (page, origin) => {
    await page.goto(origin);
    const record = page.locator('[data-action-id="record-route"]').first();
    await expect(record).toBeEnabled();
    await page.getByRole('textbox', { name: 'Location', exact: true }).fill('Unsaved entrance');
    await page.route('**/api/dev/pilot-state', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, json: { error: 'unavailable' } });
      } else await route.continue();
    });
    await record.click();
    await expect(page.getByRole('alert')).toContainText('Could not save');
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'empty');
    await expect(record).toBeEnabled();
    await expect(page.getByRole('textbox', { name: 'Location', exact: true })).toHaveValue('Unsaved entrance');
    await page.unroute('**/api/dev/pilot-state');
    await record.click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Location', exact: true })).toHaveValue('Unsaved entrance');
  });
});

test('load failures block overwriting saved data and recover on reload', async () => {
  await withDashboard(async (page, origin) => {
    await page.route('**/api/dev/pilot-state', (route) => route.fulfill({ status: 503, body: 'Unavailable' }));
    await page.goto(origin);
    await expect(page.getByRole('alert')).toContainText('Could not load');
    await expect(page.locator('[data-action-id="record-route"]').first()).toBeDisabled();
    await page.unroute('**/api/dev/pilot-state');
    await page.reload();
    await expect(page.locator('[data-action-id="record-route"]').first()).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test('saved evidence restores readiness and unsafe guest links stay inert', async () => {
  await withDashboard(async (page, origin) => {
    await page.request.post(`${origin}/api/dev/pilot-state`, { data: {
      recording: { stage: 'launch-ready', launchUrl: 'javascript:alert(1)' },
      readiness: {
        hasQrPlacement: false,
        hasStaffFallbackNote: true,
        qaResults: {},
        qrPlacementEvidence: {
          location: '<img src=x onerror=alert(1)>', orientation: 'Hallway', note: 'Simulation',
          recordedAt: '2026-09-16T00:00:00.000Z',
        },
      },
      followUps: [],
    } });
    await page.goto(origin);
    await expect(page.locator('[data-checklist-id="place-qr"]')).toHaveAttribute('data-complete', 'true');
    await expect(page.locator('[data-qa-note="place-qr"]')).toContainText('<img src=x onerror=alert(1)>');
    await expect(page.locator('a[data-launch-url]')).toHaveCount(0);
    await expect(page.getByRole('img', { name: 'Guest route QR code' })).toHaveCount(0);
    await expect(page.locator('[data-qr-placement-evidence-summary] img')).toHaveCount(0);
  });
});

test('downloadable QR decodes to the configured phone URL after reload', async () => {
  const guestOrigin = 'https://pilot.example.com';
  await withDashboard(async (page, origin) => {
    await page.request.post(`${origin}/api/dev/pilot-route-recording`, { data: {
      stage: 'active', routeId: 'pilot-restroom-route',
    } });
    const sessionResponse = await page.request.get(`${origin}/api/dev/pilot-route-session`);
    const session = await sessionResponse.json() as { launchUrl: string };
    assert.equal(new URL(session.launchUrl).origin, guestOrigin);
    await page.request.post(`${origin}/api/dev/pilot-state`, { data: {
      recording: { stage: 'launch-ready', launchUrl: session.launchUrl },
      readiness: { hasQrPlacement: true, hasStaffFallbackNote: true, qaResults: {} },
      followUps: [],
    } });
    await page.goto(origin);
    await page.reload();
    const qr = page.getByRole('img', { name: 'Guest route QR code' });
    await expect(qr).toBeVisible();
    const pixels = await qr.evaluate(async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height,
        data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
    });
    const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height);
    assert.equal(decoded?.data, session.launchUrl);
    await expect(page.locator('a[data-launch-url]')).toHaveAttribute('href', session.launchUrl);
    const downloadLink = page.getByRole('link', { name: 'Download QR image' });
    assert.equal(await downloadLink.getAttribute('href'), await qr.getAttribute('src'));
    const downloaded = page.waitForEvent('download');
    await downloadLink.click();
    const download = await downloaded;
    assert.equal(download.suggestedFilename(), 'lechigo-pilot-guest-qr.png');
    assert.equal(await download.failure(), null);
  }, guestOrigin);
});

test('QR overflow reports an error while keeping the guest link available', async () => {
  await withDashboard(async (page, origin) => {
    const launchUrl = `https://pilot.example.com/?token=${'a'.repeat(5000)}`;
    await page.request.post(`${origin}/api/dev/pilot-state`, { data: {
      recording: { stage: 'launch-ready', launchUrl },
      readiness: { hasQrPlacement: true, hasStaffFallbackNote: true, qaResults: {} },
      followUps: [],
    } });
    await page.goto(origin);
    await expect(page.getByRole('alert')).toContainText('QR image unavailable');
    await expect(page.locator('a[data-launch-url]')).toHaveAttribute('href', launchUrl);
    await expect(page.getByRole('link', { name: 'Download QR image' })).toHaveCount(0);
  });
});
