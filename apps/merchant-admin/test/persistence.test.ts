import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';
import { createMerchantAdminDevServer } from '../dev-server.ts';

async function start(stateFile: string) {
  const server = createMerchantAdminDevServer({ stateFile });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

const recording = { stage: 'launch-ready', routeId: 'pilot-restroom-route', launchUrl: 'https://example.com/?token=DO-NOT-PERSIST', expiresAt: '2026-09-17T10:20:00.000Z' };
const readiness = { hasQrPlacement: true, hasStaffFallbackNote: true, qaResults: {},
  qrPlacementEvidence: { location: 'Entrance', orientation: 'Hallway', note: 'Local simulation', recordedAt: '2026-09-17T00:00:00Z' } };

test('pilot state survives server restart without persisting guest session URLs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-state-'));
  const file = join(directory, 'pilot.json');
  let running = await start(file);
  try {
    const response = await fetch(`${running.origin}/api/dev/pilot-state`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        recording, readiness, followUps: [{ id: 'follow-up-1', targetId: 'run-guest-pilot-qa',
          targetLabel: 'Run guest pilot QA', status: 'open', createdAt: '2026-09-17T00:00:00Z',
          snapshot: { ...recording, ...readiness } }],
      }),
    });
    assert.equal(response.status, 200);
    const live = await response.json();
    assert.equal(live.recording.launchUrl, recording.launchUrl);
    const saved = await readFile(file, 'utf8');
    assert.equal(saved.includes('DO-NOT-PERSIST'), false);
    assert.equal(JSON.parse(saved).state.recording.expiresAt, undefined);
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await running.close();
    running = await start(file);
    const restored = await (await fetch(`${running.origin}/api/dev/pilot-state`)).json();
    assert.equal(restored.recording.stage, 'active');
    assert.equal(restored.recording.launchUrl, undefined);
    assert.equal(restored.recording.expiresAt, undefined);
    assert.deepEqual(restored.readiness, readiness);
    assert.equal(restored.followUps[0].id, 'follow-up-1');
    assert.equal(restored.nextTarget.id, 'generate-guest-url');
    assert.equal((await fetch(`${running.origin}/api/dev/pilot-route-session`)).status, 200);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(running.origin);
      await expect(page.getByRole('textbox', { name: 'Location', exact: true })).toHaveValue('Entrance');
      await expect(page.locator('[data-action-id="generate-guest-url"]').first()).toBeEnabled();
      await expect(page.locator('[data-follow-ups="open"] li')).toHaveCount(1);
      await expect(page.locator('a[data-launch-url]')).toHaveCount(0);
    } finally { await browser.close(); }
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});

test('concurrent partial updates persist both recording and readiness', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-state-'));
  const file = join(directory, 'pilot.json');
  let running = await start(file);
  try {
    const post = (path: string, body: unknown) => fetch(`${running.origin}${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const responses = await Promise.all([
      post('/api/dev/pilot-route-recording', { stage: 'tested', routeId: 'pilot-restroom-route' }),
      post('/api/dev/pilot-readiness', readiness),
    ]);
    responses.forEach((response) => assert.equal(response.status, 200));
    await running.close();
    running = await start(file);
    const state = await (await fetch(`${running.origin}/api/dev/pilot-state`)).json();
    assert.equal(state.recording.stage, 'tested');
    assert.deepEqual(state.readiness, readiness);
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});

test('save failure leaves live state unchanged and returns a retryable error', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-state-'));
  const parent = join(directory, 'blocked');
  const running = await start(join(parent, 'pilot.json'));
  try {
    await writeFile(parent, 'not a directory');
    const response = await fetch(`${running.origin}/api/dev/pilot-route-recording`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: 'recorded' }),
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).error, 'pilot-state-save-failed');
    const state = await (await fetch(`${running.origin}/api/dev/pilot-state`)).json();
    assert.equal(state.recording.stage, 'empty');
    assert.equal((await fetch(`${running.origin}/api/dev/pilot-route-session`)).status, 409);
    await rm(parent);
    const retry = await fetch(`${running.origin}/api/dev/pilot-route-recording`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: 'recorded' }),
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).stage, 'recorded');
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});

test('corrupt saved state is preserved and startup fails visibly', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-state-'));
  const file = join(directory, 'pilot.json');
  try {
    for (const value of ['not json', '{"version":99,"state":{}}']) {
      await writeFile(file, value);
      assert.throws(() => createMerchantAdminDevServer({ stateFile: file }), /saved pilot state/i);
      assert.equal(await readFile(file, 'utf8'), value);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('paused publishing stays unavailable after restart while retaining readiness', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-pause-'));
  const file = join(directory, 'pilot.json');
  let running = await start(file);
  try {
    const saved = await fetch(`${running.origin}/api/dev/pilot-state`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recording: { stage: 'paused', routeId: 'pilot-restroom-route' }, readiness, followUps: [] }),
    });
    assert.equal(saved.status, 200);
    await running.close();
    running = await start(file);
    const state = await (await fetch(`${running.origin}/api/dev/pilot-state`)).json();
    assert.equal(state.recording.stage, 'paused');
    assert.deepEqual(state.readiness, readiness);
    assert.equal((await fetch(`${running.origin}/api/dev/pilot-route-session`)).status, 409);
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});

test('edited directions survive restart, require reactivation, and reject invalid changes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lechigo-directions-'));
  const file = join(directory, 'pilot.json');
  let running = await start(file);
  const directions = [{ instruction: 'Pass reception.', distanceMeters: 12.5 }, { instruction: 'Turn left.', distanceMeters: 3 }];
  try {
    const post = (body: unknown) => fetch(`${running.origin}/api/dev/pilot-route-recording`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    const saved = await post({ stage: 'active', routeId: 'pilot-restroom-route', directions });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).stage, 'recorded');
    const invalid = await post({ stage: 'active', directions: [{ instruction: '', distanceMeters: -1 }] });
    assert.equal(invalid.status, 400);
    await running.close();
    running = await start(file);
    const state = await (await fetch(`${running.origin}/api/dev/pilot-state`)).json();
    assert.deepEqual(state.recording.directions, directions);
    assert.equal(state.recording.routeVersion, 2);
    assert.equal(state.recording.stage, 'recorded');
    assert.equal((await fetch(`${running.origin}/api/dev/pilot-route-session`)).status, 409);
  } finally { await running.close(); await rm(directory, { recursive: true, force: true }); }
});
