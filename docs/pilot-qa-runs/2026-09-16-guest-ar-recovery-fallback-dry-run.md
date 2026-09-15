# Toilet AR Navigation MVP Pilot QA Run - Guest AR Recovery Fallback

Run date: 2026-09-16
Tester: Codex
Branch / commit: codex/guest-ar-recovery-fallback based on 38132be
Venue / route: seeded sample pilot route / pilot-restroom-route
Device / browser: local Node.js automated test environment

## Summary

Result: Partial pass.
Highest follow-up priority: P2.

This run adds automated coverage for AR recovery and corrupt-route fallback guidance.
Limited tracking confidence, excessive drift, and unusable anchor or segment geometry now return guidance instead of leaving the guest with a silent AR state.

## Commands

- [x] `node --test apps/guest-webxr/test/entry.test.ts`
- [x] `npm --workspace @lechigo/guest-webxr run typecheck`
- [x] `npm run format`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm --workspace @lechigo/guest-webxr run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm test` reported 56 tests, 12 suites, 56 pass, 0 fail when run with localhost bind permission. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| A4 | Pass | `apps/guest-webxr/test/entry.test.ts` verifies limited tracking returns recovery guidance that asks the guest to realign on the next anchor. | none |
| A5 | Pass | `apps/guest-webxr/test/entry.test.ts` verifies excessive drift returns recovery guidance while preserving the next anchor. | none |
| A6 | Pass | `apps/guest-webxr/test/entry.test.ts` verifies empty anchors and broken segment references return generic fallback guidance instead of throwing. | none |

## Observed Friction

- Full guest WebXR workspace tests include dev-server and browser-smoke cases that bind localhost; those need elevated permissions in restricted harnesses.
- This run proves guidance contracts in Node.js, not a live headset or camera tracking session.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P2 | Record first iOS App Clip handoff result. | Manual tester | Requires Apple signing and physical iPhone. |
