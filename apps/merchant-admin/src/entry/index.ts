export type PilotRouteRecordingScreenStage =
  | 'empty'
  | 'recorded'
  | 'tested'
  | 'active'
  | 'launch-ready';

export type PilotRouteRecordingScreenActionId =
  | 'record-route'
  | 'mark-test-passed'
  | 'activate-route'
  | 'mark-qr-placed'
  | 'mark-staff-fallback-ready'
  | 'generate-guest-url';

export type PilotRouteRecordingScreenState = {
  stage: PilotRouteRecordingScreenStage;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  routeId?: string;
  launchUrl?: string;
};

export type MerchantAdminElement = {
  shadowRoot: ShadowRootLike | null;
  attachShadow(init: { mode: 'open' }): ShadowRootLike;
  connectedCallback(): void;
  click(): void;
};

export type MerchantAdminDocument = {
  createElement(tagName: string): MerchantAdminDomElement;
};

export type MerchantAdminElementConstructor = new () => {
  shadowRoot: ShadowRootLike | null;
  attachShadow(init: { mode: 'open' }): ShadowRootLike;
  connectedCallback(): void;
};

export type MerchantAdminElementRegistry = {
  get(tagName: string): MerchantAdminElementConstructor | undefined;
  define(tagName: string, constructor: MerchantAdminElementConstructor): void;
};

export type MerchantAdminElementEnvironment = {
  customElements: MerchantAdminElementRegistry;
  HTMLElement: new () => {
    shadowRoot: ShadowRootLike | null;
    attachShadow(init: { mode: 'open' }): ShadowRootLike;
  };
  document: MerchantAdminDocument;
  generateGuestUrl?: () => Promise<{ launchUrl: string }>;
  guestOrigin?: string;
};

export type MerchantAdminDomElement = {
  textContent: string | null;
  disabled: boolean;
  href: string;
  append(...nodes: MerchantAdminDomElement[]): void;
  appendChild(node: MerchantAdminDomElement): MerchantAdminDomElement;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  querySelectorAll(selector: string): MerchantAdminDomElement[];
  addEventListener(type: 'click', listener: () => void): void;
};

type ShadowRootLike = {
  replaceChildren(...nodes: MerchantAdminDomElement[]): void;
};

export function createInitialPilotRouteRecordingScreenState(): PilotRouteRecordingScreenState {
  return {
    stage: 'empty',
    hasQrPlacement: false,
    hasStaffFallbackNote: false,
  };
}

export function renderPilotRouteRecordingScreen(
  document: MerchantAdminDocument,
  state: PilotRouteRecordingScreenState,
  options: { guestOrigin?: string } = {},
): MerchantAdminDomElement {
  const view = createPilotRouteRecordingView(state);
  const section = document.createElement('section');
  section.setAttribute('data-screen', 'pilot-route-recording');
  section.setAttribute('data-stage', view.stage);

  const style = document.createElement('style');
  style.textContent = `
    :host {
      display: block;
      min-height: 100vh;
      background: #f6f7f9;
      color: #17202a;
    }

    section {
      box-sizing: border-box;
      width: min(100%, 760px);
      margin: 0 auto;
      padding: 32px 20px;
    }

    h1 {
      margin: 0 0 12px;
      font-size: 1.75rem;
      line-height: 1.2;
    }

    h2 {
      margin: 28px 0 12px;
      font-size: 1rem;
      line-height: 1.3;
    }

    p {
      margin: 0 0 16px;
      color: #46515f;
    }

    [data-status] {
      color: #17202a;
      font-weight: 700;
    }

    [data-actions] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 24px 0;
    }

    button {
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid #b9c0ca;
      border-radius: 6px;
      background: #ffffff;
      color: #17202a;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    button:disabled {
      color: #8b95a1;
      cursor: not-allowed;
      background: #eceff3;
    }

    ol {
      display: grid;
      gap: 8px;
      margin: 20px 0 0;
      padding-left: 22px;
    }

    li[data-complete="true"] {
      color: #0f766e;
      font-weight: 700;
    }

    li[data-complete="false"] {
      color: #6b7280;
    }

    a {
      overflow-wrap: anywhere;
      color: #0f766e;
      font-weight: 700;
    }
  `;

  const heading = document.createElement('h1');
  heading.textContent = view.title;

  const status = document.createElement('p');
  status.setAttribute('data-status', view.stage);
  status.textContent = view.status;

  const route = document.createElement('p');
  route.textContent = view.routeId ? `Route: ${view.routeId}` : 'Route: none';

  const actions = document.createElement('div');
  actions.setAttribute('data-actions', 'pilot-route-recording');

  for (const action of view.actions) {
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('data-action-id', action.id);
    button.textContent = action.label;
    button.disabled = !action.enabled;
    actions.appendChild(button);
  }

  const checklist = document.createElement('ol');
  checklist.setAttribute('data-checklist', 'pilot-readiness');

  for (const item of view.checklist) {
    const checklistItem = document.createElement('li');
    checklistItem.setAttribute('data-checklist-id', item.id);
    checklistItem.setAttribute('data-complete', String(item.complete));
    checklistItem.textContent = `${item.complete ? 'Done' : 'Pending'}: ${item.label}`;
    checklist.appendChild(checklistItem);
  }

  const launch = document.createElement('a');
  const launchUrl = toGuestLaunchUrl(view.launchUrl, options.guestOrigin);
  launch.setAttribute('data-launch-url', 'guest-webxr');
  launch.href = launchUrl ?? '';
  launch.textContent = launchUrl ?? 'Guest URL unavailable';

  const checklistHeading = document.createElement('h2');
  checklistHeading.textContent = 'Pilot readiness';

  section.append(
    style,
    heading,
    status,
    route,
    actions,
    launch,
    checklistHeading,
    checklist,
  );
  return section;
}

