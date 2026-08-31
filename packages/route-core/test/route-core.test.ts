import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assessProgress,
  canActivateRoute,
  canExposeRoute,
  createGuestSession,
  describeRecoveryStep,
  rotateRoutePassword,
  serializeRoute,
} from '../src/index.ts';

const recordedAt = '2026-09-01T09:00:00.000Z';
const testedAt = '2026-09-01T09:15:00.000Z';

const route = {
  id: 'route-cafe-1',
  storeId: 'store-cafe-1',
  version: 3,
  status: 'tested',
  recordedAt,
  testedAt,
  passwordUpdatedAt: '2026-09-01T10:00:00.000Z',
  passwordRetestRequired: false,
  anchors: [
    {
      id: 'entrance',
      label: 'Front door',
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      type: 'start',
    },
    {
      id: 'stairs',
      label: 'Stairs',
      floor: 1,
      position: { x: 4, y: 0, z: 1 },
      type: 'landmark',
    },
    {
      id: 'restroom',
      label: 'Restroom door',
      floor: 2,
      position: { x: 6, y: 3, z: 1 },
      type: 'destination',
    },
  ],
  segments: [
    {
      id: 'segment-1',
      fromAnchorId: 'entrance',
      toAnchorId: 'stairs',
      instruction: 'Walk toward the stairs.',
      distanceMeters: 4.2,
    },
    {
      id: 'segment-2',
      fromAnchorId: 'stairs',
      toAnchorId: 'restroom',
      instruction: 'Go upstairs and turn right.',
      distanceMeters: 6.8,
      floorTransition: {
        type: 'stairs',
        fromFloor: 1,
        toFloor: 2,
      },
    },
  ],
} as const;

describe('route core', () => {
  it('serializes only guest-safe route geometry and floor transitions', () => {
    const serialized = serializeRoute(route);

    assert.deepEqual(serialized, {
      id: 'route-cafe-1',
      storeId: 'store-cafe-1',
      version: 3,
      anchors: route.anchors,
      segments: route.segments,
      totalDistanceMeters: 11,
      floorTransitions: [
        {
          segmentId: 'segment-2',
          type: 'stairs',
          fromFloor: 1,
          toFloor: 2,
        },
      ],
    });
    assert.equal('passwordUpdatedAt' in serialized, false);
  });

  it('keeps tested routes active when only the restroom password rotates', () => {
    const rotated = rotateRoutePassword(route, '2026-09-01T12:00:00.000Z');

    assert.equal(rotated.passwordUpdatedAt, '2026-09-01T12:00:00.000Z');
    assert.equal(rotated.passwordRetestRequired, false);
    assert.equal(canActivateRoute(rotated).ok, true);
  });

  it('blocks activation when route geometry changes after the last successful test', () => {
    const changedRoute = {
      ...route,
      recordedAt: '2026-09-01T11:00:00.000Z',
      testedAt,
    };

    assert.deepEqual(canActivateRoute(changedRoute), {
      ok: false,
      reason: 'route-test-stale',
    });
  });

  it('creates short-lived guest sessions with password access only for in-store proof', () => {
    const qrSession = createGuestSession({
      route,
      source: 'qr',
      issuedAt: '2026-09-01T12:00:00.000Z',
    });

    assert.equal(qrSession.expiresAt, '2026-09-01T12:20:00.000Z');
    assert.equal(qrSession.canViewPassword, false);

    const wifiSession = createGuestSession({
      route,
      source: 'wifi',
      issuedAt: '2026-09-01T12:00:00.000Z',
      wifiProof: {
        storeId: route.storeId,
        verifiedAt: '2026-09-01T11:59:30.000Z',
      },
    });

    assert.equal(wifiSession.canViewPassword, true);
    assert.equal(wifiSession.proofExpiresAt, '2026-09-01T12:04:30.000Z');
    assert.equal(wifiSession.source, 'wifi');
  });

  it('requires an active route before exposing route geometry', () => {
    assert.deepEqual(
      canExposeRoute({
        route,
        source: 'qr',
        at: '2026-09-01T12:00:00.000Z',
      }),
      { ok: false, reason: 'route-not-active' },
    );

    assert.equal(
      canExposeRoute({
        route: { ...route, status: 'active' },
        source: 'qr',
        at: '2026-09-01T12:00:00.000Z',
      }).ok,
      true,
    );
  });

  it('requires either a QR session or valid Wi-Fi proof before exposing routes', () => {
    assert.deepEqual(
      canExposeRoute({
        route: { ...route, status: 'active' },
        source: 'wifi',
        at: '2026-09-01T12:00:00.000Z',
        wifiProof: {
          storeId: route.storeId,
          verifiedAt: '2026-09-01T11:54:30.000Z',
        },
      }),
      { ok: false, reason: 'wifi-proof-expired' },
    );

    assert.equal(
      canExposeRoute({
        route: { ...route, status: 'active' },
        source: 'qr',
        at: '2026-09-01T12:00:00.000Z',
      }).ok,
      true,
    );
  });

  it('returns recovery guidance when tracking confidence degrades or drift is high', () => {
    assert.deepEqual(
      assessProgress({
        route,
        currentAnchorId: 'entrance',
        trackingConfidence: 'limited',
        driftMeters: 0.7,
      }),
      {
        status: 'recover',
        reason: 'tracking-limited',
        nextAnchorId: 'stairs',
        instruction: 'Point your camera at Stairs to realign.',
      },
    );

    assert.deepEqual(
      describeRecoveryStep({
        route,
        currentAnchorId: 'stairs',
        reason: 'excessive-drift',
      }),
      {
        nextAnchorId: 'restroom',
        instruction: 'Point your camera at Restroom door to realign.',
      },
    );
  });
});
