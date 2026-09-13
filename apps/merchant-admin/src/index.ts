import { canActivateRoute, type Route } from '../../../packages/route-core/src/index.ts';
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
  const merchant = input.merchant ?? pilotMerchant;
  const store = registerStore(context, pilotStore);

  const draft = requireApiOk(
    saveRouteDraft(context, {
      merchant,
      storeId: pilotStoreId,
      route: {
        id: pilotRouteId,
        version: 1,
        recordedAt: '2026-09-01T09:00:00.000Z',
        anchors: [
          {
            id: 'entrance',
            label: 'Entrance',
            floor: 1,
            position: { x: 0, y: 0, z: 0 },
            type: 'start',
          },
          {
            id: 'hallway',
            label: 'Main Hallway',
            floor: 1,
            position: { x: 4, y: 0, z: 1 },
            type: 'landmark',
          },
          {
            id: 'restroom',
            label: 'Restroom',
            floor: 1,
            position: { x: 8, y: 0, z: 1 },
            type: 'destination',
          },
        ],
        segments: [
          {
            id: 'segment-1',
            fromAnchorId: 'entrance',
            toAnchorId: 'hallway',
            instruction: 'Walk toward the main hallway.',
            distanceMeters: 4,
          },
          {
            id: 'segment-2',
            fromAnchorId: 'hallway',
            toAnchorId: 'restroom',
            instruction: 'Turn right at Main Hallway and continue to the restroom.',
            distanceMeters: 4.2,
          },
        ],
      },
    }),
  );
  requireApiOk(
    recordTestRun(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      testedAt: '2026-09-01T09:10:00.000Z',
      result: 'pass',
    }),
  );
  const activation = requireApiOk(
    activateRoute(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );
  const qr = requireApiOk(
    issueQrCredential(context, {
      merchant,
      storeId: pilotStoreId,
      routeId: pilotRouteId,
    }),
  );
  const session = requireApiOk(
    createQrSession(context, {
      storeId: pilotStoreId,
      routeId: pilotRouteId,
      qrKey: qr.qrKey,
      clientKey: input.clientKey ?? 'local-dev-browser',
    }),
  );

  return {
    merchant,
    store,
    route: activation.route,
    draftRoute: draft.route,
    qrKey: qr.qrKey,
    token: session.token,
    expiresAt: session.expiresAt,
    launchUrl: `/?token=${encodeURIComponent(session.token)}`,
  };
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
