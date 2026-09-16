import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveNextPilotImplementationTarget } from '../src/entry/state.ts';

describe('merchant next target', () => {
  it('derives the next pilot implementation target from route and QA state', () => {
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'empty',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'record-pilot-route',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'recorded',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'run-route-test',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'tested',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'activate-pilot-route',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'active',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: true,
        qaResults: {},
        followUps: [],
      }).id,
      'complete-pilot-readiness',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'active',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {},
        followUps: [],
      }).id,
      'generate-guest-url',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'launch-ready',
        routeId: 'pilot-restroom-route',
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {
          'place-qr': {
            summary: 'Verified QR placed',
            recordedAt: '2026-09-01T10:10:00.000Z',
          },
        },
        followUps: [],
      }).id,
      'record-qa-evidence',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'launch-ready',
        routeId: 'pilot-restroom-route',
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {
          'place-qr': {
            summary: 'Verified QR placed',
            recordedAt: '2026-09-01T10:10:00.000Z',
          },
          'staff-fallback-note': {
            summary: 'Verified staff fallback note',
            recordedAt: '2026-09-01T10:20:00.000Z',
          },
        },
        followUps: [],
      }).id,
      'run-guest-pilot-qa',
    );
  });

});
