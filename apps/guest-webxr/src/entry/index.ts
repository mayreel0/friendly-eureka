import {
  assessProgress,
  type SerializedRoute,
  type TrackingConfidence,
} from '../../../../packages/route-core/src/index.ts';

export type ArSupport = 'webxr' | 'ios-app-clip' | 'manual';
export type NetworkState = 'online' | 'offline';

export function guestEntrySurface() {
  return 'guest-webxr';
}

export function detectArSupport(input: {
  webglAvailable: boolean;
  xrAvailable: boolean;
  immersiveArSupported: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}): ArSupport {
  if (input.webglAvailable && input.xrAvailable && input.immersiveArSupported) {
    return 'webxr';
  }

  if (input.platform === 'ios') {
    return 'ios-app-clip';
  }

  return 'manual';
}

export function resolveEntryState(input: {
  token: string | undefined;
  route: SerializedRoute | undefined;
  network: NetworkState;
  arSupport: ArSupport;
}) {
  if (!input.token) {
    return {
      screen: 'scan-required',
      canStartAr: false,
      canUseManualFallback: false,
    };
  }

  if (input.network === 'offline' && !input.route) {
    return {
      screen: 'offline',
      canStartAr: false,
      canUseManualFallback: false,
    };
  }

  if (!input.route) {
    return {
      screen: 'loading',
      canStartAr: false,
      canUseManualFallback: false,
    };
  }

  if (input.arSupport === 'manual') {
    return {
      screen: 'manual-fallback',
      canStartAr: false,
      canUseManualFallback: true,
    };
  }

  return {
    screen: 'ready',
    canStartAr: true,
    canUseManualFallback: true,
  };
}

export function buildArGuidance(input: {
  route: SerializedRoute;
  currentAnchorId: string;
  trackingConfidence: TrackingConfidence;
  driftMeters: number;
}) {
  const progress = assessProgress({
    route: input.route,
    currentAnchorId: input.currentAnchorId,
    trackingConfidence: input.trackingConfidence,
    driftMeters: input.driftMeters,
  });

  if (progress.status === 'recover') {
    return {
      mode: 'recovery',
      instruction: progress.instruction,
      nextAnchorId: progress.nextAnchorId,
    };
  }

  const segment = input.route.segments.find(
    (candidate) => candidate.fromAnchorId === input.currentAnchorId,
  );

  return {
    mode: 'ar',
    instruction: segment?.instruction ?? 'Continue to the restroom.',
    nextAnchorId: segment?.toAnchorId ?? input.route.anchors.at(-1)?.id,
  };
}
