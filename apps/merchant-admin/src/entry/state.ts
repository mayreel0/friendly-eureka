import type {
  PilotDevStateApiState,
  PilotFollowUpAction,
  PilotFollowUpSnapshot,
  PilotImplementationTarget,
  PilotQrPlacementEvidence,
  PilotReadinessApiState,
  PilotRouteRecordingApiState,
  PilotRouteRecordingScreenActionId,
  PilotRouteRecordingScreenStage,
  PilotRouteRecordingScreenState,
} from './types.ts';

export function createInitialPilotRouteRecordingScreenState(): PilotRouteRecordingScreenState {
  return {
    stage: 'empty',
    hasQrPlacement: false,
    hasStaffFallbackNote: false,
    qaResults: {},
    followUps: [],
  };
}

export function deriveNextPilotImplementationTarget(
  state: PilotRouteRecordingScreenState,
): PilotImplementationTarget {
  if (state.stage === 'empty') {
    return {
      id: 'record-pilot-route',
      label: 'Record pilot route',
      detail: 'Capture the pilot restroom route before testing can start.',
    };
  }

  if (state.stage === 'recorded') {
    return {
      id: 'run-route-test',
      label: 'Run route test',
      detail: 'Verify the recorded route before activation.',
    };
  }

  if (state.stage === 'tested' || state.stage === 'paused') {
    return {
      id: 'activate-pilot-route',
      label: state.stage === 'paused' ? 'Resume guest access' : 'Activate pilot route',
      detail: state.stage === 'paused' ? 'Resume this route and generate a new guest link.' : 'Make the tested pilot route available for launch preparation.',
    };
  }

  if (state.stage === 'active') {
    if (!state.hasQrPlacement || !state.hasStaffFallbackNote) {
      return {
        id: 'complete-pilot-readiness',
        label: 'Complete pilot readiness',
        detail: 'Confirm QR placement and staff fallback notes before launch.',
      };
    }

    return {
      id: 'generate-guest-url',
      label: 'Generate guest URL',
      detail: 'Create the guest launch URL for the seeded pilot route.',
    };
  }

  if (!state.qaResults['place-qr'] || !state.qaResults['staff-fallback-note']) {
    return {
      id: 'record-qa-evidence',
      label: 'Record QA evidence',
      detail: 'Attach QA result notes for QR placement and staff fallback.',
    };
  }

  return {
    id: 'run-guest-pilot-qa',
    label: 'Run guest pilot QA',
    detail: 'Open the guest URL and verify the end-to-end pilot experience.',
  };
}

export function createPilotRouteRecordingView(
  state: PilotRouteRecordingScreenState,
) {
  const checklist = createPilotReadinessChecklist(state);
  const isReadyToLaunch = checklist.every((item) => item.complete);
  const nextTarget = deriveNextPilotImplementationTarget(state);
  const primaryActions = createPrimaryNextTargetActions(nextTarget.id);
  const progress = createPilotProgressSummary(state);
  const openFollowUps = state.followUps.filter(
    (followUp) => followUp.status === 'open',
  );
  const completedFollowUps = state.followUps.filter(
    (followUp) => followUp.status === 'completed',
  );

  return {
    stage: state.stage,
    title: 'Merchant pilot dashboard',
    status: statusForPilotRouteRecordingStage(state.stage),
    progress,
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    nextTarget,
    primaryActions,
    qrPlacementEvidence: state.qrPlacementEvidence,
    followUps: state.followUps,
    openFollowUps,
    completedFollowUps,
    checklist,
    actions: [
      {
        id: 'record-route',
        label: 'Record route',
        enabled: state.stage === 'empty',
      },
      {
        id: 'mark-test-passed',
        label: 'Mark test passed',
        enabled: state.stage === 'recorded',
      },
      {
        id: 'activate-route',
        label: state.stage === 'paused' ? 'Resume guest access' : 'Activate route',
        enabled: state.stage === 'tested' || state.stage === 'paused',
      },
      {
        id: 'pause-route',
        label: 'Pause guest access',
        enabled: ['active', 'launch-ready'].includes(state.stage),
      },
      {
        id: 'generate-guest-url',
        label: state.stage === 'launch-ready' ? 'Refresh guest URL' : 'Generate guest URL',
        enabled: ['active', 'launch-ready'].includes(state.stage) && isReadyToLaunch,
      },
      {
        id: 'mark-qr-placed',
        label: 'Confirm QR placed',
        enabled: state.stage === 'active' && !state.hasQrPlacement,
      },
      {
        id: 'record-qr-placement-evidence',
        label: 'Save QR evidence',
        enabled:
          (state.stage === 'active' || state.stage === 'launch-ready') &&
          !state.qrPlacementEvidence,
      },
      {
        id: 'mark-staff-fallback-ready',
        label: 'Confirm fallback note',
        enabled: state.stage === 'active' && !state.hasStaffFallbackNote,
      },
    ] satisfies {
      id: PilotRouteRecordingScreenActionId;
      label: string;
      enabled: boolean;
    }[],
  };
}

