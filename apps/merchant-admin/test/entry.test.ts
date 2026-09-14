import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createInitialPilotRouteRecordingScreenState,
  registerMerchantAdminElement,
  renderPilotRouteRecordingScreen,
  type MerchantAdminDocument,
  type MerchantAdminDomElement,
  type MerchantAdminElement,
  type MerchantAdminElementConstructor,
} from '../src/entry/index.ts';

describe('merchant admin browser entry', () => {
  it('renders the pilot route recording screen from UI state', () => {
    const document = createTestDocument();
    const state = createInitialPilotRouteRecordingScreenState();

    const screen = renderPilotRouteRecordingScreen(document, state);

    assert.equal(screen.getAttribute('data-screen'), 'pilot-route-recording');
    assert.match(screen.textContent ?? '', /Pilot route recording/);
    assert.match(screen.textContent ?? '', /Route not recorded/);
    assert.match(screen.textContent ?? '', /Pilot readiness/);
    assert.equal(screen.querySelectorAll('[data-action-id]').length, 6);
    assert.equal(screen.querySelectorAll('[data-checklist-id]').length, 4);
    assert.match(screen.textContent ?? '', /Pending: Record route/);
    assert.match(screen.textContent ?? '', /Pending: Place QR/);
    assert.equal(
      screen.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'false',
    );
  });

  it('tracks pilot QA checklist before generating a launch URL', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      generateGuestUrl: async () => ({
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
      }),
      now: () => '2026-09-01T10:15:00.000Z',
    });

    const MerchantAdminElement = registry.get('lechigo-merchant-admin');
    assert.ok(MerchantAdminElement);

    const element = new MerchantAdminElement() as unknown as TestMerchantHTMLElement & {
      connectedCallback(): void;
    };
    element.connectedCallback();

    const root = element.shadowRoot;
    assert.ok(root);

    assert.match(root.textContent ?? '', /Route not recorded/);
    assert.match(root.textContent ?? '', /Pending: Record route/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'false',
    );

    getActionButtons(root)[0]?.click();
    assert.match(root.textContent ?? '', /Route recorded/);
    assert.match(root.textContent ?? '', /Done: Record route/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'true',
    );

    getActionButtons(root)[1]?.click();
    assert.match(root.textContent ?? '', /Test passed/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(1)?.getAttribute('data-complete'),
      'true',
    );

    getActionButtons(root)[2]?.click();
    assert.match(root.textContent ?? '', /Route active/);
    assert.equal(getActionButtons(root)[3]?.disabled, true);

    getActionButtons(root)[4]?.click();
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(2)?.getAttribute('data-complete'),
      'true',
    );
    assert.match(
      root.textContent ?? '',
      /Verified QR placed at 2026-09-01T10:15:00.000Z/,
    );

    getActionButtons(root)[5]?.click();
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(3)?.getAttribute('data-complete'),
      'true',
    );
    assert.match(
      root.textContent ?? '',
      /Verified staff fallback note at 2026-09-01T10:15:00.000Z/,
    );
    assert.equal(getActionButtons(root)[3]?.disabled, false);

    getActionButtons(root)[3]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(root.textContent ?? '', /Guest URL ready/);
    assert.match(root.textContent ?? '', /\/\?token=/);
  });

  it('loads and saves pilot QA readiness through the environment API', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();
    const saves: unknown[] = [];

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadReadiness: async () => ({
        hasQrPlacement: true,
        hasStaffFallbackNote: false,
        qaResults: {
          'place-qr': {
            summary: 'Verified QR placed',
            recordedAt: '2026-09-01T10:10:00.000Z',
          },
        },
      }),
      saveReadiness: async (state) => {
        saves.push(state);
      },
      now: () => '2026-09-01T10:20:00.000Z',
    });

    const MerchantAdminElement = registry.get('lechigo-merchant-admin');
    assert.ok(MerchantAdminElement);

    const element = new MerchantAdminElement() as unknown as TestMerchantHTMLElement & {
      connectedCallback(): void;
    };
    element.connectedCallback();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const root = element.shadowRoot;
    assert.ok(root);
    assert.match(
      root.textContent ?? '',
      /Verified QR placed at 2026-09-01T10:10:00.000Z/,
    );

    getActionButtons(root)[0]?.click();
    getActionButtons(root)[1]?.click();
    getActionButtons(root)[2]?.click();
    getActionButtons(root)[5]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(saves.length, 1);
    assert.deepEqual(saves.at(0), {
      hasQrPlacement: true,
      hasStaffFallbackNote: true,
      qaResults: {
        'place-qr': {
          summary: 'Verified QR placed',
          recordedAt: '2026-09-01T10:10:00.000Z',
        },
        'staff-fallback-note': {
          summary: 'Verified staff fallback note',
          recordedAt: '2026-09-01T10:20:00.000Z',
        },
      },
    });
  });

  it('loads and saves pilot route recording through the environment API', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();
    const saves: unknown[] = [];

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadRouteRecording: async () => ({
        stage: 'tested',
        routeId: 'pilot-restroom-route',
        launchUrl: undefined,
      }),
      saveRouteRecording: async (state) => {
        saves.push(state);
      },
      generateGuestUrl: async () => ({
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
      }),
    });

    const MerchantAdminElement = registry.get('lechigo-merchant-admin');
    assert.ok(MerchantAdminElement);

    const element = new MerchantAdminElement() as unknown as TestMerchantHTMLElement & {
      connectedCallback(): void;
    };
    element.connectedCallback();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const root = element.shadowRoot;
    assert.ok(root);
    assert.match(root.textContent ?? '', /Test passed/);
    assert.match(root.textContent ?? '', /Route: pilot-restroom-route/);

    getActionButtons(root)[2]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(saves.at(0), {
      stage: 'active',
      routeId: 'pilot-restroom-route',
      launchUrl: undefined,
    });

    getActionButtons(root)[4]?.click();
    getActionButtons(root)[5]?.click();
    getActionButtons(root)[3]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(saves.at(-1), {
      stage: 'launch-ready',
      routeId: 'pilot-restroom-route',
      launchUrl: 'http://127.0.0.1:4173/?token=test-token',
    });
  });
});

