import { randomUUID } from 'node:crypto';
import { createApiContext, createQrSession, fetchGuestRoute, issueQrCredential } from '../api/src/server.ts';
import {
  applyPilotRouteRecordingUiAction, createPilotRouteRecordingUiState,
  pilotRouteId, pilotStoreId, type PilotRouteRecordingStage,
} from './src/index.ts';
import { samePilotDirections, type PilotDirections } from './src/pilot-directions.ts';
import type { RouteTestResult } from './src/route-test-result.ts';

export type PilotGuestApi = Pick<ReturnType<typeof createPilotGuestApi>, 'issueSession' | 'fetchRoute'>;

// Local pilot publishing only: the saved stages describe the existing simulated route.
export function createPilotGuestApi(options: { now?: () => string; preview?: boolean } = {}) {
  let context = createApiContext({ signingSecret: randomUUID(), now: options.now });
  let published = false;
  let qrKey = '';
  let directions: PilotDirections | undefined;
  let routeVersion: number | undefined;
  let stage: PilotRouteRecordingStage | undefined;
  const unavailable = () => ({ ok: false as const, status: 409, error: 'pilot-route-not-active' });

  return {
    setRecording(recording: { stage: PilotRouteRecordingStage; routeId?: string; directions?: PilotDirections; routeVersion?: number; testResult?: RouteTestResult }) {
      const nextPublished = recording.routeId === pilotRouteId &&
        (options.preview ? recording.stage !== 'empty' : recording.stage === 'active' || recording.stage === 'launch-ready');
      if (nextPublished === published && samePilotDirections(directions, recording.directions) && routeVersion === recording.routeVersion &&
        (!options.preview || stage === recording.stage)) return;
      stage = recording.stage;
      directions = recording.directions;
      routeVersion = recording.routeVersion;
      // Rotating the local runtime revokes old sessions when a route is re-recorded.
      context = createApiContext({ signingSecret: randomUUID(), now: options.now });
      published = nextPublished;
      qrKey = '';
      if (!published) return;
      let state = createPilotRouteRecordingUiState(context, { directions, routeVersion, testRecordedAt: recording.testResult?.recordedAt });
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
      const result = fetchGuestRoute(context, { token });
      return result.ok ? { ...result, preview: options.preview === true } : result;
    },
  };
}
