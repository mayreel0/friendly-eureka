# Toilet AR Navigation MVP Pilot QA Plan
Created: 2026-09-01

## Objective

Validate the merged Toilet AR Navigation MVP on `main` as a pilot-ready flow before adding the next implementation layer.
The QA pass should prove that the current contracts support the intended guest and merchant journeys, expose gaps that only appear in real flow testing, and produce a ranked next-build list.

## Scope

### In Scope

- Guest QR entry for a route that has passed merchant testing and is active.
- Concurrent guests scanning the same QR credential.
- QR-only guest route access without restroom password exposure.
- Wi-Fi-backed password access using server-issued proof.
- Unsupported AR runtime fallback to landmark guidance.
- Tracking degradation and drift recovery guidance.
- Merchant route recording, test-run, activation, and password rotation runbook checks.
- Device readiness evidence for the first physical pilot.

### Out of Scope

- Public restroom discovery, search, maps, or social sharing.
- Multi-store rollout operations beyond one pilot store and one route.
- Full production WebXR or App Clip implementation if the current code only exposes detection or placeholder contracts.
- Analytics dashboards, support tooling, or payment flows.

## Current Baseline

| Area | Current evidence | QA meaning |
|---|---|---|
| Core route/session logic | `packages/route-core/src/index.ts`, `packages/route-core/test/route-core.test.ts` | Validate route activation, session TTLs, Wi-Fi proof decisions, and recovery behavior. |
| API service contracts | `apps/api/src/server.ts`, `apps/api/test/server.test.ts` | Validate merchant authorization, QR credentials, guest tokens, password access, rate limiting, and audit redaction. |
| Guest entry surface | `apps/guest-webxr/test/entry.test.ts` | Validate QR-first entry, AR capability detection, App Clip handoff metadata, and manual fallback states. |
| Password panel state | `packages/ui/test/password-panel.test.ts` | Validate locked, revealed, and unavailable password states. |
| Merchant admin surface | `apps/merchant-admin/test/admin.test.ts` | Validate activation readiness and pilot setup checklist behavior. |
| Device matrix | `docs/ar-device-test-matrix.md` | Record physical-device results and unresolved runtime gaps. |
| Merchant runbook | `docs/merchant-route-recording-runbook.md` | Use as the manual staff setup checklist. |

## QA Tracks

### Track 1. Automated Contract Sweep

Run the full local verification suite before manual QA starts.

```bash
npm run typecheck
npm run format
npm test
git diff --check
```

Pass criteria:

- TypeScript completes with no errors.
- Format check exits cleanly.
- Test output reports zero failures.
- No whitespace errors are reported.

Failure handling:

- If a failure touches route/session/API/guest entry behavior, stop manual QA and fix the contract first.
- If a failure is unrelated to pilot QA, record it separately and decide whether it blocks the pilot.

### Track 2. Merchant Setup and Activation Dry Run

Use `docs/merchant-route-recording-runbook.md` as the source checklist.

| Scenario | Steps | Expected result | Evidence to record |
|---|---|---|---|
| M1. Create one pilot route draft | Register one store, define QR start point, add route anchors, add route segments, save draft. | Draft exists as recorded route data and is not guest-exposed yet. | Store ID, route ID, route version, anchor count, segment count. |
| M2. Block activation before testing | Try activation before a passing test run. | Activation is rejected with a route-test reason. | API result or test output. |
| M3. Record passing guest-mode test | Mark a pass after the latest route recording. | Route can become active. | Tested timestamp and route status. |
| M4. Invalidate route exposure after failed test | Mark a fail after activation or before issuing new QR material. | Guest QR material is not valid for exposure. | Rejected session creation result. |
| M5. Rotate restroom password only | Rotate password without changing geometry. | Password generation changes, existing password-capable sessions rotate out, route geometry does not require retest. | Password generation before/after and fetch result. |

### Track 3. Guest QR Entry

| Scenario | Steps | Expected result | Evidence to record |
|---|---|---|---|
| G1. Valid QR opens active route | Scan or simulate QR credential for the active pilot route. | Guest receives a signed route token and can fetch route geometry without password fields. | Token expiry, route ID, absence of password field. |
| G2. Two guests scan same QR concurrently | Create two QR sessions with different `clientKey` values from the same QR credential. | Both route tokens remain valid until their own expiry. | Fetch result for guest A and guest B. |
| G3. Copied QR abuse is limited per client | Create six QR sessions for one `clientKey` within one minute, then one session for another `clientKey`. | Sixth same-client request returns `qr-rate-limited`; other client still succeeds. | API results for request 6 and different client. |
| G4. Invalid QR material is rejected | Use a guessed or stale QR key after route/password material changes. | Session creation returns `invalid-qr-key`. | Rejected API result. |
| G5. Expired or tampered token is rejected | Fetch route with an expired token and a modified token. | API returns `token-expired` or `invalid-token`. | Rejected API result. |

### Track 4. Guest AR and Fallback Experience

