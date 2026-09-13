import assert from 'node:assert/strict';
import { type AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { createMerchantAdminDevServer } from '../dev-server.ts';

describe('merchant admin dev server', () => {
  it('serves the browser shell and transpiles TypeScript modules', async () => {
    const server = createMerchantAdminDevServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      assert.ok(isAddressInfo(address));

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const shell = await fetch(`${baseUrl}/`);

      assert.equal(shell.status, 200);
      assert.match(await shell.text(), /lechigo-merchant-admin/);

      const entry = await fetch(`${baseUrl}/src/entry/bootstrap.ts`);

      assert.equal(entry.status, 200);
      assert.match(entry.headers.get('content-type') ?? '', /application\/javascript/);
      assert.match(await entry.text(), /registerMerchantAdminElement/);

      const session = await fetch(`${baseUrl}/api/dev/pilot-route-session`);
      const body = await session.json() as { launchUrl?: string };

      assert.equal(session.status, 200);
      assert.match(session.headers.get('content-type') ?? '', /application\/json/);
      assert.match(body.launchUrl ?? '', /^http:\/\/127\.0\.0\.1:4173\/\?token=/);
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
  return typeof address === 'object' && address !== null && 'port' in address;
}
