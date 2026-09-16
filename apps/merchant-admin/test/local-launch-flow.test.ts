import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';
import { createMerchantAdminDevServer } from '../dev-server.ts';

describe('local merchant admin to guest WebXR launch flow', () => {
  it('generates a guest launch URL whose token loads the seeded route', async () => {
    const guestServer = createGuestWebxrDevServer();
    await listen(guestServer);

    const guestBaseUrl = serverBaseUrl(guestServer);
    const merchantServer = createMerchantAdminDevServer({
      guestOrigin: guestBaseUrl,
    });
    await listen(merchantServer);

    try {
      const merchantBaseUrl = serverBaseUrl(merchantServer);
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
