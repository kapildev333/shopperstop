## Context

See proposal.md for why. Inputs read: PLAN.md Phase 3 and D29 to D35, `.claude/areas/rider.md` (work package and `## Requests`), Spec 2 §5, §6, §9, §10, §12, §13, Spec 1 §11, `openspec/config.yaml`, `.claude/lanes/platform-P3-L1.md`, the Makefile (`RIDER_ENV`, `E2E_ENV`, `test-rider`, `seed`, `gen`, `postman`), `.github/workflows/ci.yml` (`rider` job; the `core` job's `make gen postman` clean-tree check now covers rider files too), `scripts/postman.mjs`, `docs/postman/local.postman_environment.json`, and all of `services/core` that the rider copies or mirrors: `cmd/core`, `cmd/core-admin`, `internal/config`, `internal/httpx`, `internal/pg`, `internal/auth`, `internal/migrate`, `internal/testdb`, `internal/seed`, `internal/app` (router, `app_test.go`, `staff_test.go`, `contract_test.go`), `openapi.json`, `sqlc.yaml`, `queries/auth.sql`.

Facts relied on (checked 2026-10-15): the running Postgres has role `shopperstop_rider` owning `shopperstop_rider`, `_test` and `_e2e` (platform-P3-L1); `sqlc` v1.31.1 locally and in CI; core's `GET /api/core/v1/admin/me` answers `Staff` (`id`, `email`, `name`, `role` `admin|store_staff`, `storeId` only for store staff, `isActive`) or 401, and its public `GET /api/core/v1/stores/{id}` answers `Store` (`id`, `name`, `isOpen`, fee fields, `promisedMinutes`) for open and closed stores alike, 404 otherwise. Neither needs core-P3-L1, so this change runs against today's core in `make e2e` and `make dev`.

## Goals / Non-Goals

**Goals:** every requirement in `specs/rider-service/spec.md`; a service rider-P3-L2 extends by adding a migration, a package and routes, without reshaping the core client, the fake, the router or the seed.

**Non-Goals:** deliveries, ready orders, location, the customer delivery read and their core calls (rider-P3-L2); the rider app (L3); `packages/ui/src/api/rider.d.ts` (after ui-P3-L2); moving a rider to another store or changing a rider's email; password reset by the rider; a shared Go module (D31).

## Decisions

1. **Copies from core (D31), origin `services/core` at commit `5335efcec70b770ffca2b13b62fca855ce5aaa0b` (origin/main, 2026-10-15).** Copied with their tests, imports renamed to the rider module, comments saying "core" changed to "rider": `internal/httpx` (all files; `Error` drops `ProductIDs`, which only core's `out_of_stock` uses, and `TestWriteErrorProductIDs` goes with it), `internal/pg`, `internal/migrate`, `internal/testdb` (env `SHOPPERSTOP_RIDER_TEST_DATABASE_URL`, default `postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable`, advisory lock `727101`), `internal/auth/limit.go` and `password.go`, the `serve` and `newHTTPServer` functions of `cmd/core/main.go`, `internal/app/contract_test.go` (toy docs use `/api/rider/v1`), and the readyz tests of `internal/app/app_test.go`. `internal/pg` lands with task 2, because its tests need tables: they use `riders` and `sessions` where core's use `customers` and `addresses` (unique email, a session for an unknown rider as the foreign-key case), and `TestStaffRoleMatchesStore` is dropped. Each copied file's package comment ends with `Copied from services/core at 5335efc (D31).` Ceiling: drift between the two copies until payment lands and a shared module is extracted.
2. **Layout** (Spec 2 §9 in miniature): `cmd/rider`, `cmd/rider-admin`, `internal/config`, `internal/httpx`, `internal/pg`, `internal/migrate`, `internal/testdb`, `internal/auth` (riders, sessions, the two Require middlewares, sign-in, and the staff rider handlers, as core's `auth` holds staff), `internal/auth/db` (sqlc), `internal/core` (client), `internal/coretest` (fake), `internal/app` (routes, contract test, route tests), `internal/seed`, `migrations/`, `queries/auth.sql`, `sqlc.yaml`, `openapi.json`. No `internal/rider` package: riders are the service's only account type and live beside their sessions.
3. **Store id without a foreign key**: `riders.store_id` is core's store id (D32). Its existence is checked through core when a rider is created (API and CLI), never again. Ceiling: a store deleted in core leaves its riders; core refuses to delete a store with orders, so only riders of a never-used store are affected.
4. **Phone is optional**: `phone text not null default ''`, omitted from JSON when empty (core's customer rule), validated as core validates a customer phone (`^\+?[0-9]{10,15}$`), cleared by PATCH `""`. `create-rider` takes only an email and a store, so it creates `Rider` without a phone; staff add it later. The demo phones are stored as `+919000000001` to `+919000000004` (the work package's `+91 90000 000xx` with the spaces dropped, as core stores `+919800000000`).
5. **Rider sessions are customer-shaped**: 30 days from last use, last use written at most once an hour (core's customer session), not staff-shaped (12 h fixed), because a rider works shifts on a phone. Their own `sessions` table with `rider_id` (cascade) instead of core's `subject_type`/`subject_id`, since riders are the only subject. `RequireRider` joins `riders.is_active`, and deactivation also deletes the sessions, so an inactive rider's token is refused either way.
6. **Staff authenticate by introspection** (D30): `RequireStaff` answers 401 without a bearer and otherwise calls `core.StaffFromToken`. A core 401 is the caller's 401; anything else (non-2xx, transport error, undecodable body) is logged once in the client as `core call failed` with method, path, status or error and `requestId`, and answered 502 `{code: "internal", message: "core unavailable"}`. A core 404 on `GET /admin/me` is core failing (the route is missing), not the caller being refused, so it is a 502 like the rest. Successful answers are cached 30 s per `sha256(token)` in memory; failures are not cached. Ceilings: a staff user deactivated or signed out in core keeps rider access for up to 30 s; the cache is per process; a flood of unknown tokens reaches core every time (core's own limits apply); every insert prunes expired entries by a full scan under the lock (`ponytail:` comment; a bounded LRU or a sweeper if many distinct tokens churn).
7. **Store scope**: admins act on every store; store staff on `staff.StoreID` only. A `store` filter or a `storeId` body naming another store is 403 `forbidden` (the work package; the caller named the store, so nothing leaks). A rider of another store by path id is 404 `not_found`, the same as an unknown id (Spec 2 §5: other stores' resources do not leak). Store ids compare without case.
8. **Store check through the public route**: `core.Store(id)` reads `GET /api/core/v1/stores/{id}` without a token: it exists today, answers closed stores too, and needs no service token. Core 404 becomes 400 `validation` on `storeId` ("no such store"). A rider may be created at a closed store.
9. **Creation order**: `POST /admin/riders` reads the body; `storeId` must be a uuid (400 `storeId`); store staff scope (403); `auth.CreateRider(ctx, pool, core, in)` first validates email, name, phone and password exactly as core does (`checkEmail`, `checkName`, `checkPasswordLength`, `phonePattern`, copied from core's `customer.go` at the origin commit), then checks the store with core (400 `storeId` or 502), so an invalid body never costs a core call and gets its 400 while core is down; then hashes at cost 12 and inserts (unique email 409 `conflict` on `email`). The CLI calls the same `auth.CreateRider` with name `Rider`. One function, one rule set.
10. **PATCH** (`ReadPatch`, so `null` is refused): `name`, `phone`, `isActive`, `password`; other members are ignored as core ignores them (`storeId` and `email` cannot change). Request schemas (`SignInRequest`, `RiderCreate`, `RiderPatch`) therefore carry no `additionalProperties: false`, as core's request schemas; response schemas keep it. One transaction: lock the rider row (`for update`), apply the scope check (404), update, and when `isActive` is false delete its sessions.
11. **One subject per request in the log**: `rider` (its id) on rider routes, `staff` (core's staff id) on `/admin/*`.
12. **Contract from the first task**: `openapi.json` and the contract and security tests land with the skeleton, so each later task documents its routes in the same commit that serves them and regenerates the Postman collection. Tags: `platform` (health) and `rider-service` (everything else); rider-P3-L2 adds `deliveries`. `servers: [{"url": "/api/rider/v1"}]`, `info.version` `0.3.0`, `components.securitySchemes.bearer` `{type: http, scheme: bearer}`.
13. **The seed never calls core**: `internal/seed` imports neither `internal/core` nor `internal/coretest` directly, and `seed-demo` builds no client. It reaches `core` only as a compile-time dependency through `auth.HashPassword` (the `auth` package holds the client type); no code path in the seed or `seed-demo` makes a request, and `TestSummaryMatchesSeed` signs the demo riders in with a client pointed at a closed port. It loads only rider rows, whose store ids are core's fixed demo ids (D20), so it runs before any server is up (`make seed`, `make e2e`).
14. **No `docs/design/rider-P3-L1.md`**: this file holds the data model, interfaces, error handling and test strategy.

## Data model

`migrations/0001_init.sql`:

```sql
-- Baseline: citext for case-insensitive emails and the updated_at trigger every table uses.
create extension if not exists citext with schema public;

create function set_updated_at() returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end
$$;
```

`migrations/0002_riders.sql`:

```sql
-- Riders and their bearer sessions (rider-service-foundation).
create table riders (
    id            uuid primary key default gen_random_uuid(),
    store_id      uuid not null, -- core's store id, no foreign key (D32)
    email         citext not null unique,
    name          text not null,
    phone         text not null default '',
    password_hash text not null,
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index riders_store_id on riders (store_id);
create trigger riders_updated_at before update on riders for each row execute function set_updated_at();

create table sessions (
    id           uuid primary key default gen_random_uuid(),
    rider_id     uuid not null references riders (id) on delete cascade,
    token_hash   bytea not null unique,
    expires_at   timestamptz not null,
    last_seen_at timestamptz not null default now(),
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);
create index sessions_rider_id on sessions (rider_id);
create trigger sessions_updated_at before update on sessions for each row execute function set_updated_at();
```

`sqlc.yaml`: one entry, `schema: migrations`, `queries: queries/auth.sql`, out `internal/auth/db`, package `db`, `sql_package: pgx/v5`, `emit_pointers_for_null_types: true`, the two uuid overrides of core's `sqlc.yaml` (uuid to `string`, nullable uuid to `*string`). Queries in `queries/auth.sql` (names fixed so L2 can rely on them): `CreateRider :one`, `RiderByEmail :one` (with `password_hash`), `RiderByID :one`, `LockRider :one` (`for update`), `ListRiders :many` and `CountRiders :one` (both `where sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id)`, list `order by email limit offset`), `UpdateRider :one` (`coalesce(sqlc.narg(...))` for `name`, `phone`, `password_hash`, `is_active`), `CreateSession :exec` (`expires_at = now() + interval '30 days'`), `RiderSession :one` (session joined to an active rider, `expires_at > now()`), `TouchSession :exec` (core's `TouchCustomerSession`), `DeleteSession :exec`, `DeleteRiderSessions :exec`.

## Interfaces

`internal/config`: `Config{DatabaseURL, Addr, SessionPepper string; WebOrigins []string; CoreURL, CoreServiceToken string; LogLevel slog.Level}`, `Load(getenv func(string) string) (Config, error)` as core's. `CoreURL` is trimmed, its trailing `/` dropped, and must parse with scheme `http` or `https` and a host. `CoreServiceToken` is required, not trimmed.

`internal/core`:

```go
type Staff struct { // core's Staff, as GET /api/core/v1/admin/me answers it
    ID       string `json:"id"`
    Email    string `json:"email"`
    Name     string `json:"name"`
    Role     string `json:"role"`              // admin | store_staff
    StoreID  string `json:"storeId,omitempty"` // store staff only
    IsActive bool   `json:"isActive"`
}
type Store struct { // the part of core's public Store the rider reads
    ID     string `json:"id"`
    Name   string `json:"name"`
    IsOpen bool   `json:"isOpen"`
}
var ErrUnauthorized = &httpx.Error{Status: 401, Code: "unauthorized", Message: "sign in required"}
var ErrNotFound = &httpx.Error{Status: 404, Code: "not_found", Message: "not found"}

func New(baseURL, serviceToken string, now func() time.Time) *Client // http.Client timeout 5 s
func (c *Client) StaffFromToken(ctx context.Context, token string) (Staff, error) // GET /admin/me with that bearer, cached
func (c *Client) Store(ctx context.Context, id string) (Store, error)              // GET /stores/{id}, no bearer
// do sends one request to base+"/api/core/v1"+path with bearer (when non-empty) and JSON body (when non-nil),
// decodes a 2xx into out (when non-nil), returns ErrUnauthorized on 401, ErrNotFound on 404, and the logged
// 502 error otherwise. Every method, L2's included, goes through it.
func (c *Client) do(ctx context.Context, method, path, bearer string, body, out any) error
```

What rider-P3-L2 adds, without changing the above: `StoreOrders(ctx, storeID, status)`, `Order(ctx, id)`, `ChangeStatus(ctx, id, status string, actor Actor)` (service token as bearer, so `do` gets a service-token caller), `CustomerFromToken(ctx, token)` and the customer's order read; a 409 passthrough in `do`; `Order`, `Actor`, `Customer` types; and the matching fake routes. `Stores()` from the work package has no caller in L1 or L2 and is left out.

`internal/coretest`:

```go
type Fake struct{ /* httptest.Server, mutex, maps */ }
func New() *Fake                                // serves GET /api/core/v1/admin/me and GET /api/core/v1/stores/{id} with core's bodies and envelopes
func (f *Fake) URL() string
func (f *Fake) Close()
func (f *Fake) AddStaff(token string, s core.Staff) // that bearer answers s; any other bearer, or none, answers core's 401
func (f *Fake) AddStore(s core.Store)            // known stores answer 200; others core's 404
func (f *Fake) Calls(route string) int           // requests seen, keyed "GET /api/core/v1/admin/me"
func (f *Fake) Fail(status int)                  // every route answers status with {"error":{"code":"internal",...}}; 0 restores
```

`internal/auth`:

```go
type Rider struct {
    ID       string `json:"id"`
    StoreID  string `json:"storeId"`
    Email    string `json:"email"`
    Name     string `json:"name"`
    Phone    string `json:"phone,omitempty"`
    IsActive bool   `json:"isActive"`
}
func New(pool *pgxpool.Pool, pepper string, limit *Limiter, c *core.Client) *Auth // task 2 has no c; task 4 adds it
func (a *Auth) SignIn(w, r); SignOut(w, r); Me(w, r)
func (a *Auth) RequireRider(next http.Handler) http.Handler; func CurrentRider(ctx) Rider
func (a *Auth) RequireStaff(next http.Handler) http.Handler; func CurrentStaff(ctx) core.Staff
func (a *Auth) ListRiders(w, r); AdminCreateRider(w, r); AdminGetRider(w, r); AdminUpdateRider(w, r)
type NewRider struct { StoreID, Email, Name, Phone, Password string } // JSON storeId, email, name, phone, password
func CreateRider(ctx context.Context, pool *pgxpool.Pool, c *core.Client, in NewRider) (Rider, error)
func HashPassword(password string) (string, error); func NewLimiter(...) *Limiter // copies
```

`internal/app`: `New(pool *pgxpool.Pool, origins []string, a *auth.Auth) chi.Router` (task 1 has no `a`; task 2 adds it), full paths so `chi.Walk` matches `openapi.json`:

| Route | Guard | Handler |
|---|---|---|
| `GET /api/rider/v1/healthz`, `GET /api/rider/v1/readyz` | none | `healthz`, `readyz(pool)` |
| `POST /api/rider/v1/auth/sign-in` | none | `a.SignIn` |
| `POST /api/rider/v1/auth/sign-out`, `GET /api/rider/v1/me` | `RequireRider` | `a.SignOut`, `a.Me` |
| `GET`, `POST /api/rider/v1/admin/riders` | `RequireStaff` | `a.ListRiders`, `a.AdminCreateRider` |
| `GET`, `PATCH /api/rider/v1/admin/riders/{id}` | `RequireStaff` | `a.AdminGetRider`, `a.AdminUpdateRider` |

`cmd/rider`: `config.Load`, JSON slog at the level, pool, `core.New(cfg.CoreURL, cfg.CoreServiceToken, time.Now)`, `auth.New(pool, cfg.SessionPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), c)`, `app.New(pool, cfg.WebOrigins, a)`, `serve` with a 10 s grace; logs `rider listening` and `rider stopped`.

`cmd/rider-admin`: `run(args, stdout, stderr) int` as core's; usage line `usage: rider-admin migrate | seed-demo [--reset] | create-rider <email> --store <id>` (task 1 prints only `migrate`; task 5 the full line). `create-rider` takes exactly `<email> --store <id>`; its testable core is `createRider(ctx, pool, c, email, storeID string, stdin io.Reader, stdout io.Writer) error`, which reads the first stdin line as the password (empty: `password is required on stdin`) and turns a field error into `<field>: <message>`.

`internal/seed`: `Reset(ctx, pool) error`, `Load(ctx, pool) error` (one transaction each, hash computed once per process before it opens), `Summary` (printed by `seed-demo`):

```
seed-demo: demo riders loaded (local databases only)

sign-ins (email, password, store)
  rider1-koramangala@shopperstop.local  rider12345  Koramangala
  rider2-koramangala@shopperstop.local  rider12345  Koramangala
  rider1-indiranagar@shopperstop.local  rider12345  Indiranagar
  rider2-indiranagar@shopperstop.local  rider12345  Indiranagar

fixed ids (id, table, what)
  00000000-0000-4000-8000-000000000801  riders  Arjun Rao, Koramangala (Postman riderId)
  00000000-0000-4000-8000-000000000802  riders  Meera Iyer, Koramangala
  00000000-0000-4000-8000-000000000803  riders  Kabir Shah, Indiranagar
  00000000-0000-4000-8000-000000000804  riders  Divya Nair, Indiranagar
```

Riders 0801 and 0802 are at core store `00000000-0000-4000-8000-000000000401`, 0803 and 0804 at `...0402`; phones `+919000000001` to `+919000000004` in id order. Reset truncates `sessions, riders` (L2 appends its tables to the list and its rows after the riders).

## Error handling

`httpx.WriteError` as core: an `*httpx.Error` keeps its status, anything else is logged with the request id and becomes 500 `internal`. The core client returns only `*httpx.Error` values (401, 404, 502), so handlers pass them through; `CreateRider` maps `core.ErrNotFound` to 400 on `storeId`. `pg.Map` handles no rows (404); `pg.IsUnique` names `email`.

## Test strategy

- Every Go test runs with `-race` against `shopperstop_rider_test`, one fresh schema per package (`testdb.Migrated("<pkg>")`). No mock of the database or of rider's HTTP layer; core is faked only at the process boundary by `coretest` (D31), and the real core is exercised by `make e2e` from rider-P3-L3 on.
- `internal/app` tests go through the real router on an `httptest.Server` with a `coretest.Fake` (store A `00000000-0000-4000-8000-000000000401`, store B `...0402`, one admin token, one store-staff token per store) and a limiter too large to trip; the rate-limit test builds its own small limiter. Riders are inserted with SQL and a `bcrypt.MinCost` hash of `testPassword`, as core's `cheapHash`.
- Session expiry and sliding are set up by updating `expires_at` and `last_seen_at` in SQL, as core's auth tests do. The cache test uses a fake clock passed to `core.New`.
- The request log scenario captures `slog` with a JSON handler on a buffer, as core's `TestLogNamesSubject`.
- `TestSummaryMatchesSeed` reads `../../../../docs/postman/local.postman_environment.json` for `riderId`; rider-P3-L2 extends it to `deliveryId`.

## Files

All inside `services/rider/`, plus the generated `docs/postman/shopperstop-rider.postman_collection.json` (platform's request) and this change folder. No other area's file changes; `packages/ui/src/api/rider.d.ts` is not written.

## Risks / Trade-offs

- The fake drifts from real core: the fake's bodies are copied from core's `openapi.json` examples; `make e2e` with the rider app (L3) runs against the real core. Until then the manager's verification includes one manual run of `cmd/rider` against `make core` with a real staff token.
- Copies drift (D31): named above with the origin commit.
- `make gen` in CI's `core` job regenerates `services/rider/internal/auth/db`: the worker commits sqlc output from v1.31.1 (the version CI installs).
