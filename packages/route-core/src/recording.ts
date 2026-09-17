export const maxRecordingBytes = 1_000_000;
export class InvalidRecordingError extends Error {
  constructor() { super('Invalid Android route recording.'); }
}

type Position = { x: number; y: number; z: number };
export type AndroidRecording = {
  schemaVersion: 1;
  source: 'android-arcore';
  coordinateFrame: 'arcore-session-relative';
  recordedAt: string;
  heading: Position;
  samples: { elapsedMs: number; position: Position }[];
  landmarks: {
    kind: 'entrance' | 'landmark' | 'destination';
    label: string;
    instruction: string;
    position: Position;
    sampleIndex: number;
    distanceMeters: number;
  }[];
  distanceMeters: number;
};

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new InvalidRecordingError();
}
function object(value: unknown): Record<string, unknown> {
  requireValid(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function number(value: unknown, min: number, max: number): number {
  requireValid(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
  return value;
}
function position(value: unknown): Position {
  const v = object(value);
  return { x: number(v.x, -10_000, 10_000), y: number(v.y, -10_000, 10_000), z: number(v.z, -10_000, 10_000) };
}
function text(value: unknown, min: number, max: number): string {
  requireValid(typeof value === 'string' && value.trim().length >= min && value.length <= max);
  return value.trim();
}
const distance = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const equal = (a: number, b: number) => Math.abs(a - b) < 0.00001;

export function parseRecording(input: unknown): AndroidRecording {
  const value = object(input);
  requireValid(value.schemaVersion === 1 && value.source === 'android-arcore' && value.coordinateFrame === 'arcore-session-relative');
  const recordedAt = text(value.recordedAt, 20, 40);
  requireValid(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(recordedAt) && Number.isFinite(Date.parse(recordedAt)));
  const heading = position(value.heading);
  requireValid(equal(heading.y, 0) && equal(Math.hypot(heading.x, heading.z), 1));
  requireValid(Array.isArray(value.samples) && value.samples.length >= 2 && value.samples.length <= 3000);
  const samples = value.samples.map((input) => {
    const sample = object(input);
    const elapsedMs = number(sample.elapsedMs, 0, 600_000);
    requireValid(Number.isSafeInteger(elapsedMs));
    return { elapsedMs, position: position(sample.position) };
  });
  requireValid(samples[0].elapsedMs === 0 && distance(samples[0].position, { x: 0, y: 0, z: 0 }) === 0);
  const cumulative = [0];
  for (let i = 1; i < samples.length; i++) {
    requireValid(samples[i].elapsedMs > samples[i - 1].elapsedMs);
    const step = distance(samples[i].position, samples[i - 1].position);
    requireValid(step >= 0.05 && step <= 2);
    cumulative.push(cumulative[i - 1] + step);
  }
  const distanceMeters = number(value.distanceMeters, 0.2, 1000);
  requireValid(equal(distanceMeters, cumulative.at(-1)!));
  requireValid(Array.isArray(value.landmarks) && value.landmarks.length >= 2 && value.landmarks.length <= 21);
  const pointCount = value.landmarks.length;
  let previousIndex = 0;
  const landmarks = value.landmarks.map((input, index): AndroidRecording['landmarks'][number] => {
    const point = object(input);
    const kind = index === 0 ? 'entrance' : index === pointCount - 1 ? 'destination' : 'landmark';
    requireValid(point.kind === kind);
    const sampleIndex = number(point.sampleIndex, 0, samples.length - 1);
    requireValid(Number.isSafeInteger(sampleIndex) && (index === 0 ? sampleIndex === 0 : sampleIndex > previousIndex));
    if (kind === 'destination') requireValid(sampleIndex === samples.length - 1);
    const pointPosition = position(point.position);
    requireValid(equal(distance(pointPosition, samples[sampleIndex].position), 0));
    const segmentDistance = number(point.distanceMeters, index === 0 ? 0 : 0.2, 1000);
    requireValid(equal(segmentDistance, cumulative[sampleIndex] - cumulative[previousIndex]));
    previousIndex = sampleIndex;
    return { kind, label: text(point.label, 1, 80), instruction: text(point.instruction, index === 0 ? 0 : 1, index === 0 ? 0 : 500),
      position: pointPosition, sampleIndex, distanceMeters: segmentDistance };
  });
  return { schemaVersion: 1, source: 'android-arcore', coordinateFrame: 'arcore-session-relative', recordedAt, heading, samples, landmarks, distanceMeters };
}
