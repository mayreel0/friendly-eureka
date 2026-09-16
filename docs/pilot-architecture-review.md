# Lechigo AR Navigation Pilot — Comprehensive Project Review

**Date**: 2026-09-16  
**Baseline**: PR #1 ~ PR #49 (`main`)  
**Scope**: Full monorepo codebase (`packages/`, `apps/`, `docs/`, `scripts/`)

---

## 1. Executive Summary

Lechigo is an AR-guided indoor navigation system designed for seamless restroom and store-amenity guidance. The pilot implementation establishes a robust, framework-agnostic foundation focusing on:

1. **Security by Default**: Strict credential bounding, HMAC token verification, one-time Wi-Fi proof tokens, and password protection.
2. **Resilient User Experience**: Graceful multi-tier fallback (WebXR AR $\rightarrow$ Landmark Re-alignment $\rightarrow$ Step-by-Step Manual Guidance $\rightarrow$ Staff Code Note).
3. **Streamlined Merchant Workflow**: Strict route lifecycle state machine (Recorded $\rightarrow$ Tested $\rightarrow$ Active), QA checklist tracking, and physical QR placement runbooks.
4. **Lightweight & High Performance**: Zero runtime npm bloat, relying on native ES/TypeScript support in Node.js 24+, with 66 tests passing in under 3 seconds.

---

## 2. Architecture & Domain Separation

The monorepo enforces clean layer boundaries:

```
├── packages/
│   ├── route-core/        # Pure domain logic: Geometry, sessions, tracking & recovery math
│   ├── ui/                # Framework-neutral presentation logic & state formatters
│   └── config/            # Shared monorepo configuration & constants
├── apps/
│   ├── api/               # Stateless service contracts & cryptographic token handlers
│   ├── guest-webxr/       # Browser shell, custom element entry, fallback renderer
│   ├── merchant-admin/    # Merchant pilot dashboard, recording state & QA flow
│   ├── android/           # Android WebXR compatibility specifications
│   └── ios/               # iOS App Clip device gap specifications
├── docs/                  # Security contracts, runbooks, QA checklists, architecture
└── scripts/               # Unified pilot runner (`npm run dev:pilot`) & format checkers
```

### Layer Responsibilities
- **`packages/route-core`**: Completely decoupled from DOM and network. Implements route serialization, distance calculation, tracking drift evaluation, anchor recovery search, and guest session validation.
- **`apps/api`**: Pure JavaScript service functions without HTTP framework lock-in. Handles HMAC token signing/verification (`timingSafeEqual`), store ownership authorization, QR credential issuance, and rate limiting.
- **`apps/guest-webxr`**: Native Web Component shell (`lechigo-guest-entry`) providing shadow DOM encapsulation without forcing React/Vue dependencies.
- **`apps/merchant-admin`**: Manages the end-to-end pilot onboarding: Route recording $\rightarrow$ Test run verification $\rightarrow$ QA checklist $\rightarrow$ QR evidence logging $\rightarrow$ Guest launch URL generation.

---

## 3. Security & Cryptographic Contract Audit

| Security Control | Implementation | Assessment |
|:---|:---|:---|
| **Route Activation Gate** | `canActivateRoute` / `canExposeRoute` | ✅ Tested route required before activation; route edits or test failures immediately revoke QR credentials. |
| **Token Integrity** | HMAC-SHA256 with `timingSafeEqual` | ✅ Rejects forged, truncated, or tampered tokens with constant-time comparison. |
| **Wi-Fi Password Proof** | Single-use `proofId` with 5-minute TTL | ✅ Prevents replay attacks; Wi-Fi proof must be consumed immediately to obtain guest session. |
| **Password Invalidation** | Password generation counter (`passwordGeneration`) | ✅ Password rotation invalidates all existing password-capable guest sessions and QR material instantly. |
| **Rate Limiting** | `consumeQrRateLimit` | ✅ Throttles rapid session creation per store/route key. |
| **Audit Log Redaction** | `apps/api/src/server.ts` | ✅ Sensitive credentials (`password: '[redacted]'`) are masked in event streams. |

---

## 4. Navigation & State Machine Evaluation

```
[Start Scan] ──► Token Verified?
                    ├── No  ──► [Scan Required Screen]
                    └── Yes ──► WebXR Supported?
                                  ├── Yes (Android Chrome) ──► [Ready AR Screen]
                                  │                              ├── Tracking OK ──► [AR Mode Guidance]
                                  │                              └── High Drift  ──► [Camera Landmark Realign]
                                  └── No (iOS / Desktop)   ──► [Manual Fallback Step List]
```

### Key Strengths:
- **Resilient Guidance**: Even when WebXR is unsupported (e.g. iOS Safari before App Clip release, or desktop browsers), the guest receives rich step-by-step navigation instructions and landmark cues (`apps/guest-webxr`).
- **Drift Recovery**: If camera AR drift exceeds `DRIFT_RECOVERY_THRESHOLD_METERS (1.5m)`, the system prompts the user to point the camera toward the next visual landmark.

---

## 5. Developer Experience & Pilot Tooling

- **Single Pilot Command**: `npm run dev:pilot` boots both shells with shared publishing state. The seeded example route becomes available to guests only after administrator activation; the standalone guest command remains an independent seeded demo.
- **Physical Device Bridge**: Out-of-the-box instructions for Cloudflare Quick Tunnels (`cloudflared tunnel --url http://127.0.0.1:4173`) enabling instant Android testing over HTTPS.
- **Automated Verification**: `npm run typecheck`, `npm run format`, and `npm test` execute 66 tests across 13 test suites with 100% pass rate.

---

## 6. Production Readiness Roadmap & Recommendations

### P0 (Must Have Before Multi-Store Production)
1. **Persistent Storage Adapter**: Replace in-memory `Map` storage in `apps/api` with an abstract repository layer (PostgreSQL / SQLite / DynamoDB).
2. **Distributed Rate Limiting**: Move token buckets and rate limits from local process memory to a distributed cache (e.g., Redis) for multi-node deployments.

### P1 (Pilot Expansion)
1. **3D WebXR Engine Mount**: Wire the Web Component's `ready` screen to an actual WebXR rendering loop (Three.js / WebXR Device API) for 3D arrow projection.
2. **iOS App Clip Companion**: Implement native Swift/ARKit App Clip following the contract in `apps/ios/README.md`.

### P2 (Quality & Polish)
1. **Archive Deprecated Notes**: Clean up transitional merge order notes (`docs/current-pr-merge-order.md`) now that PRs #37~#49 are fully merged.

---

## 7. Verdict

The Lechigo AR Navigation Pilot codebase exhibits exceptionally high engineering quality, rigorous security guarantees, and modular, dependency-free architecture. It is fully ready for physical Android pilot validation.
