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
npm install
npx playwright install chromium
npm test
npm run typecheck
npm run format
```

The current implementation uses Node.js built-in TypeScript stripping for tests and `tsc --noEmit` for semantic type checking.

The merchant dashboard uses Lit components and templates. Its dev server bundles the browser entry with esbuild; the existing dev command is unchanged:

```bash
npm --workspace @lechigo/merchant-admin run dev
```

Merchant browser tests use real Chromium, including action persistence and error recovery. The pilot data remains local development data. Both dev commands save merchant setup, QR placement evidence, and follow-ups to `.lechigo/pilot-state.json` (ignored by Git), so restarting restores them. Guest session URLs are excluded from disk; generate a fresh guest URL after restart.

Set `PILOT_STATE_FILE` to use a different local state file. Run only one merchant server per file. For a fresh pilot, stop the server and move the state file aside before restarting. If saved JSON is corrupt, startup fails without overwriting it; preserve a backup before repairing it.

The guest launch panel displays a scannable QR and downloads it as a PNG. For phone testing, start a tunnel to guest port 4173, then use its HTTPS origin when starting the pilot servers:

```bash
cloudflared tunnel --url http://127.0.0.1:4173
# In another terminal, substitute the origin printed by cloudflared:
GUEST_ORIGIN=https://your-tunnel.trycloudflare.com npm run dev:pilot
```

Open the merchant dashboard and generate a new guest URL; its QR uses that origin. `GUEST_ORIGIN` also works with the standalone merchant dev command. Without it, QR links target this computer's loopback address and cannot be opened on a phone. These QR images contain temporary development sessions, not permanent venue entry credentials.

## Implemented Pilot Slice

Guest links now open step-by-step landmark guidance. Confirm each landmark, return to the previous step when needed, and confirm arrival at the final destination. Floor transitions and an expandable full route list remain available without AR support. This is manual progression, not camera-based position tracking; progress resets on reload and is not stored in browser storage.

- Route core serializes guest-safe AR geometry, checks activation readiness, creates short-lived sessions, validates Wi-Fi proof, and returns recovery guidance when tracking degrades.
- API service contracts cover merchant store ownership, route draft/test/activation, server-issued QR and Wi-Fi guest sessions, QR credential validation/rate limiting, session rotation, password access gates, and redacted audit logging.
- Guest WebXR state helpers cover QR entry, AR support detection, App Clip handoff, manual fallback, AR guidance, and recovery prompts.
- Merchant admin state helpers cover activation blocking, password-only rotation readiness, and the pilot setup checklist.
