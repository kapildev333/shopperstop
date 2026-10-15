# core-P2-L7 - last active admin cannot be deactivated (OpenSpec change core-last-active-admin)
Status: started
## Doing
2026-10-15: change proposed and validated (`openspec validate core-last-active-admin --strict`); one worker task, brief in `.claude/lanes/core-P2-L7-t1.md`. Waiting for the manager to launch the worker.
## Found
- Change: `openspec/changes/core-last-active-admin/` (proposal; MODIFIED `admin-staff` "Admins manage staff users" with four new scenarios; design with verbatim code and tests; tasks, one task).
- Design: when a PATCH sets `isActive` false, `UpdateStaffUser` runs in one transaction that locks all active admin rows `FOR UPDATE ... ORDER BY id` and answers 409 `conflict` field `isActive` when the only locked row is the target; `UpdateStaff` runs on the same transaction, so the whole patch (a name sent with it too) is refused. Lock order in SQL, no deadlock.
- Spike (tree restored before commit): the design compiles; `internal/app` green under `-race` (81 s); the concurrency test failed 5 of 5 at red and passed 5 of 5 at green.
- Found in the spike: the race's loser gets 401 instead of 409 when it reaches `RequireStaff` after the winner committed (its own admin is inactive). The scenario accepts 409 or 401; the invariant is exactly one 200 and exactly one admin left active.
- Found in the spike: `httpx.PathID` accepts uppercase uuids, Postgres returns lowercase; the id comparison is `strings.EqualFold` and the test patches with the uppercase id (a plain `==` would bypass the guard).
- For admin (information, through the core area plan): `PATCH /admin/staff-users/{id}` answers 409 `{code: "conflict", field: "isActive", message: "cannot deactivate the last active admin"}`; documented in `openapi.json` with the regenerated `core.d.ts`.
## Requests
- to admin (through the core area plan, after merge): the 409 above exists; showing its message next to the active switch is optional.
## Blockers
None.
