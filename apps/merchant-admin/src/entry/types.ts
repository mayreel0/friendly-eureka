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
  | 'record-follow-up'
  | 'complete-follow-up'
  | 'record-qr-placement-evidence';

export type PilotRouteRecordingScreenState = {
  stage: PilotRouteRecordingScreenStage;
  hasQrPlacement: boolean;
  hasStaffFallbackNote: boolean;
  qaResults: Partial<Record<PilotReadinessChecklistId, PilotQaResultNote>>;
  followUps: PilotFollowUpAction[];
  qrPlacementEvidence?: PilotQrPlacementEvidence;
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

export type MerchantAdminElementEnvironment = {
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
