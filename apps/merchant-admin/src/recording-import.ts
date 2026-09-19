import { InvalidRecordingError, parseRecording, type AndroidRecording } from '../../../packages/route-core/src/recording.ts';
import { parsePilotDirections } from './pilot-directions.ts';

export type ImportedRecording = {
  source: 'android-arcore';
  recordedAt: string;
  importedAt: string;
  sampleCount: number;
  distanceMeters: number;
  routeVersion: number;
  original?: AndroidRecording;
};

export function recordingToDraft(recording: AndroidRecording, routeVersion: number) {
  return {
    directions: parsePilotDirections(recording.landmarks.slice(1).map((point) => ({
      instruction: point.instruction, landmarkLabel: point.label,
      distanceMeters: Number(point.distanceMeters.toFixed(2)),
    }))),
    importedRecording: {
      source: recording.source, recordedAt: recording.recordedAt, importedAt: new Date().toISOString(),
      sampleCount: recording.samples.length, distanceMeters: recording.distanceMeters, routeVersion,
      original: recording,
    } satisfies ImportedRecording,
  };
}

export function parseImportedRecording(value: unknown): ImportedRecording | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if (v.source !== 'android-arcore' || typeof v.recordedAt !== 'string' || typeof v.importedAt !== 'string' ||
    !Number.isFinite(Date.parse(v.recordedAt)) || !Number.isFinite(Date.parse(v.importedAt)) ||
    typeof v.sampleCount !== 'number' || !Number.isInteger(v.sampleCount) || v.sampleCount < 2 || v.sampleCount > 3000 ||
    typeof v.distanceMeters !== 'number' || !Number.isFinite(v.distanceMeters) || v.distanceMeters < 0.2 || v.distanceMeters > 1000 ||
    typeof v.routeVersion !== 'number' || !Number.isSafeInteger(v.routeVersion) || v.routeVersion < 1) return undefined;
  const original = v.original === undefined ? undefined : parseRecording(v.original);
  if (original && (original.recordedAt !== v.recordedAt || original.samples.length !== v.sampleCount ||
    original.distanceMeters !== v.distanceMeters)) throw new InvalidRecordingError();
  return { source: v.source, recordedAt: v.recordedAt, importedAt: v.importedAt,
    sampleCount: v.sampleCount, distanceMeters: v.distanceMeters, routeVersion: v.routeVersion,
    ...(original ? { original } : {}) };
}
