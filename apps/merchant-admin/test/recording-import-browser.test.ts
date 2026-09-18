import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';

test('merchant selects a recording, confirms replacement and previews imported guidance', async () => {
  const merchant = createMerchantAdminDevServer();
  const guest = createGuestWebxrDevServer({ guestApi: merchant.guestApi });
  merchant.listen(0, '127.0.0.1'); await once(merchant, 'listening');
  guest.listen(0, '127.0.0.1'); await once(guest, 'listening');
  const address = merchant.address(); const guestAddress = guest.address();
  assert.ok(address && typeof address !== 'string'); assert.ok(guestAddress && typeof guestAddress !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const fixture = await readFile(new URL('../../../packages/route-core/test/fixtures/android-recording.json', import.meta.url));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    const input = page.getByLabel('Android recording JSON', { exact: true });
    await input.setInputFiles({ name: 'walk.json', mimeType: 'application/json', buffer: fixture });
    await expect(page.locator('[data-recording-preview]')).toContainText('2 steps');
    const map = page.getByRole('img', { name: 'Recorded path, top view' });
    await expect(map).toBeVisible();
    await expect(map.locator('[data-route-line]')).toHaveAttribute('points', /\d/);
    await expect(map.locator('[data-landmark-marker]')).toHaveCount(3);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      const box = await map.boundingBox();
      assert.ok(box && box.width > 200 && box.height > 100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') await page.getByRole('region', { name: 'Recorded route', exact: true }).screenshot({ path: `/tmp/lechigo-path-${width}.png` });
    }
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'empty');
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
    await expect(page.getByLabel('Step 1 landmark name', { exact: true })).toHaveValue('Reception');
    await expect(page.locator('[data-recording-source]')).toContainText('Manual guidance');
    await page.reload();
    await expect(page.getByLabel('Step 2 instruction', { exact: true })).toHaveValue('Turn left to the restroom.');
    await input.setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(page.getByRole('alert')).toContainText('Invalid Android');
    await expect(page.getByRole('button', { name: 'Import as new draft', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Step 1 landmark name', { exact: true })).toHaveValue('Reception');
    await input.setInputFiles({ name: 'walk.json', mimeType: 'application/json', buffer: fixture });
    const getState = async () => (await (await fetch(`${origin}/api/dev/pilot-state`)).json());
    await page.getByLabel('Step 1 instruction', { exact: true }).fill('Temporary edit.');
    await page.getByLabel('Step 1 instruction', { exact: true }).fill('Walk to reception.');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Import as new draft', exact: true })).toBeEnabled();
    let confirmationShown = false;
    page.once('dialog', async (dialog) => { confirmationShown = true; await dialog.dismiss(); });
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    assert.equal(confirmationShown, true, 'saving reverted edits must unblock import');
    await page.getByLabel('Step 1 instruction', { exact: true }).fill('Edited before importing.');
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Save your route direction edits');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import as new draft', exact: true })).toBeEnabled();
    const version = (await getState()).recording.routeVersion;
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    assert.equal((await getState()).recording.routeVersion, version);
    const current = await getState();
    await fetch(`${origin}/api/dev/pilot-state`, { method: 'POST',
      headers: { 'content-type': 'application/json', 'x-pilot-revision': current.revision }, body: JSON.stringify(current) });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Saved state changed');
    assert.equal((await getState()).recording.routeVersion, version);
    await page.getByRole('button', { name: 'Load latest state', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('[data-recording-preview]')).toContainText('2 steps');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Import as new draft', exact: true }).click();
    await expect(page.locator('[data-recording-preview]')).toHaveCount(0);
    assert.equal((await getState()).recording.routeVersion, version + 1);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') await page.getByRole('region', { name: 'Recorded route', exact: true }).screenshot({ path: `/tmp/lechigo-import-${width}.png` });
    }
    await page.locator('[data-action-id="preview-route"]').first().click();
    await expect(page.locator('a[data-preview-url]')).toBeVisible();
    const previewUrl = new URL((await page.locator('a[data-preview-url]').getAttribute('href'))!);
    const visitor = await browser.newPage(); visitor.on('pageerror', (error) => errors.push(error.message));
    await visitor.goto(`http://127.0.0.1:${guestAddress.port}/${previewUrl.search}`);
    await expect(visitor.locator('[data-screen="manual-fallback"]')).toContainText('Walk to reception.');
    await visitor.getByRole('button', { name: 'Reached this landmark', exact: true }).click();
    await expect(visitor.locator('[data-screen="manual-fallback"]')).toContainText('Turn left to the restroom.');
    await visitor.getByRole('button', { name: 'I have arrived', exact: true }).click();
    await expect(visitor.locator('[data-screen="arrived"]')).toBeVisible();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => merchant.close(() => resolve()));
    await new Promise<void>((resolve) => guest.close(() => resolve()));
  }
});
