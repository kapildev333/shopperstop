## Why

D31 copied `internal/httpx` and `internal/migrate` from core into the rider service. core-P3-L3 (`core-hygiene`, archived 2026-10-15) fixed two ceilings in core's copies: a wrong method on a known route answered 404, and two `migrate` runs could interleave. The rider's copies still carry both (`r.MethodNotAllowed(notFound)`; the `ponytail:` "no advisory lock" comment), so the two services now drift. This change carries core-hygiene Decisions 2 and 3 over unchanged.

## What Changes

- A known rider path asked with a method it does not serve answers 405 `{"error":{"code":"method_not_allowed","message":"method not allowed"}}` with `Allow` listing the path's methods in GET, POST, PUT, PATCH, DELETE order. Unknown paths stay 404; CORS preflights from allowed origins stay 204.
- `migrate.Apply` holds a session advisory lock (key 727101) on its own hijacked connection for the whole run, so a second run waits and then applies only what is pending. `testdb.Migrated` drops its own lock on the same key (now redundant, and it would deadlock).
- Contract: `method_not_allowed` added to the `Error.code` enum in `services/rider/openapi.json`; regenerated `packages/ui/src/api/rider.d.ts` (D19 extended). The rider Postman collection does not change (`make postman` checked in the spike).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rider-service`: MODIFIED "Rider HTTP conventions match core" (wrong method is 405 with `Allow`; scenario "Unknown route and wrong method" changed, scenario "Preflight on a known path still answered" added); MODIFIED "Rider schema migrations" (advisory lock; scenario "Concurrent runs serialise" added).

## Impact

- Area: `rider`. Files: `services/rider/internal/migrate/` (`migrate.go`, `migrate_test.go`), `services/rider/internal/testdb/testdb.go`, `services/rider/internal/httpx/` (`router.go`, `router_test.go`), `services/rider/internal/app/app_test.go`, `services/rider/openapi.json`. Generated: `packages/ui/src/api/rider.d.ts`.
- Contracts relied on: `services/rider/openapi.json` (rider to apps, through `rider.d.ts`).
- Cross-area: `packages/ui/src/api/api.test.ts` "rider response types are usable by name" asserts the exact seven-code union with `toEqualTypeOf` and fails `tsc` (TS2344) once `rider.d.ts` gains `method_not_allowed`. ui lands the `toExtend` fix in design.md "Cross-area" first; it typechecks against the old and the new `rider.d.ts`. `apps/rider`, `apps/web` and `apps/admin` typecheck unchanged against the new `rider.d.ts`.
- No new dependency, route, migration or app change.
- Out of scope (backlog): core-hygiene Decision 1 (sweep expired rider sessions on sign-in), Decision 4 (trusted proxy for the sign-in limiter), Decision 5 (core's demo rider, core only); HEAD answered as GET; a 405 entry per operation in `openapi.json`.
