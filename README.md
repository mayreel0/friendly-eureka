# Lechigo

Mobile-first AR restroom navigation MVP for cafes and restaurants.

## Workspace

This repository is a greenfield monorepo.

- `apps/api` contains the local route and session API.
- `apps/guest-webxr` contains the guest QR/WebXR entry surface.
- `apps/merchant-admin` contains the merchant setup and activation surface.
- `apps/ios` contains iOS App Clip and merchant-recorder notes.
- `apps/android` contains Android merchant-recorder notes.
- `packages/route-core` contains shared route, activation, session, Wi-Fi, progress, and recovery rules.
- `packages/ui` contains shared UI state helpers.

## Commands

```bash
npm test
npm run typecheck
```

The current implementation uses Node.js built-in TypeScript stripping and test runner so the MVP core can be verified without downloading dependencies.
