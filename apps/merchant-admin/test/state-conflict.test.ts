import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createPilotStateStore, PilotStateConflictError, PilotStateSaveError } from '../pilot-state-store.ts';

function store(file?: string) {
  return createPilotStateStore({ file, initial: { count: 0 },
    parse: (value) => value as { count: number }, forDisk: (value) => value });
}

test('only one concurrent writer with the same revision commits', async () => {
  const state = store();
  const revision = state.revision();
  const outcomes = await Promise.allSettled([
    state.update(() => ({ count: 1 }), revision),
    state.update(() => ({ count: 2 }), revision),
  ]);
  assert.equal(outcomes[0].status, 'fulfilled');
  assert.equal(outcomes[1].status, 'rejected');
  if (outcomes[1].status === 'rejected') assert.ok(outcomes[1].reason instanceof PilotStateConflictError);
  assert.equal(state.read().count, 1);
  assert.notEqual(state.revision(), revision);
});

test('failed writes preserve revisions and restart rejects pre-restart revisions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-conflict-'));
  const parent = join(directory, 'blocked');
  const file = join(parent, 'state.json');
  try {
    const state = store(file);
    const revision = state.revision();
    await writeFile(parent, 'not a directory');
    await assert.rejects(state.update(() => ({ count: 1 }), revision), PilotStateSaveError);
    assert.equal(state.revision(), revision);
    await rm(parent);
    await state.update(() => ({ count: 1 }), revision);
    const restarted = store(file);
    await assert.rejects(restarted.update(() => ({ count: 2 }), state.revision()), PilotStateConflictError);
    assert.equal(restarted.read().count, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
