## Why

rider-P4-L1 (`rider-hygiene`, archived 2026-10-16) carried core-hygiene Decisions 2 and 3 (405 with `Allow`, migrate lock) into the rider service and left the rest in the rider backlog: the expired-session sweep (core-hygiene Decision 1), the trusted proxy for the sign-in limiter (Decision 4), "HEAD answered as GET" and "405 listed per operation in `openapi.json`". D31 says the rider's copies follow core. This change carries over the two that core has and records why the other two are dropped.

## What Changes

- Every rider session start (rider sign-in) first deletes every rider session whose `expires_at <= now()`, the exact complement of the live-session check, as core's `startSession` does.
- `SHOPPERSTOP_RIDER_TRUST_PROXY` (`true` or `false`, surrounding spaces ignored, unset or empty `false`, anything else refuses to start naming the variable): when `true` the per-IP sign-in limit keys on the first `X-Forwarded-For` address, trimmed, or on the connection address when that is empty. Same parsing, default and header handling as `SHOPPERSTOP_CORE_TRUST_PROXY`.
- Dropped, with reasons in design.md: HEAD answered as GET (core answers HEAD on a GET route 405 `Allow: GET`, and so does the rider since rider-P4-L1; matching core means no change), 405 per operation in `openapi.json` (a wrong-method 405 comes from the router, not from a route; core's contract does not list it either).
- No contract change: `services/rider/openapi.json`, `packages/ui/src/api/rider.d.ts` and the rider Postman collection stay as they are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rider-service`: ADDED "Expired rider sessions are deleted", "The rider sign-in limiter trusts a proxy only when told".

## Impact

- Area: `rider`. Files under `services/rider/`: `queries/auth.sql` and its sqlc output `internal/auth/db/auth.sql.go`, `internal/auth/` (`auth.go`, `rider.go`, `limit.go`, `auth_test.go`), `internal/config/` (`config.go`, `config_test.go`), `cmd/rider/main.go`, `internal/app/riders_test.go`.
- Contracts relied on: none changed; `services/rider/openapi.json` untouched.
- No new dependency, route, migration or app change. No cross-area file.
- Out of scope: an index on `sessions.expires_at` or a periodic sweep; `SHOPPERSTOP_RIDER_TRUST_PROXY` in the Makefile, `deploy/` or the e2e env (core's variable is in none of them either); HEAD support in either service; a 405 entry per operation in either contract; a shared Go module for the copied code (D31).
