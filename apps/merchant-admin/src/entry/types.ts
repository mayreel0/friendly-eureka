import type { PilotDirections } from '../pilot-directions.ts';
import type { ImportedRecording } from '../recording-import.ts';
import type { RouteTestResult } from '../route-test-result.ts';

export type PilotRouteRecordingScreenStage =
  | 'empty'
  | 'recorded'
  | 'tested'
  | 'active'
  | 'paused'
  | 'launch-ready';

export type PilotRouteRecordingScreenActionId =
  | 'record-route'
  | 'mark-test-passed'
  | 'mark-test-failed'
  | 'activate-route'
  | 'pause-route'
  | 'save-directions'
  | 'preview-route'
  | 'mark-qr-placed'
  | 'mark-staff-fallback-ready'
  | 'generate-guest-url'
  | 'record-follow-up'
  | 'complete-follow-up'
  | 'record-qr-placement-evidence';

export type PilotRouteRecordingScreenState = {
  importedRecording?: ImportedRecording;
  testResult?: RouteTestResult;
  directions?: PilotDirections;
  routeVersion?: number;
  stage: PilotRouteRecordingScreenStage;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  followUps: PilotFollowUpAction[];
  qrPlacementEvidence?: PilotQrPlacementEvidence;
  routeId?: string;
  launchUrl?: string;
  expiresAt?: string;
  entryUrl?: string;
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
  qrPlacementEvidence?: PilotQrPlacementEvidence;
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

export type PilotQrPlacementEvidence = {
  location: string;
  orientation: string;
  note: string;
  recordedAt: string;
};

export type PilotReadinessApiState = {
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  qrPlacementEvidence?: PilotQrPlacementEvidence;
};

export type PilotRouteRecordingApiState = {
  importedRecording?: ImportedRecording;
  entryUrl?: string;
  testResult?: RouteTestResult;
  directions?: PilotDirections;
  routeVersion?: number;
  stage: PilotRouteRecordingScreenStage;
  routeId?: string;
  launchUrl?: string;
  expiresAt?: string;
};

export type PilotDevStateApiState = {
  revision?: string;
  recording: PilotRouteRecordingApiState;
  readiness: PilotReadinessApiState;
  followUps?: PilotFollowUpAction[];
  nextTarget?: PilotImplementationTarget;
};

export type MerchantAdminElementEnvironment = {
  generateGuestUrl?: () => Promise<{ launchUrl: string; expiresAt?: string; entryUrl?: string }>;
  loadPilotState?: () => Promise<PilotDevStateApiState>;
  loadReadiness?: () => Promise<PilotReadinessApiState>;
  loadRouteRecording?: () => Promise<PilotRouteRecordingApiState>;
  savePilotState?: (state: PilotDevStateApiState) => Promise<void>;
  saveReadiness?: (state: PilotReadinessApiState) => Promise<void>;
  saveRouteRecording?: (state: PilotRouteRecordingApiState) => Promise<void>;
  guestOrigin?: string;
  now?: () => string;
};
