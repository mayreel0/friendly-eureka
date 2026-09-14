import { createPilotRouteRecordingView } from './state.ts';
import type {
  MerchantAdminDocument,
  MerchantAdminDomElement,
  PilotRouteRecordingScreenActionId,
  PilotRouteRecordingScreenState,
} from './types.ts';

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

function toGuestLaunchUrl(
  launchUrl: string | undefined,
  guestOrigin: string | undefined,
) {
  if (!launchUrl || !guestOrigin) {
    return launchUrl;
  }

  return new URL(launchUrl, guestOrigin).toString();
}
