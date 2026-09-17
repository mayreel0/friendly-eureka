import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePilotDirections, samePilotDirections } from '../src/pilot-directions.ts';

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
