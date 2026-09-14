import {
  generateGuestSession,
  loadPilotState,
  savePilotReadinessState,
  savePilotRouteRecordingState,
  savePilotState,
} from './api.ts';
import {
  applyLocalPilotRouteRecordingAction,
  completePilotFollowUp,
  createInitialPilotRouteRecordingScreenState,
  createInitialPilotState,
  isPilotReadinessAction,
  isPilotRouteRecordingAction,
  recordPilotFollowUp,
} from './state.ts';
import type {
  MerchantAdminElementConstructor,
  MerchantAdminElementEnvironment,
  PilotRouteRecordingScreenActionId,
} from './types.ts';
import { renderPilotRouteRecordingScreen } from './view.ts';

export type * from './types.ts';
export {
  applyLocalPilotRouteRecordingAction,
  completePilotFollowUp,
  createInitialPilotRouteRecordingScreenState,
  createInitialPilotState,
  createPilotRouteRecordingView,
  deriveNextPilotImplementationTarget,
  isPilotReadinessAction,
  isPilotRouteRecordingAction,
  recordPilotFollowUp,
} from './state.ts';
export {
  generateGuestSession,
  loadPilotState,
  savePilotReadinessState,
  savePilotRouteRecordingState,
  savePilotState,
} from './api.ts';
export { renderPilotRouteRecordingScreen } from './view.ts';

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
        const followUpId = button.getAttribute('data-follow-up-id');

        if (!actionId || button.disabled) {
          continue;
        }

        button.addEventListener('click', () => {
          void this.applyAction(actionId, followUpId ?? undefined);
        });
      }

      root.replaceChildren(screen);
    }

    private async applyAction(
      actionId: PilotRouteRecordingScreenActionId,
      followUpId?: string,
    ) {
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

      if (actionId === 'complete-follow-up' && followUpId) {
        this.state = completePilotFollowUp(this.state, followUpId);
        this.render();
        await savePilotState(environment, this.state).catch(() => undefined);
        return;
      }

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
