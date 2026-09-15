# Toilet AR Navigation MVP Pilot QA Run - Browser Visual Smoke

Run date: 2026-09-15
Tester: Codex
Branch / commit: codex/guest-fallback-visual-smoke based on 47134cf
Store / route: seeded pilot guest fallback fixture / pilot-restroom-route
Device / browser: local headless Chrome through Chrome DevTools Protocol

## Summary

Result: Partial pass.
Highest follow-up priority: P1.

This run adds real browser visual smoke coverage for the guest fallback screen.
The smoke opens `apps/guest-webxr/visual-smoke.html` through the guest WebXR dev server, waits for the browser-side smoke runner to pass, verifies the manual fallback text and layout box, and captures a non-empty PNG screenshot through the browser protocol.

## Commands

- [x] `npm run typecheck`
- [x] `npm run format`
- [x] `node --test apps/guest-webxr/test/visual-smoke-browser.test.ts`
- [x] `npm test`
- [x] `git diff --check`

## Scenario Results

| ID | Result | Evidence | Follow-up |
|---|---|---|---|
| C1 | Pass | `npm run typecheck` exited 0. | none |
| C2 | Pass | `npm run format` exited 0. | none |
| C3 | Pass | `node --test apps/guest-webxr/test/visual-smoke-browser.test.ts` reported 1 test, 1 suite, 1 pass, 0 fail. | none |
| C4 | Pass | `npm test` reported 53 tests, 12 suites, 53 pass, 0 fail. | none |
| C5 | Pass | `git diff --check` exited 0. | none |
| A1 | Pass | Headless Chrome rendered the visual smoke page, produced three smoke cases, showed manual fallback guidance text, had a positive layout box, and returned a non-empty PNG screenshot. | none |
| M2 | Partial | Route draft fixture covers anchors and segments, but physical QR placement metadata still needs manual evidence. | P1: capture physical QR placement metadata in first manual route recording run. |
| A2 | Not run | Physical ARCore Android device not available. | P2: record first physical Android WebXR result. |
| A3 | Not run | Signed physical iPhone and App Clip signing not available. | P2: record first iOS App Clip handoff result. |

## Observed Friction

- The visual smoke can run without adding Playwright or another browser dependency.
- Localhost bind and headless browser launch require permissions in restricted harnesses.
- The smoke currently proves visible fallback rendering, not physical-device AR startup.

## Follow-Up Queue

| Priority | Item | Owner | Notes |
|---|---|---|---|
| P1 | Cover physical QR placement metadata in first manual route recording run. | TBD | Automated dry runs only exercise fixture route data. |
| P1 | Keep adding one run file per QA pass. | TBD | Evidence habit continues after this browser visual run. |
| P2 | Record physical Android WebXR result. | TBD | Requires ARCore-capable Android phone. |
| P2 | Record physical iOS App Clip handoff result. | TBD | Requires Apple signing and physical iPhone. |
