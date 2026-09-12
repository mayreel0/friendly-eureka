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
});

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return address !== null && typeof address !== 'string';
}
