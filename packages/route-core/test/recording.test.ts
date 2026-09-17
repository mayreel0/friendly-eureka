import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { InvalidRecordingError, parseRecording } from '../src/recording.ts';

const fixtureText = readFileSync(new URL('./fixtures/android-recording.json', import.meta.url), 'utf8');
const recordingFixture = () => JSON.parse(fixtureText);

test('accepts the Kotlin recorder export and returns only canonical fields', () => {
  const input = recordingFixture();
  input.token = 'not retained';
  const recording = parseRecording(input);
  assert.equal(recording.distanceMeters, 2);
  assert.equal(recording.landmarks[2].label, 'Restroom');
  assert.equal('token' in recording, false);
});

test('rejects malformed, inconsistent and out-of-bounds recordings', () => {
  const mutations = [
    (v: any) => { v.schemaVersion = 2; },
    (v: any) => { v.source = 'simulation'; },
    (v: any) => { v.coordinateFrame = 'world'; },
    (v: any) => { v.recordedAt = 'tomorrow'; },
    (v: any) => { v.heading.z = 0; },
    (v: any) => { v.samples = []; },
    (v: any) => { v.samples[0].position.x = 1; },
    (v: any) => { v.samples[1].elapsedMs = 0; },
    (v: any) => { v.samples[2].elapsedMs = 600001; },
    (v: any) => { v.samples[1].position.x = Infinity; },
    (v: any) => { v.samples[1].position.x = 3; },
    (v: any) => { v.distanceMeters = 99; },
    (v: any) => { v.landmarks[1].distanceMeters = 99; },
    (v: any) => { v.landmarks[1].position.x = 0; },
    (v: any) => { v.landmarks[1].sampleIndex = 0; },
    (v: any) => { v.landmarks[2].kind = 'landmark'; },
    (v: any) => { v.landmarks[2].instruction = ' '; },
    (v: any) => { v.landmarks[2].label = 'a'.repeat(81); },
    (v: any) => { v.samples = Array(3001).fill(v.samples[0]); },
    (v: any) => { v.landmarks = Array(22).fill(v.landmarks[0]); },
  ];
  for (const mutate of mutations) {
    const input = recordingFixture();
    mutate(input);
    assert.throws(() => parseRecording(input), InvalidRecordingError, String(mutate));
  }
  for (const input of [null, [], {}, '']) assert.throws(() => parseRecording(input), InvalidRecordingError);
});
