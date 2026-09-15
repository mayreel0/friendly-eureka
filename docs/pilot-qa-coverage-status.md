# Toilet AR Navigation MVP Pilot QA Coverage Status

Updated: 2026-09-16
Baseline: main @ 55d05e7

This document tracks the current status of `docs/pilot-qa-checklist.md`.
The checklist remains a reusable run template; this file is the living coverage snapshot.

## Summary

Automated coverage is strong for API contracts, guest fallback behavior, Android WebXR availability, AR recovery, corrupt anchor fallback, and Wi-Fi password access.

The remaining meaningful gaps are physical pilot evidence:

- Physical QR placement metadata from a real venue.
- iOS App Clip handoff on a signed physical iPhone.

## Current Coverage

| Area | Status | Evidence | Remaining gap |
|---|---|---|---|
| Run setup | Partial | `docs/pilot-qa-runs/2026-09-15-manual-pilot-readiness.md` records the sample venue, tester, Android device, and route scenario. | Real venue QR placement evidence is still not captured. |
| Automated contract sweep | Pass | Latest full test evidence is recorded in `docs/pilot-qa-runs/2026-09-16-guest-ar-recovery-fallback-dry-run.md`. | none |
| Merchant setup and activation | Partial | `apps/api/test/server.test.ts`, `apps/merchant-admin/test/admin.test.ts`, and `apps/merchant-admin/test/entry.test.ts` cover ownership, route draft, activation gating, route test pass, failed test blocking, stale route edits, password-only rotation, and staff fallback notes. | Physical QR placement remains venue evidence, not an automated contract. |
| Guest QR entry | Pass | `apps/api/test/server.test.ts` and `apps/guest-webxr/test/dev-server.test.ts` cover guest token creation, guest-safe route payloads, password exclusion, concurrent QR sessions, copied-key rate limiting, guessed QR rejection, expired tokens, and tampered tokens. | none |
| AR and fallback experience | Partial | `apps/guest-webxr/test/entry.test.ts`, `apps/guest-webxr/test/visual-smoke-browser.test.ts`, `packages/route-core/test/route-core.test.ts`, and `docs/ar-device-test-matrix.md` cover manual fallback, Android WebXR availability, recovery guidance, drift recovery, and corrupt-anchor fallback. | iOS App Clip handoff is not run. |
| Wi-Fi proof and password access | Pass | `apps/api/test/server.test.ts` and `packages/ui/test/password-panel.test.ts` cover QR password denial, Wi-Fi proof sessions, proof expiry, proof replay, invalid proof timestamps, audit redaction, and password rotation invalidation. | none |

## Open Pilot Evidence

| Priority | Item | Why it remains |
|---|---|---|
| P1 | Capture physical QR placement metadata from a real venue. | Follow `docs/physical-qr-placement-runbook.md`; current evidence is still local/manual simulation. |
| P2 | Record iOS App Clip handoff status. | Requires Apple signing and a physical iPhone. |

## Next Implementation Candidates

| Candidate | Rationale |
|---|---|
| Physical QR placement run | Use `docs/physical-qr-placement-runbook.md` to capture real venue evidence when a physical pilot venue is available. |
| iOS App Clip readiness stub or checklist | Keeps the P2 iOS gap explicit until signing/device work is available. |
