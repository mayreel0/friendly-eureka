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

export async function generateGuestSession(
  environment: MerchantAdminElementEnvironment,
) {
  if (environment.generateGuestUrl) {
    return environment.generateGuestUrl();
  }

  const response = await fetch('/api/dev/pilot-route-session');

  if (!response.ok) {
    throw new Error('Failed to generate guest URL');
  }

  return (await response.json()) as { launchUrl: string };
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
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(pilotState),
  });
  if (!response.ok) throw new Error('Failed to save pilot state');
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
