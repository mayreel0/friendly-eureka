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
  | 'generate-guest-url'
  | 'record-follow-up';

export type PilotRouteRecordingScreenState = {
  stage: PilotRouteRecordingScreenStage;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  followUps: PilotFollowUpAction[];
  routeId?: string;
  launchUrl?: string;
};

export type PilotImplementationTargetId =
  | 'record-pilot-route'
  | 'run-route-test'
  | 'activate-pilot-route'
  | 'complete-pilot-readiness'
  | 'generate-guest-url'
  | 'record-qa-evidence'
  | 'run-guest-pilot-qa';

export type PilotImplementationTarget = {
  id: PilotImplementationTargetId;
  label: string;
  detail: string;
};

export type PilotFollowUpAction = {
  id: string;
  targetId: PilotImplementationTargetId;
  targetLabel: string;
  status: 'open' | 'completed';
  createdAt: string;
  snapshot: PilotFollowUpSnapshot;
};

export type PilotFollowUpSnapshot = {
  stage: PilotRouteRecordingScreenStage;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  routeId?: string;
  launchUrl?: string;
};

export type PilotReadinessChecklistId =
  | 'record-route'
  | 'test-route'
  | 'place-qr'
  | 'staff-fallback-note';

export type PilotQaResultNote = {
  summary: string;
  recordedAt: string;
};

export type PilotReadinessApiState = {
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
};

export type PilotRouteRecordingApiState = {
  stage: PilotRouteRecordingScreenStage;
  routeId?: string;
  launchUrl?: string;
};

export type PilotDevStateApiState = {
  recording: PilotRouteRecordingApiState;
  readiness: PilotReadinessApiState;
  followUps?: PilotFollowUpAction[];
  nextTarget?: PilotImplementationTarget;
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
  loadPilotState?: () => Promise<PilotDevStateApiState>;
  loadReadiness?: () => Promise<PilotReadinessApiState>;
  loadRouteRecording?: () => Promise<PilotRouteRecordingApiState>;
  savePilotState?: (state: PilotDevStateApiState) => Promise<void>;
  saveReadiness?: (state: PilotReadinessApiState) => Promise<void>;
  saveRouteRecording?: (state: PilotRouteRecordingApiState) => Promise<void>;
  guestOrigin?: string;
  now?: () => string;
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
    qaResults: {},
    followUps: [],
  };
}

