import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildActivationChecklist,
  merchantAdminSurface,
  resolveMerchantRouteActions,
} from '../src/index.ts';

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
});
