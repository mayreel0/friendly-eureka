# AR Device Test Matrix

| Surface | Device / browser | Expected result | Status | Notes |
|---|---|---|---|---|
| iOS App Clip ARKit | TBD physical iPhone | QR invocation opens App Clip and starts ARKit tracking | Not run | Requires Apple signing and physical device |
| Android Chrome WebXR | TBD ARCore-capable Android phone | WebXR support detection reports AR availability | Not run | Fast-follow after QR pilot |
| Guest fallback | Desktop or unsupported mobile browser | Non-AR landmark steps are shown | Planned | Covered by automated UI state tests |
