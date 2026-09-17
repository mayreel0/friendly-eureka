import type {
  MerchantAdminElementEnvironment,
  PilotDevStateApiState,
  PilotReadinessApiState,
  PilotRouteRecordingApiState,
  PilotRouteRecordingScreenState,
} from './types.ts';
import {
  createInitialPilotReadiness,
  createInitialPilotRouteRecording,
  toPilotReadinessApiState,
  toPilotRouteRecordingApiState,
} from './state.ts';

export class GuestSessionError extends Error {}
export class PilotStateConflictError extends Error {}

export async function recordRouteTest(result: 'pass' | 'fail', note: string, routeVersion: number, revision?: string) {
  const response = await fetch('/api/dev/pilot-route-test', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(revision ? { 'x-pilot-revision': revision } : {}) },
    body: JSON.stringify({ result, note, routeVersion }),
  });
  if (response.status === 409) throw new PilotStateConflictError('Saved state changed in another tab or after a server restart. Load the latest state before continuing.');
  if (!response.ok) throw new GuestSessionError('Could not save the route test. Please try again.');
  return (await response.json()) as PilotDevStateApiState;
}

export async function generateRoutePreview(revision?: string) {
  const response = await fetch('/api/dev/pilot-route-preview', {
    headers: revision ? { 'x-pilot-revision': revision } : {},
  });
  if (response.status === 409) throw new PilotStateConflictError('Saved state changed in another tab or after a server restart. Load the latest state before continuing.');
  if (!response.ok) throw new GuestSessionError(response.status === 429
    ? 'Too many previews generated. Wait one minute before trying again.'
    : 'Could not create a route preview. Please try again.');
  return (await response.json()) as { launchUrl: string };
}

export async function generateGuestSession(
  environment: MerchantAdminElementEnvironment,
) {
  if (environment.generateGuestUrl) {
    return environment.generateGuestUrl();
  }

  const response = await fetch('/api/dev/pilot-route-session');

  if (!response.ok) {
    throw new GuestSessionError(response.status === 429
      ? 'Too many links generated. Wait one minute before trying again.'
      : 'Could not generate a guest link. Please try again.');
  }

  return (await response.json()) as { launchUrl: string; expiresAt?: string; entryUrl?: string };
}

export async function loadPilotState(
  environment: MerchantAdminElementEnvironment,
): Promise<PilotDevStateApiState> {
  if (environment.loadPilotState) {
    return environment.loadPilotState();
  }

  if (environment.loadRouteRecording || environment.loadReadiness) {
    const [recording, readiness] = await Promise.all([
      loadPilotRouteRecording(environment).catch(() =>
        createInitialPilotRouteRecording(),
      ),
      loadPilotReadiness(environment).catch(() => createInitialPilotReadiness()),
    ]);

    return { recording, readiness };
  }

  const response = await fetch('/api/dev/pilot-state');

  if (!response.ok) {
    throw new Error('Failed to load pilot state');
  }

  return (await response.json()) as PilotDevStateApiState;
}

export async function savePilotState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
  revision?: string,
) {
  const pilotState = {
    recording: toPilotRouteRecordingApiState(state),
    readiness: toPilotReadinessApiState(state),
    followUps: state.followUps,
  };

  if (environment.savePilotState) {
    await environment.savePilotState(pilotState);
    return;
  }

  const response = await fetch('/api/dev/pilot-state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(revision ? { 'x-pilot-revision': revision } : {}) },
    body: JSON.stringify(pilotState),
  });
  if (response.status === 409) throw new PilotStateConflictError('Saved state changed in another tab or after a server restart. Load the latest state before continuing.');
  if (!response.ok) throw new Error('Failed to save pilot state');
  return (await response.json()) as PilotDevStateApiState;
}

export async function savePilotReadinessState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
) {
  if (environment.saveReadiness) {
    await savePilotReadiness(environment, toPilotReadinessApiState(state));
    return;
  }

  await savePilotState(environment, state);
}

export async function savePilotRouteRecordingState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
) {
  if (environment.saveRouteRecording) {
    await savePilotRouteRecording(
      environment,
      toPilotRouteRecordingApiState(state),
    );
    return;
  }

  await savePilotState(environment, state);
}

async function loadPilotReadiness(
  environment: MerchantAdminElementEnvironment,
) {
  if (environment.loadReadiness) {
    return environment.loadReadiness();
  }

  const response = await fetch('/api/dev/pilot-readiness');

  if (!response.ok) {
    return createInitialPilotReadiness();
  }

  return (await response.json()) as PilotReadinessApiState;
}

async function loadPilotRouteRecording(
  environment: MerchantAdminElementEnvironment,
) {
  if (environment.loadRouteRecording) {
    return environment.loadRouteRecording();
  }

  const response = await fetch('/api/dev/pilot-route-recording');

  if (!response.ok) {
    return createInitialPilotRouteRecording();
  }

  return (await response.json()) as PilotRouteRecordingApiState;
}

async function savePilotReadiness(
  environment: MerchantAdminElementEnvironment,
  state: PilotReadinessApiState,
) {
  const readiness = {
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
    qrPlacementEvidence: state.qrPlacementEvidence,
  };

  if (environment.saveReadiness) {
    await environment.saveReadiness(readiness);
    return;
  }

  await fetch('/api/dev/pilot-readiness', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(readiness),
  });
}

async function savePilotRouteRecording(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingApiState,
) {
  const recording = toPilotRouteRecordingApiState(state);

  if (environment.saveRouteRecording) {
    await environment.saveRouteRecording(recording);
    return;
  }

  await fetch('/api/dev/pilot-route-recording', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(recording),
  });
}
