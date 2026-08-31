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
npm install --package-lock-only --ignore-scripts
npm test
npm run typecheck
npm run format
```

The current implementation uses Node.js built-in TypeScript stripping and test runner so the MVP core can be verified without downloading dependencies.

## Implemented Pilot Slice

- Route core serializes guest-safe AR geometry, checks activation readiness, creates short-lived sessions, validates Wi-Fi proof, and returns recovery guidance when tracking degrades.
- API service contracts cover merchant store ownership, route draft/test/activation, signed QR and Wi-Fi guest sessions, QR session rotation, password access gates, and redacted audit logging.
- Guest WebXR state helpers cover QR entry, AR support detection, App Clip handoff, manual fallback, AR guidance, and recovery prompts.
- Merchant admin state helpers cover activation blocking, password-only rotation readiness, and the pilot setup checklist.
