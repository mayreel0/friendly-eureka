import type { AndroidRecording } from '../../../packages/route-core/src/recording.ts';

export function projectRecordingPath(recording: AndroidRecording) {
  const { heading, samples, landmarks } = recording;
  // Rotate session coordinates into the entrance heading; this is not a compass bearing.
  const local = samples.map(({ position: p }) => ({
    x: -heading.z * p.x + heading.x * p.z,
    y: -heading.x * p.x - heading.z * p.z,
  }));
  const xs = local.map((p) => p.x); const ys = local.map((p) => p.y);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const scale = Math.min(416 / Math.max(1, maxX - minX), 256 / Math.max(1, maxY - minY));
  const points = local.map((p) => ({
    x: 240 + (p.x - (minX + maxX) / 2) * scale,
    y: 160 + (p.y - (minY + maxY) / 2) * scale,
  }));
  const heights = samples.map((s) => s.position.y);
  return {
    points, markers: landmarks.map((landmark, index) => ({ index, point: points[landmark.sampleIndex], landmark })),
    heightRange: Math.max(...heights) - Math.min(...heights),
  };
}
