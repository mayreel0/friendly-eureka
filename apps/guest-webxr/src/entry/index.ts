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
  token: string | undefined;
  network: NetworkState;
  arSupport: ArSupport;
  currentAnchorId: string;
  trackingConfidence: TrackingConfidence;
  driftMeters: number;
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

export function renderGuestFallbackScreen(
  document: GuestFallbackDocument,
  input: {
    route: SerializedRoute;
    currentAnchorId: string;
    trackingConfidence: TrackingConfidence;
    driftMeters: number;
  },
): GuestFallbackElement {
  const guidance = buildArGuidance(input);
  const section = document.createElement('section');
  section.setAttribute('data-screen', 'manual-fallback');

  const heading = document.createElement('h1');
  heading.textContent = 'Manual route guidance';

  const instruction = document.createElement('p');
  instruction.textContent = guidance.instruction;

  const distance = document.createElement('p');
  distance.textContent = `${input.route.totalDistanceMeters} meters`;

  const anchors = document.createElement('ol');

  for (const anchor of input.route.anchors) {
    const item = document.createElement('li');
    item.setAttribute('data-anchor-id', anchor.id);
    item.textContent = anchor.label;
    anchors.appendChild(item);
  }

  section.append(heading, instruction, distance, anchors);
  return section;
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

      if (state.screen === 'manual-fallback' && this.config.route) {
        root.replaceChildren(
          renderGuestFallbackScreen(document, {
            route: this.config.route,
            currentAnchorId: this.config.currentAnchorId,
            trackingConfidence: this.config.trackingConfidence,
            driftMeters: this.config.driftMeters,
          }),
        );
        return;
      }

      const status = document.createElement('section');
      status.setAttribute('data-screen', state.screen);
      status.textContent = state.screen;
      root.replaceChildren(status);
    }
  }

  environment.customElements.define(tagName, LechigoGuestEntryElement);
  return LechigoGuestEntryElement;
}
