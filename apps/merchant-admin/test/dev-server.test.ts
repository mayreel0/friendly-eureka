import assert from 'node:assert/strict';
import { type AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

import { createMerchantAdminDevServer, resolveGuestOrigin } from '../dev-server.ts';

describe('merchant admin dev server', () => {
  it('accepts a public guest origin and rejects unsafe or ambiguous values', () => {
    assert.equal(resolveGuestOrigin('https://pilot.example.com/'), 'https://pilot.example.com');
    for (const value of ['javascript:alert(1)', 'https://user:pass@example.com',
      'https://example.com/path', 'https://example.com/?token=x', 'https://example.com/#x']) {
      assert.throws(() => resolveGuestOrigin(value), /GUEST_ORIGIN/);
    }
  });
  it('serves the browser shell and transpiles TypeScript modules', async () => {
    const server = createMerchantAdminDevServer();

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });

    try {
      const address = server.address();
      assert.ok(isAddressInfo(address));

      const baseUrl = `http://127.0.0.1:${address.port}`;
      const shell = await fetch(`${baseUrl}/`);

      assert.equal(shell.status, 200);
      assert.match(await shell.text(), /lechigo-merchant-admin/);

      const entry = await fetch(`${baseUrl}/src/entry/bootstrap.ts`);

      assert.equal(entry.status, 200);
      assert.match(entry.headers.get('content-type') ?? '', /application\/javascript/);
      assert.match(await entry.text(), /registerMerchantAdminElement/);

      const session = await fetch(`${baseUrl}/api/dev/pilot-route-session`);
      const body = await session.json() as { error?: string };

      assert.equal(session.status, 409);
      assert.match(session.headers.get('content-type') ?? '', /application\/json/);
      assert.equal(body.error, 'pilot-route-not-active');

      const sessionUrl = await fetch(`${baseUrl}/api/dev/pilot-route-session-url`);

      assert.equal(sessionUrl.status, 409);
      assert.equal((await sessionUrl.json()).error, 'pilot-route-not-active');

      const initialReadiness = await fetch(
        `${baseUrl}/api/dev/pilot-readiness`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as {
          ok?: boolean;
          hasQrPlacement?: boolean;
          hasStaffFallbackNote?: boolean;
          qaResults?: Record<string, unknown>;
        },
      }));

      assert.equal(initialReadiness.status, 200);
      assert.equal(initialReadiness.body.ok, true);
      assert.equal(initialReadiness.body.hasQrPlacement, false);
      assert.equal(initialReadiness.body.hasStaffFallbackNote, false);

      const savedReadiness = await fetch(`${baseUrl}/api/dev/pilot-readiness`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hasQrPlacement: true,
          hasStaffFallbackNote: true,
          qaResults: {
            'place-qr': {
              summary: 'Verified QR placed',
              recordedAt: '2026-09-01T10:15:00.000Z',
            },
            'staff-fallback-note': {
              summary: 'Verified staff fallback note',
              recordedAt: '2026-09-01T10:16:00.000Z',
            },
          },
        }),
      }).then(async (response) => ({
        status: response.status,
        body: await response.json() as {
          ok?: boolean;
          hasQrPlacement?: boolean;
          hasStaffFallbackNote?: boolean;
          qaResults?: {
            'place-qr'?: { recordedAt?: string };
            'staff-fallback-note'?: { recordedAt?: string };
          };
        },
      }));

      assert.equal(savedReadiness.status, 200);
      assert.equal(savedReadiness.body.ok, true);
      assert.equal(savedReadiness.body.hasQrPlacement, true);
      assert.equal(savedReadiness.body.hasStaffFallbackNote, true);
      assert.equal(
        savedReadiness.body.qaResults?.['place-qr']?.recordedAt,
        '2026-09-01T10:15:00.000Z',
      );

      const reloadedReadiness = await fetch(
        `${baseUrl}/api/dev/pilot-readiness`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as typeof savedReadiness.body,
      }));

      assert.equal(reloadedReadiness.status, 200);
      assert.deepEqual(reloadedReadiness.body, savedReadiness.body);

      const initialRecording = await fetch(
        `${baseUrl}/api/dev/pilot-route-recording`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as {
          ok?: boolean;
          stage?: string;
          routeId?: string;
          launchUrl?: string;
        },
      }));

      assert.equal(initialRecording.status, 200);
      assert.equal(initialRecording.body.ok, true);
      assert.equal(initialRecording.body.stage, 'empty');
      assert.equal(initialRecording.body.routeId, undefined);

      const savedRecording = await fetch(
        `${baseUrl}/api/dev/pilot-route-recording`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            stage: 'launch-ready',
            routeId: 'pilot-restroom-route',
            launchUrl: 'http://127.0.0.1:4173/?token=test-token',
          }),
        },
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as {
          ok?: boolean;
          stage?: string;
          routeId?: string;
          launchUrl?: string;
        },
      }));

      assert.equal(savedRecording.status, 200);
      assert.equal(savedRecording.body.ok, true);
      assert.equal(savedRecording.body.stage, 'launch-ready');
      assert.equal(savedRecording.body.routeId, 'pilot-restroom-route');
      assert.equal(
        savedRecording.body.launchUrl,
        'http://127.0.0.1:4173/?token=test-token',
      );

      const reloadedRecording = await fetch(
        `${baseUrl}/api/dev/pilot-route-recording`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as typeof savedRecording.body,
      }));

      assert.equal(reloadedRecording.status, 200);
      assert.deepEqual(reloadedRecording.body, savedRecording.body);

      const initialPilotState = await fetch(`${baseUrl}/api/dev/pilot-state`).then(
        async (response) => ({
          status: response.status,
          body: await response.json() as {
            ok?: boolean;
            nextTarget?: { id?: string; label?: string };
            recording?: { stage?: string; routeId?: string };
            readiness?: {
              hasQrPlacement?: boolean;
              hasStaffFallbackNote?: boolean;
            };
          },
        }),
      );

      assert.equal(initialPilotState.status, 200);
      assert.equal(initialPilotState.body.ok, true);
      assert.equal(initialPilotState.body.nextTarget?.id, 'run-guest-pilot-qa');
      assert.equal(initialPilotState.body.recording?.stage, 'launch-ready');
      assert.equal(initialPilotState.body.readiness?.hasQrPlacement, true);

      const updatedPilotState = await fetch(`${baseUrl}/api/dev/pilot-state`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          recording: {
            stage: 'active',
            routeId: 'pilot-restroom-route',
          },
          readiness: {
            hasQrPlacement: false,
            hasStaffFallbackNote: true,
            qaResults: {
              'staff-fallback-note': {
                summary: 'Verified staff fallback note',
                recordedAt: '2026-09-01T10:16:00.000Z',
              },
            },
          },
          followUps: [
            {
              id: 'follow-up-1',
              targetId: 'complete-pilot-readiness',
              targetLabel: 'Complete pilot readiness',
              status: 'open',
              createdAt: '2026-09-01T10:30:00.000Z',
              snapshot: {
                stage: 'active',
                routeId: 'pilot-restroom-route',
                hasQrPlacement: false,
                hasStaffFallbackNote: true,
                qaResults: {},
              },
            },
          ],
        }),
      }).then(async (response) => ({
        status: response.status,
        body: await response.json() as {
          ok?: boolean;
          nextTarget?: { id?: string; label?: string };
          followUps?: { targetId?: string; createdAt?: string }[];
          recording?: { stage?: string; routeId?: string; launchUrl?: string };
          readiness?: {
            hasQrPlacement?: boolean;
            hasStaffFallbackNote?: boolean;
            qaResults?: {
              'staff-fallback-note'?: { recordedAt?: string };
            };
          };
        },
      }));

      assert.equal(updatedPilotState.status, 200);
      assert.equal(updatedPilotState.body.ok, true);
      assert.equal(updatedPilotState.body.nextTarget?.id, 'complete-pilot-readiness');
      assert.equal(
        updatedPilotState.body.nextTarget?.label,
        'Complete pilot readiness',
      );
      assert.deepEqual(updatedPilotState.body.recording, {
        stage: 'active',
        routeId: 'pilot-restroom-route',
      });
      assert.equal(updatedPilotState.body.readiness?.hasQrPlacement, false);
      assert.equal(updatedPilotState.body.readiness?.hasStaffFallbackNote, true);
      assert.equal(
        updatedPilotState.body.readiness?.qaResults?.['staff-fallback-note']?.recordedAt,
        '2026-09-01T10:16:00.000Z',
      );
      assert.equal(
        updatedPilotState.body.followUps?.[0]?.targetId,
        'complete-pilot-readiness',
      );
      assert.equal(
        updatedPilotState.body.followUps?.[0]?.createdAt,
        '2026-09-01T10:30:00.000Z',
      );

      const recordingAfterPilotStateUpdate = await fetch(
        `${baseUrl}/api/dev/pilot-route-recording`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as typeof savedRecording.body,
      }));
      const readinessAfterPilotStateUpdate = await fetch(
        `${baseUrl}/api/dev/pilot-readiness`,
      ).then(async (response) => ({
        status: response.status,
        body: await response.json() as typeof savedReadiness.body,
      }));

      assert.equal(recordingAfterPilotStateUpdate.status, 200);
      assert.equal(recordingAfterPilotStateUpdate.body.stage, 'active');
      assert.equal(
        recordingAfterPilotStateUpdate.body.routeId,
        'pilot-restroom-route',
      );
      assert.equal(readinessAfterPilotStateUpdate.status, 200);
      assert.equal(readinessAfterPilotStateUpdate.body.hasQrPlacement, false);
      assert.equal(
        readinessAfterPilotStateUpdate.body.hasStaffFallbackNote,
        true,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error: Error | undefined) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  });
});

function isAddressInfo(address: string | AddressInfo | null): address is AddressInfo {
  return typeof address === 'object' && address !== null && 'port' in address;
}
