# Toilet AR Navigation MVP Pilot QA Run - Browser Fallback Dry Run

Run date: 2026-09-01
Tester: Codex
Branch / commit: codex/guest-fallback-browser-smoke @ 284cc69 plus browser fallback smoke diff
Store / route: simulated contract fixtures / route-1
Device / browser: local Node.js DOM-shaped render smoke environment

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This dry run validates the first guest fallback browser-smoke layer after the P1 API hardening work.
It upgrades A1 from state-only fallback coverage to a DOM-shaped render smoke assertion that the manual fallback screen is non-blank and includes route guidance, distance, and anchors.
It does not replace a future Playwright or physical-browser visual smoke run because the current guest app does not yet expose a local dev server or full browser shell.

## Commands

- [x] `npm test -- apps/guest-webxr/test/entry.test.ts`
- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm test` reported 31 tests, 5 suites, 31 pass, 0 fail. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| A1 | Pass | `apps/guest-webxr/test/entry.test.ts` renders `renderGuestFallbackScreen` into a DOM-shaped document and asserts the fallback screen, instruction, distance, and route anchors are present. | P1: add real browser visual smoke when the guest app has a dev server or browser shell. |
| A4 | Pass | Existing guest entry coverage verifies limited tracking returns recovery guidance to the next anchor. | none |
| M2 | Partial | Route draft fixture covers anchors and segments, but physical QR placement metadata still needs manual evidence. | P1: capture physical QR placement metadata in first manual route recording run. |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |

## Observed Friction

- The guest fallback path now has render-level evidence instead of only state resolution evidence.
- The smoke harness intentionally stays dependency-free because the repo has no guest dev server or browser runner yet.
- A true browser visual pass remains useful once the guest app grows a browser shell.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Cover physical QR placement metadata in first manual route recording run. | TBD | Automated dry runs only exercise fixture route data. |
| P1 | Add real browser visual smoke for guest fallback once a browser shell exists. | TBD | Current coverage is DOM-shaped render smoke, not Playwright/device visual QA. |
| P1 | Keep adding one run file per QA pass. | TBD | Evidence habit continues after this third dry run. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
