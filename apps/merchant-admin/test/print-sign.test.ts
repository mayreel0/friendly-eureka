import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { prepareTestedRoute } from './pilot-fixture.ts';
const jsQR = createRequire(import.meta.url)('jsqr') as typeof import('jsqr').default;

test('entrance sign prints the durable QR without consuming guest sessions', async () => {
  const server = createMerchantAdminDevServer();
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    assert.equal((await fetch(`${origin}/print/entrance`)).status, 409);
    await prepareTestedRoute(origin);
    await fetch(`${origin}/api/dev/pilot-route-recording`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: 'active', routeId: 'pilot-restroom-route' }) });
    const state = await (await fetch(`${origin}/api/dev/pilot-state`)).json();
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => { window.print = () => { document.documentElement.dataset.printRequested = 'true'; }; });
    await page.goto(origin);
    const opened = page.waitForEvent('popup');
    await page.getByRole('link', { name: 'Print entrance sign', exact: true }).click();
    const sign = await opened;
    sign.on('pageerror', (error) => errors.push(error.message));
    await sign.evaluate(() => { window.print = () => { document.documentElement.dataset.printRequested = 'true'; }; });
    await expect(sign.getByRole('heading', { name: 'Restroom directions' })).toBeVisible();
    const qr = sign.getByRole('img', { name: 'Entrance route QR code' });
    await expect(qr).toBeVisible();
    const pixels = await qr.evaluate(async (element) => {
      const image = element as HTMLImageElement; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
    });
    assert.equal(jsQR(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data, state.recording.entryUrl);
    for (const width of [390, 1280]) {
      await sign.setViewportSize({ width, height: 844 });
      assert.equal(await sign.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      if (process.env.LECHIGO_SCREENSHOTS === '1') await sign.screenshot({ path: `/tmp/lechigo-sign-${width}.png`, fullPage: true });
    }
    await sign.emulateMedia({ media: 'print' });
    await expect(sign.getByRole('button', { name: 'Print sign' })).toBeHidden();
    await expect(qr).toBeVisible();
    await sign.emulateMedia({ media: 'screen' });
    await sign.getByRole('button', { name: 'Print sign' }).click();
    assert.equal(await sign.locator('html').getAttribute('data-print-requested'), 'true');
    for (let index = 0; index < 5; index++) assert.equal(server.guestApi.issueSession().ok, true);
    assert.equal(server.guestApi.issueSession().ok, false);
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
