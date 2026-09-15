# Current PR Merge Order

Updated: 2026-09-16
Baseline: `main` after PR #36.

Use this note while several split implementation PRs are open.
All listed PRs were `CLEAN` on GitHub when this note was written.

## Recommended Order

| Order | PR | Area | Why |
|---|---|---|---|
| 1 | #37 `feat: detect Android WebXR support during guest bootstrap` | `apps/guest-webxr/src/entry/bootstrap.ts` | Enables Android WebXR-ready state after valid QR route load. |
| 2 | #38 `test: cover WebXR ready visual smoke` | `apps/guest-webxr/src/entry/visual-smoke.ts` | Browser smoke coverage for the ready state from #37/#36-era behavior. |
| 3 | #39 `feat: describe guest route steps` | `packages/route-core` | Adds reusable route step descriptions without changing app rendering. |
| 4 | #43 `feat: show guest route step list` | `apps/guest-webxr/src/entry/index.ts` | Shows segment steps in the guest route screen. |
| 5 | #40 `feat: expose copy-safe guest dev URL` | `apps/guest-webxr/dev-server.ts` | Adds `copyUrl` to the JSON dev session response. |
| 6 | #41 `feat: add plain guest dev URL endpoint` | `apps/guest-webxr/dev-server.ts` | Adds plain text URL endpoint; merge after #40 if both touch the same dev response area. |
| 7 | #44 `feat: show copy-safe merchant launch URL` | `apps/merchant-admin/src/entry/view.ts` | Displays resolved launch URL in the merchant dashboard. |
| 8 | #45 `feat: return guest route session summary` | `apps/api/src/server.ts` | Returns session metadata with guest-safe route geometry. |
| 9 | #46 `feat: show password session expiry` | `packages/ui` | Allows password panel messages to include session expiry metadata. |
| 10 | #42 `docs: mark iOS App Clip device gap blocked` | `docs/ar-device-test-matrix.md` | Documents that iOS testing is blocked without a physical iPhone. |

## Notes

- #40 and #41 both touch the guest WebXR dev server; merge #40 first, then re-check #41 if GitHub stops reporting it as clean.
- #39 and #43 are complementary. #43 does not require #39, but later cleanup can reuse the route-core helper after both are merged.
- #45 and #46 are complementary. After both are merged, guest UI can pass session expiry into the password panel.
- Avoid stacking additional changes on these same files until this batch is merged or rebased.
