import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';

test('merchant floor changes persist and guests see stairs and elevator guidance', async () => {
  const merchant = createMerchantAdminDevServer();
  const guest = createGuestWebxrDevServer({ guestApi: merchant.guestApi });
  merchant.listen(0, '127.0.0.1'); await once(merchant, 'listening');
  guest.listen(0, '127.0.0.1'); await once(guest, 'listening');
  const address = merchant.address(); const guestAddress = guest.address();
  assert.ok(address && typeof address !== 'string'); assert.ok(guestAddress && typeof guestAddress !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const guestOrigin = `http://127.0.0.1:${guestAddress.port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator('[data-action-id="record-route"]').first().click();
    await page.getByLabel('Step 1 movement', { exact: true }).selectOption('stairs');
    await page.getByLabel('Step 1 from floor', { exact: true }).fill('-1');
    await page.getByLabel('Step 1 to floor', { exact: true }).fill('1');
    await page.getByLabel('Step 2 movement', { exact: true }).selectOption('elevator');
    await page.getByLabel('Step 2 from floor', { exact: true }).fill('2');
    await page.getByLabel('Step 2 to floor', { exact: true }).fill('3');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Step 2');
    assert.equal((await (await fetch(`${origin}/api/dev/pilot-state`)).json()).recording.routeVersion ?? 1, 1);
    await page.getByLabel('Step 2 from floor', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save route directions', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('Step 1 from floor', { exact: true })).toHaveValue('-1');
    await expect(page.getByLabel('Step 2 movement', { exact: true })).toHaveValue('elevator');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') await page.getByRole('region', { name: 'Route directions', exact: true }).screenshot({ path: `/tmp/lechigo-floors-${width}.png` });
    }
    await page.getByLabel('Route test note', { exact: true }).fill('Checked both floor changes.');
    await page.locator('[data-action-id="mark-test-passed"]').first().click();
    await page.locator('[data-action-id="activate-route"]').first().click();
    await expect(page.locator('a[data-entry-url]')).toBeVisible();
    const session = merchant.guestApi.issueSession(); assert.ok(session.ok);
    const route = merchant.guestApi.fetchRoute(session.token); assert.ok(route.ok);
    assert.deepEqual(route.route.anchors.map((anchor) => anchor.floor), [-1, 1, 3]);
    const visitor = await browser.newPage(); visitor.on('pageerror', (error) => errors.push(error.message));
    await visitor.goto(`${guestOrigin}/?token=${encodeURIComponent(session.token)}`);
    await expect(visitor.locator('[data-floor-transition]')).toHaveText('Floor -1 to 1 · stairs');
    await visitor.getByText('All directions', { exact: true }).click();
    await expect(visitor.locator('details')).toContainText('Floor 1 to 3 (elevator).');
    await visitor.getByRole('button', { name: 'Reached this landmark', exact: true }).click();
    await expect(visitor.locator('[data-floor-transition]')).toHaveText('Floor 1 to 3 · elevator');
    await visitor.getByRole('button', { name: 'I have arrived', exact: true }).click();
    await expect(visitor.locator('[data-screen="arrived"]')).toBeVisible();
    await page.getByLabel('Step 2 movement', { exact: true }).selectOption('ramp');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
    assert.equal(merchant.guestApi.fetchRoute(session.token).ok, false);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => merchant.close(() => resolve()));
    await new Promise<void>((resolve) => guest.close(() => resolve()));
  }
});
