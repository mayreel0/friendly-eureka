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
        | 'wifi-proof-expired'
        | 'invalid-timestamp';
    };

export type GuestSession = {
  routeId: string;
  routeVersion: number;
  storeId: string;
  source: EntrySource;
  issuedAt: string;
  expiresAt: string;
  proofExpiresAt?: string;
  canViewPassword: boolean;
};

export type GuestSessionResult =
  | { ok: true; session: GuestSession }
  | { ok: false; reason: 'invalid-timestamp' };

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
}): GuestSessionResult {
  const issuedAtMs = parseTimestamp(input.issuedAt);

  if (issuedAtMs === undefined) {
    return { ok: false, reason: 'invalid-timestamp' };
  }

  const expiresAt = new Date(issuedAtMs + SESSION_TTL_MS);
  const proofDecision =
    input.source === 'wifi'
      ? validateWifiProof(input.route, input.wifiProof, input.issuedAt)
      : undefined;
  const proofExpiresAt = input.wifiProof
    ? addMsToTimestamp(input.wifiProof.verifiedAt, WIFI_PROOF_TTL_MS)
    : undefined;

  if (input.wifiProof && proofExpiresAt === undefined) {
    return { ok: false, reason: 'invalid-timestamp' };
  }

  return {
    ok: true,
    session: {
      routeId: input.route.id,
      routeVersion: input.route.version,
      storeId: input.route.storeId,
      source: input.source,
      issuedAt: input.issuedAt,
      expiresAt: expiresAt.toISOString(),
      proofExpiresAt,
      canViewPassword: proofDecision?.ok === true,
    },
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
      nextAnchorId?: string;
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

  if (!nextAnchor) {
    return {
      instruction:
        'Look for the nearest store landmark or ask staff for directions.',
    };
  }

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

  const atMs = parseTimestamp(at);
  const verifiedAtMs = parseTimestamp(wifiProof.verifiedAt);

  if (atMs === undefined || verifiedAtMs === undefined) {
    return { ok: false, reason: 'invalid-timestamp' };
  }

  if (atMs - verifiedAtMs > WIFI_PROOF_TTL_MS) {
    return { ok: false, reason: 'wifi-proof-expired' };
  }

  return { ok: true };
}

function findNextAnchor(
  route: RouteGeometry,
  currentAnchorId: string,
): Anchor | undefined {
  const segment = route.segments.find(
    (candidate) => candidate.fromAnchorId === currentAnchorId,
  );
  const nextAnchorId = segment?.toAnchorId ?? route.anchors.at(-1)?.id;

  return route.anchors.find((anchor) => anchor.id === nextAnchorId);
}

function addMsToTimestamp(value: string, ms: number): string | undefined {
  const timestamp = parseTimestamp(value);

  if (timestamp === undefined) {
    return undefined;
  }

  return new Date(timestamp + ms).toISOString();
}

function parseTimestamp(value: string): number | undefined {
  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp) ? timestamp : undefined;
}
