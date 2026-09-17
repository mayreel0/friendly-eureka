import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { createGuestWebxrDevServer } from '../../guest-webxr/dev-server.ts';
import { prepareTestedRoute } from './pilot-fixture.ts';

async function start(file: string) {
  const merchant = createMerchantAdminDevServer({ stateFile: file });
  const guest = createGuestWebxrDevServer({ guestApi: merchant.guestApi });
  const listen = async (server: typeof guest) => {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  return { merchant: await listen(merchant), guest: await listen(guest),
    close: () => Promise.all([merchant, guest].map((server) => new Promise<void>((resolve) => server.close(() => resolve())))) };
}

test('printed entry QR survives restart and pause but is revoked by route editing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-entry-qr-'));
  const file = join(directory, 'state.json');
  let running = await start(file);
  const post = (stage: string, extra = {}) => fetch(`${running.merchant}/api/dev/pilot-route-recording`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage, routeId: 'pilot-restroom-route', ...extra }),
  });
  try {
    await prepareTestedRoute(running.merchant);
    await post('active');
    const state = await (await fetch(`${running.merchant}/api/dev/pilot-state`)).json();
    assert.equal(typeof state.recording.entryUrl, 'string');
    const path = new URL(state.recording.entryUrl).pathname;
    const scan = () => fetch(`${running.guest}${path}`, { redirect: 'manual' });
    const first = await scan();
    assert.equal(first.status, 303);
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const firstToken = new URL(first.headers.get('location')!, running.guest).searchParams.get('token');
    assert.ok(firstToken);
    for (let index = 0; index < 4; index++) assert.equal((await scan()).status, 303);
    const limited = await scan();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '60');
    await running.close(); running = await start(file);
    assert.equal((await scan()).status, 303);
    assert.equal((await fetch(`${running.guest}/api/guest/routes?token=${encodeURIComponent(firstToken)}`)).status, 401);
    await post('paused');
    const paused = await scan();
    assert.equal(paused.status, 409);
    assert.match(await paused.text(), /Ask staff/);
    await post('active');
    assert.equal((await scan()).status, 303);
    await post('active', { directions: [{ instruction: 'New way.', distanceMeters: 5 }, { instruction: 'Turn.', distanceMeters: 2 }] });
    assert.equal((await scan()).status, 404);
    assert.equal((await fetch(`${running.guest}/q/invalid`, { redirect: 'manual' })).status, 404);
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});
