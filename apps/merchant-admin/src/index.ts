import { canActivateRoute, type Route } from '../../../packages/route-core/src/index.ts';
import { defaultPilotDirections, type PilotDirections } from './pilot-directions.ts';
import {
  activateRoute,
  createQrSession,
  issueQrCredential,
  recordTestRun,
  registerStore,
  saveRouteDraft,
  type ApiContext,
  type MerchantPrincipal,
  type StoreRecord,
} from '../../api/src/server.ts';

export const pilotStoreId = 'pilot-store';
export const pilotRouteId = 'pilot-restroom-route';
export type PilotRouteRecordingStage =
  | 'empty'
  | 'recorded'
  | 'tested'
  | 'active'
  | 'paused'
  | 'launch-ready';
export type PilotRouteRecordingUiActionId =
  | 'record-route'
  | 'mark-test-passed'
  | 'activate-route'
  | 'generate-guest-url';
export type PilotRouteRecordingUiState = {
  context: ApiContext;
  merchant: MerchantPrincipal;
  clientKey: string;
  stage: PilotRouteRecordingStage;
  store?: StoreRecord;
  route?: Route;
  draftRoute?: Route;
  qrKey?: string;
  token?: string;
  expiresAt?: string;
  launchUrl?: string;
  directions?: PilotDirections;
  routeVersion?: number;
  testRecordedAt?: string;
};

export function merchantAdminSurface() {
  return 'merchant-admin';
}

export function resolveMerchantRouteActions(route: Route) {
  const activation = canActivateRoute(route);

  return {
    canRecord: true,
    canRunTest: true,
    canActivate: activation.ok,
    canRotatePassword: true,
    blockingReason: activation.ok ? undefined : activation.reason,
  };
}

export function buildActivationChecklist(input: {
  hasRecordedRoute: boolean;
  hasPassingTestRun: boolean;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
}) {
  return [
    { id: 'record-route', complete: input.hasRecordedRoute },
    { id: 'test-route', complete: input.hasPassingTestRun },
    { id: 'place-qr', complete: input.hasQrPlacement },
    { id: 'staff-fallback-note', complete: input.hasStaffFallbackNote },
  ];
}

export function recordPilotRestroomRoute(
  context: ApiContext,
  input: {
    merchant?: MerchantPrincipal;
    clientKey?: string;
  } = {},
) {
  const recorded = recordPilotRouteDraft(
    createPilotRouteRecordingUiState(context, input),
  );
  const tested = markPilotRouteTestPassed(recorded);
  const active = activatePilotRoute(tested);
  const launchReady = generatePilotGuestUrl(active);

  return {
    merchant: launchReady.merchant,
    store: requireDefined(launchReady.store, 'store'),
    route: requireDefined(launchReady.route, 'route'),
    draftRoute: requireDefined(launchReady.draftRoute, 'draftRoute'),
    qrKey: requireDefined(launchReady.qrKey, 'qrKey'),
    token: requireDefined(launchReady.token, 'token'),
    expiresAt: requireDefined(launchReady.expiresAt, 'expiresAt'),
    launchUrl: requireDefined(launchReady.launchUrl, 'launchUrl'),
  };
}

export function createPilotRouteRecordingUiState(
  context: ApiContext,
  input: {
    merchant?: MerchantPrincipal;
    clientKey?: string;
    directions?: PilotDirections;
    routeVersion?: number;
    testRecordedAt?: string;
  } = {},
): PilotRouteRecordingUiState {
  return {
    context,
    merchant: input.merchant ?? pilotMerchant,
    clientKey: input.clientKey ?? 'local-dev-browser',
    stage: 'empty',
    directions: input.directions,
    routeVersion: input.routeVersion,
    testRecordedAt: input.testRecordedAt,
  };
}

export function applyPilotRouteRecordingUiAction(
  state: PilotRouteRecordingUiState,
  actionId: PilotRouteRecordingUiActionId,
): PilotRouteRecordingUiState {
  if (actionId === 'record-route') {
    return recordPilotRouteDraft(state);
  }

  if (actionId === 'mark-test-passed') {
    return markPilotRouteTestPassed(state);
  }

  if (actionId === 'activate-route') {
    return activatePilotRoute(state);
  }

  return generatePilotGuestUrl(state);
}

