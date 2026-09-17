import assert from 'node:assert/strict';

export async function prepareTestedRoute(origin: string) {
  const post = (path: string, body: unknown) => fetch(`${origin}/api/dev/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await post('pilot-route-recording', { stage: 'recorded', routeId: 'pilot-restroom-route' })).status, 200);
  assert.equal((await post('pilot-route-test', { result: 'pass', note: 'Test fixture walkthrough.', routeVersion: 1 })).status, 200);
}