| Scenario | Runtime | Steps | Expected result | Evidence to record |
|---|---|---|---|---|
| A1. Unsupported browser fallback | Desktop browser or unsupported mobile browser | Open guest route entry. | Manual landmark guidance is visible; no blank AR state. | Screenshot or test output. |
| A2. WebXR-capable detection | Android Chrome on ARCore-capable device, if available | Open guest route entry. | WebXR availability is detected and recorded in `docs/ar-device-test-matrix.md`. | Device, browser version, status. |
| A3. iOS App Clip handoff readiness | Signed physical iPhone, if available | Scan pilot QR. | App Clip handoff path opens or the missing-signing blocker is documented. | Device, iOS version, signing status. |
| A4. Tracking limited recovery | Simulate limited confidence or drift above threshold. | Recovery instruction points to the next route anchor. | Current anchor, next anchor, instruction text. |
| A5. Corrupt or empty anchors fallback | Simulate empty anchor/segment route. | Generic store-landmark fallback is returned instead of throwing. | Recovery result with no `nextAnchorId`. |

### Track 5. Wi-Fi Proof and Password Access

| Scenario | Steps | Expected result | Evidence to record |
|---|---|---|---|
| W1. QR-only session cannot read password | Fetch password with a QR-backed route token. | API returns `password-forbidden`. | API result. |
| W2. Server-issued Wi-Fi proof can unlock password | Issue Wi-Fi proof, create Wi-Fi guest session, fetch password. | Password is returned only from the Wi-Fi-backed session. | Proof expiry, session expiry, password fetch result. |
| W3. Stale Wi-Fi proof is blocked | Attempt Wi-Fi session after proof expiry. | API returns `wifi-proof-expired`. | API result and timestamps. |
| W4. Wi-Fi proof replay is blocked | Use the same proof token twice to create sessions. | Second attempt returns `wifi-proof-replayed`. | API result. |
| W5. Invalid proof timestamp is handled | Issue proof with invalid timestamp input. | API returns `invalid-timestamp`; no runtime crash. | API result. |
| W6. Password read logs are redacted | Fetch password from a valid Wi-Fi session. | Audit event records metadata and `[redacted]`, never the raw password. | Last audit log entry. |

## Pilot QA Result Log

Use this shape for every manual or semi-manual run.

| Field | Value |
|---|---|
| Run date | YYYY-MM-DD |
| Tester | Name or initials |
| Store / route | Pilot store ID and route ID |
| Device / browser | Device, OS, browser, app shell |
| Scenario IDs | M1, G2, A1, etc. |
| Result | Pass, fail, blocked, or not run |
| Evidence | Screenshot, command output, API result, device note |
| Observed friction | What felt confusing, slow, fragile, or surprising |
| Follow-up priority | P0, P1, P2, or none |

## Exit Criteria

The pilot QA pass is acceptable when:

- Automated contract sweep passes on `main`.
- One merchant route can be recorded, tested, activated, and protected from stale QR material.
- Two concurrent QR guests can both fetch the same active route.
- QR-only guests cannot view restroom passwords.
- Wi-Fi-backed guests can view restroom passwords only through valid, one-time, server-issued proof.
- Unsupported AR environments show usable landmark fallback.
- Physical device status is recorded in `docs/ar-device-test-matrix.md`, even if the status is a documented blocker.
- Every failed or blocked scenario has a next implementation priority.

## Next Implementation Priority

### P0. Pilot blockers

Fix these before inviting a real merchant or guest tester:

- Any failing automated contract in Track 1.
- Any blank guest entry state for unsupported AR runtimes.
- Any route/password exposure bug that leaks a restroom password to QR-only sessions.
- Any inability to invalidate stale QR material after route failure, route edit, or password rotation.
- Missing evidence path for manual physical-device results.

### P1. First real-world usability

Do these after P0 is clean, before expanding beyond one pilot store:

- Implement `plans/2026-09-01-002-pilot-qa-p1-test-hardening-plan.md` to turn the W1 and W3 dry-run partials into direct API evidence.
- Keep using `docs/pilot-qa-checklist.md` and `docs/pilot-qa-runs/` for manual QA evidence.
- Add real browser smoke coverage for guest fallback screens if the current tests remain state-only.
- Tighten merchant admin copy and checklist states around "recorded", "tested", and "active".
- Make device support status visible enough that a tester knows whether they are in AR, handoff, or fallback mode.

### P2. Expansion after pilot learning

Defer until the first pilot route has real tester feedback:

- Production WebXR path beyond support detection.
- App Clip signing, launch, and ARKit smoke automation.
- Multi-store and multi-route operational tooling.
- Analytics, event dashboards, and broader support workflows.

## Traceability

This QA plan follows the MVP plan in `plans/2026-08-27-001-feat-toilet-ar-navigation-mvp-plan.md` and the merged PR #3 behavior.
It uses `docs/ar-device-test-matrix.md`, `docs/api-security-contracts.md`, and `docs/merchant-route-recording-runbook.md` as supporting operational references.
