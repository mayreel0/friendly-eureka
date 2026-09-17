import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';

test('merchant adds and removes steps and guests follow the saved order', async () => {
  const merchant = createMerchantAdminDevServer();
  const guest = createGuestWebxrDevServer({ guestApi: merchant.guestApi });
  merchant.listen(0, '127.0.0.1'); await once(merchant, 'listening');
  guest.listen(0, '127.0.0.1'); await once(guest, 'listening');
  const merchantAddress = merchant.address(); const guestAddress = guest.address();
  assert.ok(merchantAddress && typeof merchantAddress !== 'string');
  assert.ok(guestAddress && typeof guestAddress !== 'string');
  const origin = `http://127.0.0.1:${merchantAddress.port}`;
  const guestOrigin = `http://127.0.0.1:${guestAddress.port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage(); page.setDefaultTimeout(5000);
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await page.locator('[data-action-id="record-route"]').first().click();
    await page.getByRole('button', { name: 'Add step', exact: true }).click();
    const instructions = ['Pass reception.', 'Turn left at the lift.', 'Open the restroom door.'];
    const landmarks = ['Reception', 'Lift lobby', 'Accessible restroom'];
    for (let index = 0; index < 3; index++) {
      await page.getByLabel(`Step ${index + 1} instruction`, { exact: true }).fill(instructions[index]);
      await page.getByLabel(`Step ${index + 1} distance (meters)`, { exact: true }).fill(String(index + 2));
      await page.getByLabel(`Step ${index + 1} landmark name`, { exact: true }).fill(landmarks[index]);
    }
    await expect(page.getByRole('button', { name: 'Move step 1 up', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move step 3 down', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Move step 2 up', exact: true }).click();
    [instructions[0], instructions[1]] = [instructions[1], instructions[0]];
    [landmarks[0], landmarks[1]] = [landmarks[1], landmarks[0]];
    await expect(page.getByLabel('Step 1 instruction', { exact: true })).toHaveValue('Turn left at the lift.');
    await expect(page.getByLabel('Step 1 landmark name', { exact: true })).toHaveValue('Lift lobby');
    await expect(page.getByLabel('Step 1 distance (meters)', { exact: true })).toHaveValue('3');
    await expect(page.getByLabel('Step 2 distance (meters)', { exact: true })).toHaveValue('2');
    await page.getByRole('button', { name: 'Move step 1 down', exact: true }).click();
    await expect(page.getByLabel('Step 1 landmark name', { exact: true })).toHaveValue('Reception');
    await page.getByRole('button', { name: 'Move step 2 up', exact: true }).click();
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Save route directions', exact: true })).toBeEnabled();
    await page.reload();
    await expect(page.getByLabel('Step 3 instruction', { exact: true })).toHaveValue(instructions[2]);
    await expect(page.getByLabel('Step 3 landmark name', { exact: true })).toHaveValue(landmarks[2]);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') await page.getByRole('region', { name: 'Route directions', exact: true }).screenshot({ path: `/tmp/lechigo-directions-${width}.png` });
    }
    await page.getByLabel('Route test note', { exact: true }).fill('Checked all three instructions.');
    await page.locator('[data-action-id="mark-test-passed"]').first().click();
    await page.locator('[data-action-id="activate-route"]').first().click();
    await expect(page.locator('a[data-entry-url]')).toBeVisible();
    const oldEntry = new URL((await page.locator('a[data-entry-url]').getAttribute('href'))!);
    const visitor = await browser.newPage(); visitor.on('pageerror', (error) => errors.push(error.message));
    await visitor.goto(`${guestOrigin}${oldEntry.pathname}`);
    for (let index = 0; index < 3; index++) {
      await expect(visitor.locator('[data-current-instruction]')).toHaveText(instructions[index]);
      await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(landmarks[index]);
      await expect(visitor.locator('[data-progress]')).toHaveText(`Step ${index + 1} of 3`);
      await visitor.getByRole('button', { name: index === 2 ? 'I have arrived' : 'Reached this landmark', exact: true }).click();
    }
    await expect(visitor.locator('[data-screen="arrived"]')).toBeVisible();
    await expect(visitor.locator('[data-screen="arrived"]')).toContainText('Accessible restroom');
    await page.getByRole('button', { name: 'Remove step 2', exact: true }).click();
    await expect(page.getByLabel('Step 2 instruction', { exact: true })).toHaveValue(instructions[2]);
    await page.getByRole('button', { name: 'Remove step 2', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Remove step 1', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
    assert.equal((await fetch(`${guestOrigin}${oldEntry.pathname}`)).status, 404);
    await expect(page.locator('[data-route-test-result]')).toContainText('retest required');
    await page.reload();
    await expect(page.getByLabel('Step 1 instruction', { exact: true })).toHaveValue(instructions[0]);
    await expect(page.getByLabel('Step 2 instruction', { exact: true })).toHaveCount(0);
    await page.getByLabel('Route test note', { exact: true }).fill('Checked the one-step route.');
    await page.locator('[data-action-id="mark-test-passed"]').first().click();
    await page.locator('[data-action-id="activate-route"]').first().click();
    await expect(page.locator('a[data-entry-url]')).toBeVisible();
    const singleEntry = new URL((await page.locator('a[data-entry-url]').getAttribute('href'))!);
    await visitor.goto(`${guestOrigin}${singleEntry.pathname}`);
    await expect(visitor.locator('[data-progress]')).toHaveText('Step 1 of 1');
    await expect(visitor.locator('[data-current-instruction]')).toHaveText(instructions[0]);
    await visitor.getByRole('button', { name: 'I have arrived', exact: true }).click();
    await expect(visitor.locator('[data-screen="arrived"]')).toBeVisible();
    await page.getByLabel('Step 1 landmark name', { exact: true }).fill('Restroom entrance');
    await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
    await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
    await expect(page.locator('[data-route-test-result]')).toContainText('retest required');
    assert.equal((await fetch(`${guestOrigin}${singleEntry.pathname}`)).status, 404);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise<void>((resolve) => merchant.close(() => resolve()));
    await new Promise<void>((resolve) => guest.close(() => resolve()));
  }
});