export function renderPilotRouteRecordingUi(state: PilotRouteRecordingUiState) {
  return {
    screen: 'pilot-route-recording',
    stage: state.stage,
    title: 'Pilot route recording',
    status: statusForPilotRouteRecordingStage(state.stage),
    routeId: state.route?.id,
    launchUrl: state.launchUrl,
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
        label: 'Activate route',
        enabled: state.stage === 'tested',
      },
      {
        id: 'generate-guest-url',
        label: 'Generate guest URL',
        enabled: state.stage === 'active',
      },
    ] satisfies {
      id: PilotRouteRecordingUiActionId;
      label: string;
      enabled: boolean;
    }[],
  };
}

function recordPilotRouteDraft(
  state: PilotRouteRecordingUiState,
): PilotRouteRecordingUiState {
  const directions = state.directions ?? defaultPilotDirections;
  // These are simulated anchors for manual guidance, not recorded AR coordinates.
  const anchors: Route['anchors'] = Array.from({ length: directions.length + 1 }, (_, index) => ({
    id: index === 0 ? 'entrance' : index === directions.length ? 'restroom' : directions.length === 2 ? 'hallway' : `landmark-${index}`,
    label: index === 0 ? 'Entrance' : index === directions.length ? 'Restroom' : directions.length === 2 ? 'Main Hallway' : `Landmark ${index}`,
    type: index === 0 ? 'start' : index === directions.length ? 'destination' : 'landmark',
    floor: 1,
    position: { x: index * 4, y: 0, z: index === 0 ? 0 : 1 },
  }));
  const store = registerStore(state.context, {
    ...pilotStore,
    merchantId: state.merchant.id,
  });
  const draft = requireApiOk(
    saveRouteDraft(state.context, {
      merchant: state.merchant,
      storeId: pilotStoreId,
      route: {
        id: pilotRouteId,
        version: state.routeVersion ?? 1,
        recordedAt: '2026-09-01T09:00:00.000Z',
        anchors,
        segments: directions.map((step, index) => ({
          id: `segment-${index + 1}`,
          fromAnchorId: anchors[index].id,
          toAnchorId: anchors[index + 1].id,
          ...step,
        })),
      },
    }),
  );

  return {
    ...state,
    stage: 'recorded',
    store,
    route: draft.route,
    draftRoute: draft.route,
  };
}

function markPilotRouteTestPassed(
  state: PilotRouteRecordingUiState,
): PilotRouteRecordingUiState {
  const testRun = requireApiOk(
    recordTestRun(state.context, {
      merchant: state.merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      testedAt: state.testRecordedAt ?? '2026-09-01T09:10:00.000Z',
      result: 'pass',
    }),
  );

  return {
    ...state,
    stage: 'tested',
    route: testRun.route,
  };
}

function activatePilotRoute(
  state: PilotRouteRecordingUiState,
): PilotRouteRecordingUiState {
  const activation = requireApiOk(
    activateRoute(state.context, {
      merchant: state.merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );

  return {
    ...state,
    stage: 'active',
    route: activation.route,
  };
}

function generatePilotGuestUrl(
  state: PilotRouteRecordingUiState,
): PilotRouteRecordingUiState {
  const qr = requireApiOk(
    issueQrCredential(state.context, {
      merchant: state.merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );
  const session = requireApiOk(
    createQrSession(state.context, {
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      qrKey: qr.qrKey,
      clientKey: state.clientKey,
    }),
  );

  return {
    ...state,
    stage: 'launch-ready',
    route: requireDefined(state.route, 'route'),
    qrKey: qr.qrKey,
    token: session.token,
    expiresAt: session.expiresAt,
    launchUrl: `/?token=${encodeURIComponent(session.token)}`,
  };
}

function statusForPilotRouteRecordingStage(stage: PilotRouteRecordingStage) {
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

const pilotMerchant: MerchantPrincipal = {
  id: 'pilot-merchant',
  storeIds: [pilotStoreId],
  role: 'merchant',
};

const pilotStore: StoreRecord = {
  id: pilotStoreId,
  merchantId: pilotMerchant.id,
  name: 'Pilot Store',
  restroomPassword: '2468',
};

function requireApiOk<T extends object>(
  result: ({ ok: true } & T) | { ok: false; status: number; error: string },
): { ok: true } & T {
  if (!result.ok) {
    throw new Error(`Failed to record pilot restroom route: ${result.error}`);
  }

  return result;
}

function requireDefined<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(`Failed to record pilot restroom route: missing ${name}`);
  }

  return value;
}
