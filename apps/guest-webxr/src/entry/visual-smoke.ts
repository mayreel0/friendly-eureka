import {
  type GuestEntryElementConstructor,
  type GuestEntryElementConfig,
  type GuestEntryElementEnvironment,
  registerGuestEntryElement,
} from './index.ts';
import type { SerializedRoute } from '../../../../packages/route-core/src/index.ts';

type BrowserGuestEntryElement = HTMLElement & {
  configure(config: GuestEntryElementConfig): void;
};

type VisualSmokeCase = {
  id: string;
  expectedScreen: string;
  expectedText: string;
  config: GuestEntryElementConfig;
};

const route: SerializedRoute = {
  id: 'pilot-restroom-route',
  storeId: 'pilot-store',
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
};

const cases: VisualSmokeCase[] = [
  {
    id: 'scan-required',
    expectedScreen: 'scan-required',
    expectedText: 'scan-required',
    config: createBaseConfig({
      token: undefined,
      route: undefined,
    }),
  },
  {
    id: 'route-load-failed',
    expectedScreen: 'error',
    expectedText: 'route-load-failed',
    config: createBaseConfig({
      route: undefined,
      routeLoadError: 'route-load-failed',
    }),
  },
  {
    id: 'manual-fallback',
    expectedScreen: 'manual-fallback',
    expectedText: 'Manual route guidance',
    config: createBaseConfig({
      route,
    }),
  },
];

export async function runGuestFallbackVisualSmoke(
  input: {
    document: Document;
    customElements: CustomElementRegistry;
    HTMLElement: typeof HTMLElement;
  } = {
    document,
    customElements,
    HTMLElement,
  },
) {
  registerGuestEntryElement(createBrowserGuestEntryEnvironment(input));
  await input.customElements.whenDefined('lechigo-guest-entry');

  const root = input.document.querySelector('[data-visual-smoke-root]');
  const result = input.document.querySelector('[data-visual-smoke-result]');

  if (!root || !result) {
    throw new Error('visual-smoke-root-missing');
  }

  const failures: string[] = [];

  for (const testCase of cases) {
    const host = input.document.createElement('section');
    host.setAttribute('data-visual-smoke-case', testCase.id);

    const heading = input.document.createElement('h2');
    heading.textContent = testCase.id;

    const entry = input.document.createElement(
      'lechigo-guest-entry',
    ) as BrowserGuestEntryElement;

    host.append(heading, entry);
    root.append(host);
    entry.configure(testCase.config);
    await nextFrame();

    const screen = entry.shadowRoot?.querySelector('[data-screen]');
    const screenName = screen?.getAttribute('data-screen');
    const text = screen?.textContent ?? '';
    const box = screen?.getBoundingClientRect();

    if (screenName !== testCase.expectedScreen) {
      failures.push(`${testCase.id}: expected ${testCase.expectedScreen}, got ${screenName}`);
    }

    if (!text.includes(testCase.expectedText)) {
      failures.push(`${testCase.id}: missing text ${testCase.expectedText}`);
    }

    if (!box || box.width <= 0 || box.height <= 0) {
      failures.push(`${testCase.id}: screen has no visible layout box`);
    }
  }

  const status = failures.length === 0 ? 'pass' : 'fail';
  result.setAttribute('data-visual-smoke-result', status);
  result.textContent = status === 'pass' ? 'pass' : failures.join('\n');

  return {
    status,
    failures,
  };
}

function createBrowserGuestEntryEnvironment(input: {
  document: Document;
  customElements: CustomElementRegistry;
  HTMLElement: typeof HTMLElement;
}): GuestEntryElementEnvironment {
  return {
    document: input.document,
    HTMLElement: input.HTMLElement as unknown as GuestEntryElementEnvironment['HTMLElement'],
    customElements: {
      define(name, constructor) {
        input.customElements.define(name, constructor as unknown as CustomElementConstructor);
      },
      get(name) {
        return input.customElements.get(name) as
          | GuestEntryElementConstructor
          | undefined;
      },
    },
  };
}

function createBaseConfig(
  overrides: Partial<GuestEntryElementConfig>,
): GuestEntryElementConfig {
  return {
    route: undefined,
    token: 'visual-smoke-token',
    network: 'online',
    arSupport: 'manual',
    currentAnchorId: 'entrance',
    trackingConfidence: 'normal',
    driftMeters: 0,
    ...overrides,
  };
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

void runGuestFallbackVisualSmoke().catch((error: unknown) => {
  const result = document.querySelector('[data-visual-smoke-result]');
  if (result) {
    result.setAttribute('data-visual-smoke-result', 'fail');
    result.textContent = error instanceof Error ? error.message : 'visual-smoke-failed';
  }
});
