import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createDevPilotInstructions } from '../../../scripts/dev-pilot-flow.mjs';

describe('local pilot dev flow instructions', () => {
  it('keeps the tunnel target local when guest QR uses a public origin', () => {
    const lines = createDevPilotInstructions({
      guestOrigin: 'http://127.0.0.1:4173',
      merchantOrigin: 'http://127.0.0.1:4174',
      publicGuestOrigin: 'https://pilot.example.com',
    });
    assert.ok(lines.includes('Android tunnel command: cloudflared tunnel --url http://127.0.0.1:4173'));
    assert.ok(lines.includes('Guest QR origin: https://pilot.example.com'));
  });
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
        'Merchant-generated guest URL text: http://127.0.0.1:4174/api/dev/pilot-route-session-url',
        'Android tunnel command: cloudflared tunnel --url http://127.0.0.1:4173',
        'Pilot flow: open merchant admin, generate the guest URL, then open it on Android Chrome.',
      ],
    );
  });
});
