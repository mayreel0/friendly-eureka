export const routeCorePackage = '@lechigo/route-core';

export type RouteStatus = 'draft' | 'recorded' | 'test_failed' | 'tested' | 'active';
export type EntrySource = 'qr' | 'wifi';
export type TrackingConfidence = 'normal' | 'limited' | 'lost';

export type Anchor = {
  id: string;
  label: string;
  floor: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
  type: 'start' | 'landmark' | 'destination';
};

export type Segment = {
  id: string;
  fromAnchorId: string;
  toAnchorId: string;
  instruction: string;
  distanceMeters: number;
  floorTransition?: {
    type: 'stairs' | 'elevator' | 'ramp';
    fromFloor: number;
    toFloor: number;
  };
};

export type Route = {
  id: string;
  storeId: string;
  version: number;
  status: RouteStatus;
  recordedAt: string;
  testedAt?: string;
  passwordUpdatedAt?: string;
  passwordRetestRequired?: boolean;
  anchors: readonly Anchor[];
  segments: readonly Segment[];
};

export type WifiProof = {
  storeId: string;
  verifiedAt: string;
};

export type RouteDecision =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'route-not-tested'
        | 'route-test-stale'
        | 'route-not-active'
        | 'password-retest-required'
        | 'wifi-proof-missing'
        | 'wifi-proof-store-mismatch'
        | 'wifi-proof-expired';
    };

export type SerializedRoute = {
  id: string;
  storeId: string;
  version: number;
  anchors: readonly Anchor[];
  segments: readonly Segment[];
  totalDistanceMeters: number;
  floorTransitions: readonly {
    segmentId: string;
    type: 'stairs' | 'elevator' | 'ramp';
    fromFloor: number;
    toFloor: number;
  }[];
};

export type RouteGeometry = Pick<Route, 'id' | 'anchors' | 'segments'>;

const SESSION_TTL_MS = 20 * 60 * 1000;
const WIFI_PROOF_TTL_MS = 5 * 60 * 1000;
const DRIFT_RECOVERY_THRESHOLD_METERS = 1.5;

export function serializeRoute(route: Route): SerializedRoute {
  return {
    id: route.id,
    storeId: route.storeId,
    version: route.version,
    anchors: route.anchors,
    segments: route.segments,
    totalDistanceMeters: Number(
      route.segments
        .reduce((sum, segment) => sum + segment.distanceMeters, 0)
        .toFixed(1),
    ),
    floorTransitions: route.segments.flatMap((segment) =>
      segment.floorTransition
        ? [
            {
              segmentId: segment.id,
              ...segment.floorTransition,
            },
          ]
        : [],
    ),
  };
}

export function canActivateRoute(route: Route): RouteDecision {
  if (!route.testedAt) {
    return { ok: false, reason: 'route-not-tested' };
  }

  if (Date.parse(route.recordedAt) > Date.parse(route.testedAt)) {
    return { ok: false, reason: 'route-test-stale' };
  }

  if (route.passwordRetestRequired) {
    return { ok: false, reason: 'password-retest-required' };
  }

  return { ok: true };
}

export function rotateRoutePassword(route: Route, passwordUpdatedAt: string): Route {
  return {
    ...route,
    passwordUpdatedAt,
    passwordRetestRequired: false,
  };
}

export function canExposeRoute(input: {
  route: Route;
  source: EntrySource;
  at: string;
  wifiProof?: WifiProof;
}): RouteDecision {
  const activation = canActivateRoute(input.route);

  if (!activation.ok) {
    return activation;
  }

  if (input.route.status !== 'active') {
    return { ok: false, reason: 'route-not-active' };
  }

  if (input.source === 'qr') {
    return { ok: true };
  }

  return validateWifiProof(input.route, input.wifiProof, input.at);
}

export function createGuestSession(input: {
  route: Route;
  source: EntrySource;
  issuedAt: string;
  wifiProof?: WifiProof;
}) {
  const issuedAt = new Date(input.issuedAt);
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);
  const proofDecision =
    input.source === 'wifi'
      ? validateWifiProof(input.route, input.wifiProof, input.issuedAt)
      : undefined;
  const proofExpiresAt = input.wifiProof
    ? new Date(
        Date.parse(input.wifiProof.verifiedAt) + WIFI_PROOF_TTL_MS,
      ).toISOString()
    : undefined;

  return {
    routeId: input.route.id,
    routeVersion: input.route.version,
    storeId: input.route.storeId,
    source: input.source,
    issuedAt: input.issuedAt,
    expiresAt: expiresAt.toISOString(),
    proofExpiresAt,
    canViewPassword: proofDecision?.ok === true,
  };
}

export function assessProgress(input: {
  route: RouteGeometry;
  currentAnchorId: string;
  trackingConfidence: TrackingConfidence;
  driftMeters: number;
}):
  | {
      status: 'recover';
      reason: 'tracking-limited' | 'tracking-lost' | 'excessive-drift';
      nextAnchorId: string;
      instruction: string;
    }
  | {
      status: 'on-route';
      reason: 'tracking-normal';
    } {
  if (input.trackingConfidence !== 'normal') {
    return {
      status: 'recover',
      reason:
        input.trackingConfidence === 'lost'
          ? 'tracking-lost'
          : 'tracking-limited',
      ...describeRecoveryStep({
        route: input.route,
        currentAnchorId: input.currentAnchorId,
        reason:
          input.trackingConfidence === 'lost'
            ? 'tracking-lost'
            : 'tracking-limited',
      }),
    };
  }

  if (input.driftMeters > DRIFT_RECOVERY_THRESHOLD_METERS) {
    return {
      status: 'recover',
      reason: 'excessive-drift',
      ...describeRecoveryStep({
        route: input.route,
        currentAnchorId: input.currentAnchorId,
        reason: 'excessive-drift',
      }),
    };
  }

  return {
    status: 'on-route',
    reason: 'tracking-normal',
  };
}

export function describeRecoveryStep(input: {
  route: RouteGeometry;
  currentAnchorId: string;
  reason: 'tracking-limited' | 'tracking-lost' | 'excessive-drift';
}) {
  const nextAnchor = findNextAnchor(input.route, input.currentAnchorId);

  return {
    nextAnchorId: nextAnchor.id,
    instruction: `Point your camera at ${nextAnchor.label} to realign.`,
  };
}

function validateWifiProof(
  route: Route,
  wifiProof: WifiProof | undefined,
  at: string,
): RouteDecision {
  if (!wifiProof) {
    return { ok: false, reason: 'wifi-proof-missing' };
  }

  if (wifiProof.storeId !== route.storeId) {
    return { ok: false, reason: 'wifi-proof-store-mismatch' };
  }

  if (Date.parse(at) - Date.parse(wifiProof.verifiedAt) > WIFI_PROOF_TTL_MS) {
    return { ok: false, reason: 'wifi-proof-expired' };
  }

  return { ok: true };
}

function findNextAnchor(route: RouteGeometry, currentAnchorId: string): Anchor {
  const segment = route.segments.find(
    (candidate) => candidate.fromAnchorId === currentAnchorId,
  );
  const nextAnchorId = segment?.toAnchorId ?? route.anchors.at(-1)?.id;
  const nextAnchor = route.anchors.find((anchor) => anchor.id === nextAnchorId);

  if (!nextAnchor) {
    throw new Error(`Route ${route.id} has no recovery anchor.`);
  }

  return nextAnchor;
}
