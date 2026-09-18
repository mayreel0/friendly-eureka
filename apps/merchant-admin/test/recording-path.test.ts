import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseRecording } from '../../../packages/route-core/src/recording.ts';
import { projectRecordingPath } from '../src/recording-path.ts';

const fixture = parseRecording(JSON.parse(readFileSync(new URL('../../../packages/route-core/test/fixtures/android-recording.json', import.meta.url), 'utf8')));

test('path projection uses entrance heading and preserves equal meter scale', () => {
  const map = projectRecordingPath(fixture);
  const [a, b, c] = map.points;
  assert.ok(b.x > a.x);
  assert.ok(c.y > b.y);
  assert.equal(b.x - a.x, c.y - b.y);
  assert.equal(map.heightRange, 0);
  assert.equal(map.markers.length, 3);
  assert.deepEqual(map.markers[1].point, b);
  const rotate = ({ x, y, z }: { x: number; y: number; z: number }) => ({ x: -z, y, z: x });
  const rotated = { ...fixture, heading: rotate(fixture.heading),
    samples: fixture.samples.map((sample) => ({ ...sample, position: rotate(sample.position) })) };
  assert.deepEqual(projectRecordingPath(rotated).points, map.points);
});

test('vertical and very long recordings stay finite and inside the viewport', () => {
  for (const scale of [0, 1000]) {
    const recording = { ...fixture, samples: fixture.samples.map((sample, index) => ({
      ...sample, position: { x: index * scale, y: index * 2, z: 0 },
    })) };
    const map = projectRecordingPath(recording);
    assert.equal(map.heightRange, 4);
    for (const point of map.points) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= 32 && point.x <= 448 && point.y >= 32 && point.y <= 288);
    }
  }
});
