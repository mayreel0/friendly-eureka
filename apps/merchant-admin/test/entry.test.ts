import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  createInitialPilotRouteRecordingScreenState,
  deriveNextPilotImplementationTarget,
  registerMerchantAdminElement,
  renderPilotRouteRecordingScreen,
  type MerchantAdminDocument,
  type MerchantAdminDomElement,
  type MerchantAdminElement,
  type MerchantAdminElementConstructor,
} from '../src/entry/index.ts';

describe('merchant admin browser entry', () => {
  it('derives the next pilot implementation target from route and QA state', () => {
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'empty',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'record-pilot-route',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'recorded',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'run-route-test',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'tested',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: false,
        qaResults: {},
        followUps: [],
      }).id,
      'activate-pilot-route',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'active',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: false,
        hasStaffFallbackNote: true,
        qaResults: {},
        followUps: [],
      }).id,
      'complete-pilot-readiness',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'active',
        routeId: 'pilot-restroom-route',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {},
        followUps: [],
      }).id,
      'generate-guest-url',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'launch-ready',
        routeId: 'pilot-restroom-route',
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {
          'place-qr': {
            summary: 'Verified QR placed',
            recordedAt: '2026-09-01T10:10:00.000Z',
          },
        },
        followUps: [],
      }).id,
      'record-qa-evidence',
    );
    assert.equal(
      deriveNextPilotImplementationTarget({
        stage: 'launch-ready',
        routeId: 'pilot-restroom-route',
        launchUrl: 'http://127.0.0.1:4173/?token=test-token',
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
        followUps: [],
      }).id,
      'run-guest-pilot-qa',
    );
  });

  it('renders the pilot route recording screen from UI state', () => {
    const document = createTestDocument();
    const state = createInitialPilotRouteRecordingScreenState();

    const screen = renderPilotRouteRecordingScreen(document, state);

    assert.equal(screen.getAttribute('data-screen'), 'pilot-route-recording');
    assert.equal(screen.getAttribute('data-dashboard'), 'merchant-pilot');
    assert.match(screen.textContent ?? '', /Merchant pilot dashboard/);
    assert.match(screen.textContent ?? '', /Route status/);
    assert.match(screen.textContent ?? '', /Route not recorded/);
    assert.match(screen.textContent ?? '', /0 of 6 pilot steps complete/);
    assert.match(screen.textContent ?? '', /Next: Record pilot route/);
    assert.match(screen.textContent ?? '', /Next target/);
    assert.match(screen.textContent ?? '', /Record pilot route/);
    assert.match(screen.textContent ?? '', /Pilot readiness/);
    assert.match(screen.textContent ?? '', /QR placement evidence/);
    assert.match(screen.textContent ?? '', /Guest launch/);
    assert.match(screen.textContent ?? '', /Open follow-ups/);
    assert.equal(screen.querySelectorAll('[data-dashboard-panel]').length, 7);
    assert.equal(screen.querySelectorAll('[data-progress-summary]').length, 1);
    assert.equal(screen.querySelectorAll('[data-action-id]').length, 10);
    assert.equal(screen.querySelectorAll('[data-checklist-id]').length, 4);
    assert.equal(screen.querySelectorAll('[data-qr-placement-location]').length, 1);
    assert.match(screen.textContent ?? '', /Pending: Record route/);
    assert.match(screen.textContent ?? '', /Pending: Place QR/);
    assert.equal(
      screen.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'false',
    );
  });

  it('renders a copy-safe guest launch URL when launch is ready', () => {
    const document = createTestDocument();
    const screen = renderPilotRouteRecordingScreen(
      document,
      {
        ...createInitialPilotRouteRecordingScreenState(),
        stage: 'launch-ready',
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {},
        followUps: [],
        routeId: 'pilot-restroom-route',
        launchUrl: '/?token=test-token',
      },
      {
        guestOrigin: 'http://127.0.0.1:4173',
      },
    );

    assert.match(screen.textContent ?? '', /http:\/\/127\.0\.0\.1:4173\/\?token=test-token/);
    assert.equal(screen.querySelectorAll('[data-launch-url]').length, 1);
    assert.equal(screen.querySelectorAll('[data-launch-copy-url]').length, 1);
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
    assert.match(root.textContent ?? '', /0 of 6 pilot steps complete/);
    assert.match(root.textContent ?? '', /Pending: Record route/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'false',
    );

    getActionButton(root, 'record-route')?.click();
    assert.match(root.textContent ?? '', /Route recorded/);
    assert.match(root.textContent ?? '', /1 of 6 pilot steps complete/);
    assert.match(root.textContent ?? '', /Next: Run route test/);
    assert.match(root.textContent ?? '', /Done: Record route/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(0)?.getAttribute('data-complete'),
      'true',
    );

    getActionButton(root, 'mark-test-passed')?.click();
    assert.match(root.textContent ?? '', /Test passed/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(1)?.getAttribute('data-complete'),
      'true',
    );

    getActionButton(root, 'activate-route')?.click();
    assert.match(root.textContent ?? '', /Route active/);
    assert.match(root.textContent ?? '', /3 of 6 pilot steps complete/);
    assert.equal(getActionButton(root, 'generate-guest-url')?.disabled, true);

    getActionButton(root, 'mark-qr-placed')?.click();
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(2)?.getAttribute('data-complete'),
      'true',
    );
    assert.match(
      root.textContent ?? '',
      /Verified QR placed at 2026-09-01T10:15:00.000Z/,
    );

    getActionButton(root, 'mark-staff-fallback-ready')?.click();
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(3)?.getAttribute('data-complete'),
      'true',
    );
    assert.match(
      root.textContent ?? '',
      /Verified staff fallback note at 2026-09-01T10:15:00.000Z/,
    );
    assert.match(root.textContent ?? '', /5 of 6 pilot steps complete/);
    assert.match(root.textContent ?? '', /Next: Generate guest URL/);
    assert.equal(getActionButton(root, 'generate-guest-url')?.disabled, false);

    getActionButton(root, 'generate-guest-url')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(root.textContent ?? '', /Guest URL ready/);
    assert.match(root.textContent ?? '', /6 of 6 pilot steps complete/);
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

    getActionButton(root, 'record-route')?.click();
    getActionButton(root, 'mark-test-passed')?.click();
    getActionButton(root, 'activate-route')?.click();
    getActionButton(root, 'mark-staff-fallback-ready')?.click();
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
      qrPlacementEvidence: undefined,
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

    getActionButton(root, 'activate-route')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(saves.at(0), {
      stage: 'active',
      routeId: 'pilot-restroom-route',
      launchUrl: undefined,
    });

    getActionButton(root, 'mark-qr-placed')?.click();
    getActionButton(root, 'mark-staff-fallback-ready')?.click();
    getActionButton(root, 'generate-guest-url')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(saves.at(-1), {
      stage: 'launch-ready',
      routeId: 'pilot-restroom-route',
      launchUrl: 'http://127.0.0.1:4173/?token=test-token',
    });
  });

  it('loads and saves the consolidated pilot state through the environment API', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();
    const saves: unknown[] = [];

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadPilotState: async () => ({
        recording: {
          stage: 'active',
          routeId: 'pilot-restroom-route',
        },
        readiness: {
          hasQrPlacement: true,
          hasStaffFallbackNote: false,
          qaResults: {
            'place-qr': {
              summary: 'Verified QR placed',
              recordedAt: '2026-09-01T10:10:00.000Z',
            },
          },
        },
      }),
      savePilotState: async (state) => {
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
    assert.match(root.textContent ?? '', /Route active/);
    assert.match(
      root.textContent ?? '',
      /Verified QR placed at 2026-09-01T10:10:00.000Z/,
    );

    getActionButton(root, 'mark-staff-fallback-ready')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(saves.at(0), {
      recording: {
        stage: 'active',
        routeId: 'pilot-restroom-route',
        launchUrl: undefined,
      },
      readiness: {
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
        qrPlacementEvidence: undefined,
      },
      followUps: [],
    });
  });

  it('recovers QR placement readiness from saved placement evidence', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadPilotState: async () => ({
        recording: {
          stage: 'active',
          routeId: 'pilot-restroom-route',
        },
        readiness: {
          hasQrPlacement: false,
          hasStaffFallbackNote: false,
          qaResults: {},
          qrPlacementEvidence: {
            location: 'Entrance counter',
            orientation: 'Guest-facing',
            note: 'Visible from queue',
            recordedAt: '2026-09-01T10:10:00.000Z',
          },
        },
      }),
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
    assert.match(root.textContent ?? '', /QR placed at Entrance counter; Guest-facing/);
    assert.equal(
      root.querySelectorAll('[data-checklist-id]').at(2)?.getAttribute('data-complete'),
      'true',
    );
  });

  it('records physical QR placement evidence through the dashboard', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();
    const saves: unknown[] = [];

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadPilotState: async () => ({
        recording: {
          stage: 'active',
          routeId: 'pilot-restroom-route',
        },
        readiness: {
          hasQrPlacement: false,
          hasStaffFallbackNote: true,
          qaResults: {},
        },
        followUps: [],
      }),
      savePilotState: async (state) => {
        saves.push(state);
      },
      now: () => '2026-09-01T10:40:00.000Z',
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
    assert.match(root.textContent ?? '', /QR placement evidence/);
    assert.match(root.textContent ?? '', /Save QR evidence/);
    assert.equal(getActionButton(root, 'generate-guest-url')?.disabled, true);

    getField(root, 'data-qr-placement-location').value = 'Front counter stand';
    getField(root, 'data-qr-placement-orientation').value =
      'Faces guests entering from the cafe door';
    getField(root, 'data-qr-placement-note').value =
      'Eye-level placard with clear restroom arrow';
    getActionButton(root, 'record-qr-placement-evidence')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(root.textContent ?? '', /Saved 2026-09-01T10:40:00.000Z/);
    assert.match(root.textContent ?? '', /Front counter stand/);
    assert.equal(getActionButton(root, 'generate-guest-url')?.disabled, false);
    assert.deepEqual(saves.at(0), {
      recording: {
        stage: 'active',
        routeId: 'pilot-restroom-route',
        launchUrl: undefined,
      },
      readiness: {
        hasQrPlacement: true,
        hasStaffFallbackNote: true,
        qaResults: {
          'place-qr': {
            summary:
              'QR placed at Front counter stand; Faces guests entering from the cafe door',
            recordedAt: '2026-09-01T10:40:00.000Z',
          },
        },
        qrPlacementEvidence: {
          location: 'Front counter stand',
          orientation: 'Faces guests entering from the cafe door',
          note: 'Eye-level placard with clear restroom arrow',
          recordedAt: '2026-09-01T10:40:00.000Z',
        },
      },
      followUps: [],
    });
  });

  it('records and completes follow-up actions from the current next target', async () => {
    const registry = createTestCustomElementRegistry();
    const document = createTestDocument();
    const saves: unknown[] = [];

    registerMerchantAdminElement({
      customElements: registry,
      HTMLElement: TestMerchantHTMLElement,
      document,
      loadPilotState: async () => ({
        recording: {
          stage: 'active',
          routeId: 'pilot-restroom-route',
        },
        readiness: {
          hasQrPlacement: false,
          hasStaffFallbackNote: true,
          qaResults: {},
        },
        followUps: [],
      }),
      savePilotState: async (state) => {
        saves.push(state);
      },
      now: () => '2026-09-01T10:30:00.000Z',
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
    assert.match(root.textContent ?? '', /Complete pilot readiness/);

    getActionButton(root, 'record-follow-up')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(root.textContent ?? '', /Open follow-ups/);
    assert.match(root.textContent ?? '', /Completed follow-ups/);
    assert.match(root.textContent ?? '', /Complete pilot readiness/);
    assert.match(root.textContent ?? '', /Mark done/);
    assert.equal(root.querySelectorAll('[data-follow-up-status]').length, 1);
    assert.deepEqual(saves.at(0), {
      recording: {
        stage: 'active',
        routeId: 'pilot-restroom-route',
        launchUrl: undefined,
      },
      readiness: {
        hasQrPlacement: false,
        hasStaffFallbackNote: true,
        qaResults: {},
        qrPlacementEvidence: undefined,
      },
      followUps: [
        {
          id: 'follow-up-1',
          targetId: 'complete-pilot-readiness',
          targetLabel: 'Complete pilot readiness',
          status: 'open',
          createdAt: '2026-09-01T10:30:00.000Z',
          snapshot: {
            stage: 'active',
            routeId: 'pilot-restroom-route',
            launchUrl: undefined,
            hasQrPlacement: false,
            hasStaffFallbackNote: true,
            qaResults: {},
            qrPlacementEvidence: undefined,
          },
        },
      ],
    });

    getActionButton(root, 'record-follow-up')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(root.querySelectorAll('[data-follow-up-status]').length, 1);
    assert.equal(saves.length, 2);
    assert.equal(
      (saves.at(1) as { followUps?: { status?: string }[] }).followUps?.length,
      1,
    );

    getActionButton(root, 'complete-follow-up')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.match(root.textContent ?? '', /completed/);
    assert.doesNotMatch(root.textContent ?? '', /Mark done/);
    assert.equal(
      root
        .querySelectorAll('[data-follow-up-status]')
        .at(0)
        ?.getAttribute('data-follow-up-status'),
      'completed',
    );
    assert.deepEqual(
      (saves.at(2) as { followUps?: { status?: string }[] }).followUps?.[0]?.status,
      'completed',
    );
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

function getActionButton(root: TestElement, actionId: string) {
  return getActionButtons(root).find(
    (button) => button.getAttribute('data-action-id') === actionId,
  );
}

function getField(root: TestElement, attributeName: string) {
  const field = root.querySelectorAll(`[${attributeName}]`).at(0) as
    | TestElement
    | undefined;
  assert.ok(field);
  return field;
}

class TestElement implements MerchantAdminDomElement {
  private readonly attributes = new Map<string, string>();
  private readonly children: MerchantAdminDomElement[] = [];
  private readonly listeners = new Map<string, (() => void)[]>();
  private ownTextContent: string | null = null;
  disabled = false;
  href = '';
  value = '';
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
