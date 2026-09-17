import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPilotGuestApi } from '../pilot-guest-api.ts';

test('only an active saved pilot route can issue or serve guest sessions', () => {
  const api = createPilotGuestApi();
  for (const stage of ['empty', 'recorded', 'tested', 'paused'] as const) {
    api.setRecording({ stage, routeId: 'pilot-restroom-route' });
    assert.deepEqual(api.issueSession(), { ok: false, status: 409, error: 'pilot-route-not-active' });
    assert.equal(api.fetchRoute('anything').ok, false);
  }
  api.setRecording({ stage: 'active', routeId: 'pilot-restroom-route' });
  const session = api.issueSession();
  assert.ok(session.ok);
  assert.equal(api.fetchRoute(session.token).ok, true);
  api.setRecording({ stage: 'launch-ready', routeId: 'pilot-restroom-route' });
  assert.equal(api.fetchRoute(session.token).ok, true);
  api.setRecording({ stage: 'recorded', routeId: 'pilot-restroom-route' });
  assert.equal(api.fetchRoute(session.token).ok, false);
  api.setRecording({ stage: 'active', routeId: 'pilot-restroom-route' });
  assert.equal(api.fetchRoute(session.token).ok, false);
  api.setRecording({ stage: 'active', routeId: 'unknown-route' });
  assert.equal(api.issueSession().ok, false);
});

test('pilot sessions use the clock, expire, and retain issuance rate limits', () => {
  let now = '2026-09-17T10:00:00.000Z';
  const api = createPilotGuestApi({ now: () => now });
  api.setRecording({ stage: 'active', routeId: 'pilot-restroom-route' });
  const session = api.issueSession();
  assert.ok(session.ok);
  assert.equal(session.expiresAt, '2026-09-17T10:20:00.000Z');
  for (let index = 0; index < 4; index++) assert.equal(api.issueSession().ok, true);
  const limited = api.issueSession();
  assert.ok(!limited.ok);
  assert.equal(limited.status, 429);
  now = '2026-09-17T10:21:00.000Z';
  assert.equal(api.fetchRoute(session.token).ok, false);
  assert.equal(api.issueSession().ok, true);
});

test('merchant previews work before activation without opening public guest access', () => {
  let now = '2026-09-17T10:00:00.000Z';
  const preview = createPilotGuestApi({ preview: true, now: () => now });
  const published = createPilotGuestApi({ now: () => now });
  const recording = { stage: 'recorded' as const, routeId: 'pilot-restroom-route' };
  preview.setRecording(recording);
  published.setRecording(recording);
  const session = preview.issueSession();
  assert.ok(session.ok);
  const route = preview.fetchRoute(session.token);
  assert.ok(route.ok);
  assert.equal(route.preview, true);
  assert.equal(published.issueSession().ok, false);
  assert.equal(published.fetchRoute(session.token).ok, false);
  now = '2026-09-17T10:21:00.000Z';
  assert.equal(preview.fetchRoute(session.token).ok, false);
  const renewed = preview.issueSession();
  assert.ok(renewed.ok);
  preview.setRecording({ ...recording, stage: 'paused' });
  assert.equal(preview.fetchRoute(renewed.token).ok, false);
  const beforeEdit = preview.issueSession();
  assert.ok(beforeEdit.ok);
  preview.setRecording({ ...recording, directions: [
    { instruction: 'Use the corridor.', distanceMeters: 5 },
    { instruction: 'Turn left.', distanceMeters: 2 },
  ], routeVersion: 2 });
  assert.equal(preview.fetchRoute(beforeEdit.token).ok, false);
});
