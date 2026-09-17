import {
  assessProgress,
  type SerializedRoute,
  type TrackingConfidence,
} from '../../../../packages/route-core/src/index.ts';

export type ArSupport = 'webxr' | 'ios-app-clip' | 'manual';
export type NetworkState = 'online' | 'offline';
export type GuestFallbackElement = {
  textContent: string | null;
  append(...nodes: GuestFallbackElement[]): void;
  appendChild(node: GuestFallbackElement): GuestFallbackElement;
  replaceChildren(...nodes: GuestFallbackElement[]): void;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  querySelectorAll(selector: string): GuestFallbackElement[];
};

export type GuestFallbackDocument = {
  createElement(tagName: string): GuestFallbackElement;
};

export type GuestEntryElementConfig = {
  route: SerializedRoute | undefined;
  session?: GuestRouteSessionSummary;
  token: string | undefined;
  network: NetworkState;
  arSupport: ArSupport;
  routeLoadError?: string;
  routeLoadStatus?: number;
  preview?: boolean;
  currentAnchorId: string;
  trackingConfidence: TrackingConfidence;
  driftMeters: number;
};

export type GuestRouteSessionSummary = {
  source: 'qr' | 'wifi';
  expiresAt: string;
  canViewPassword: boolean;
};

export type GuestEntryElementConstructor = {
  new (): {
    shadowRoot: GuestFallbackElement | null;
    attachShadow(init: { mode: 'open' }): GuestFallbackElement;
    connectedCallback(): void;
    configure(config: GuestEntryElementConfig): void;
  };
};

export type GuestEntryElementRegistry = {
  define(name: string, constructor: GuestEntryElementConstructor): void;
  get(name: string): GuestEntryElementConstructor | undefined;
};

