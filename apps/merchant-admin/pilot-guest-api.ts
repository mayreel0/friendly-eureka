import { randomUUID } from 'node:crypto';
import { createApiContext, createQrSession, fetchGuestRoute, issueQrCredential } from '../api/src/server.ts';
import {
  applyPilotRouteRecordingUiAction, createPilotRouteRecordingUiState,
  pilotRouteId, pilotStoreId, type PilotRouteRecordingStage,
} from './src/index.ts';
import { samePilotDirections, type PilotDirections } from './src/pilot-directions.ts';

export type PilotGuestApi = Pick<ReturnType<typeof createPilotGuestApi>, 'issueSession' | 'fetchRoute'>;

// Local pilot publishing only: the saved stages describe the existing simulated route.
export function createPilotGuestApi(options: { now?: () => string } = {}) {
  let context = createApiContext({ signingSecret: randomUUID(), now: options.now });
  let published = false;
  let qrKey = '';
  let directions: PilotDirections | undefined;
  let routeVersion: number | undefined;
  const unavailable = () => ({ ok: false as const, status: 409, error: 'pilot-route-not-active' });

  return {
    setRecording(recording: { stage: PilotRouteRecordingStage; routeId?: string; directions?: PilotDirections; routeVersion?: number }) {
      const nextPublished = recording.routeId === pilotRouteId &&
        (recording.stage === 'active' || recording.stage === 'launch-ready');
      if (nextPublished === published && samePilotDirections(directions, recording.directions) && routeVersion === recording.routeVersion) return;
      directions = recording.directions;
      routeVersion = recording.routeVersion;
      // Rotating the local runtime revokes old sessions when a route is re-recorded.
      context = createApiContext({ signingSecret: randomUUID(), now: options.now });
      published = nextPublished;
      qrKey = '';
      if (!published) return;
      let state = createPilotRouteRecordingUiState(context, { directions, routeVersion });
      for (const action of ['record-route', 'mark-test-passed', 'activate-route'] as const) {
        state = applyPilotRouteRecordingUiAction(state, action);
      }
      const credential = issueQrCredential(context, {
        merchant: state.merchant, storeId: pilotStoreId, routeId: pilotRouteId,
      });
      if (!credential.ok) throw new Error(credential.error);
      qrKey = credential.qrKey;
    },
    issueSession() {
      if (!published) return unavailable();
      return createQrSession(context, {
        storeId: pilotStoreId, routeId: pilotRouteId, qrKey, clientKey: 'local-dev-browser',
      });
    },
    fetchRoute(token: string) {
      if (!published) return { ok: false as const, status: 403, error: 'pilot-route-not-active' };
      return fetchGuestRoute(context, { token });
    },
  };
}
