# Toilet AR Navigation MVP Pilot QA Run - Main Dry Run

Run date: 2026-09-01
Tester: Codex
Branch / commit: main @ 8e0928a
Store / route: simulated contract fixtures / route-1
Device / browser: local Node.js automated test environment

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This dry run validates the automated contract layer on `main`.
Manual physical-device AR checks were not run because no signed iPhone, ARCore Android device, or pilot QR installation was available in this session.

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
| C3 | Pass | `npm test` reported 28 tests, 5 suites, 28 pass, 0 fail. | none |
| C4 | Pass | `git diff --check` exited 0. | none |
| M1 | Pass | Covered by `apps/api/test/server.test.ts` merchant ownership test. | none |
| M2 | Partial | `saveRouteDraft` is covered with fixture anchors and segments; manual QR placement metadata is not exercised. | P1: cover physical QR placement metadata in first manual route recording run. |
| M3 | Pass | Covered by activation-before-test API/admin tests. | none |
| M4 | Pass | Covered by route test and activation API/admin tests. | none |
| M5 | Pass | Covered by failed route exposure API test. | none |
| M6 | Pass | Covered by route-core stale route test. | none |
| M7 | Pass | Covered by route-core and admin password-only rotation tests. | none |
| M8 | Pass | Covered by merchant admin pilot-readiness checklist test. | none |
| G1 | Pass | Covered by active route QR exposure API test. | none |
| G2 | Pass | Covered by guest-safe route payload API assertion. | none |
| G3 | Pass | Covered by absence of password in guest route payload. | none |
| G4 | Pass | Covered by concurrent QR session API test. | none |
| G5 | Pass | Covered by same-client QR rate limit API test. | none |
| G6 | Pass | Covered by different-client QR rate limit API test. | none |
| G7 | Pass | Covered by invalid QR credential API tests. | none |
| G8 | Pass | Covered by expired QR token API test. | none |
| G9 | Pass | Covered by tampered QR token API test. | none |
| A1 | Pass | Covered by `apps/guest-webxr/test/entry.test.ts` fallback test. | none |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |
| A4 | Pass | Covered by guest entry and route-core tracking-limited recovery tests. | none |
| A5 | Pass | Covered by route-core drift recovery test. | none |
| A6 | Pass | Covered by empty anchor recovery fallback test. | none |
| W1 | Partial | Password panel QR-locked state is covered; direct API QR-token password rejection needs a focused assertion. | P1: add API test for `password-forbidden` from QR token. |
| W2 | Pass | Covered by Wi-Fi proof password access API test. | none |
| W3 | Partial | Route-core expiry decision is covered; API proof-token expiry needs a focused assertion. | P1: add API test for expired Wi-Fi proof token. |
| W4 | Pass | Covered by Wi-Fi proof replay API test. | none |
| W5 | Pass | Covered by invalid Wi-Fi proof timestamp API test. | none |
| W6 | Pass | Covered by password read audit redaction API test. | none |
| W7 | Pass | Covered by password session invalidation after rotation API test. | none |

## Observed Friction

- The automated dry run covers state contracts but does not prove a real browser visual layout or physical AR runtime.
- Device matrix entries for iOS App Clip and Android WebXR remain `Not run`.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Add browser smoke coverage for guest fallback screens. | TBD | Current coverage is mostly state-level. |
| P1 | Cover physical QR placement metadata in first manual route recording run. | TBD | Automated dry run only exercises fixture route data. |
| P1 | Add direct API coverage for QR-token password rejection. | TBD | Dry run found only UI-level evidence for W1. |
| P1 | Add direct API coverage for expired Wi-Fi proof tokens. | TBD | Dry run found route-core evidence, but not an API proof-token expiry assertion. |
| P1 | Create a manual QA evidence habit using this run-file pattern. | TBD | Required before inviting an outside pilot tester. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
