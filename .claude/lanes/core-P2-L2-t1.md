# core-P2-L2-t1 - stores schema, store queries, Get and ForPincode (tasks 1.1, 1.2)
Status: done (gates green 2026-10-12)
## Doing
Task 1 landed on `lane/core-P2-L2-stores-serviceability`: test commit `9254102`, feat commit (see git log), tick commit. Waiting for task 2 brief.
## Found
- Gates: `GOFLAGS=-count=1 make test-core` green: cmd/core, cmd/core-admin, internal/app, internal/auth, config, httpx, migrate, pg, seed, store (store: 6 new tests pass, `-race`). `make gen` leaves `git status` empty after commit. `openspec validate --all --strict`: 6 passed, 2 failed (`spec/accounts` and `spec/admin-staff`: "Purpose section is still a placeholder"); both specs came from the L1 archive on main, not from this branch's files. Escalated to the area manager.
- Names: design matched the branch except nothing renamed; `testdb.Migrated`, `pg.IsUnique`, `pg.Map`, `httpx.Error` as on main. `store.Get` / `store.ForPincode` take `db.DBTX` as designed; no `IsOpen` helper (not in the design's interfaces).
- L1 fixtures that needed a store row: `internal/auth` (`TestRequireAdminForbidsStoreStaff`, `TestRequireStaffLogsSubject` fail with 23503 without it) and `internal/app` (the shared `seedStaff` fixture; without it the package panics in `TestAuthGates`, so every staff test depends on it). Fix: one `insert into stores (id, ...)` row with `testStoreID` (`...0401`) in each package's `TestMain`, not per test. Placement deviation from "in those tests' setup": one place per package, same effect.
- sqlc v1.31.1 regenerated `internal/address/db/models.go` and `internal/auth/db/models.go` too (models for every table in the schema directory). Committed in the feat commit; no query changes there.
- Store ids `...0401` (Koramangala) and `...0402` are the design's demo ids; the app and auth fixtures reuse `...0401` as a plain row, separate schema from the seed.
## Requests
- to core-P2-L1: none. Its request for the foreign key is done (0003, `not valid`); its `storeId` 400 mapping in `auth.CreateStaff` is task 5.
- to core-P2-L4 and core-P2-L5: `store.Get` / `store.ForPincode` take `db.DBTX`; use the store's `db` queries only through these functions.
## Blockers
- none. Platform note: `openspec validate --all --strict` fails on two L1 main specs (Purpose placeholders), which blocks CI's `spec` job for every later PR.