function createPilotProgressSummary(state: PilotRouteRecordingScreenState) {
  const completedSteps = [
    state.stage !== 'empty',
    ['tested', 'active', 'launch-ready', 'paused'].includes(state.stage),
    ['active', 'launch-ready'].includes(state.stage),
    state.hasQrPlacement,
    state.hasStaffFallbackNote,
    state.stage === 'launch-ready',
  ].filter(Boolean).length;
  const totalSteps = 6;

  return {
    completed: completedSteps,
    total: totalSteps,
    label: `${completedSteps} of ${totalSteps} pilot steps complete`,
  };
}

function createPrimaryNextTargetActions(targetId: PilotImplementationTarget['id']) {
  if (targetId === 'record-pilot-route') {
    return ['record-route'] satisfies PilotRouteRecordingScreenActionId[];
  }

  if (targetId === 'run-route-test') {
    return ['mark-test-passed'] satisfies PilotRouteRecordingScreenActionId[];
  }

  if (targetId === 'activate-pilot-route') {
    return ['activate-route'] satisfies PilotRouteRecordingScreenActionId[];
  }

  if (targetId === 'complete-pilot-readiness') {
    return [
      'record-qr-placement-evidence',
      'mark-staff-fallback-ready',
    ] satisfies PilotRouteRecordingScreenActionId[];
  }

  if (targetId === 'generate-guest-url') {
    return ['generate-guest-url'] satisfies PilotRouteRecordingScreenActionId[];
  }

  return [] satisfies PilotRouteRecordingScreenActionId[];
}

export function applyLocalPilotRouteRecordingAction(
  state: PilotRouteRecordingScreenState,
  actionId: Exclude<
    PilotRouteRecordingScreenActionId,
    | 'generate-guest-url'
    | 'record-follow-up'
    | 'complete-follow-up'
    | 'record-qr-placement-evidence'
    | 'save-directions'
  >,
  now: (() => string) | undefined = defaultNow,
): PilotRouteRecordingScreenState {
  if (actionId === 'pause-route') {
    if (!['active', 'launch-ready'].includes(state.stage)) return state;
    return { ...state, stage: 'paused', launchUrl: undefined, expiresAt: undefined };
  }
  if (actionId === 'record-route') {
    return {
      ...state,
      stage: 'recorded',
      routeId: 'pilot-restroom-route',
    };
  }

  if (actionId === 'mark-test-passed') {
    return { ...state, stage: 'tested' };
  }

  if (actionId === 'mark-qr-placed') {
    return {
      ...state,
      hasQrPlacement: true,
      qaResults: {
        ...state.qaResults,
        'place-qr': {
          summary: 'Verified QR placed',
          recordedAt: now(),
        },
      },
    };
  }

  if (actionId === 'mark-staff-fallback-ready') {
    return {
      ...state,
      hasStaffFallbackNote: true,
      qaResults: {
        ...state.qaResults,
        'staff-fallback-note': {
          summary: 'Verified staff fallback note',
          recordedAt: now(),
        },
      },
    };
  }

  return { ...state, stage: 'active' };
}

export function recordPilotFollowUp(
  state: PilotRouteRecordingScreenState,
  now: (() => string) | undefined = defaultNow,
): PilotRouteRecordingScreenState {
  const target = deriveNextPilotImplementationTarget(state);
  const hasOpenFollowUpForTarget = state.followUps.some(
    (followUp) =>
      followUp.status === 'open' && followUp.targetId === target.id,
  );

  if (hasOpenFollowUpForTarget) {
    return state;
  }

  const followUp: PilotFollowUpAction = {
    id: `follow-up-${state.followUps.length + 1}`,
    targetId: target.id,
    targetLabel: target.label,
    status: 'open',
    createdAt: now(),
    snapshot: toPilotFollowUpSnapshot(state),
  };

  return {
    ...state,
    followUps: [...state.followUps, followUp],
  };
}