export type GuestEntryElementEnvironment = {
  customElements: GuestEntryElementRegistry;
  HTMLElement: new () => {
    shadowRoot: GuestFallbackElement | null;
    attachShadow(init: { mode: 'open' }): GuestFallbackElement;
  };
  document: GuestFallbackDocument;
};

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
  routeLoadError?: string;
}) {
  if (!input.token) {
    return {
      screen: 'scan-required',
      canStartAr: false,
      canUseManualFallback: false,
    };
  }

  if (input.routeLoadError) {
    return {
      screen: 'error',
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
  if (!hasUsableGuidanceGeometry(input.route, input.currentAnchorId)) {
    return {
      mode: 'fallback',
      instruction: 'Follow posted signs or ask staff for restroom directions.',
      nextAnchorId: undefined,
    };
  }

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

export function summarizeRoute(route: SerializedRoute) {
  const destination =
    route.anchors.find((anchor) => anchor.type === 'destination') ??
    route.anchors.at(-1);
  const firstSegment = route.segments.at(0);
  const firstStepAnchor = route.anchors.find(
    (anchor) => anchor.id === firstSegment?.toAnchorId,
  );

  return {
    destinationLabel: destination?.label ?? 'Restroom',
    totalDistanceLabel: `${route.totalDistanceMeters} meters`,
    firstStepInstruction:
      firstSegment?.instruction ?? 'Follow posted signs to the restroom.',
    firstStepLabel: firstStepAnchor?.label ?? destination?.label,
  };
}

export function summarizeRouteSteps(route: SerializedRoute) {
  const anchorsById = new Map(route.anchors.map((anchor) => [anchor.id, anchor]));

  return route.segments.map((segment) => {
    const toAnchor = anchorsById.get(segment.toAnchorId);

    return {
      segmentId: segment.id,
      instruction: segment.instruction,
      distanceLabel: `${segment.distanceMeters} meters`,
      landmarkLabel: toAnchor?.label ?? segment.toAnchorId,
    };
  });
}

function hasUsableGuidanceGeometry(
  route: SerializedRoute,
  currentAnchorId: string,
) {
  if (!route.anchors.some((anchor) => anchor.id === currentAnchorId)) {
    return false;
  }

  const anchorIds = new Set(route.anchors.map((anchor) => anchor.id));

  return route.segments.every(
    (segment) =>
      anchorIds.has(segment.fromAnchorId) && anchorIds.has(segment.toAnchorId),
  );
}

export function renderGuestFallbackScreen(
  document: GuestFallbackDocument,
  input: {
    route: SerializedRoute;
    session?: GuestRouteSessionSummary;
    currentAnchorId: string;
    trackingConfidence: TrackingConfidence;
    driftMeters: number;
  },
): GuestFallbackElement {
  return renderGuestRouteScreen(document, {
    ...input,
    screen: 'manual-fallback',
  });
}

export function renderGuestRouteScreen(
  document: GuestFallbackDocument,
  input: {
    route: SerializedRoute;
    session?: GuestRouteSessionSummary;
    currentAnchorId: string;
    trackingConfidence: TrackingConfidence;
    driftMeters: number;
    screen: 'ready' | 'manual-fallback';
  },
): GuestFallbackElement {
  const guidance = buildArGuidance(input);
  const summary = summarizeRoute(input.route);
  const section = document.createElement('section');
  section.setAttribute('data-screen', input.screen);
  section.setAttribute('data-guidance-mode', guidance.mode);

  const heading = document.createElement('h1');
  heading.textContent =
    input.screen === 'ready' ? 'Route ready' : 'Manual route guidance';

  const destination = document.createElement('p');
  destination.setAttribute('data-route-summary', 'destination');
  destination.textContent = `Destination: ${summary.destinationLabel}`;

  const distance = document.createElement('p');
  distance.setAttribute('data-route-summary', 'distance');
  distance.textContent = `Distance: ${summary.totalDistanceLabel}`;

  const firstStep = document.createElement('p');
  firstStep.setAttribute('data-route-summary', 'first-step');
  firstStep.textContent = `First step: ${summary.firstStepInstruction}`;

  const instruction = document.createElement('p');
  instruction.setAttribute('data-current-guidance', guidance.mode);
  instruction.textContent =
    guidance.mode === 'recovery'
      ? `Recovery: ${guidance.instruction}`
      : guidance.instruction;

  const session = input.session
    ? renderSessionSummary(document, input.session)
    : undefined;

  if (summary.firstStepLabel) {
    const firstStepTarget = document.createElement('p');
    firstStepTarget.setAttribute('data-route-summary', 'first-step-target');
    firstStepTarget.textContent = `Next landmark: ${summary.firstStepLabel}`;
    section.append(heading, destination, distance, firstStep, firstStepTarget);
  } else {
    section.append(heading, destination, distance, firstStep);
  }

  if (session) {
    section.append(session);
  }

  section.append(instruction);

  const steps = document.createElement('ol');
  steps.setAttribute('data-route-steps', 'true');

  for (const step of summarizeRouteSteps(input.route)) {
    const item = document.createElement('li');
    item.setAttribute('data-route-step-id', step.segmentId);
    item.textContent = `${step.instruction} ${step.distanceLabel}. Next: ${step.landmarkLabel}.`;
    steps.appendChild(item);
  }

  const anchors = document.createElement('ol');
  anchors.setAttribute('data-route-landmarks', 'true');

  for (const anchor of input.route.anchors) {
    const item = document.createElement('li');
    item.setAttribute('data-anchor-id', anchor.id);
    item.textContent = anchor.label;
    anchors.appendChild(item);
  }

  section.append(steps, anchors);
  return section;
}

function renderSessionSummary(
  document: GuestFallbackDocument,
  session: GuestRouteSessionSummary,
) {
  const summary = document.createElement('p');
  summary.setAttribute('data-session-summary', session.source);
  summary.textContent = `${session.source.toUpperCase()} session expires at ${session.expiresAt}.`;

  if (!session.canViewPassword) {
    summary.textContent += ' Restroom password remains locked.';
  }

  return summary;
}

function describeEntryStatus(
  state: ReturnType<typeof resolveEntryState>,
  routeLoadError: string | undefined,
) {
  if (state.screen === 'error') {
    return routeLoadError ?? 'route-load-failed';
  }

  if (state.screen === 'scan-required') {
    return 'scan-required: Scan the venue QR code to start restroom guidance.';
  }

  if (state.screen === 'loading') {
    return 'loading: Loading route guidance.';
  }

  if (state.screen === 'offline') {
    return 'offline: Reconnect to load this route.';
  }

  return state.screen;
}

export function registerGuestEntryElement(
  environment: GuestEntryElementEnvironment,
  tagName = 'lechigo-guest-entry',
) {
  const existing = environment.customElements.get(tagName);

  if (existing) {
    return existing;
  }

  const { HTMLElement, document } = environment;

  class LechigoGuestEntryElement extends HTMLElement {
    private config: GuestEntryElementConfig | undefined;

    configure(config: GuestEntryElementConfig) {
      this.config = config;
      this.render();
    }

    connectedCallback() {
      this.render();
    }

    private render() {
      if (!this.config) {
        return;
      }

      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      const state = resolveEntryState(this.config);

      if (
        (state.screen === 'manual-fallback' || state.screen === 'ready') &&
        this.config.route
      ) {
        root.replaceChildren(
          renderGuestRouteScreen(document, {
            route: this.config.route,
            session: this.config.session,
            currentAnchorId: this.config.currentAnchorId,
            trackingConfidence: this.config.trackingConfidence,
            driftMeters: this.config.driftMeters,
            screen: state.screen,
          }),
        );
        return;
      }

      const status = document.createElement('section');
      status.setAttribute('data-screen', state.screen);
      status.textContent = describeEntryStatus(state, this.config.routeLoadError);
      root.replaceChildren(status);
    }
  }

  environment.customElements.define(tagName, LechigoGuestEntryElement);
  return LechigoGuestEntryElement;
}
