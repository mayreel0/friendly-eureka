import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildArGuidance,
  detectArSupport,
  type GuestEntryElementConstructor,
  type GuestFallbackDocument,
  type GuestFallbackElement,
  guestEntrySurface,
  registerGuestEntryElement,
  renderGuestFallbackScreen,
  resolveEntryState,
} from '../src/entry/index.ts';

const route = {
  id: 'route-1',
  storeId: 'store-1',
  version: 1,
  anchors: [
    {
      id: 'entrance',
      label: 'Entrance',
      floor: 1,
      position: { x: 0, y: 0, z: 0 },
      type: 'start',
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
      toAnchorId: 'restroom',
      instruction: 'Follow the hallway to the restroom.',
      distanceMeters: 8,
    },
  ],
  totalDistanceMeters: 8,
  floorTransitions: [],
} as const;

describe('guest WebXR entry', () => {
  it('keeps the first QR screen actionable without local persistence', () => {
    assert.equal(guestEntrySurface(), 'guest-webxr');

    assert.deepEqual(
      resolveEntryState({
        token: undefined,
        route: undefined,
        network: 'online',
        arSupport: 'webxr',
      }),
      {
        screen: 'scan-required',
        canStartAr: false,
        canUseManualFallback: false,
      },
    );

    assert.deepEqual(
      resolveEntryState({
        token: 'signed-token',
        route,
        network: 'online',
        arSupport: 'webxr',
      }),
      {
        screen: 'ready',
        canStartAr: true,
        canUseManualFallback: true,
      },
    );
  });

  it('detects WebXR, App Clip handoff, and manual fallback surfaces', () => {
    assert.equal(
      detectArSupport({
        webglAvailable: true,
        xrAvailable: true,
        immersiveArSupported: true,
        platform: 'android',
      }),
      'webxr',
    );

    assert.equal(
      detectArSupport({
        webglAvailable: true,
        xrAvailable: false,
        immersiveArSupported: false,
        platform: 'ios',
      }),
      'ios-app-clip',
    );

    assert.equal(
      detectArSupport({
        webglAvailable: false,
        xrAvailable: false,
        immersiveArSupported: false,
        platform: 'desktop',
      }),
      'manual',
    );
  });

  it('falls back to landmark guidance when AR tracking is degraded', () => {
    assert.deepEqual(
      buildArGuidance({
        route,
        currentAnchorId: 'entrance',
        trackingConfidence: 'limited',
        driftMeters: 0.3,
      }),
      {
        mode: 'recovery',
        instruction: 'Point your camera at Restroom to realign.',
        nextAnchorId: 'restroom',
      },
    );

    assert.deepEqual(
      buildArGuidance({
        route,
        currentAnchorId: 'entrance',
        trackingConfidence: 'normal',
        driftMeters: 0.2,
      }),
      {
        mode: 'ar',
        instruction: 'Follow the hallway to the restroom.',
        nextAnchorId: 'restroom',
      },
    );
  });

  it('renders a non-blank manual fallback screen in a browser document', () => {
    const document = createTestDocument();

    const screen = renderGuestFallbackScreen(document, {
      route,
      currentAnchorId: 'entrance',
      trackingConfidence: 'normal',
      driftMeters: 0.2,
    });

    assert.equal(screen.getAttribute('data-screen'), 'manual-fallback');
    assert.match(screen.textContent ?? '', /Manual route guidance/);
    assert.match(screen.textContent ?? '', /Follow the hallway to the restroom\./);
    assert.match(screen.textContent ?? '', /8 meters/);
    assert.equal(screen.querySelectorAll('[data-anchor-id]').length, 2);
  });

  it('registers a lightweight custom element shell for fallback rendering', () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();

    registerGuestEntryElement({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    });

    registerGuestEntryElement({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    });

    assert.equal(registry.defineCalls.length, 1);
    assert.equal(registry.defineCalls[0]?.name, 'lechigo-guest-entry');

    const GuestEntryElement = registry.get('lechigo-guest-entry');
    assert.ok(GuestEntryElement);

    const element = new GuestEntryElement();
    element.configure({
      route,
      token: 'signed-token',
      network: 'online',
      arSupport: 'manual',
      currentAnchorId: 'entrance',
      trackingConfidence: 'normal',
      driftMeters: 0.2,
    });
    element.connectedCallback();

    assert.equal(element.shadowRoot?.getAttribute('data-shadow-root'), 'open');
    const screens = element.shadowRoot?.querySelectorAll('[data-screen]') ?? [];

    assert.equal(screens.length, 1);
    assert.equal(screens[0]?.getAttribute('data-screen'), 'manual-fallback');
    assert.match(element.shadowRoot?.textContent ?? '', /Manual route guidance/);
    assert.match(element.shadowRoot?.textContent ?? '', /Follow the hallway to the restroom\./);
  });
});

function createTestDocument(): GuestFallbackDocument {
  return {
    createElement(tagName) {
      return new TestElement(tagName);
    },
  };
}

class TestElement implements GuestFallbackElement {
  private readonly attributes = new Map<string, string>();
  private readonly children: GuestFallbackElement[] = [];
  private ownTextContent: string | null = null;
  readonly tagName: string;

  constructor(tagName: string) {
    this.tagName = tagName;
  }

  get textContent() {
    const childText = this.children
      .map((child) => child.textContent ?? '')
      .join('');

    return `${this.ownTextContent ?? ''}${childText}`;
  }

  set textContent(value: string | null) {
    this.ownTextContent = value;
  }

  append(...nodes: GuestFallbackElement[]) {
    this.children.push(...nodes);
  }

  appendChild(node: GuestFallbackElement) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: GuestFallbackElement[]) {
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll(selector: string) {
    const attributeName = selector.match(/^\[([a-z-]+)\]$/)?.[1];

    if (!attributeName) {
      return [];
    }

    return this.findElementsWithAttribute(attributeName);
  }

  private findElementsWithAttribute(name: string): GuestFallbackElement[] {
    const matches: GuestFallbackElement[] = this.getAttribute(name) ? [this] : [];

    for (const child of this.children) {
      matches.push(...child.querySelectorAll(`[${name}]`));
    }

    return matches;
  }
}

class TestGuestHTMLElement {
  shadowRoot: GuestFallbackElement | null = null;

  attachShadow(init: { mode: 'open' }) {
    const root = new TestElement('shadow-root');
    root.setAttribute('data-shadow-root', init.mode);
    this.shadowRoot = root;
    return root;
  }
}

function createTestCustomElementRegistry() {
  const definitions = new Map<string, GuestEntryElementConstructor>();

  return {
    defineCalls: [] as Array<{
      name: string;
      constructor: GuestEntryElementConstructor;
    }>,

    define(name: string, constructor: GuestEntryElementConstructor) {
      definitions.set(name, constructor);
      this.defineCalls.push({ name, constructor });
    },

    get(name: string) {
      return definitions.get(name);
    },
  };
}
