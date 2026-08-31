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
  issueQrCredential,
  issueWifiProof,
  recordTestRun,
  registerStore,
  rotatePassword,
  saveRouteDraft,
  setApiNow,
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

    assert.ok(saved.ok);
    assert.equal(saved.route.status, 'recorded');
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
    assert.ok(activation.ok);

    const qr = issueQrCredential(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    assert.ok(qr.ok);
    setApiNow(api, '2026-09-01T10:00:00.000Z');
    const session = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      qrKey: qr.qrKey,
    });
    assert.ok(session.ok);

    setApiNow(api, '2026-09-01T10:01:00.000Z');
    const guestRoute = fetchGuestRoute(api, {
      token: session.token,
    });

    assert.ok(guestRoute.ok);
    assert.equal(guestRoute.route.id, 'route-1');
    assert.equal('password' in guestRoute.route, false);
  });

  it('rejects guessed, expired, tampered, and replayed QR session tokens', () => {
    const api = createActiveRouteContext();
    const qr = issueQrCredential(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    assert.ok(qr.ok);

    assert.deepEqual(
      createQrSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        qrKey: 'guessed-route-key',
      }),
      { ok: false, status: 401, error: 'invalid-qr-key' },
    );

    setApiNow(api, '2026-09-01T10:00:00.000Z');
    const session = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      qrKey: qr.qrKey,
    });
    assert.ok(session.ok);

    setApiNow(api, '2026-09-01T10:01:00.000Z');
    assert.deepEqual(
      fetchGuestRoute(api, {
        token: `${session.token}tampered`,
      }),
      { ok: false, status: 401, error: 'invalid-token' },
    );

    setApiNow(api, '2026-09-01T10:20:00.001Z');
    assert.deepEqual(
      fetchGuestRoute(api, {
        token: session.token,
      }),
      { ok: false, status: 401, error: 'token-expired' },
    );

    setApiNow(api, '2026-09-01T10:02:00.000Z');
    const rotatedSession = createQrSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      qrKey: qr.qrKey,
    });
    assert.ok(rotatedSession.ok);

    setApiNow(api, '2026-09-01T10:03:00.000Z');
    assert.deepEqual(
      fetchGuestRoute(api, {
        token: session.token,
      }),
      { ok: false, status: 401, error: 'qr-session-rotated' },
    );
  });

  it('rate-limits repeated QR session creation for a copied key', () => {
    const api = createActiveRouteContext();
    const qr = issueQrCredential(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    assert.ok(qr.ok);
    setApiNow(api, '2026-09-01T10:00:00.000Z');

    for (let index = 0; index < 5; index += 1) {
      assert.equal(
        createQrSession(api, {
          storeId: 'store-1',
          routeId: 'route-1',
          qrKey: qr.qrKey,
        }).ok,
        true,
      );
    }

    assert.deepEqual(
      createQrSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        qrKey: qr.qrKey,
      }),
      { ok: false, status: 429, error: 'qr-rate-limited' },
    );
  });

  it('allows password access only from server-issued Wi-Fi proof and redacts logs', () => {
    const api = createActiveRouteContext();
    rotatePassword(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
      password: '2468',
      updatedAt: '2026-09-01T10:30:00.000Z',
    });

    setApiNow(api, '2026-09-01T10:32:00.000Z');
    const denied = createWifiSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      wifiProofToken: 'forged-proof-token',
    });
    assert.deepEqual(denied, {
      ok: false,
      status: 401,
      error: 'invalid-wifi-proof',
    });

    const proof = issueWifiProof(api, {
      storeId: 'store-1',
      verifiedAt: '2026-09-01T10:31:00.000Z',
    });
    assert.ok(proof.ok);

    const allowed = createWifiSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      wifiProofToken: proof.wifiProofToken,
    });
    assert.ok(allowed.ok);

    assert.deepEqual(
      createWifiSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        wifiProofToken: proof.wifiProofToken,
      }),
      { ok: false, status: 401, error: 'wifi-proof-replayed' },
    );

    setApiNow(api, '2026-09-01T10:33:00.000Z');
    assert.deepEqual(
      fetchPassword(api, {
        token: allowed.token,
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

  it('invalidates password sessions and QR material after password rotation', () => {
    const api = createActiveRouteContext();
    const qr = issueQrCredential(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    const proof = issueWifiProof(api, {
      storeId: 'store-1',
      verifiedAt: '2026-09-01T10:31:00.000Z',
    });
    assert.ok(qr.ok);
    assert.ok(proof.ok);

    setApiNow(api, '2026-09-01T10:32:00.000Z');
    const wifiSession = createWifiSession(api, {
      storeId: 'store-1',
      routeId: 'route-1',
      wifiProofToken: proof.wifiProofToken,
    });
    assert.ok(wifiSession.ok);

    rotatePassword(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
      password: '8642',
      updatedAt: '2026-09-01T10:34:00.000Z',
    });

    assert.deepEqual(
      fetchPassword(api, {
        token: wifiSession.token,
      }),
      { ok: false, status: 401, error: 'session-rotated' },
    );
    assert.deepEqual(
      createQrSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        qrKey: qr.qrKey,
      }),
      { ok: false, status: 401, error: 'invalid-qr-key' },
    );
  });

  it('blocks guest exposure after failed tests or untested route edits', () => {
    const api = createActiveRouteContext();
    const qr = issueQrCredential(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
    });
    assert.ok(qr.ok);

    recordTestRun(api, {
      merchant,
      storeId: 'store-1',
      routeId: 'route-1',
      testedAt: '2026-09-01T10:40:00.000Z',
      result: 'fail',
    });

    assert.deepEqual(
      createQrSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        qrKey: qr.qrKey,
      }),
      { ok: false, status: 401, error: 'invalid-qr-key' },
    );

    saveRouteDraft(api, { merchant, storeId: 'store-1', route: routeDraft });
    assert.deepEqual(
      createQrSession(api, {
        storeId: 'store-1',
        routeId: 'route-1',
        qrKey: qr.qrKey,
      }),
      { ok: false, status: 401, error: 'invalid-qr-key' },
    );
  });
});

function createSeededContext() {
  const api = createApiContext({
    signingSecret: 'unit-test-secret',
    now: () => '2026-09-01T10:00:00.000Z',
  });
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
