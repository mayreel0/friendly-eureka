import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDevPilotInstructions } from '../../../scripts/dev-pilot-flow.mjs';

describe('local pilot dev flow instructions', () => {
  it('prints Android manual testing entry points', () => {
    assert.deepEqual(
      createDevPilotInstructions({
        guestOrigin: 'http://127.0.0.1:4173',
        merchantOrigin: 'http://127.0.0.1:4174',
      }),
      [
        'Guest WebXR dev shell: http://127.0.0.1:4173/',
        'Merchant admin dev shell: http://127.0.0.1:4174/',
        'Dev guest session JSON: http://127.0.0.1:4173/api/dev/guest-session',
        'Android tunnel command: cloudflared tunnel --url http://127.0.0.1:4173',
        'Pilot flow: open merchant admin, generate the guest URL, then open it on Android Chrome.',
      ],
    );
  });
});
