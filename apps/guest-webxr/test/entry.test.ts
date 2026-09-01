import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildArGuidance,
  detectArSupport,
  guestEntrySurface,
  resolveEntryState,
} from '../src/entry/index.ts';

const route = {
  id: 'route-1',
  storeId: 'store-1',
  version: 1,
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
      position: { x: 8, y: 0, z: 1 },
      type: 'destination',
    },
  ],
  segments: [
    {
      id: 'segment-1',
      fromAnchorId: 'entrance',
      toAnchorId: 'restroom',
      instruction: 'Follow the hallway to the restroom.',
      distanceMeters: 8,
    },
  ],
  totalDistanceMeters: 8,
  floorTransitions: [],
} as const;

describe('guest WebXR entry', () => {
  it('keeps the first QR screen actionable without local persistence', () => {
    assert.equal(guestEntrySurface(), 'guest-webxr');

    assert.deepEqual(
      resolveEntryState({
        token: undefined,
        route: undefined,
        network: 'online',
        arSupport: 'webxr',
      }),
      {
        screen: 'scan-required',
        canStartAr: false,
        canUseManualFallback: false,
      },
    );

    assert.deepEqual(
      resolveEntryState({
        token: 'signed-token',
        route,
        network: 'online',
        arSupport: 'webxr',
      }),
      {
        screen: 'ready',
        canStartAr: true,
        canUseManualFallback: true,
      },
    );
  });

  it('detects WebXR, App Clip handoff, and manual fallback surfaces', () => {
    assert.equal(
      detectArSupport({
        webglAvailable: true,
        xrAvailable: true,
        immersiveArSupported: true,
        platform: 'android',
      }),
      'webxr',
    );

    assert.equal(
      detectArSupport({
        webglAvailable: true,
        xrAvailable: false,
        immersiveArSupported: false,
        platform: 'ios',
      }),
      'ios-app-clip',
    );

    assert.equal(
      detectArSupport({
        webglAvailable: false,
        xrAvailable: false,
        immersiveArSupported: false,
        platform: 'desktop',
      }),
      'manual',
    );
  });

  it('falls back to landmark guidance when AR tracking is degraded', () => {
    assert.deepEqual(
      buildArGuidance({
        route,
        currentAnchorId: 'entrance',
        trackingConfidence: 'limited',
        driftMeters: 0.3,
      }),
      {
        mode: 'recovery',
        instruction: 'Point your camera at Restroom to realign.',
        nextAnchorId: 'restroom',
      },
    );

    assert.deepEqual(
      buildArGuidance({
        route,
        currentAnchorId: 'entrance',
        trackingConfidence: 'normal',
        driftMeters: 0.2,
      }),
      {
        mode: 'ar',
        instruction: 'Follow the hallway to the restroom.',
        nextAnchorId: 'restroom',
      },
    );
  });
});
