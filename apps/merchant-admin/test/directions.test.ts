import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePilotDirections } from '../src/pilot-directions.ts';

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