export function recordQrPlacementEvidence(
  state: PilotRouteRecordingScreenState,
  evidence: Omit<PilotQrPlacementEvidence, 'recordedAt'>,
  now: (() => string) | undefined = defaultNow,
): PilotRouteRecordingScreenState {
  const recordedAt = now();
  const location = evidence.location.trim() || 'QR placement location not specified';
  const orientation =
    evidence.orientation.trim() || 'QR orientation not specified';
  const note = evidence.note.trim() || 'No additional QR placement note';

  return {
    ...state,
    hasQrPlacement: true,
    qrPlacementEvidence: {
      location,
      orientation,
      note,
      recordedAt,
    },
    qaResults: {
      ...state.qaResults,
      'place-qr': {
        summary: `QR placed at ${location}; ${orientation}`,
        recordedAt,
      },
    },
  };
}

export function completePilotFollowUp(
  state: PilotRouteRecordingScreenState,
  followUpId: string,
): PilotRouteRecordingScreenState {
  return {
    ...state,
    followUps: state.followUps.map((followUp) =>
      followUp.id === followUpId
        ? {
            ...followUp,
            status: 'completed',
          }
        : followUp,
    ),
  };
}

export function createInitialPilotReadiness(): PilotReadinessApiState {
  return {
    hasQrPlacement: false,
    hasStaffFallbackNote: false,
    qaResults: {},
    qrPlacementEvidence: undefined,
  };
}

export function createInitialPilotRouteRecording(): PilotRouteRecordingApiState {
  return {
    stage: 'empty',
  };
}

export function createInitialPilotState(): PilotDevStateApiState {
  return {
    recording: createInitialPilotRouteRecording(),
    readiness: createInitialPilotReadiness(),
    followUps: [],
  };
}

export function toPilotReadinessApiState(
  state: PilotReadinessApiState,
): PilotReadinessApiState {
  return {
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
    qrPlacementEvidence: state.qrPlacementEvidence,
  };
}

export function toPilotRouteRecordingApiState(
  state: PilotRouteRecordingApiState,
): PilotRouteRecordingApiState {
  return {
    stage: state.stage,
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    expiresAt: state.expiresAt,
    directions: state.directions,
    routeVersion: state.routeVersion,
  };
}

export function isPilotReadinessAction(
  actionId: PilotRouteRecordingScreenActionId,
) {
  return (
    actionId === 'mark-qr-placed' ||
    actionId === 'mark-staff-fallback-ready' ||
    actionId === 'record-qr-placement-evidence'
  );
}

export function isPilotRouteRecordingAction(
  actionId: PilotRouteRecordingScreenActionId,
) {
  return (
    actionId === 'record-route' ||
    actionId === 'mark-test-passed' ||
    actionId === 'activate-route'
  );
}

function toPilotFollowUpSnapshot(
  state: PilotRouteRecordingScreenState,
): PilotFollowUpSnapshot {
  return {
    stage: state.stage,
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
    qrPlacementEvidence: state.qrPlacementEvidence,
  };
}

function createPilotReadinessChecklist(state: PilotRouteRecordingScreenState) {
  return [
    {
      id: 'record-route',
      label: 'Record route',
      complete: state.stage !== 'empty',
    },
    {
      id: 'test-route',
      label: 'Test route',
      complete: ['tested', 'active', 'launch-ready', 'paused'].includes(state.stage),
    },
    {
      id: 'place-qr',
      label: 'Place QR',
      complete: state.hasQrPlacement,
      resultNote: state.qaResults['place-qr'],
    },
    {
      id: 'staff-fallback-note',
      label: 'Staff fallback note',
      complete: state.hasStaffFallbackNote,
      resultNote: state.qaResults['staff-fallback-note'],
    },
  ];
}

function statusForPilotRouteRecordingStage(stage: PilotRouteRecordingScreenStage) {
  if (stage === 'paused') return 'Guest access paused';
  if (stage === 'empty') {
    return 'Route not recorded';
  }

  if (stage === 'recorded') {
    return 'Route recorded';
  }

  if (stage === 'tested') {
    return 'Test passed';
  }

  if (stage === 'active') {
    return 'Route active';
  }

  return 'Guest URL ready';
}

function defaultNow() {
  return '2026-09-01T10:00:00.000Z';
}
