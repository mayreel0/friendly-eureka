import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePilotDirections, samePilotDirections } from '../src/pilot-directions.ts';

test('floor transitions preserve type and floors and reject disconnected routes', () => {
  const step = { instruction: 'Change floors.', distanceMeters: 5 };
  const stairs = { ...step, floorTransition: { type: 'stairs' as const, fromFloor: -1, toFloor: 1 } };
  const elevator = { ...step, floorTransition: { type: 'elevator' as const, fromFloor: 1, toFloor: 3 } };
  assert.deepEqual(parsePilotDirections([stairs, step, elevator]), [stairs, step, elevator]);
  assert.equal(samePilotDirections([step], [stairs]), false);
  assert.equal(samePilotDirections([stairs], [{ ...stairs, floorTransition: { ...stairs.floorTransition, type: 'ramp' } }]), false);
  for (const floorTransition of [null, {}, { type: 'teleport', fromFloor: 1, toFloor: 2 },
    { type: 'stairs', fromFloor: 1, toFloor: 1 }, { type: 'stairs', fromFloor: 1.5, toFloor: 2 },
    { type: 'stairs', fromFloor: -11, toFloor: 2 }, { type: 'stairs', fromFloor: 1, toFloor: 201 }]) {
    assert.throws(() => parsePilotDirections([{ ...step, floorTransition }]));
  }
  assert.throws(() => parsePilotDirections([stairs, { ...elevator, floorTransition: { ...elevator.floorTransition, fromFloor: 2 } }]));
});

test('landmark names are optional, bounded, normalized and affect route identity', () => {
  const step = { instruction: 'Turn left.', distanceMeters: 3 };
  assert.deepEqual(parsePilotDirections([{ ...step, landmarkLabel: '  Reception  ' }]), [{ ...step, landmarkLabel: 'Reception' }]);
  assert.deepEqual(parsePilotDirections([{ ...step, landmarkLabel: '  ' }]), [step]);
  for (const landmarkLabel of [null, 123, 'x'.repeat(81)]) {
    assert.throws(() => parsePilotDirections([{ ...step, landmarkLabel }]));
  }
  assert.equal(samePilotDirections([step], [{ ...step, landmarkLabel: 'Reception' }]), false);
});

test('manual routes accept 1-20 steps and detect appended or removed steps', () => {
  const one = [{ instruction: 'Go to the door.', distanceMeters: 3 }];
  const twenty = Array.from({ length: 20 }, () => ({ ...one[0] }));
  assert.deepEqual(parsePilotDirections(one), one);
  assert.equal(parsePilotDirections(twenty).length, 20);
  assert.throws(() => parsePilotDirections([...twenty, one[0]]));
  assert.equal(samePilotDirections(one, [...one, ...one]), false);
  assert.equal(samePilotDirections([...one, ...one], one), false);
});

test('pilot directions accept two bounded instructions and positive finite distances', () => {
  assert.deepEqual(parsePilotDirections([
    { instruction: '  Follow the signs. ', distanceMeters: 12.5 },
    { instruction: 'Continue to the door.', distanceMeters: 3 },
  ]), [
    { instruction: 'Follow the signs.', distanceMeters: 12.5 },
    { instruction: 'Continue to the door.', distanceMeters: 3 },
  ]);
  for (const distanceMeters of [0, -1, NaN, Infinity, 1001, '4']) {
    assert.throws(() => parsePilotDirections([
      { instruction: 'Walk.', distanceMeters }, { instruction: 'Turn.', distanceMeters: 3 },
    ]));
  }
  for (const value of [null, [], [{ instruction: '', distanceMeters: 3 }, { instruction: 'Turn.', distanceMeters: 3 }]]) {
    assert.throws(() => parsePilotDirections(value));
  }
});
