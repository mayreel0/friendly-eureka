import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';

test('merchant actions work in a real browser and survive reload', async () => {
  const server = createMerchantAdminDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const screen = page.locator('[data-screen="pilot-route-recording"]');
    await expect(screen).toHaveAttribute('data-stage', 'empty');
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
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
