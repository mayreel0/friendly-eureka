import { canActivateRoute, type Route } from '../../../packages/route-core/src/index.ts';

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
