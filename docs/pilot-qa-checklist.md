# Toilet AR Navigation MVP Pilot QA Checklist

Use this checklist with `plans/2026-09-01-001-toilet-ar-navigation-pilot-qa-plan.md`.
Each QA run should create one result file under `docs/pilot-qa-runs/` from the template below.

## Run Setup

- [ ] Confirm the branch is `main` and matches `origin/main`.
- [ ] Confirm the pilot route scope is one store and one route.
- [ ] Record tester, run date, device/browser, and route identifiers.
- [ ] Keep raw restroom passwords out of logs, screenshots, and shared notes.
- [ ] Record screenshots or command output for every failed or blocked item.

## Automated Contract Sweep

Run before any manual pilot attempt:

```bash
npm run typecheck
npm run format
npm test
git diff --check
```

- [ ] C1. TypeScript passes with no errors.
- [ ] C2. Format check passes.
- [ ] C3. Full test suite passes with zero failures.
- [ ] C4. `git diff --check` reports no whitespace errors.

## Merchant Setup and Activation

- [ ] M1. Store ownership is enforced for route writes.
- [ ] M2. A route draft can be saved with QR start point, anchors, and segments.
- [ ] M3. Activation is blocked before a successful route test.
- [ ] M4. A passing guest-mode route test allows activation.
- [ ] M5. A failed route test blocks guest exposure and invalidates QR material.
- [ ] M6. A route edit after testing requires a fresh passing test.
- [ ] M7. Password-only rotation does not require route geometry retest.
- [ ] M8. Staff fallback note is present before pilot use.

## Guest QR Entry

- [ ] G1. A valid QR credential creates a short-lived guest route token.
- [ ] G2. Guest route payload includes geometry and instructions only.
- [ ] G3. Guest route payload does not include restroom password data.
- [ ] G4. Two guests with different `clientKey` values can scan the same QR concurrently.
- [ ] G5. Same-client copied-key abuse is rate-limited.
- [ ] G6. Another client is not blocked by the copied-key rate limit bucket.
- [ ] G7. Guessed or stale QR credentials are rejected.
- [ ] G8. Expired guest route tokens are rejected.
- [ ] G9. Tampered guest route tokens are rejected.

## AR and Fallback Experience

- [ ] A1. Unsupported browser/device shows manual landmark guidance, not a blank AR state.
- [ ] A2. WebXR-capable Android status is recorded in `docs/ar-device-test-matrix.md`.
- [ ] A3. iOS App Clip handoff status is recorded in `docs/ar-device-test-matrix.md`.
- [ ] A4. Limited tracking confidence returns recovery guidance.
- [ ] A5. Excessive drift returns recovery guidance.
- [ ] A6. Empty or corrupt anchor data returns generic fallback guidance instead of throwing.

## Wi-Fi Proof and Password Access

- [ ] W1. QR-only guest session cannot fetch restroom password.
- [ ] W2. Server-issued Wi-Fi proof can create a password-capable guest session.
- [ ] W3. Wi-Fi proof expires after five minutes.
- [ ] W4. Wi-Fi proof replay is rejected.
- [ ] W5. Invalid Wi-Fi proof timestamp returns `invalid-timestamp`.
- [ ] W6. Password read audit logs redact the password value.
- [ ] W7. Password-capable sessions are invalidated after password rotation.

## Result Classification

Use the highest applicable priority:

| Priority | Meaning | Examples |
|---|---|---|
| P0 | Blocks real pilot use or risks private data exposure. | Blank guest entry, password leakage, broken QR entry, stale route exposure. |
| P1 | Real pilot can proceed, but the tester or staff experience is confusing or fragile. | Ambiguous activation state, unclear fallback state, missing QA evidence affordance. |
| P2 | Expansion or polish after first pilot learning. | Multi-store tooling, production WebXR expansion, App Clip automation, analytics. |
| none | Behavior passes or does not need follow-up. | Expected test pass, documented non-blocking device gap. |

## Result File Template

Create `docs/pilot-qa-runs/YYYY-MM-DD-<short-name>.md`:

```md
# Toilet AR Navigation MVP Pilot QA Run - <Short Name>

Run date: YYYY-MM-DD
Tester: <name or initials>
Branch / commit: main @ <sha>
Store / route: <store ID> / <route ID>
Device / browser: <device, OS, browser, app shell>

## Summary

Result: Pass / fail / blocked / partial
Highest follow-up priority: P0 / P1 / P2 / none

## Commands

- [ ] `npm run typecheck`
- [ ] `npm run format`
- [ ] `npm test`
- [ ] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Not run |  |  |

## Observed Friction

- None recorded.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| none |  |  |  |
```
