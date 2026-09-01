# AR Device Test Matrix

| Surface | Device / browser | Expected result | Status | Notes |
|---|---|---|---|---|
| iOS App Clip ARKit | TBD physical iPhone | QR invocation opens App Clip and starts ARKit tracking | Not run | Requires Apple signing and physical device |
| Android Chrome WebXR | TBD ARCore-capable Android phone | WebXR support detection reports AR availability | Not run | Fast-follow after QR pilot |
| Guest fallback | Desktop or unsupported mobile browser | Non-AR landmark steps are shown | Automated | Covered by `apps/guest-webxr/test/entry.test.ts` |
| Password panel | QR and Wi-Fi guest sessions | QR locks password; Wi-Fi proof can reveal it | Automated | Covered by `packages/ui/test/password-panel.test.ts` |

## Local Automated Checks

```bash
npm test -- apps/guest-webxr/test/entry.test.ts packages/ui/test/password-panel.test.ts
```

## Manual Device Exit Criteria

- iOS App Clip opens from the pilot QR code on a signed physical device.
- AR tracking starts at QR placement and recovers at the next landmark after a tracking interruption.
- Unsupported browsers show manual route guidance instead of a blank AR view.
- Password panel remains locked for QR-only sessions and reveals the code only after approved in-store proof.