function createTestDocument(): MerchantAdminDocument {
  return {
    createElement(tagName) {
      return new TestElement(tagName);
    },
  };
}

function getActionButtons(root: TestElement) {
  return root.querySelectorAll('[data-action-id]') as TestElement[];
}

class TestElement implements MerchantAdminDomElement {
  private readonly attributes = new Map<string, string>();
  private readonly children: MerchantAdminDomElement[] = [];
  private readonly listeners = new Map<string, (() => void)[]>();
  private ownTextContent: string | null = null;
  disabled = false;
  href = '';
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

  append(...nodes: MerchantAdminDomElement[]) {
    this.children.push(...nodes);
  }

  appendChild(node: MerchantAdminDomElement) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes: MerchantAdminDomElement[]) {
    this.children.splice(0, this.children.length, ...nodes);
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(name: string, listener: () => void) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  click() {
    for (const listener of this.listeners.get('click') ?? []) {
      listener();
    }
  }

  querySelectorAll(selector: string) {
    const attributeName = selector.match(/^\[([a-z-]+)\]$/)?.[1];

    if (!attributeName) {
      return [];
    }

    const matches: MerchantAdminDomElement[] = [];

    if (this.attributes.has(attributeName)) {
      matches.push(this);
    }

    for (const child of this.children) {
      matches.push(...child.querySelectorAll(selector));
    }

    return matches;
  }
}

function createTestCustomElementRegistry() {
  const constructors = new Map<string, MerchantAdminElementConstructor>();

  return {
    define(name: string, constructor: MerchantAdminElementConstructor) {
      constructors.set(name, constructor);
    },
    get(name: string) {
      return constructors.get(name);
    },
  };
}

class TestMerchantHTMLElement extends TestElement {
  shadowRoot: TestElement | null = null;

  constructor() {
    super('lechigo-merchant-admin');
  }

  attachShadow(init: { mode: 'open' }) {
    this.shadowRoot = new TestElement('shadow-root');
    this.shadowRoot.setAttribute('data-shadow-root', init.mode);
    return this.shadowRoot;
  }
}
