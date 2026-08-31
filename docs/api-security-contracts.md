# API Security Contracts

The current API implementation is a dependency-free service layer in `apps/api/src/server.ts`.
It is intentionally HTTP-framework-neutral so the same contracts can be mounted behind a later REST, edge, or native backend adapter.

## Merchant Access

- Merchants can write routes only for stores that match both their principal ID and declared store list.
- Route activation requires a successful route test after the most recent route recording.
- Password-only rotation updates the restroom code without forcing a route geometry retest.

## Guest Sessions

- QR sessions are signed HMAC tokens with a 10-minute TTL.
- QR session rotation invalidates earlier QR tokens for the same route.
- Wi-Fi sessions require a store-matching proof that is no older than five minutes.
- Guest route payloads contain geometry and instructions only; restroom passwords are never included in route responses.
- Restroom password reads require a Wi-Fi-backed token with `canViewPassword`.

## Audit Logging

Password reads emit an audit event with store, route, and source metadata.
The password value is logged only as `[redacted]`.

## Automated Coverage

Run:

```bash
npm test -- apps/api/test/server.test.ts
```

Covered cases:

- health response does not expose configuration details
- merchant store ownership enforcement
- route test requirement before activation and QR exposure
- expired, tampered, and replayed QR token rejection
- Wi-Fi proof store matching
- password read redaction
