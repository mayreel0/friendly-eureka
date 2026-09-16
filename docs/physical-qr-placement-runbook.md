# Physical QR Placement Runbook

Use this runbook when capturing pilot evidence for a real venue's restroom route QR.
It complements `docs/pilot-qa-checklist.md`; it does not replace the automated contract sweep.

## Purpose

Physical QR placement evidence proves that the route starts from a real, discoverable, scannable location in the venue.
The result should be enough for a later reviewer to understand where the QR was placed, whether guests can find it, and whether scanning it starts the expected route.

## Before The Visit

- Confirm the route is the intended pilot restroom route.
- Confirm the route has passed guest-mode activation testing.
- For local Android checks, start both pilot dev shells with `npm run dev:pilot`.
- Prepare a QR print or display that points to the pilot guest entry.
- Bring at least one target Android test device and record the device, OS, browser, and browser version.
- Keep raw restroom passwords, private tokens, cookies, and internal hostnames out of photos and notes.

## Local Android Tunnel Setup

When testing from a physical Android device against the local dev server:

```bash
npm run dev:pilot
cloudflared tunnel --url http://127.0.0.1:4173
```

After cloudflared prints its HTTPS origin, restart the pilot servers with that origin:

```bash
GUEST_ORIGIN=https://your-tunnel.trycloudflare.com npm run dev:pilot
```

Keep the tunnel running. Restarting the pilot servers resets their development state.
Complete the merchant pilot controls and generate a new guest URL. Scan the displayed QR with Android Chrome, or use **Download QR image** to save a PNG. The default loopback URL works only on the computer, not on the phone.
These QR images carry temporary development sessions and are for local simulation; they are not permanent venue QR credentials. A changed tunnel origin requires restarting with the new value and generating a new guest URL.

## Placement Criteria

Record a placement only when it satisfies all required criteria:

| Criterion | Required result |
|---|---|
| Guest discoverability | A first-time guest can reasonably see the QR from the expected entry or waiting position. |
| Route start alignment | The QR is located at the intended route start point, not after the first confusing turn. |
| Scan distance | The QR scans reliably from normal standing distance. |
| Lighting | The QR remains readable under the venue's normal lighting. |
| Obstruction | Doors, counter items, staff movement, glare, or customer traffic do not routinely hide it. |
| Staff suitability | Staff can explain the QR purpose without exposing private restroom password data. |

## Evidence To Capture

Create or update a QA run file under `docs/pilot-qa-runs/` and include:

| Field | Example |
|---|---|
| Venue / route | `Sample pilot venue / restroom route` |
| QR placement scenario | `Entrance counter, guest-facing side` |
| Physical placement status | `Physically placed` / `Not physically placed` / `Blocked` |
| QR evidence screenshot/photo reference | `local photo retained by tester; not committed` |
| Scan distance | `0.5m`, `1m`, `1.5m` |
| Lighting condition | `daylight`, `evening indoor`, `low light`, `glare present` |
| Obstruction check | `clear`, `partially blocked`, `blocked during queue` |
| Device / browser | `Galaxy Z Flip7 / Android 16 / Chrome 152.0.7977.82` |
| Observed guest screen | `scan-required`, `manual-fallback`, `ar-guidance`, `error` |
| Result | `Pass`, `Partial`, `Fail`, or `Blocked` |

Do not commit raw photos if they include faces, private venue details, tokens, receipts, Wi-Fi identifiers, or restroom passwords.
Record a neutral reference instead, such as `photo retained by tester`.

## Test Procedure

1. Place the QR at the proposed start location.
2. Stand where a guest would naturally approach or wait.
3. Confirm the QR is visible without staff intervention.
4. Scan the QR with the target Android device.
5. Confirm the guest entry opens the expected route, not a generic error state.
6. Start guidance and confirm the first instruction matches the physical surroundings.
7. Move through the first route segment and confirm the next landmark or fallback instruction is understandable.
8. Repeat at normal standing distance and one farther distance if space allows.
9. Record any glare, obstruction, low-light, crowding, or staff explanation issue.

## Result Classification

| Result | Use when |
|---|---|
| Pass | QR is discoverable, scannable, starts the expected route, and first guidance matches the venue. |
| Partial | QR works, but placement, lighting, obstruction, or explanation needs adjustment before outside testing. |
| Fail | QR cannot be reliably found or scanned, opens the wrong route, or starts unusable guidance. |
| Blocked | Physical placement cannot be attempted because the venue, device, QR material, or network path is unavailable. |

Use the priority definitions in `docs/pilot-qa-checklist.md`.
Physical placement failures are usually P1 unless they block all guest entry, expose private data, or route guests to the wrong destination; those cases are P0.

## Minimal Result Template

```md
## Physical QR Placement

| Field | Value |
|---|---|
| Venue / route |  |
| QR placement scenario |  |
| Physical placement status |  |
| QR evidence screenshot/photo reference |  |
| Scan distance |  |
| Lighting condition |  |
| Obstruction check |  |
| Device / browser |  |
| Observed guest screen |  |
| Result |  |

Notes:

- 
```
