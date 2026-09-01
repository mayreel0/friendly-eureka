# Toilet AR Navigation MVP Pilot QA Run - API Hardening Dry Run

Run date: 2026-09-01
Tester: Codex
Branch / commit: codex/pilot-qa-p1-hardening @ 8e0928a plus P1 hardening diff
Store / route: simulated contract fixtures / route-1
Device / browser: local Node.js automated test environment

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This dry run validates the P1 API hardening work from `plans/2026-09-01-002-pilot-qa-p1-test-hardening-plan.md`.
It upgrades W1 and W3 from indirect evidence to direct API assertions.
Manual physical-device AR checks and real browser smoke checks remain outside this dry run.

## Commands

- [x] `npm test -- apps/api/test/server.test.ts`
- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm test` reported 30 tests, 5 suites, 30 pass, 0 fail. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| W1 | Pass | `apps/api/test/server.test.ts` now directly asserts QR-backed `fetchPassword` returns `password-forbidden`. | none |
| W3 | Pass | `apps/api/test/server.test.ts` now directly asserts expired Wi-Fi proof token use returns `wifi-proof-expired`. | none |
| A1 | Partial | Guest fallback still has state-level automated coverage, not browser-render smoke coverage. | P1: add browser smoke coverage for guest fallback screens. |
| M2 | Partial | Route draft fixture covers anchors and segments, but physical QR placement metadata still needs manual evidence. | P1: capture physical QR placement metadata in first manual route recording run. |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |

## Observed Friction

- API security evidence for W1 and W3 is now direct and local.
- The remaining P1 gaps are experience/evidence gaps rather than API boundary gaps.
- This run still does not prove real browser visual rendering or physical AR startup.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Add browser smoke coverage for guest fallback screens. | TBD | Current coverage is still mostly state-level. |
| P1 | Cover physical QR placement metadata in first manual route recording run. | TBD | Automated dry runs only exercise fixture route data. |
| P1 | Keep adding one run file per QA pass. | TBD | Evidence habit continues after this second dry run. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
