import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createMerchantAdminDevServer } from '../dev-server.ts';

test('only a current-version passing result permits activation', async () => {
  const server = createMerchantAdminDevServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const post = (path: string, body: unknown) => fetch(`${origin}/api/dev/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const recording = (stage: string, extra = {}) => post('pilot-route-recording', { stage, routeId: 'pilot-restroom-route', ...extra });
  try {
    assert.equal((await recording('active')).status, 422);
    await recording('recorded');
    assert.equal((await post('pilot-route-test', { result: 'pass', note: '', routeVersion: 1 })).status, 400);
    const tested = await post('pilot-route-test', { result: 'pass', note: 'Walked both segments.', routeVersion: 1 });
    assert.equal(tested.status, 200);
    const state = await tested.json();
    assert.equal(state.recording.testResult.routeVersion, 1);
    assert.ok(Math.abs(Date.now() - Date.parse(state.recording.testResult.recordedAt)) < 10000);
    assert.equal((await recording('active')).status, 200);
    assert.equal((await post('pilot-route-test', { result: 'fail', note: 'Hallway blocked.', routeVersion: 1 })).status, 200);
    assert.equal((await recording('active', { testResult: state.recording.testResult })).status, 422);
    assert.equal((await fetch(`${origin}/api/dev/pilot-route-session`)).status, 409);
    await post('pilot-route-test', { result: 'pass', note: 'Hallway cleared.', routeVersion: 1 });
    const directions = [{ instruction: 'New first step.', distanceMeters: 5 }, { instruction: 'Turn right.', distanceMeters: 3 }];
    await recording('active', { directions });
    assert.equal((await post('pilot-route-test', { result: 'pass', note: 'Old version.', routeVersion: 1 })).status, 409);
    assert.equal((await recording('active', { directions })).status, 422);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
