import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type GuestEntryElementConfig,
  type GuestEntryElementConstructor,
  type GuestFallbackDocument,
  type GuestFallbackElement,
} from '../src/entry/index.ts';
import {
  bootstrapGuestEntry,
  createHttpGuestRouteLoader,
  parseGuestSessionToken,
} from '../src/entry/bootstrap.ts';

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

describe('guest WebXR browser bootstrap', () => {
  it('reads the guest token from the URL and loads route guidance', async () => {
    const document = createTestDocument();
    const registry = createTestCustomElementRegistry();

    const result = bootstrapGuestEntry({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    }, {
      location: {
        search: '?token=signed-token',
        hash: '',
      },
      routeLoader: async ({ token }) => ({
        ok: true,
        route,
      }),
    });

    assert.equal(result.configured, true);
    assert.ok(result.routeLoad);
    assert.equal(document.host.configurations.length, 1);
    assert.equal(document.host.configurations[0]?.token, 'signed-token');
    assert.equal(
      document.host.shadowRoot?.querySelectorAll('[data-screen]').at(0)?.getAttribute('data-screen'),
      'loading',
    );

    await result.routeLoad;

    assert.equal(document.host.configurations.length, 2);
    assert.equal(document.host.configurations[1]?.route?.id, 'route-1');
    assert.equal(registry.defineCalls.length, 1);
    assert.equal(registry.defineCalls[0]?.name, 'lechigo-guest-entry');
    assert.equal(
      document.host.shadowRoot?.querySelectorAll('[data-screen]').at(0)?.getAttribute('data-screen'),
      'manual-fallback',
    );
    assert.match(document.host.shadowRoot?.textContent ?? '', /Manual route guidance/);
  });

  it('renders an error state when route loading fails', async () => {
    const document = createTestDocument();
    const registry = createTestCustomElementRegistry();

    const result = bootstrapGuestEntry({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    }, {
      location: {
        search: '',
        hash: '#token=expired-token',
      },
      routeLoader: async () => ({
        ok: false,
        status: 401,
        error: 'token-expired',
      }),
    });

    assert.ok(result.routeLoad);

    await result.routeLoad;

    assert.equal(
      document.host.shadowRoot?.querySelectorAll('[data-screen]').at(0)?.getAttribute('data-screen'),
      'error',
    );
    assert.match(document.host.shadowRoot?.textContent ?? '', /token-expired/);
  });

  it('keeps guests in scan-required when the URL has no token', () => {
    const document = createTestDocument();
    const registry = createTestCustomElementRegistry();

    const result = bootstrapGuestEntry({
      customElements: registry,
      HTMLElement: TestGuestHTMLElement,
      document,
    }, {
      location: {
        search: '',
        hash: '',
      },
      routeLoader: async () => {
        throw new Error('route loader should not run without a token');
      },
    });

    assert.equal(result.configured, true);
    assert.equal(result.routeLoad, undefined);
    assert.equal(document.host.configurations.length, 1);
    assert.equal(document.host.configurations[0]?.token, undefined);
    assert.equal(
      document.host.shadowRoot?.querySelectorAll('[data-screen]').at(0)?.getAttribute('data-screen'),
      'scan-required',
    );
  });

  it('parses QR session tokens from query strings and hash fragments', () => {
    assert.equal(
      parseGuestSessionToken({
        search: '?token=query-token',
        hash: '',
      }),
      'query-token',
    );
    assert.equal(
      parseGuestSessionToken({
        search: '',
        hash: '#token=hash-token',
      }),
      'hash-token',
    );
    assert.equal(
      parseGuestSessionToken({
        search: '?token=',
        hash: '#token=fallback-token',
      }),
      'fallback-token',
    );
  });

  it('fetches guest routes using the API service response contract', async () => {
    const requests: string[] = [];
    const loader = createHttpGuestRouteLoader({
      endpoint: '/api/guest/routes',
      fetch: async (url) => {
        requests.push(String(url));
        return new Response(
          JSON.stringify({
            ok: true,
            route: {
              id: 'route-1',
              storeId: 'store-1',
              version: 1,
              anchors: [],
              segments: [],
              totalDistanceMeters: 0,
              floorTransitions: [],
            },
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          },
        );
      },
    });

    const result = await loader({ token: 'signed token' });

    assert.deepEqual(requests, ['/api/guest/routes?token=signed+token']);
    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.route.id : undefined, 'route-1');
  });

  it('reports a stable error when the API route returns non-JSON', async () => {
    const loader = createHttpGuestRouteLoader({
      endpoint: '/api/guest/routes',
      fetch: async () =>
        new Response('Not found', {
          status: 404,
          headers: {
            'content-type': 'text/plain; charset=utf-8',
          },
        }),
    });

    assert.deepEqual(await loader({ token: 'signed-token' }), {
      ok: false,
      status: 404,
      error: 'route-load-failed',
    });
  });
});

function createTestDocument(): GuestFallbackDocument & {
  host: TestGuestHostElement;
  querySelector(selector: string): TestGuestHostElement | null;
} {
  const host = new TestGuestHostElement();

  return {
    host,

    createElement(tagName) {
      return new TestElement(tagName);
    },

    querySelector(selector) {
      return selector === 'lechigo-guest-entry' || selector === '[data-guest-entry]'
        ? host
        : null;
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

class TestGuestHostElement {
  readonly configurations: GuestEntryElementConfig[] = [];
  private element: InstanceType<GuestEntryElementConstructor> | undefined;

  get shadowRoot() {
    return this.element?.shadowRoot ?? null;
  }

  configure(config: GuestEntryElementConfig) {
    this.configurations.push(config);
    this.ensureElement().configure(config);
  }

  private ensureElement() {
    if (!this.element) {
      this.element = new registeredGuestEntryElement();
    }

    return this.element;
  }
}

let registeredGuestEntryElement: GuestEntryElementConstructor;

function createTestCustomElementRegistry() {
  return {
    defineCalls: [] as Array<{
      name: string;
      constructor: GuestEntryElementConstructor;
    }>,

    define(name: string, constructor: GuestEntryElementConstructor) {
      registeredGuestEntryElement = constructor;
      this.defineCalls.push({ name, constructor });
    },

    get() {
      return registeredGuestEntryElement;
    },
  };
}
