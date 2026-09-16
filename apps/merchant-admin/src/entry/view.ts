import { html, nothing } from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { repeat } from 'lit/directives/repeat.js';
import './guest-qr.ts';
import { createPilotRouteRecordingView } from './state.ts';
import type { PilotRouteRecordingScreenActionId, PilotRouteRecordingScreenState } from './types.ts';

export type QrPlacementDraft = { location: string; orientation: string; note: string };

export function renderPilotRouteRecordingScreen(
  state: PilotRouteRecordingScreenState,
  options: {
    guestOrigin: string;
    busy: boolean;
    error: string;
    draft: QrPlacementDraft;
    onDraft: (field: keyof QrPlacementDraft, value: string) => void;
    onAction: (id: PilotRouteRecordingScreenActionId, followUpId?: string) => void;
  },
) {
  const view = createPilotRouteRecordingView(state);
  const actionButton = (id: PilotRouteRecordingScreenActionId, primary = false) => {
    const action = view.actions.find((item) => item.id === id);
    return action ? html`<button type="button" data-action-id=${id}
      data-primary-action-id=${ifDefined(primary ? id : undefined)}
      ?disabled=${options.busy || !action.enabled}
      @click=${() => options.onAction(id)}>${action.label}</button>` : nothing;
  };
  const launchUrl = toGuestLaunchUrl(view.launchUrl, options.guestOrigin);
  const evidence = view.qrPlacementEvidence;
  return html`
    <section data-screen="pilot-route-recording" data-dashboard="merchant-pilot" data-stage=${view.stage}
      aria-busy=${String(options.busy)}>
      <h1>${view.title}</h1>
      <p data-progress-summary="pilot">${view.progress.label}</p>
      <p data-progress-next-target=${view.nextTarget.id}>Next: ${view.nextTarget.label}</p>
      ${options.error ? html`<p role="alert">${options.error}</p>` : nothing}
      <div data-dashboard-grid="pilot">
        <div data-dashboard-column="primary">
          <div data-dashboard-panel="route-status">
            <h2>Route status</h2>
            <p data-status=${view.stage}>${view.status}</p>
            <p>Route: ${view.routeId ?? 'none'}</p>
          </div>
          <div data-dashboard-panel="next-target">
            <h2>Next target</h2>
            <p data-next-target-id=${view.nextTarget.id}>${view.nextTarget.label}: ${view.nextTarget.detail}</p>
            <div data-primary-actions="next-target">${view.primaryActions.map((id) => actionButton(id, true))}</div>
          </div>
          <div data-dashboard-panel="actions">
            <h2>Pilot controls</h2>
            <div data-actions="pilot-route-recording">${view.actions.map((action) => actionButton(action.id))}</div>
          </div>
          <div data-dashboard-panel="readiness">
            <h2>Pilot readiness</h2>
            <ol data-checklist="pilot-readiness">${view.checklist.map((item) => html`
              <li data-checklist-id=${item.id} data-complete=${String(item.complete)}>
                ${item.complete ? 'Done' : 'Pending'}: ${item.label}
                ${item.resultNote ? html`<span data-qa-note=${item.id}>${item.resultNote.summary} at ${item.resultNote.recordedAt}</span>` : nothing}
              </li>`)}</ol>
          </div>
          <div data-dashboard-panel="qr-placement-evidence">
            <h2>QR placement evidence</h2>
            <label>Location<input data-qr-placement-location .value=${options.draft.location}
              @input=${(event: Event) => options.onDraft('location', (event.target as HTMLInputElement).value)}></label>
            <label>Orientation<input data-qr-placement-orientation .value=${options.draft.orientation}
              @input=${(event: Event) => options.onDraft('orientation', (event.target as HTMLInputElement).value)}></label>
            <label>Note<textarea data-qr-placement-note .value=${options.draft.note}
              @input=${(event: Event) => options.onDraft('note', (event.target as HTMLTextAreaElement).value)}></textarea></label>
            ${evidence ? html`<p data-qr-placement-evidence-summary="saved">Saved ${evidence.recordedAt}: ${evidence.location}; ${evidence.orientation}; ${evidence.note}</p>` : nothing}
            ${actionButton('record-qr-placement-evidence')}
          </div>
        </div>
        <div data-dashboard-column="secondary">
          <div data-dashboard-panel="guest-launch">
            <h2>Guest launch</h2>
            ${launchUrl ? html`
              <lechigo-guest-qr .url=${launchUrl}></lechigo-guest-qr>
              <a data-launch-url="guest-webxr" href=${launchUrl}>${launchUrl}</a>
            ` : html`<p data-launch-url="guest-webxr">Guest URL unavailable</p>`}
          </div>
          <div data-dashboard-panel="follow-ups">
            <h2>Open follow-ups</h2>
            <button type="button" data-action-id="record-follow-up" ?disabled=${options.busy}
              @click=${() => options.onAction('record-follow-up')}>Record follow-up</button>
            <ol data-follow-ups="open">${repeat(view.openFollowUps, (item) => item.id, (item) => html`
              <li data-follow-up-id=${item.id} data-follow-up-status=${item.status}>
                ${item.targetLabel} (${item.status}) at ${item.createdAt}
                <button type="button" data-action-id="complete-follow-up" data-follow-up-id=${item.id}
                  ?disabled=${options.busy} @click=${() => options.onAction('complete-follow-up', item.id)}>Mark done</button>
              </li>`)}</ol>
            <h3>Completed follow-ups</h3>
            <ol data-follow-ups="completed">${repeat(view.completedFollowUps, (item) => item.id, (item) => html`
              <li data-follow-up-id=${item.id} data-follow-up-status=${item.status}>
                ${item.targetLabel} (${item.status}) at ${item.createdAt}
              </li>`)}</ol>
          </div>
        </div>
      </div>
    </section>`;
}

function toGuestLaunchUrl(value: string | undefined, origin: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