export function deriveNextPilotImplementationTarget(
  state: PilotRouteRecordingScreenState,
): PilotImplementationTarget {
  if (state.stage === 'empty') {
    return {
      id: 'record-pilot-route',
      label: 'Record pilot route',
      detail: 'Capture the pilot restroom route before testing can start.',
    };
  }

  if (state.stage === 'recorded') {
    return {
      id: 'run-route-test',
      label: 'Run route test',
      detail: 'Verify the recorded route before activation.',
    };
  }

  if (state.stage === 'tested') {
    return {
      id: 'activate-pilot-route',
      label: 'Activate pilot route',
      detail: 'Make the tested pilot route available for launch preparation.',
    };
  }

  if (state.stage === 'active') {
    if (!state.hasQrPlacement || !state.hasStaffFallbackNote) {
      return {
        id: 'complete-pilot-readiness',
        label: 'Complete pilot readiness',
        detail: 'Confirm QR placement and staff fallback notes before launch.',
      };
    }

    return {
      id: 'generate-guest-url',
      label: 'Generate guest URL',
      detail: 'Create the guest launch URL for the seeded pilot route.',
    };
  }

  if (!state.qaResults['place-qr'] || !state.qaResults['staff-fallback-note']) {
    return {
      id: 'record-qa-evidence',
      label: 'Record QA evidence',
      detail: 'Attach QA result notes for QR placement and staff fallback.',
    };
  }

  return {
    id: 'run-guest-pilot-qa',
    label: 'Run guest pilot QA',
    detail: 'Open the guest URL and verify the end-to-end pilot experience.',
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

    [data-qa-note] {
      display: block;
      margin-top: 4px;
      color: #46515f;
      font-size: 0.875rem;
      font-weight: 400;
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

    if (item.resultNote) {
      const resultNote = document.createElement('span');
      resultNote.setAttribute('data-qa-note', item.id);
      resultNote.textContent = `${item.resultNote.summary} at ${item.resultNote.recordedAt}`;
      checklistItem.appendChild(resultNote);
    }

    checklist.appendChild(checklistItem);
  }

  const launch = document.createElement('a');
  const launchUrl = toGuestLaunchUrl(view.launchUrl, options.guestOrigin);
  launch.setAttribute('data-launch-url', 'guest-webxr');
  launch.href = launchUrl ?? '';
  launch.textContent = launchUrl ?? 'Guest URL unavailable';

  const targetHeading = document.createElement('h2');
  targetHeading.textContent = 'Next target';

  const target = document.createElement('p');
  target.setAttribute('data-next-target-id', view.nextTarget.id);
  target.textContent = `${view.nextTarget.label}: ${view.nextTarget.detail}`;

  const checklistHeading = document.createElement('h2');
  checklistHeading.textContent = 'Pilot readiness';

  const followUpButton = document.createElement('button');
  followUpButton.setAttribute('type', 'button');
  followUpButton.setAttribute('data-action-id', 'record-follow-up');
  followUpButton.textContent = 'Record follow-up';

  const followUpsHeading = document.createElement('h2');
  followUpsHeading.textContent = 'Open follow-ups';

  const followUps = document.createElement('ol');
  followUps.setAttribute('data-follow-ups', 'pilot');

  for (const followUp of view.followUps) {
    const followUpItem = document.createElement('li');
    followUpItem.setAttribute('data-follow-up-id', followUp.id);
    followUpItem.textContent = `${followUp.targetLabel} (${followUp.status}) at ${followUp.createdAt}`;
    followUps.appendChild(followUpItem);
  }

  section.append(
    style,
    heading,
    status,
    route,
    actions,
    launch,
    targetHeading,
    target,
    followUpButton,
    followUpsHeading,
    followUps,
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
      void this.loadPersistedState();
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
        this.render();
        await savePilotRouteRecordingState(environment, this.state).catch(
          () => undefined,
        );
        return;
      }

      if (actionId === 'record-follow-up') {
        this.state = recordPilotFollowUp(this.state, environment.now);
        this.render();
        await savePilotState(environment, this.state).catch(() => undefined);
        return;
      }

      {
        this.state = applyLocalPilotRouteRecordingAction(
          this.state,
          actionId,
          environment.now,
        );
        this.render();

        if (isPilotReadinessAction(actionId)) {
          await savePilotReadinessState(environment, this.state).catch(
            () => undefined,
          );
        }

        if (isPilotRouteRecordingAction(actionId)) {
          await savePilotRouteRecordingState(environment, this.state).catch(
            () => undefined,
          );
        }
        return;
      }
    }

    private async loadPersistedState() {
      const loadingFromState = this.state;
      const pilotState = await loadPilotState(environment).catch(() =>
        createInitialPilotState(),
      );

      if (this.state !== loadingFromState) {
        return;
      }

      this.state = {
        ...this.state,
        ...pilotState.recording,
        ...pilotState.readiness,
        followUps: pilotState.followUps ?? [],
      };
      this.render();
    }
  }

  environment.customElements.define(tagName, LechigoMerchantAdminElement);
  return LechigoMerchantAdminElement;
}

function createPilotRouteRecordingView(state: PilotRouteRecordingScreenState) {
  const checklist = createPilotReadinessChecklist(state);
  const isReadyToLaunch = checklist.every((item) => item.complete);
  const nextTarget = deriveNextPilotImplementationTarget(state);

  return {
    stage: state.stage,
    title: 'Pilot route recording',
    status: statusForPilotRouteRecordingStage(state.stage),
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    nextTarget,
    followUps: state.followUps,
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
  actionId: Exclude<
    PilotRouteRecordingScreenActionId,
    'generate-guest-url' | 'record-follow-up'
  >,
  now: (() => string) | undefined = defaultNow,
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
    return {
      ...state,
      hasQrPlacement: true,
      qaResults: {
        ...state.qaResults,
        'place-qr': {
          summary: 'Verified QR placed',
          recordedAt: now(),
        },
      },
    };
  }

  if (actionId === 'mark-staff-fallback-ready') {
    return {
      ...state,
      hasStaffFallbackNote: true,
      qaResults: {
        ...state.qaResults,
        'staff-fallback-note': {
          summary: 'Verified staff fallback note',
          recordedAt: now(),
        },
      },
    };
  }

  return { ...state, stage: 'active' };
}

function recordPilotFollowUp(
  state: PilotRouteRecordingScreenState,
  now: (() => string) | undefined = defaultNow,
): PilotRouteRecordingScreenState {
  const target = deriveNextPilotImplementationTarget(state);
  const followUp: PilotFollowUpAction = {
    id: `follow-up-${state.followUps.length + 1}`,
    targetId: target.id,
    targetLabel: target.label,
    status: 'open',
    createdAt: now(),
    snapshot: toPilotFollowUpSnapshot(state),
  };

  return {
    ...state,
    followUps: [...state.followUps, followUp],
  };
}

function toPilotFollowUpSnapshot(
  state: PilotRouteRecordingScreenState,
): PilotFollowUpSnapshot {
  return {
    stage: state.stage,
    routeId: state.routeId,
    launchUrl: state.launchUrl,
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
  };
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
      resultNote: state.qaResults['place-qr'],
    },
    {
      id: 'staff-fallback-note',
      label: 'Staff fallback note',
      complete: state.hasStaffFallbackNote,
      resultNote: state.qaResults['staff-fallback-note'],
    },
  ];
}

