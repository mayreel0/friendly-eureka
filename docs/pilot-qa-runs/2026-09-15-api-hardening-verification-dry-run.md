# Toilet AR Navigation MVP Pilot QA Run - API Hardening Verification

Run date: 2026-09-15
Tester: Codex
Branch / commit: codex/pilot-api-hardening-verification based on 9d0064e
Store / route: simulated contract fixtures / route-1
Device / browser: local Node.js automated test environment

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This run revalidates the P1 API hardening from `plans/2026-09-01-002-pilot-qa-p1-test-hardening-plan.md` on the current local main state after PR #27 was merged.
W1 and W3 now have direct API boundary evidence.
The remaining P1 items are still browser/manual evidence gaps.

## Commands

- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0 after narrowing `complete-follow-up` handling away from local route actions. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm test` reported 52 tests, 11 suites, 52 pass, 0 fail. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| W1 | Pass | `apps/api/test/server.test.ts` directly asserts QR-backed `fetchPassword` returns `password-forbidden`. | none |
| W3 | Pass | `apps/api/test/server.test.ts` directly asserts expired Wi-Fi proof token use returns `wifi-proof-expired`. | none |
| A1 | Partial | Guest fallback has automated state and dev-server coverage, but no browser visual smoke evidence. | P1: add browser smoke coverage for guest fallback screens. |
| M2 | Partial | Route draft fixture covers anchors and segments, but physical QR placement metadata still needs manual evidence. | P1: capture physical QR placement metadata in first manual route recording run. |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |

## Observed Friction

- The API boundary now directly proves both security cases from the P1 hardening plan.
- The full suite needed localhost bind permission for dev-server tests.
- A merchant-admin follow-up action type boundary blocked `npm run typecheck` until `complete-follow-up` was consumed before local route actions.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Add browser visual smoke coverage for guest fallback screens. | TBD | Current automated coverage does not preserve a rendered screenshot or pixel-level browser proof. |
| P1 | Cover physical QR placement metadata in first manual route recording run. | TBD | Automated dry runs only exercise fixture route data. |
| P1 | Keep adding one run file per QA pass. | TBD | Evidence habit continues after this verification run. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
