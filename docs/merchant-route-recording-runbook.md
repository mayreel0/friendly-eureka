# Merchant Route Recording Runbook

## Pilot Scope

The first pilot records one route for one store with one native recorder path.

## Recording Checklist

- Start at the physical QR placement.
- Confirm initial phone orientation and heading.
- Walk the route at a normal pace.
- Mark corners, stairs, elevators, doors, floor changes, and password-entry points.
- Pause when tracking weakens.
- Edit, reorder, or delete incorrect key points before saving.
- Run guest-mode testing before activation.

## Activation Checklist

- Confirm the route has been recorded.
- Run a passing guest-mode route test after the latest route recording.
- Place the QR code at the same start point used for route recording.
- Add a staff fallback note for guests who cannot use AR.

## Password Rotation

Changing only the restroom password does not require a route geometry retest.
Retest is required when the path, landmarks, floors, or QR placement changes.

## Local Verification

```bash
npm test -- apps/merchant-admin/test/admin.test.ts packages/route-core/test/route-core.test.ts
```
