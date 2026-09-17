import { LitElement } from 'lit';
import { generateGuestSession, generateRoutePreview, GuestSessionError, loadPilotState, PilotStateConflictError, recordRouteTest, savePilotState } from './api.ts';
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
import { createDirectionsDraft } from './directions-editor.ts';
import { InvalidPilotDirectionsError, maxPilotSteps, parsePilotDirections, samePilotDirections } from '../pilot-directions.ts';
import { InvalidRouteTestError, parseRouteTestInput } from '../route-test-result.ts';

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
    private directionsDraft = createDirectionsDraft();
    private directionsEdited = false;
    private previewUrl?: string;
    private testNote = '';

    protected firstUpdated() {
      void this.loadPersistedState();
    }

    protected render() {
      return renderPilotRouteRecordingScreen(this.state, {
        guestOrigin: environment.guestOrigin ?? 'http://127.0.0.1:4173',
        busy: this.busy || this.conflict,
        error: this.error,
        previewUrl: this.previewUrl,
        testNote: this.testNote,
        onTestNote: (note) => { this.testNote = note; },
        onReload: this.conflict && !this.busy ? () => { void this.loadPersistedState(); } : undefined,
        draft: this.draft,
        directionsDraft: this.directionsDraft,
        onAddDirection: () => {
          if (this.busy || this.conflict || this.directionsDraft.length >= maxPilotSteps) return;
          this.directionsDraft = [...this.directionsDraft, { instruction: '', distanceMeters: '', landmarkLabel: '' }];
          this.directionsEdited = true;
          this.previewUrl = undefined;
          this.requestUpdate();
        },
        onRemoveDirection: (index) => {
          if (this.busy || this.conflict || this.directionsDraft.length <= 1) return;
          this.directionsDraft = this.directionsDraft.filter((_, stepIndex) => stepIndex !== index);
          this.directionsEdited = true;
          this.previewUrl = undefined;
          this.requestUpdate();
        },
        onDirectionsDraft: (index, field, value) => {
          this.directionsEdited = true;
          this.directionsDraft = this.directionsDraft.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step);
          this.previewUrl = undefined;
          this.requestUpdate();
        },
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
        if (id === 'mark-test-passed' || id === 'mark-test-failed') {
          const draft = parsePilotDirections(this.directionsDraft.map((step) => ({ ...step, distanceMeters: Number(step.distanceMeters) })));
          if (!samePilotDirections(next.directions, draft)) throw new GuestSessionError('Save route directions before recording their test result.');
          const input = parseRouteTestInput({ result: id === 'mark-test-passed' ? 'pass' : 'fail', note: this.testNote, routeVersion: next.routeVersion ?? 1 });
          const saved = await recordRouteTest(input.result, input.note, input.routeVersion, this.revision);
          this.state = { ...next, launchUrl: undefined, expiresAt: undefined, ...saved.recording };
          this.revision = saved.revision;
          this.previewUrl = undefined;
          return;
        } else if (id === 'preview-route') {
          const draft = parsePilotDirections(this.directionsDraft.map((step) => ({ ...step, distanceMeters: Number(step.distanceMeters) })));
          if (!samePilotDirections(this.state.directions, draft)) throw new GuestSessionError('Save route directions before previewing them.');
          this.previewUrl = (await generateRoutePreview(this.revision)).launchUrl;
          return;
        } else if (id === 'save-directions') {
          const directions = parsePilotDirections(this.directionsDraft.map((step) => ({
            ...step, distanceMeters: Number(step.distanceMeters),
          })));
          if (samePilotDirections(next.directions, directions)) return;
          next = { ...next, directions, routeVersion: (next.routeVersion ?? 1) + 1,
            routeId: 'pilot-restroom-route', stage: 'recorded', launchUrl: undefined, expiresAt: undefined };
        } else if (id === 'generate-guest-url') {
          const session = await generateGuestSession(environment);
          next = { ...next, stage: 'launch-ready', launchUrl: session.launchUrl, expiresAt: session.expiresAt, entryUrl: session.entryUrl };
        } else if (id === 'record-follow-up') {
          next = recordPilotFollowUp(next, environment.now);
        } else if (id === 'complete-follow-up') {
          if (followUpId) next = completePilotFollowUp(next, followUpId);
        } else if (id === 'record-qr-placement-evidence') {
          next = recordQrPlacementEvidence(next, this.draft, environment.now);
        } else {
          next = applyLocalPilotRouteRecordingAction(next, id, environment.now);
        }
        const saved = await savePilotState(environment, next, this.revision);
        this.revision = saved?.revision;
        this.state = { ...next, ...saved?.recording };
        this.previewUrl = undefined;
        if (id === 'save-directions') {
          this.directionsDraft = createDirectionsDraft(next.directions);
          this.directionsEdited = false;
        }
      } catch (error) {
        this.conflict = error instanceof PilotStateConflictError;
        this.error = error instanceof GuestSessionError || error instanceof PilotStateConflictError || error instanceof InvalidPilotDirectionsError || error instanceof InvalidRouteTestError
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
        this.previewUrl = undefined;
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
        if (!this.directionsEdited) this.directionsDraft = createDirectionsDraft(pilot.recording.directions);
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
