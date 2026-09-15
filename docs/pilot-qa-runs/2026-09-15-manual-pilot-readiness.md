# Toilet AR Navigation MVP Pilot QA Run - Manual Pilot Readiness

Run date: 2026-09-15
Tester: kjh
Branch / commit: codex/manual-pilot-readiness-qa based on 298451b
Venue / route: Sample pilot venue / restroom route
Device / browser: Galaxy Z Flip7 / Android 16; iOS App Clip not run

## Summary

Result: Partial.
Highest follow-up priority: P1.

The automated readiness sweep passes on the current local main state after PR #30.
This manual readiness record uses a sample pilot venue scenario, not a single-store-only service assumption.
Physical QR placement is not yet done; the current evidence is a local/manual simulation plus the available Android test phone.

## Commands

- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm test` reported 54 tests, 12 suites, 54 pass, 0 fail. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| M2-physical-placement | Partial | Venue / route is `Sample pilot venue / restroom route`; QR placement scenario is `Prototype entrance-to-restroom route`; physical placement status is `Not physically placed; local/manual simulation only`. | P1: record real QR placement metadata when a physical pilot venue is available. |
| A2 | Partial | Available Android test phone recorded as Galaxy Z Flip7 / Android 16. Browser, WebXR availability, and observed route screen result are not recorded yet. | P2: record first Android browser/WebXR result on the available phone. |
| A3 | Not run | iOS App Clip was not run in this pass. | P2: record first iOS App Clip handoff result when an iPhone/signing path is available. |

## Manual Evidence Recorded

Recorded values from this local/manual pilot readiness pass:

| Field | Value |
|---|---|
| Tester | kjh |
| Venue / route | Sample pilot venue / restroom route |
| QR placement scenario | Prototype entrance-to-restroom route |
| Physical placement status | Not physically placed; local/manual simulation only |
| QR evidence screenshot/photo reference | Not captured |
| Android device/browser status | Galaxy Z Flip7 / Android 16; browser/WebXR result not recorded yet |
| iOS App Clip status | Not run |

## Observed Friction

- Automated readiness is green, but physical QR placement is not yet observed.
- QR placement evidence should be treated as venue/scenario configuration, not a single-store-only service assumption.
- Localhost bind and headless browser launch require permissions in restricted harnesses when running the full suite.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Fill physical QR placement metadata from the real pilot setup. | Manual tester | Required before inviting an outside pilot tester. |
| P2 | Record physical Android WebXR result. | Manual tester | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | Manual tester | Requires Apple signing and physical iPhone. |
