import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildActivationChecklist,
  createPilotRouteRecordingUiState,
  applyPilotRouteRecordingUiAction,
  renderPilotRouteRecordingUi,
  recordPilotRestroomRoute,
  merchantAdminSurface,
  resolveMerchantRouteActions,
} from '../src/index.ts';
import {
  createApiContext,
  fetchGuestRoute,
} from '../../api/src/server.ts';

const route = {
  id: 'route-1',
  storeId: 'store-1',
  version: 1,
  status: 'recorded',
  recordedAt: '2026-09-01T09:00:00.000Z',
  anchors: [],
  segments: [],
} as const;

describe('merchant admin workflow surface', () => {
  it('identifies the merchant admin package surface', () => {
    assert.equal(merchantAdminSurface(), 'merchant-admin');
  });

  it('keeps activation blocked until a successful route test exists', () => {
    assert.deepEqual(resolveMerchantRouteActions(route), {
      canRecord: true,
      canRunTest: true,
      canActivate: false,
      canRotatePassword: true,
      blockingReason: 'route-not-tested',
    });
  });

  it('allows activation for tested routes and preserves password-only rotation', () => {
    assert.deepEqual(
      resolveMerchantRouteActions({
        ...route,
        status: 'tested',
        testedAt: '2026-09-01T09:10:00.000Z',
        passwordUpdatedAt: '2026-09-01T10:00:00.000Z',
        passwordRetestRequired: false,
      }),
      {
        canRecord: true,
        canRunTest: true,
        canActivate: true,
        canRotatePassword: true,
        blockingReason: undefined,
      },
    );
  });

  it('summarizes pilot-readiness checklist items for staff setup', () => {
    assert.deepEqual(
      buildActivationChecklist({
        hasRecordedRoute: true,
        hasPassingTestRun: true,
        hasQrPlacement: false,
        hasStaffFallbackNote: true,
      }),
      [
        { id: 'record-route', complete: true },
        { id: 'test-route', complete: true },
        { id: 'place-qr', complete: false },
        { id: 'staff-fallback-note', complete: true },
      ],
    );
  });

  it('records the pilot restroom route and returns a guest-loadable session', () => {
    const api = createApiContext({
      signingSecret: 'local-dev-pilot-secret',
      now: () => '2026-09-01T10:00:00.000Z',
    });

    const recording = recordPilotRestroomRoute(api);

    assert.equal(recording.store.id, 'pilot-store');
    assert.equal(recording.route.id, 'pilot-restroom-route');
    assert.equal(recording.route.status, 'active');
    assert.equal(recording.route.anchors.at(0)?.id, 'entrance');
    assert.equal(recording.route.anchors.at(-1)?.id, 'restroom');
    assert.equal(typeof recording.qrKey, 'string');
    assert.equal(typeof recording.token, 'string');
    assert.equal(recording.launchUrl, `/?token=${encodeURIComponent(recording.token)}`);

    const guestRoute = fetchGuestRoute(api, { token: recording.token });

    assert.ok(guestRoute.ok);
    assert.equal(guestRoute.route.id, 'pilot-restroom-route');
    assert.equal(guestRoute.route.totalDistanceMeters, 8.2);
    assert.equal('password' in guestRoute.route, false);
  });

  it('surfaces the pilot recording steps as actionable UI state', () => {
    const api = createApiContext({
      signingSecret: 'local-dev-pilot-secret',
      now: () => '2026-09-01T10:00:00.000Z',
    });
    let state = createPilotRouteRecordingUiState(api);

    assert.deepEqual(renderPilotRouteRecordingUi(state), {
      screen: 'pilot-route-recording',
      stage: 'empty',
      title: 'Pilot route recording',
      status: 'Route not recorded',
      routeId: undefined,
      launchUrl: undefined,
      actions: [
        { id: 'record-route', label: 'Record route', enabled: true },
        { id: 'mark-test-passed', label: 'Mark test passed', enabled: false },
        { id: 'activate-route', label: 'Activate route', enabled: false },
        { id: 'generate-guest-url', label: 'Generate guest URL', enabled: false },
      ],
    });

    state = applyPilotRouteRecordingUiAction(state, 'record-route');
    assert.equal(renderPilotRouteRecordingUi(state).stage, 'recorded');
    assert.equal(renderPilotRouteRecordingUi(state).actions.at(1)?.enabled, true);

    state = applyPilotRouteRecordingUiAction(state, 'mark-test-passed');
    assert.equal(renderPilotRouteRecordingUi(state).stage, 'tested');
    assert.equal(renderPilotRouteRecordingUi(state).actions.at(2)?.enabled, true);

    state = applyPilotRouteRecordingUiAction(state, 'activate-route');
    assert.equal(renderPilotRouteRecordingUi(state).stage, 'active');
    assert.equal(renderPilotRouteRecordingUi(state).actions.at(3)?.enabled, true);

    state = applyPilotRouteRecordingUiAction(state, 'generate-guest-url');
    const view = renderPilotRouteRecordingUi(state);

    assert.equal(view.stage, 'launch-ready');
    assert.equal(view.status, 'Guest URL ready');
    assert.equal(view.routeId, 'pilot-restroom-route');
    assert.match(view.launchUrl ?? '', /^\/\?token=.+/);

    const guestRoute = fetchGuestRoute(api, {
      token: view.launchUrl?.replace('/?token=', '') ?? '',
    });

    assert.ok(guestRoute.ok);
    assert.equal(guestRoute.route.id, 'pilot-restroom-route');
  });
});
