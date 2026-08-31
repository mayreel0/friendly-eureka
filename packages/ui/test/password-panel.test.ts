import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolvePasswordPanelState } from '../src/index.ts';

describe('guest password panel state', () => {
  it('locks restroom passwords for QR-only route sessions', () => {
    assert.deepEqual(
      resolvePasswordPanelState({
        canViewPassword: false,
        password: undefined,
        source: 'qr',
      }),
      {
        state: 'locked',
        message: 'Connect to verified store Wi-Fi to view the restroom code.',
        visiblePassword: undefined,
      },
    );
  });

  it('reveals passwords only when the API grants Wi-Fi-backed access', () => {
    assert.deepEqual(
      resolvePasswordPanelState({
        canViewPassword: true,
        password: '2468',
        source: 'wifi',
      }),
      {
        state: 'revealed',
        message: 'Restroom code available.',
        visiblePassword: '2468',
      },
    );
  });

  it('shows an unavailable state when access is granted but no code exists', () => {
    assert.deepEqual(
      resolvePasswordPanelState({
        canViewPassword: true,
        password: undefined,
        source: 'wifi',
      }),
      {
        state: 'unavailable',
        message: 'Ask staff for the current restroom code.',
        visiblePassword: undefined,
      },
    );
  });
});
