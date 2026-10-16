## Why

Phase 2 left four named ceilings in core (area plan `## Found`): expired sessions are never deleted, a wrong method on a known route answers 404, two `migrate` runs can interleave, and the sign-in limiter keys every client behind a proxy on the proxy's address. The admin manager also needs the delivered demo order to name the rider service's demo rider for admin-P3-L1's e2e.

## What Changes

- Every session start (registration, customer sign-in, staff sign-in) first deletes every session whose `expires_at <= now()`, the exact complement of the live-session check.
- A known path asked with a method it does not serve answers 405 `{"error":{"code":"method_not_allowed","message":"method not allowed"}}` with `Allow` listing the path's methods (`GET, POST, PUT, PATCH, DELETE` order). Unknown paths stay 404; CORS preflights stay 204.
- `migrate.Apply` holds a session advisory lock on its own connection for the whole run, so a second run waits and then applies only what is pending. `testdb.Migrated` drops its own lock (now redundant).
- `SHOPPERSTOP_CORE_TRUST_PROXY` (`true` or `false`, default `false`, anything else refuses to start): when `true` the per-IP limit keys on the first `X-Forwarded-For` address.
- `seed-demo`: SS-DEMOAAAB (`...0701`) names rider `Arjun Rao`; its `out_for_delivery` and `delivered` events are by rider `...0801` `Arjun Rao` (the rider service's demo rider).
- Contract: `method_not_allowed` added to the `Error.code` enum in `openapi.json`; regenerated `packages/ui/src/api/core.d.ts` (D19). No route, schema member or Postman change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `platform`: MODIFIED "Error envelope" (the new code); ADDED "A wrong method on a known route answers 405", "Migration runs do not interleave".
- `accounts`: ADDED "Expired sessions are deleted", "The rate limiter trusts a proxy only when told".
- `orders`: ADDED "The delivered demo order names its rider".

## Impact

- Area: `core`. Files under `services/core/`: `internal/migrate`, `internal/testdb`, `queries/auth.sql` and its sqlc output, `internal/auth` (`auth.go`, `customer.go`, `limit.go`, tests), `internal/config`, `cmd/core/main.go`, `internal/seed`, `internal/httpx/router.go`, `internal/app` tests, `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`.
- Contracts relied on: `services/core/openapi.json` (core to apps); the rider service's demo rider id and name (`services/rider/internal/seed/seed.go`).
- Cross-area: `packages/ui/src/api/core.test.ts` asserts the exact `Error.code` union and fails typecheck once `core.d.ts` gains `method_not_allowed`; ui lands a fix valid against both unions first (design.md "Cross-area").
- No new dependency, no new route, no migration.
- Out of scope: a `core-admin sweep-sessions` command or periodic sweep; an index on `sessions.expires_at`; HEAD support; the request log's remote address; the rider service's own router and migration runner (same ceilings, rider area); `SHOPPERSTOP_CORE_TRUST_PROXY` in the Makefile.
