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
  section.setAttribute('data-dashboard', 'merchant-pilot');
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
      width: min(100%, 1040px);
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

    [data-progress-summary] {
      margin: 0 0 8px;
      color: #17202a;
      font-size: 1.125rem;
      font-weight: 700;
    }

    [data-progress-next-target] {
      margin-bottom: 24px;
    }

    [data-dashboard-grid] {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
      gap: 16px;
      align-items: start;
    }

    [data-dashboard-column] {
      display: grid;
      gap: 16px;
    }

    [data-dashboard-panel] {
      box-sizing: border-box;
      border: 1px solid #d7deea;
      border-radius: 8px;
      background: #ffffff;
      padding: 16px;
    }

    [data-dashboard-panel] h2 {
      margin-top: 0;
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

    input,
    textarea {
      box-sizing: border-box;
      width: 100%;
      min-height: 40px;
      margin: 4px 0 12px;
      padding: 8px 10px;
      border: 1px solid #b9c0ca;
      border-radius: 6px;
      color: #17202a;
      font: inherit;
    }

    textarea {
      min-height: 72px;
      resize: vertical;
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

    @media (max-width: 760px) {
      [data-dashboard-grid] {
        grid-template-columns: 1fr;
      }
    }
  `;

  const heading = document.createElement('h1');
  heading.textContent = view.title;

  const summary = document.createElement('p');
  summary.textContent =
    'Track the pilot route, launch readiness, follow-ups, and guest entry from one place.';

  const progress = document.createElement('p');
  progress.setAttribute('data-progress-summary', 'pilot');
  progress.textContent = view.progress.label;

  const progressNextTarget = document.createElement('p');
  progressNextTarget.setAttribute('data-progress-next-target', view.nextTarget.id);
  progressNextTarget.textContent = `Next: ${view.nextTarget.label}`;

  const status = document.createElement('p');
  status.setAttribute('data-status', view.stage);
  status.textContent = view.status;

  const route = document.createElement('p');
  route.textContent = view.routeId ? `Route: ${view.routeId}` : 'Route: none';

  const routePanel = createDashboardPanel(document, 'route-status', 'Route status');
  routePanel.append(status, route);

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

  const actionsPanel = createDashboardPanel(document, 'actions', 'Pilot controls');
  actionsPanel.append(actions);

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

  const checklistPanel = createDashboardPanel(
    document,
    'readiness',
    'Pilot readiness',
  );
  checklistPanel.append(checklist);

  const qrEvidencePanel = createDashboardPanel(
    document,
    'qr-placement-evidence',
    'QR placement evidence',
  );
  const qrEvidence = view.qrPlacementEvidence;
  qrEvidencePanel.append(
    createEvidenceField(
      document,
      'Location',
      'data-qr-placement-location',
      qrEvidence?.location ?? '',
    ),
    createEvidenceField(
      document,
      'Orientation',
      'data-qr-placement-orientation',
      qrEvidence?.orientation ?? '',
    ),
    createEvidenceField(
      document,
      'Note',
      'data-qr-placement-note',
      qrEvidence?.note ?? '',
      'textarea',
    ),
  );

  if (qrEvidence) {
    const qrEvidenceSummary = document.createElement('p');
    qrEvidenceSummary.setAttribute('data-qr-placement-evidence-summary', 'saved');
    qrEvidenceSummary.textContent = `Saved ${qrEvidence.recordedAt}: ${qrEvidence.location}; ${qrEvidence.orientation}; ${qrEvidence.note}`;
    qrEvidencePanel.append(qrEvidenceSummary);
  }

  const qrEvidenceAction = view.actions.find(
    (action) => action.id === 'record-qr-placement-evidence',
  );

  if (qrEvidenceAction) {
    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('data-action-id', qrEvidenceAction.id);
    button.textContent = qrEvidenceAction.label;
    button.disabled = !qrEvidenceAction.enabled;
    qrEvidencePanel.append(button);
  }

  const launchUrl = toGuestLaunchUrl(view.launchUrl, options.guestOrigin);

  const launchPanel = createDashboardPanel(document, 'guest-launch', 'Guest launch');

  if (launchUrl) {
    const launch = document.createElement('a');
    launch.setAttribute('data-launch-url', 'guest-webxr');
    launch.href = launchUrl;
    launch.textContent = launchUrl;
    launchPanel.append(launch);

    const copyTarget = document.createElement('p');
    copyTarget.setAttribute('data-launch-copy-url', 'guest-webxr');
    copyTarget.textContent = launchUrl;
    launchPanel.append(copyTarget);
  } else {
    const launchUnavailable = document.createElement('p');
    launchUnavailable.setAttribute('data-launch-url', 'guest-webxr');
    launchUnavailable.textContent = 'Guest URL unavailable';
    launchPanel.append(launchUnavailable);
  }

  const target = document.createElement('p');
  target.setAttribute('data-next-target-id', view.nextTarget.id);
  target.textContent = `${view.nextTarget.label}: ${view.nextTarget.detail}`;

  const primaryActions = document.createElement('div');
  primaryActions.setAttribute('data-primary-actions', 'next-target');

  for (const actionId of view.primaryActions) {
    const action = view.actions.find((candidate) => candidate.id === actionId);

    if (!action) {
      continue;
    }

    const button = document.createElement('button');
    button.setAttribute('type', 'button');
    button.setAttribute('data-action-id', action.id);
    button.setAttribute('data-primary-action-id', action.id);
    button.textContent = action.label;
    button.disabled = !action.enabled;
    primaryActions.appendChild(button);
  }

  const targetPanel = createDashboardPanel(document, 'next-target', 'Next target');
  targetPanel.append(target, primaryActions);

  const followUpButton = document.createElement('button');
  followUpButton.setAttribute('type', 'button');
  followUpButton.setAttribute('data-action-id', 'record-follow-up');
  followUpButton.textContent = 'Record follow-up';

  const openFollowUps = document.createElement('ol');
  openFollowUps.setAttribute('data-follow-ups', 'open');

  for (const followUp of view.openFollowUps) {
    const followUpItem = document.createElement('li');
    followUpItem.setAttribute('data-follow-up-id', followUp.id);
    followUpItem.setAttribute('data-follow-up-status', followUp.status);
    followUpItem.textContent = `${followUp.targetLabel} (${followUp.status}) at ${followUp.createdAt}`;

    if (followUp.status === 'open') {
      const completeButton = document.createElement('button');
      completeButton.setAttribute('type', 'button');
      completeButton.setAttribute('data-action-id', 'complete-follow-up');
      completeButton.setAttribute('data-follow-up-id', followUp.id);
      completeButton.textContent = 'Mark done';
      followUpItem.appendChild(completeButton);
    }

    openFollowUps.appendChild(followUpItem);
  }

  const completedHeading = document.createElement('h3');
  completedHeading.textContent = 'Completed follow-ups';

  const completedFollowUps = document.createElement('ol');
  completedFollowUps.setAttribute('data-follow-ups', 'completed');

  for (const followUp of view.completedFollowUps) {
    const followUpItem = document.createElement('li');
    followUpItem.setAttribute('data-follow-up-id', followUp.id);
    followUpItem.setAttribute('data-follow-up-status', followUp.status);
    followUpItem.textContent = `${followUp.targetLabel} (${followUp.status}) at ${followUp.createdAt}`;
    completedFollowUps.appendChild(followUpItem);
  }

  const followUpsPanel = createDashboardPanel(
    document,
    'follow-ups',
    'Open follow-ups',
  );
  followUpsPanel.append(
    followUpButton,
    openFollowUps,
    completedHeading,
    completedFollowUps,
  );

  const primaryColumn = document.createElement('div');
  primaryColumn.setAttribute('data-dashboard-column', 'primary');
  primaryColumn.append(
    routePanel,
    targetPanel,
    actionsPanel,
    checklistPanel,
    qrEvidencePanel,
  );

  const secondaryColumn = document.createElement('div');
  secondaryColumn.setAttribute('data-dashboard-column', 'secondary');
  secondaryColumn.append(launchPanel, followUpsPanel);

  const dashboard = document.createElement('div');
  dashboard.setAttribute('data-dashboard-grid', 'pilot');
  dashboard.append(primaryColumn, secondaryColumn);

  section.append(style, heading, summary, progress, progressNextTarget, dashboard);
  return section;
}

function createEvidenceField(
  document: MerchantAdminDocument,
  labelText: string,
  attributeName: string,
  value: string,
  elementName = 'input',
) {
  const container = document.createElement('p');
  container.textContent = labelText;

  const field = document.createElement(elementName);
  field.setAttribute(attributeName, 'true');
  field.setAttribute('aria-label', labelText);
  field.value = value;
  container.appendChild(field);

  return container;
}

function createDashboardPanel(
  document: MerchantAdminDocument,
  id: string,
  headingText: string,
) {
  const panel = document.createElement('div');
  panel.setAttribute('data-dashboard-panel', id);

  const heading = document.createElement('h2');
  heading.textContent = headingText;
  panel.appendChild(heading);

  return panel;
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