function defaultNow() {
  return '2026-09-01T10:00:00.000Z';
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

async function loadPilotReadiness(environment: MerchantAdminElementEnvironment) {
  if (environment.loadReadiness) {
    return environment.loadReadiness();
  }

  const response = await fetch('/api/dev/pilot-readiness');

  if (!response.ok) {
    return createInitialPilotReadiness();
  }

  return (await response.json()) as PilotReadinessApiState;
}

async function loadPilotState(
  environment: MerchantAdminElementEnvironment,
): Promise<PilotDevStateApiState> {
  if (environment.loadPilotState) {
    return environment.loadPilotState();
  }

  if (environment.loadRouteRecording || environment.loadReadiness) {
    const [recording, readiness] = await Promise.all([
      loadPilotRouteRecording(environment).catch(() =>
        createInitialPilotRouteRecording(),
      ),
      loadPilotReadiness(environment).catch(() => createInitialPilotReadiness()),
    ]);

    return { recording, readiness };
  }

  const response = await fetch('/api/dev/pilot-state');

  if (!response.ok) {
    return createInitialPilotState();
  }

  return (await response.json()) as PilotDevStateApiState;
}

async function loadPilotRouteRecording(
  environment: MerchantAdminElementEnvironment,
) {
  if (environment.loadRouteRecording) {
    return environment.loadRouteRecording();
  }

  const response = await fetch('/api/dev/pilot-route-recording');

  if (!response.ok) {
    return createInitialPilotRouteRecording();
  }

  return (await response.json()) as PilotRouteRecordingApiState;
}

function createInitialPilotReadiness(): PilotReadinessApiState {
  return {
    hasQrPlacement: false,
    hasStaffFallbackNote: false,
    qaResults: {},
  };
}

function createInitialPilotRouteRecording(): PilotRouteRecordingApiState {
  return {
    stage: 'empty',
  };
}

function createInitialPilotState(): PilotDevStateApiState {
  return {
    recording: createInitialPilotRouteRecording(),
    readiness: createInitialPilotReadiness(),
    followUps: [],
  };
}

async function savePilotReadiness(
  environment: MerchantAdminElementEnvironment,
  state: PilotReadinessApiState,
) {
  const readiness = {
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
  };

  if (environment.saveReadiness) {
    await environment.saveReadiness(readiness);
    return;
  }

  await fetch('/api/dev/pilot-readiness', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(readiness),
  });
}

async function savePilotState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
) {
  const pilotState = {
    recording: toPilotRouteRecordingApiState(state),
    readiness: toPilotReadinessApiState(state),
    followUps: state.followUps,
  };

  if (environment.savePilotState) {
    await environment.savePilotState(pilotState);
    return;
  }

  await fetch('/api/dev/pilot-state', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(pilotState),
  });
}

async function savePilotReadinessState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
) {
  if (environment.saveReadiness) {
    await savePilotReadiness(environment, toPilotReadinessApiState(state));
    return;
  }

  await savePilotState(environment, state);
}

async function savePilotRouteRecordingState(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingScreenState,
) {
  if (environment.saveRouteRecording) {
    await savePilotRouteRecording(
      environment,
      toPilotRouteRecordingApiState(state),
    );
    return;
  }

  await savePilotState(environment, state);
}

async function savePilotRouteRecording(
  environment: MerchantAdminElementEnvironment,
  state: PilotRouteRecordingApiState,
) {
  const recording = toPilotRouteRecordingApiState(state);

  if (environment.saveRouteRecording) {
    await environment.saveRouteRecording(recording);
    return;
  }

  await fetch('/api/dev/pilot-route-recording', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(recording),
  });
}

function toPilotReadinessApiState(
  state: PilotReadinessApiState,
): PilotReadinessApiState {
  return {
    hasQrPlacement: state.hasQrPlacement,
    hasStaffFallbackNote: state.hasStaffFallbackNote,
    qaResults: state.qaResults,
  };
}

function toPilotRouteRecordingApiState(
  state: PilotRouteRecordingApiState,
): PilotRouteRecordingApiState {
  return {
    stage: state.stage,
    routeId: state.routeId,
    launchUrl: state.launchUrl,
  };
}

function isPilotReadinessAction(actionId: PilotRouteRecordingScreenActionId) {
  return (
    actionId === 'mark-qr-placed' ||
    actionId === 'mark-staff-fallback-ready'
  );
}

function isPilotRouteRecordingAction(actionId: PilotRouteRecordingScreenActionId) {
  return (
    actionId === 'record-route' ||
    actionId === 'mark-test-passed' ||
    actionId === 'activate-route'
  );
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
