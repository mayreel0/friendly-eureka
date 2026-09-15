# AR Device Test Matrix

| Surface | Device / browser | Expected result | Status | Notes |
|---|---|---|---|---|
| iOS App Clip ARKit | TBD physical iPhone | QR invocation opens App Clip and starts ARKit tracking | Not run | Requires Apple signing and physical device; not run in `docs/pilot-qa-runs/2026-09-15-manual-pilot-readiness.md` |
| Android Chrome WebXR | Galaxy Z Flip7 / Android 16; Chrome 152.0.7977.82 | WebXR support detection reports AR availability | Pass | WebXR availability reported `available`, and the guest route screen rendered normally through a Cloudflare quick tunnel; captured in `docs/pilot-qa-runs/2026-09-15-manual-pilot-readiness.md` |
| Guest fallback | Desktop or unsupported mobile browser | Non-AR landmark steps are shown | Automated | Covered by state and DOM-shaped render smoke in `apps/guest-webxr/test/entry.test.ts` |
| Password panel | QR and Wi-Fi guest sessions | QR locks password; Wi-Fi proof can reveal it | Automated | Covered by `packages/ui/test/password-panel.test.ts` |

## Local Automated Checks

```bash
npm test -- apps/guest-webxr/test/entry.test.ts packages/ui/test/password-panel.test.ts
```

Latest automated dry run: `docs/pilot-qa-runs/2026-09-15-browser-visual-smoke-dry-run.md`.
Latest manual readiness record: `docs/pilot-qa-runs/2026-09-15-manual-pilot-readiness.md`.

## Manual Device Exit Criteria

- iOS App Clip opens from a pilot QR code on a signed physical device.
- AR tracking starts at QR placement and recovers at the next landmark after a tracking interruption.
- Unsupported browsers show manual route guidance instead of a blank AR view.
- Password panel remains locked for QR-only sessions and reveals the code only after approved in-store proof.
