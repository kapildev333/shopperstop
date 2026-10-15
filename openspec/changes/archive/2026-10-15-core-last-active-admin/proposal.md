## Why

`PATCH /api/core/v1/admin/staff-users/{id}` lets an admin set `isActive` false on themself or on the last active admin and answers 200. The panel then has no admin who can sign in, and recovery needs shell access (`core-admin create-admin`). Requested by admin (admin-P2-L6, relayed by the orchestrator 2026-10-13, `.claude/areas/core.md` `## Requests`).

## What Changes

- Setting `isActive` false on the only active admin answers 409 `conflict` with field `isActive`, and nothing in that patch is applied: the admin stays active and signed in.
- Deactivating one of two or more active admins, deactivating store staff, and setting `isActive` false on a user who is already inactive keep answering 200.
- Two admins deactivating each other at the same moment never both succeed: one answers 200, the other 409 (or 401 when the winner's patch ended its session before it was checked).
- `openapi.json`: the PATCH operation documents the 409 with an example, and its description drops "An admin may deactivate their own account" without condition. The regenerated `packages/ui/src/api/core.d.ts` and `docs/postman/` follow (D19).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-staff`: requirement "Admins manage staff users" gains the last-active-admin rule and four scenarios.

## Impact

- Area: `core` only. Files: `services/core/queries/auth.sql`, `services/core/internal/auth/db/auth.sql.go` (sqlc output), `services/core/internal/auth/staff.go`, `services/core/internal/app/staff_test.go`, `services/core/openapi.json`; generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` (D19).
- Contract: `services/core/openapi.json` (the new 409 on `patchStaffUser`). No new route, no schema change, no migration, no dependency.
- Admin app: may show the 409 message next to the active switch; it needs no change to stay correct (it already hides the switch on the admin's own row).
- Out of scope: the backlog items of the same request (one call for a store's active orders with a total, staff names on order events, `isOpen` on the dashboard); changing a staff user's role (still immutable); revoking sessions on password reset.
