import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';
import { chromium, expect } from '@playwright/test';

import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';
import { createMerchantAdminDevServer } from '../dev-server.ts';

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
      for (const stage of ['recorded', 'tested', 'active']) {
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
