import { LitElement } from 'lit';
import { generateGuestSession, GuestSessionError, loadPilotState, PilotStateConflictError, savePilotState } from './api.ts';
import {
  applyLocalPilotRouteRecordingAction,
  completePilotFollowUp,
  createInitialPilotRouteRecordingScreenState,
  recordPilotFollowUp,
  recordQrPlacementEvidence,
} from './state.ts';
import type { MerchantAdminElementEnvironment, PilotRouteRecordingScreenActionId } from './types.ts';
import { renderPilotRouteRecordingScreen, type QrPlacementDraft } from './view.ts';
import { merchantStyles } from './styles.ts';

export type * from './types.ts';
export * from './state.ts';
export * from './api.ts';
export { renderPilotRouteRecordingScreen } from './view.ts';

export function registerMerchantAdminElement(
  environment: MerchantAdminElementEnvironment = {},
  tagName = 'lechigo-merchant-admin',
) {
  const existing = customElements.get(tagName);
  if (existing) return existing;

  class LechigoMerchantAdminElement extends LitElement {
    static styles = merchantStyles;
    private state = createInitialPilotRouteRecordingScreenState();
    private draft: QrPlacementDraft = { location: '', orientation: '', note: '' };
    private draftEdited = false;
    private busy = true;
    private error = '';
    private revision?: string;
    private conflict = false;

    protected firstUpdated() {
      void this.loadPersistedState();
    }

    protected render() {
      return renderPilotRouteRecordingScreen(this.state, {
        guestOrigin: environment.guestOrigin ?? 'http://127.0.0.1:4173',
        busy: this.busy || this.conflict,
        error: this.error,
        onReload: this.conflict && !this.busy ? () => { void this.loadPersistedState(); } : undefined,
        draft: this.draft,
        onDraft: (field, value) => {
          this.draftEdited = true;
          this.draft = { ...this.draft, [field]: value };
        },
        onAction: (id, followUpId) => { void this.applyAction(id, followUpId); },
      });
    }

    private async applyAction(id: PilotRouteRecordingScreenActionId, followUpId?: string) {
      if (this.busy || this.conflict) return;
      this.busy = true;
      this.error = '';
      this.requestUpdate();
      try {
        let next = this.state;
        if (id === 'generate-guest-url') {
          const session = await generateGuestSession(environment);
          next = { ...next, stage: 'launch-ready', launchUrl: session.launchUrl, expiresAt: session.expiresAt };
        } else if (id === 'record-follow-up') {
          next = recordPilotFollowUp(next, environment.now);
        } else if (id === 'complete-follow-up') {
          if (followUpId) next = completePilotFollowUp(next, followUpId);
        } else if (id === 'record-qr-placement-evidence') {
          next = recordQrPlacementEvidence(next, this.draft, environment.now);
        } else {
          next = applyLocalPilotRouteRecordingAction(next, id, environment.now);
        }
        this.revision = await savePilotState(environment, next, this.revision);
        this.state = next;
      } catch (error) {
        this.conflict = error instanceof PilotStateConflictError;
        this.error = error instanceof GuestSessionError || error instanceof PilotStateConflictError
          ? error.message : 'Could not save this action. Please try again.';
      } finally {
        this.busy = false;
        this.requestUpdate();
      }
    }

    private async loadPersistedState() {
      this.busy = true;
      this.requestUpdate();
      try {
        const pilot = await loadPilotState(environment);
        this.revision = pilot.revision;
        const evidence = pilot.readiness.qrPlacementEvidence;
        this.state = {
          ...createInitialPilotRouteRecordingScreenState(),
          ...pilot.recording,
          ...pilot.readiness,
          followUps: pilot.followUps ?? [],
          ...(evidence ? {
            hasQrPlacement: true,
            qaResults: {
              ...pilot.readiness.qaResults,
              'place-qr': pilot.readiness.qaResults['place-qr'] ?? {
                summary: `QR placed at ${evidence.location}; ${evidence.orientation}`,
                recordedAt: evidence.recordedAt,
              },
            },
          } : {}),
        };
        if (evidence && !this.draftEdited) {
          this.draft = { location: evidence.location, orientation: evidence.orientation, note: evidence.note };
        }
        this.busy = false;
        this.conflict = false;
        this.error = '';
      } catch {
        this.error = 'Could not load saved state. Reload to try again.';
        if (this.conflict) this.busy = false;
      } finally {
        this.requestUpdate();
      }
    }
  }

  customElements.define(tagName, LechigoMerchantAdminElement);
  return LechigoMerchantAdminElement;
}
