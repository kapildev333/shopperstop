# Proposal

## Why
Phase 2 needs accounts before anything a customer or staff member owns: carts, orders, stock edits and store administration all sit behind a bearer session. `services/core` has no table, no query layer and no auth today (D3, D16 deferred them to this lane). This change, the first Phase 2 core lane (core-P2-L1, Spec 2 §3, §5, §6, §9, §10, §12, §13), adds the accounts schema, the sqlc query layer, bearer sessions for customers and staff, the customer profile and addresses, staff sign-in and staff-user management, the first admin from the command line, and the first slice of the demo seed (D22).

## What Changes
- Migration `0002_accounts.sql`: `citext` (in `public`), enums `order_status` and `staff_role`, the `set_updated_at()` trigger function, tables `customers`, `staff_users`, `sessions`, `addresses` (addresses belong to accounts and land here, not in core-P2-L5).
- `internal/testdb.Migrated`: a per-package test schema with every embedded migration applied; test search path gains `public`.
- `internal/pg`: database error mapping (unique and foreign-key violation to `conflict`, no rows to `not_found`).
- `sqlc.yaml` and `queries/{auth,address}.sql` with generated code in `internal/auth/db` and `internal/address/db` (D3; sqlc v1.31.1).
- `internal/httpx` additions: PATCH bodies refuse explicit `null`; paged list helper `{items, page, pageSize, total}`; uuid path ids (malformed is `not_found`); the request log names the signed-in subject.
- `internal/auth`: bcrypt cost 12, opaque bearer tokens stored as `sha256(token || pepper)`, customer sessions 30 days sliding (refreshed at most hourly), staff sessions 12 hours fixed, inactive staff rejected, `RequireCustomer` / `RequireStaff` / `RequireAdmin`, an in-memory limiter (10 per email, 100 per IP, per hour) answering `429 rate_limited`; handlers for customer and staff auth, `/me`, `/admin/me` and `/admin/staff-users`.
- `internal/address`: `/me/addresses` CRUD with one default per customer.
- Routes under `/api/core/v1`: `POST /auth/register`, `POST /auth/sign-in`, `POST /auth/sign-out`, `GET|PATCH /me`, `GET|POST /me/addresses`, `PATCH|DELETE /me/addresses/{id}`, `POST /admin/auth/sign-in`, `POST /admin/auth/sign-out`, `GET /admin/me`, `GET|POST /admin/staff-users`, `PATCH /admin/staff-users/{id}`.
- `core-admin create-admin <email>` (password on stdin) and `core-admin seed-demo [--reset]` loading the demo admin, the demo customer and the customer's two addresses with fixed ids (D20, D22).
- `openapi.json`: every new operation with summary, description, tag (`accounts` or `admin-staff`), typed schemas, every error code it returns by design, examples; `components.securitySchemes.bearer`; `security` on every authenticated operation; sign-in and register examples carry a string `token` (D20). The contract test proves `security` matches the router's behaviour.
- `packages/ui/src/api/core.d.ts` regenerated (D19, mechanical).

Area: core. Capabilities: `accounts` (new), `admin-staff` (new, sign-in and staff users; the dashboard arrives with core-P2-L5), `platform` (ADDED requirements only).

Out of scope: stores and the `staff_users.store_id` foreign key (core-P2-L2 adds it with `stores`); the staff dashboard (core-P2-L5); email verification and password reset by email (Spec 2 §2); address coordinates (`lat`, `lng`: unused until radius serviceability, Spec 2 §14); changing a staff user's role or store; revoking sessions on password reset; `SHOPPERSTOP_CORE_FILES_DIR`.

## Capabilities

### New Capabilities
- `accounts`: customer registration, sign-in, sign-out, bearer sessions with sliding expiry, rate limits, profile, addresses, demo customer.
- `admin-staff`: staff sign-in and sessions, role gates, staff-user management, the first admin from the command line, demo admin.

### Modified Capabilities
- `platform`: ADDED requirements: PATCH bodies refuse explicit null; lists are paged; malformed path ids are not found; the request log names the signed-in subject; authenticated operations declare bearer security.

## Impact
- Files: `services/core/` (migration, `sqlc.yaml`, `queries/`, `internal/{pg,auth,address,seed,httpx,testdb,app}`, `cmd/core`, `cmd/core-admin`, `openapi.json`, `go.mod`/`go.sum`), `packages/ui/src/api/core.d.ts` (generated, D19), this change folder, `.claude/lanes/core-P2-L1.md`. `docs/postman/shopperstop-core.postman_collection.json` changes when `make postman` runs; committing it from a core PR needs the orchestrator's word (see design.md Risks).
- Cross-area contracts produced: `openapi.json` (read by ui's type generation, platform's Postman generator, web and admin clients); the response shapes `{token, customer}` and `{token, staff}`; the fixed demo ids in design.md (for Postman's environment and the e2e suites).
- Cross-area contracts relied on: `deploy/initdb.sql` (role `shopperstop_core` owns its three databases, so it may create the trusted `citext` extension); the `platform` spec; the Postman generator's rules (bearer `security`, `/admin/` prefix, `token` in auth examples, `addresses` path ids).
- Dependencies: `golang.org/x/crypto` (bcrypt), already in CLAUDE.md's list. sqlc v1.31.1 is a build tool, not a module dependency.
