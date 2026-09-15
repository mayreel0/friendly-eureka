# Toilet AR Navigation MVP Pilot QA Run - QR Placement Evidence Affordance

Run date: 2026-09-15
Tester: Codex
Branch / commit: codex/qr-placement-evidence-affordance based on b27ca68
Store / route: merchant admin simulated pilot state / pilot-restroom-route
Device / browser: local Node.js automated test environment

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This run adds a merchant dashboard affordance for physical QR placement metadata.
The dashboard can now collect, save, and display QR placement location, orientation, and note fields as pilot readiness evidence.
It does not replace the future physical store visit or device run that captures the real QR installation.

## Commands

- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `npm --workspace @lechigo/merchant-admin test`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `npm --workspace @lechigo/merchant-admin test` reported 17 tests, 5 suites, 17 pass, 0 fail. | none |
| C4 | Pass | `npm test` reported 54 tests, 12 suites, 54 pass, 0 fail. | none |
| C5 | Pass | `git diff --check` exited 0. | none |
| M2-evidence-affordance | Pass | `apps/merchant-admin/test/entry.test.ts` records QR placement location, orientation, note, QA result summary, and saved readiness payload from the dashboard. | none |
| M2-physical-placement | Partial | The product can record placement evidence, but no real store QR installation has been captured yet. | P1: capture physical QR placement metadata in the first manual route recording run. |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |

## Observed Friction

- The evidence affordance uses the existing pilot readiness save path instead of adding a new API route.
- Manual QA still needs real location, orientation, and photo or operator notes from the actual pilot store.
- Localhost bind and headless browser launch require permissions in restricted harnesses when running the full suite.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Capture physical QR placement metadata in the first manual route recording run. | TBD | Use the new dashboard fields during the real pilot route setup. |
| P1 | Keep adding one run file per QA pass. | TBD | Evidence habit continues after this affordance run. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
