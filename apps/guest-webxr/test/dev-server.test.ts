import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { createGuestWebxrDevServer } from '../dev-server.ts';

describe('guest WebXR dev server', () => {
  it('serves the browser shell and transpiles TypeScript modules', async () => {
    const server = createGuestWebxrDevServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      assert.ok(isAddressInfo(address));

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const [html, bootstrap, entry, routeCore] = await Promise.all([
        fetch(`${baseUrl}/`).then(async (response) => ({
          contentType: response.headers.get('content-type'),
          body: await response.text(),
        })),
        fetch(`${baseUrl}/src/entry/bootstrap.ts`).then(async (response) => ({
          contentType: response.headers.get('content-type'),
          body: await response.text(),
        })),
        fetch(`${baseUrl}/src/entry/index.ts`).then(async (response) => ({
          contentType: response.headers.get('content-type'),
          body: await response.text(),
        })),
        fetch(`${baseUrl}/packages/route-core/src/index.ts`).then(async (response) => ({
          contentType: response.headers.get('content-type'),
          body: await response.text(),
          status: response.status,
        })),
      ]);

      assert.match(html.contentType ?? '', /text\/html/);
      assert.match(html.body, /<lechigo-guest-entry data-guest-entry>/);
      assert.match(html.body, /src="\.\/src\/entry\/bootstrap\.ts"/);
      assert.match(bootstrap.contentType ?? '', /application\/javascript/);
      assert.doesNotMatch(bootstrap.body, /export type/);
      assert.match(bootstrap.body, /bootstrapGuestEntry/);
      assert.match(entry.contentType ?? '', /application\/javascript/);
      assert.doesNotMatch(entry.body, /export type/);
      assert.match(entry.body, /registerGuestEntryElement/);
      assert.equal(routeCore.status, 200);
      assert.match(routeCore.contentType ?? '', /application\/javascript/);
      assert.doesNotMatch(routeCore.body, /export type/);
      assert.match(routeCore.body, /createGuestSession/);
    } finally {
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
  });

  it('serves seeded pilot guest routes from the local API endpoint', async () => {
    const server = createGuestWebxrDevServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      assert.ok(isAddressInfo(address));

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const devSession = await fetch(`${baseUrl}/api/dev/guest-session`).then(
        async (response) => ({
          status: response.status,
          contentType: response.headers.get('content-type'),
          body: await response.json(),
        }),
      );

      assert.equal(devSession.status, 200);
      assert.match(devSession.contentType ?? '', /application\/json/);
      assert.equal(devSession.body.ok, true);
      assert.equal(typeof devSession.body.token, 'string');

      const guestRoute = await fetch(
        `${baseUrl}/api/guest/routes?token=${encodeURIComponent(devSession.body.token)}`,
      ).then(async (response) => ({
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: await response.json(),
      }));

      assert.equal(guestRoute.status, 200);
      assert.match(guestRoute.contentType ?? '', /application\/json/);
      assert.equal(guestRoute.body.ok, true);
      assert.equal(guestRoute.body.route.id, 'pilot-restroom-route');
      assert.equal('password' in guestRoute.body.route, false);
      assert.equal(guestRoute.body.route.anchors.at(0)?.id, 'entrance');
      assert.equal(guestRoute.body.route.anchors.at(-1)?.id, 'restroom');

      const invalidRoute = await fetch(
        `${baseUrl}/api/guest/routes?token=invalid-token`,
      ).then(async (response) => ({
        status: response.status,
        contentType: response.headers.get('content-type'),
        body: await response.json(),
      }));

      assert.equal(invalidRoute.status, 401);
      assert.match(invalidRoute.contentType ?? '', /application\/json/);
      assert.deepEqual(invalidRoute.body, {
        ok: false,
        status: 401,
        error: 'invalid-token',
      });
    } finally {
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
  });
});

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return address !== null && typeof address !== 'string';
}
