# Pilot QA P1 Test Hardening Plan
Created: 2026-09-01

## Objective

Convert the first pilot QA dry-run findings into the next concrete implementation target.
The immediate goal is to harden the evidence gaps that were marked P1 in `docs/pilot-qa-runs/2026-09-01-main-dry-run.md`, starting with focused API tests before browser and physical-device QA.

## Source Findings

| Finding | Dry-run evidence | Priority | Decision |
|---|---|---|---|
| W1. QR-only password rejection has indirect evidence. | UI password panel covers QR-locked state, but API does not directly assert `fetchPassword` returns `password-forbidden` for a QR token. | P1 | Implement first. It is small, security-relevant, and fully local. |
| W3. Expired Wi-Fi proof token has indirect API evidence. | Route-core expiry decision is covered, but API does not directly assert expired Wi-Fi proof token rejection. | P1 | Implement first. It protects the API boundary that real clients will hit. |
| Guest fallback browser smoke coverage is state-only. | `apps/guest-webxr/test/entry.test.ts` covers fallback state, not rendered browser behavior. | P1 | Implement second, after API boundary tests are explicit. |
| Physical QR placement metadata is not exercised. | Fixture route data covers anchors and segments, but no physical placement run exists. | P1 | Do in the first manual pilot route recording run. |
| Manual QA evidence habit needs use. | Template now exists, but only one automated dry run has been recorded. | P1 | Keep as operating rule for every QA run. |
| Android WebXR and iOS App Clip physical checks are not run. | Device matrix remains `Not run` for physical-device rows. | P2 | Defer until suitable devices/signing are available. |

## Selected Next Implementation Goal

Harden P1 API evidence first:

1. Add direct API coverage that a QR-backed guest route token cannot fetch the restroom password and receives `password-forbidden`.
2. Add direct API coverage that an expired Wi-Fi proof token cannot create a Wi-Fi guest session and receives `wifi-proof-expired`.

This is the next implementation target because it is the smallest security-relevant gap found by the dry run, it requires no device access, and it improves confidence before browser or manual pilot QA.

## Execution Units

### U1. Add QR-token password rejection API coverage

- **Goal:** Prove the API boundary rejects password access from QR-backed guest sessions, not only through UI panel state.
- **Files:** `apps/api/test/server.test.ts`
- **Existing patterns:** Reuse `createActiveRouteContext`, `issueQrCredential`, `createQrSession`, `fetchPassword`, and the assertion style already used in the API contract tests.
- **Test scenario:** Given an active route and valid QR credential, when a QR session token is passed to `fetchPassword`, then the API returns `{ ok: false, status: 403, error: 'password-forbidden' }`.
- **Done signal:** `npm test -- apps/api/test/server.test.ts` passes and the dry-run W1 follow-up can move from `Partial` to `Pass` in a new QA run.

### U2. Add expired Wi-Fi proof API coverage

- **Goal:** Prove the API boundary rejects expired Wi-Fi proof tokens before creating password-capable guest sessions.
- **Files:** `apps/api/test/server.test.ts`
- **Existing patterns:** Reuse `issueWifiProof`, `setApiNow`, `createWifiSession`, and existing Wi-Fi proof replay/invalid timestamp tests.
- **Test scenario:** Given a Wi-Fi proof issued at `2026-09-01T10:31:00.000Z`, when `createWifiSession` is called after the proof expiry window, then the API returns `{ ok: false, status: 401, error: 'wifi-proof-expired' }`.
- **Done signal:** `npm test -- apps/api/test/server.test.ts` passes and the dry-run W3 follow-up can move from `Partial` to `Pass` in a new QA run.

### U3. Record the post-hardening dry run

- **Goal:** Keep QA evidence current after U1 and U2 land.
- **Files:** `docs/pilot-qa-runs/YYYY-MM-DD-api-hardening-dry-run.md`, optionally `docs/ar-device-test-matrix.md`
- **Existing patterns:** Copy the structure of `docs/pilot-qa-runs/2026-09-01-main-dry-run.md`.
- **Test scenario:** Record command outcomes for `npm run typecheck`, `npm run format`, `npm test`, and `git diff --check`; update W1 and W3 to `Pass` if the new tests prove the API boundary.
- **Done signal:** The new run file names the commit tested, W1/W3 are no longer partial, and any remaining P1 items are still visible.

## Deferred P1 Work

These remain P1 but should follow the API hardening work:

| Item | Why deferred | First useful action |
|---|---|---|
| Browser smoke coverage for guest fallback screens | API hardening landed first; the follow-up branch added a dependency-free DOM-shaped render smoke. | Add real browser visual smoke once the guest app has a dev server or browser shell. |
| Physical QR placement metadata | It depends on a real pilot route recording or a closer recorder simulation. | During the first manual run, capture QR placement location, orientation, and route start anchor evidence. |
| Manual QA evidence habit | The template exists; the habit is proven by use over multiple runs. | Add one run file per QA pass and keep follow-up priorities current. |

## Verification Contract

Run these after implementing U1 and U2:

```bash
npm run typecheck
npm run format
npm test
git diff --check
```

Minimum passing evidence:

- API test suite includes direct assertions for `password-forbidden` from QR token and `wifi-proof-expired` from expired proof token.
- Full test suite reports zero failures.
- A new dry-run record links the passing evidence back to W1 and W3.

## Recommended Next Goal

`/goal Implement the P1 API test hardening from plans/2026-09-01-002-pilot-qa-p1-test-hardening-plan.md and record the post-hardening dry run`
