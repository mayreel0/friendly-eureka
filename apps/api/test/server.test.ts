import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activateRoute,
  createApiContext,
  createQrSession,
  createWifiSession,
  fetchGuestRoute,
  fetchPassword,
  health,
  recordTestRun,
  registerStore,
  rotatePassword,
  saveRouteDraft,
} from '../src/server.ts';

const merchant = {
  id: 'merchant-1',
  storeIds: ['store-1'],
  role: 'merchant',
} as const;

const outsider = {
  id: 'merchant-2',
  storeIds: ['store-2'],
  role: 'merchant',
} as const;

const routeDraft = {
  id: 'route-1',
  version: 1,
  recordedAt: '2026-09-01T09:00:00.000Z',
  anchors: [
    {
      id: 'entrance',
      label: 'Entrance',
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      type: 'start',
    },
    {
      id: 'restroom',
      label: 'Restroom',
      floor: 1,
      position: { x: 7, y: 0, z: 2 },
      type: 'destination',
    },
  ],
  segments: [
    {
      id: 'segment-1',
      fromAnchorId: 'entrance',
      toAnchorId: 'restroom',
      instruction: 'Follow the hallway to the restroom.',
      distanceMeters: 7.4,
    },
  ],
} as const;

describe('api service contracts', () => {
  it('reports health without exposing configuration details', () => {
    assert.deepEqual(health(), { ok: true, service: 'lechigo-api' });
  });

  it('enforces merchant store ownership for route writes', () => {
    const api = createSeededContext();

    assert.deepEqual(
      saveRouteDraft(api, {
        merchant: outsider,
        storeId: 'store-1',
        route: routeDraft,
      }),
      { ok: false, status: 403, error: 'store-forbidden' },
    );

    const saved = saveRouteDraft(api, {
      merchant,
      storeId: 'store-1',
      route: routeDraft,
    });

    assert.equal(saved.ok, true);
    assert.equal(saved.route?.status, 'recorded');
  });

  it('requires a successful route test before activation and guest QR exposure', () => {
    const api = createSeededContext();
    saveRouteDraft(api, { merchant, storeId: 'store-1', route: routeDraft });

    assert.deepEqual(
      activateRoute(api, {
        merchant,
        storeId: 'store-1',
        routeId: 'route-1',
      }),
      { ok: false, status: 409, error: 'route-not-tested' },
    );

    recordTestRun(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
      testedAt: '2026-09-01T09:10:00.000Z',
      result: 'pass',
    });

    const activation = activateRoute(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    assert.equal(activation.ok, true);

    const session = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      issuedAt: '2026-09-01T10:00:00.000Z',
      qrNonce: 'qr-nonce-1',
    });
    assert.equal(session.ok, true);

    const guestRoute = fetchGuestRoute(api, {
      token: session.token ?? '',
      at: '2026-09-01T10:01:00.000Z',
    });

    assert.equal(guestRoute.ok, true);
    assert.equal(guestRoute.route?.id, 'route-1');
    assert.equal('password' in (guestRoute.route ?? {}), false);
  });

  it('rejects expired, tampered, and replayed QR session tokens', () => {
    const api = createActiveRouteContext();
    const session = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      issuedAt: '2026-09-01T10:00:00.000Z',
      qrNonce: 'qr-nonce-1',
    });
    assert.equal(session.ok, true);

    assert.deepEqual(
      fetchGuestRoute(api, {
        token: `${session.token}tampered`,
        at: '2026-09-01T10:01:00.000Z',
      }),
      { ok: false, status: 401, error: 'invalid-token' },
    );

    assert.deepEqual(
      fetchGuestRoute(api, {
        token: session.token ?? '',
        at: '2026-09-01T10:11:00.001Z',
      }),
      { ok: false, status: 401, error: 'token-expired' },
    );

    const rotatedSession = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      issuedAt: '2026-09-01T10:02:00.000Z',
      qrNonce: 'qr-nonce-2',
    });
    assert.equal(rotatedSession.ok, true);

    assert.deepEqual(
      fetchGuestRoute(api, {
        token: session.token ?? '',
        at: '2026-09-01T10:03:00.000Z',
      }),
      { ok: false, status: 401, error: 'qr-session-rotated' },
    );
  });

  it('allows password access only from valid Wi-Fi proof and redacts logs', () => {
    const api = createActiveRouteContext();
    rotatePassword(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
      password: '2468',
      updatedAt: '2026-09-01T10:30:00.000Z',
    });

    const denied = createWifiSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      issuedAt: '2026-09-01T10:32:00.000Z',
      wifiProof: {
        storeId: 'store-2',
        verifiedAt: '2026-09-01T10:31:00.000Z',
      },
    });
    assert.deepEqual(denied, {
      ok: false,
      status: 403,
      error: 'wifi-proof-store-mismatch',
    });

    const allowed = createWifiSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      issuedAt: '2026-09-01T10:32:00.000Z',
      wifiProof: {
        storeId: 'store-1',
        verifiedAt: '2026-09-01T10:31:00.000Z',
      },
    });
    assert.equal(allowed.ok, true);

    assert.deepEqual(
      fetchPassword(api, {
        token: allowed.token ?? '',
        at: '2026-09-01T10:33:00.000Z',
      }),
      { ok: true, password: '2468' },
    );

    assert.deepEqual(api.auditLog.at(-1), {
      event: 'password.read',
      storeId: 'store-1',
      routeId: 'route-1',
      source: 'wifi',
      password: '[redacted]',
    });
  });
});

function createSeededContext() {
  const api = createApiContext({ signingSecret: 'unit-test-secret' });
  registerStore(api, {
    id: 'store-1',
    merchantId: 'merchant-1',
    name: 'Cafe Test',
    restroomPassword: '1357',
  });
  return api;
}

function createActiveRouteContext() {
  const api = createSeededContext();
  saveRouteDraft(api, { merchant, storeId: 'store-1', route: routeDraft });
  recordTestRun(api, {
    merchant,
    storeId: 'store-1',
    routeId: 'route-1',
    testedAt: '2026-09-01T09:10:00.000Z',
    result: 'pass',
  });
  activateRoute(api, { merchant, storeId: 'store-1', routeId: 'route-1' });
  return api;
}
