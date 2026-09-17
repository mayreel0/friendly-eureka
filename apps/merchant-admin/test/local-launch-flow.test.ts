import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { chromium, expect } from '@playwright/test';

import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { prepareTestedRoute } from './pilot-fixture.ts';

describe('local merchant admin to guest WebXR launch flow', () => {
  it('connects real administrator actions to guest landmark arrival', async () => {
    const guestServer = createGuestWebxrDevServer({ guestApi: {
      issueSession: () => merchantServer.guestApi.issueSession(),
      fetchRoute: (token) => merchantServer.guestApi.fetchRoute(token),
    } });
    await listen(guestServer);
    const merchantServer = createMerchantAdminDevServer({ guestOrigin: serverBaseUrl(guestServer) });
    await listen(merchantServer);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(5000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(serverBaseUrl(merchantServer));
      for (const action of ['record-route', 'mark-test-passed', 'activate-route', 'mark-qr-placed', 'mark-staff-fallback-ready', 'generate-guest-url']) {
        if (action === 'mark-test-passed') await page.getByRole('textbox', { name: 'Route test note', exact: true }).fill('Walked both segments.');
        await page.locator(`[data-action-id="${action}"]`).first().click();
      }
      await expect(page.locator('a[data-launch-url]')).toBeVisible();
      const url = await page.locator('a[data-launch-url]').getAttribute('href');
      assert.ok(url);
      await page.goto(url);
      await expect(page.locator('[data-current-instruction]')).toContainText('main hallway');
      await page.getByRole('button', { name: 'Reached this landmark' }).click();
      await page.getByRole('button', { name: 'I have arrived' }).click();
      await expect(page.locator('[data-screen="arrived"]')).toBeVisible();
      await page.goto(serverBaseUrl(merchantServer));
      const pause = page.getByRole('button', { name: 'Pause guest access', exact: true });
      await page.route('**/api/dev/pilot-state', async (route) => {
        if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { error: 'unavailable' } });
        else await route.continue();
      });
      await pause.click();
      await expect(page.getByRole('alert')).toContainText('Could not save');
      const oldToken = new URL(url).searchParams.get('token')!;
      const routeUrl = `${serverBaseUrl(guestServer)}/api/guest/routes?token=${encodeURIComponent(oldToken)}`;
      assert.equal((await fetch(routeUrl)).status, 200);
      await page.unroute('**/api/dev/pilot-state');
      await pause.click();
      await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'paused');
      await expect(page.locator('a[data-launch-url]')).toHaveCount(0);
      assert.equal((await fetch(routeUrl)).status, 403);
      assert.equal((await fetch(`${serverBaseUrl(guestServer)}/api/dev/guest-session`)).status, 409);
      await page.reload();
      await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'paused');
      await page.getByRole('button', { name: 'Resume guest access', exact: true }).first().click();
      await page.locator('[data-action-id="generate-guest-url"]').first().click();
      await expect(page.locator('a[data-launch-url]')).toBeVisible();
      assert.equal((await fetch(routeUrl)).status, 401);
      const resumedUrl = await page.locator('a[data-launch-url]').getAttribute('href');
      assert.ok(resumedUrl);
      await page.goto(resumedUrl);
      await expect(page.locator('[data-current-instruction]')).toContainText('main hallway');
      await page.goto(serverBaseUrl(merchantServer));
      await page.getByRole('textbox', { name: 'Step 1 instruction', exact: true }).fill('Walk past the reception desk.');
      await page.getByRole('spinbutton', { name: 'Step 1 distance (meters)', exact: true }).fill('12.5');
      await page.route('**/api/dev/pilot-state', async (route) => {
        if (route.request().method() === 'POST') await route.fulfill({ status: 500, json: { error: 'unavailable' } });
        else await route.continue();
      });
      await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Could not save');
      await expect(page.getByRole('textbox', { name: 'Step 1 instruction', exact: true })).toHaveValue('Walk past the reception desk.');
      await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'launch-ready');
      await page.unroute('**/api/dev/pilot-state');
      await page.getByRole('button', { name: 'Save route directions', exact: true }).click();
      await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
      const resumedToken = new URL(resumedUrl).searchParams.get('token')!;
      assert.equal((await fetch(`${serverBaseUrl(guestServer)}/api/guest/routes?token=${encodeURIComponent(resumedToken)}`)).status, 403);
      await page.reload();
      await expect(page.getByRole('textbox', { name: 'Step 1 instruction', exact: true })).toHaveValue('Walk past the reception desk.');
      await page.route('**/api/dev/pilot-route-preview', (route) => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
      await page.getByRole('button', { name: 'Preview route', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Could not create a route preview');
      await expect(page.locator('[data-screen]')).toHaveAttribute('data-stage', 'recorded');
      await page.unroute('**/api/dev/pilot-route-preview');
      await page.getByRole('button', { name: 'Preview route', exact: true }).click();
      const openedPreview = page.waitForEvent('popup');
      await page.getByRole('link', { name: 'Open route preview', exact: true }).click();
      const preview = await openedPreview;
      preview.on('pageerror', (error) => errors.push(error.message));
      await expect(preview.locator('[data-route-preview]')).toContainText('not a published guest link');
      await expect(preview.locator('[data-current-instruction]')).toHaveText('Walk past the reception desk.');
      assert.equal((await fetch(`${serverBaseUrl(guestServer)}/api/dev/guest-session`)).status, 409);
      assert.equal((await fetch(`${serverBaseUrl(guestServer)}/api/dev/pilot-route-preview`)).status, 404);
      await preview.close();
      for (const action of ['mark-test-passed', 'activate-route', 'generate-guest-url']) {
        if (action === 'mark-test-passed') await page.getByRole('textbox', { name: 'Route test note', exact: true }).fill('Walked the edited route.');
        await page.locator(`[data-action-id="${action}"]`).first().click();
      }
      await expect(page.locator('a[data-launch-url]')).toBeVisible();
      const editedUrl = await page.locator('a[data-launch-url]').getAttribute('href');
      assert.ok(editedUrl);
      const editedToken = new URL(editedUrl).searchParams.get('token')!;
      const editedRoute = await (await fetch(`${serverBaseUrl(guestServer)}/api/guest/routes?token=${encodeURIComponent(editedToken)}`)).json();
      assert.equal(editedRoute.route.version, 2);
      assert.equal(editedRoute.route.totalDistanceMeters, 16.7);
      await page.goto(editedUrl);
      await expect(page.locator('[data-current-instruction]')).toHaveText('Walk past the reception desk.');
      await expect(page.locator('[data-route-preview]')).toHaveCount(0);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
      await Promise.all([close(merchantServer), close(guestServer)]);
    }
  });

  it('generates a guest launch URL whose token loads the seeded route', async () => {
    const guestServer = createGuestWebxrDevServer({ guestApi: {
      issueSession: () => merchantServer.guestApi.issueSession(),
      fetchRoute: (token) => merchantServer.guestApi.fetchRoute(token),
    } });
    await listen(guestServer);

    const guestBaseUrl = serverBaseUrl(guestServer);
    const merchantServer = createMerchantAdminDevServer({
      guestOrigin: guestBaseUrl,
    });
    await listen(merchantServer);

    try {
      const merchantBaseUrl = serverBaseUrl(merchantServer);
      assert.equal((await fetch(`${merchantBaseUrl}/api/dev/pilot-route-session`)).status, 409);
      assert.equal((await fetch(`${guestBaseUrl}/api/dev/guest-session`)).status, 409);
      await prepareTestedRoute(merchantBaseUrl);
      for (const stage of ['active']) {
        const saved = await fetch(`${merchantBaseUrl}/api/dev/pilot-route-recording`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stage, routeId: 'pilot-restroom-route' }),
        });
        assert.equal(saved.status, 200);
      }
      const session = await fetch(
        `${merchantBaseUrl}/api/dev/pilot-route-session`,
      ).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as {
          expiresAt?: string;
          launchUrl?: string;
          token?: string;
        },
      }));

      assert.equal(session.status, 200);
      assert.equal(typeof session.body.launchUrl, 'string');
      assert.equal(typeof session.body.token, 'string');

      const launchUrlValue = session.body.launchUrl;
      const token = session.body.token;
      assert.ok(launchUrlValue);
      assert.ok(token);

      const launchUrl = new URL(launchUrlValue);
      assert.equal(launchUrl.origin, guestBaseUrl);
      assert.equal(launchUrl.searchParams.get('token'), token);

      const route = await fetch(
        `${guestBaseUrl}/api/guest/routes?token=${encodeURIComponent(
          launchUrl.searchParams.get('token') ?? '',
        )}`,
      ).then(async (response) => ({
        status: response.status,
        body: (await response.json()) as {
          ok: boolean;
          route?: { id?: string };
          session?: {
            source?: string;
            expiresAt?: string;
            canViewPassword?: boolean;
          };
        },
      }));

      assert.equal(route.status, 200);
      assert.equal(route.body.ok, true);
      assert.equal(route.body.route?.id, 'pilot-restroom-route');
      assert.deepEqual(route.body.session, {
        source: 'qr',
        expiresAt: session.body.expiresAt,
        canViewPassword: false,
      });
      await fetch(`${merchantBaseUrl}/api/dev/pilot-route-recording`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stage: 'recorded', routeId: 'pilot-restroom-route' }),
      });
      assert.equal((await fetch(`${guestBaseUrl}/api/guest/routes?token=${encodeURIComponent(token)}`)).status, 403);
    } finally {
      await Promise.all([close(merchantServer), close(guestServer)]);
    }
  });
});

async function listen(server: Server) {
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
}

function serverBaseUrl(server: Server) {
  const address = server.address();
  assert.ok(isAddressInfo(address));

  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error: Error | undefined) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null && 'port' in address;
}
