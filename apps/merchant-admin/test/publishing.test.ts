import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPilotGuestApi } from '../pilot-guest-api.ts';

test('only an active saved pilot route can issue or serve guest sessions', () => {
  const api = createPilotGuestApi();
  for (const stage of ['empty', 'recorded', 'tested'] as const) {
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
