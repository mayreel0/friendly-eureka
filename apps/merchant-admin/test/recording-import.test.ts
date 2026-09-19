import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createMerchantAdminDevServer } from '../dev-server.ts';
import { parseImportedRecording, recordingToDraft } from '../src/recording-import.ts';
import { InvalidRecordingError, parseRecording } from '../../../packages/route-core/src/recording.ts';

test('recording import is bounded, revision guarded, durable and draft-only', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-import-'));
  const options = { stateFile: join(directory, 'state.json') };
  let server = createMerchantAdminDevServer(options);
  const start = async () => {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    return `http://127.0.0.1:${address.port}`;
  };
  const stop = () => new Promise<void>((resolve) => server.close(() => resolve()));
  let origin = await start();
  const state = async () => (await fetch(`${origin}/api/dev/pilot-state`)).json();
  const post = (path: string, body: string, revision?: string) => fetch(`${origin}/api/dev/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(revision ? { 'x-pilot-revision': revision } : {}) }, body,
  });
  const fixture = await readFile(new URL('../../../packages/route-core/test/fixtures/android-recording.json', import.meta.url), 'utf8');
  try {
    const original = await state();
    assert.equal((await fetch(`${origin}/api/dev/pilot-route-source`)).status, 404);
    assert.equal((await post('pilot-route-import', fixture)).status, 428);
    assert.equal((await fetch(`${origin}/api/dev/pilot-route-import`)).status, 405);
    for (const [body, status] of [['{', 400], ['{}', 422], [' '.repeat(1_000_001), 413]] as const) {
      assert.equal((await post('pilot-route-import', body, original.revision)).status, status);
      assert.deepEqual(await state(), original);
    }
    const response = await post('pilot-route-import', fixture, original.revision);
    assert.equal(response.status, 200);
    const imported = await response.json();
    assert.equal(imported.recording.stage, 'recorded');
    assert.equal(imported.recording.directions[1].landmarkLabel, 'Restroom');
    assert.equal(imported.recording.importedRecording.sampleCount, 3);
    assert.equal(imported.recording.importedRecording.routeVersion, imported.recording.routeVersion);
    assert.deepEqual(imported.recording.importedRecording.original, JSON.parse(fixture));
    const sourceUrl = `${origin}/api/dev/pilot-route-source?version=${imported.recording.routeVersion}`;
    const download = await fetch(sourceUrl);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition')!, /^attachment;/);
    assert.equal(download.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await download.json(), JSON.parse(fixture));
    assert.equal((await post('pilot-route-source', fixture)).status, 405);
    assert.equal((await post('pilot-route-import', fixture, original.revision)).status, 409);
    assert.deepEqual((await state()).recording, imported.recording);
    assert.equal(server.guestApi.issueSession().ok, false);
    await post('pilot-route-test', JSON.stringify({ result: 'pass', note: 'Walked route.', routeVersion: imported.recording.routeVersion }));
    await post('pilot-route-recording', JSON.stringify({ ...imported.recording, stage: 'active', importedRecording: { forged: true } }));
    const active = await state();
    assert.deepEqual(active.recording.importedRecording, imported.recording.importedRecording);
    const session = server.guestApi.issueSession(); assert.ok(session.ok);
    assert.equal(JSON.stringify(server.guestApi.fetchRoute(session.token)).includes('arcore-session-relative'), false);
    const editedDirections = active.recording.directions.map((step: object, index: number) => ({ ...step, instruction: `Edited step ${index + 1}.` }));
    await post('pilot-route-recording', JSON.stringify({ ...active.recording, directions: editedDirections,
      importedRecording: { ...active.recording.importedRecording, original: undefined } }));
    const edited = await state();
    assert.deepEqual(edited.recording.importedRecording.original, JSON.parse(fixture));
    assert.deepEqual(await (await fetch(sourceUrl)).json(), JSON.parse(fixture));
    const replaced = await (await post('pilot-route-import', fixture, edited.revision)).json();
    assert.equal(replaced.recording.routeVersion, edited.recording.routeVersion + 1);
    assert.equal(replaced.recording.stage, 'recorded');
    assert.equal((await fetch(sourceUrl)).status, 409);
    assert.equal(replaced.recording.entryKey, undefined);
    assert.equal(server.guestApi.fetchRoute(session.token).ok, false);
    assert.equal(server.guestApi.issueEntrySession(active.recording.entryKey).ok, false);
    assert.equal((await post('pilot-route-recording', JSON.stringify({ ...replaced.recording, stage: 'active' }))).status, 422);
    await stop(); server = createMerchantAdminDevServer(options); origin = await start();
    assert.deepEqual((await state()).recording, replaced.recording);
    assert.deepEqual(await (await fetch(`${origin}/api/dev/pilot-route-source?version=${replaced.recording.routeVersion}`)).json(), JSON.parse(fixture));
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});

test('saved recording metadata remains backward compatible and validates retained geometry', async () => {
  const fixture = JSON.parse(await readFile(new URL('../../../packages/route-core/test/fixtures/android-recording.json', import.meta.url), 'utf8'));
  const { importedRecording } = recordingToDraft(parseRecording(fixture), 3);
  assert.deepEqual(parseImportedRecording(importedRecording), importedRecording);
  const { original, ...legacy } = importedRecording;
  assert.deepEqual(parseImportedRecording(legacy), legacy);
  assert.throws(() => parseImportedRecording({ ...importedRecording, original: {} }), InvalidRecordingError);
  assert.throws(() => parseImportedRecording({ ...importedRecording, sampleCount: 9 }), InvalidRecordingError);
  const clean = parseImportedRecording({ ...importedRecording, original: { ...original, secret: 'discard' } });
  assert.equal(JSON.stringify(clean).includes('discard'), false);
});