export function registerMerchantAdminElement(
  environment: MerchantAdminElementEnvironment,
  tagName = 'lechigo-merchant-admin',
): MerchantAdminElementConstructor {
  const existing = environment.customElements.get(tagName);

  if (existing) {
    return existing;
  }

  const { HTMLElement, document } = environment;

  class LechigoMerchantAdminElement extends HTMLElement {
    private state = createInitialPilotRouteRecordingScreenState();

    connectedCallback() {
      this.render();
    }

    private render() {
      const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
      const screen = renderPilotRouteRecordingScreen(document, this.state, {
        guestOrigin: environment.guestOrigin ?? 'http://127.0.0.1:4173',
      });

      for (const button of screen.querySelectorAll('[data-action-id]')) {
        const actionId = button.getAttribute(
          'data-action-id',
        ) as PilotRouteRecordingScreenActionId | null;

        if (!actionId || button.disabled) {
          continue;
        }

        button.addEventListener('click', () => {
          void this.applyAction(actionId);
        });
      }

      root.replaceChildren(screen);
    }

    private async applyAction(actionId: PilotRouteRecordingScreenActionId) {
      if (actionId === 'generate-guest-url') {
        const guestSession = await generateGuestSession(environment);
        this.state = {
          ...this.state,
          stage: 'launch-ready',
          launchUrl: guestSession.launchUrl,
        };
      } else {
        this.state = applyLocalPilotRouteRecordingAction(this.state, actionId);
      }

      this.render();
    }
  }

  environment.customElements.define(tagName, LechigoMerchantAdminElement);
  return LechigoMerchantAdminElement;
}

function createPilotRouteRecordingView(state: PilotRouteRecordingScreenState) {
  const checklist = createPilotReadinessChecklist(state);
  const isReadyToLaunch = checklist.every((item) => item.complete);

  return {
    stage: state.stage,
    title: 'Pilot route recording',
    status: statusForPilotRouteRecordingStage(state.stage),
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    checklist,
    actions: [
      {
        id: 'record-route',
        label: 'Record route',
        enabled: state.stage === 'empty',
      },
      {
        id: 'mark-test-passed',
        label: 'Mark test passed',
        enabled: state.stage === 'recorded',
      },
      {
        id: 'activate-route',
        label: 'Activate route',
        enabled: state.stage === 'tested',
      },
      {
        id: 'generate-guest-url',
        label: 'Generate guest URL',
        enabled: state.stage === 'active' && isReadyToLaunch,
      },
      {
        id: 'mark-qr-placed',
        label: 'Confirm QR placed',
        enabled: state.stage === 'active' && !state.hasQrPlacement,
      },
      {
        id: 'mark-staff-fallback-ready',
        label: 'Confirm fallback note',
        enabled: state.stage === 'active' && !state.hasStaffFallbackNote,
      },
    ] satisfies {
      id: PilotRouteRecordingScreenActionId;
      label: string;
      enabled: boolean;
    }[],
  };
}

function applyLocalPilotRouteRecordingAction(
  state: PilotRouteRecordingScreenState,
  actionId: Exclude<PilotRouteRecordingScreenActionId, 'generate-guest-url'>,
): PilotRouteRecordingScreenState {
  if (actionId === 'record-route') {
    return {
      ...state,
      stage: 'recorded',
      routeId: 'pilot-restroom-route',
    };
  }

  if (actionId === 'mark-test-passed') {
    return { ...state, stage: 'tested' };
  }

  if (actionId === 'mark-qr-placed') {
    return { ...state, hasQrPlacement: true };
  }

  if (actionId === 'mark-staff-fallback-ready') {
    return { ...state, hasStaffFallbackNote: true };
  }

  return { ...state, stage: 'active' };
}

function createPilotReadinessChecklist(state: PilotRouteRecordingScreenState) {
  return [
    {
      id: 'record-route',
      label: 'Record route',
      complete: state.stage !== 'empty',
    },
    {
      id: 'test-route',
      label: 'Test route',
      complete: ['tested', 'active', 'launch-ready'].includes(state.stage),
    },
    {
      id: 'place-qr',
      label: 'Place QR',
      complete: state.hasQrPlacement,
    },
    {
      id: 'staff-fallback-note',
      label: 'Staff fallback note',
      complete: state.hasStaffFallbackNote,
    },
  ];
}

async function generateGuestSession(environment: MerchantAdminElementEnvironment) {
  if (environment.generateGuestUrl) {
    return environment.generateGuestUrl();
  }

  const response = await fetch('/api/dev/pilot-route-session');

  if (!response.ok) {
    throw new Error('Failed to generate guest URL');
  }

  return (await response.json()) as { launchUrl: string };
}

function statusForPilotRouteRecordingStage(stage: PilotRouteRecordingScreenStage) {
  if (stage === 'empty') {
    return 'Route not recorded';
  }

  if (stage === 'recorded') {
    return 'Route recorded';
  }

  if (stage === 'tested') {
    return 'Test passed';
  }

  if (stage === 'active') {
    return 'Route active';
  }

  return 'Guest URL ready';
}

function toGuestLaunchUrl(
  launchUrl: string | undefined,
  guestOrigin: string | undefined,
) {
  if (!launchUrl || !guestOrigin) {
    return launchUrl;
  }

  return new URL(launchUrl, guestOrigin).toString();
}
