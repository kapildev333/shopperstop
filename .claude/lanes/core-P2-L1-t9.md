# core-P2-L1-t9 - task 9: seed-demo loads the demo accounts (internal/seed, core-admin seed-demo [--reset])
Status: done
## Doing
Task 9 landed on `lane/core-P2-L1-accounts-auth`: `883fb3d` (test: seed-demo reset twice leaves the demo accounts, red by build failure: no `internal/seed` package yet), `a7d903c` (feat: seed-demo loads the demo admin, customer and addresses), then the tick commit (`chore: tick tasks 9.1 9.2`). Gates: `GOFLAGS=-count=1 make test-core` exit 0; `openspec validate --all --strict` 6 passed. Dev database checks done (below). Ready for task 10.
## Found
- Fixed demo ids and values (design Decision 22), all loaded by `seed.Reset` / `seed.Load` in `services/core/internal/seed/seed.go`:
  - staff admin `00000000-0000-4000-8000-000000000101`: `admin@shopperstop.local` / `admin12345`, name `Admin`, role `admin`.
  - customer `00000000-0000-4000-8000-000000000201`: `demo@shopperstop.local` / `demo12345`, name `Demo Customer`, phone `+919800000000`.
  - address Home `00000000-0000-4000-8000-000000000301`: `12 80 Feet Rd, Koramangala`, `560034`, default.
  - address Work `00000000-0000-4000-8000-000000000302`: `100 Feet Rd, Indiranagar`, `560038`.
  - Reserved, not loaded here: staff `...0102` and `...0103` (L2, store staff), stores `...04xx`, categories `...05xx`, products `...06xx`, orders `...07xx`.
- `seed.Reset(ctx, pool)`: hashes first (outside the transaction), then one transaction: `truncate sessions, addresses, customers, staff_users`, then `load`. `seed.Load(ctx, pool)`: the same `load` without the truncate; a row that exists fails on its primary key, the transaction rolls back, nothing is left half-loaded.
- Where later lanes extend the seed: add the table to `truncateTables` (one slice), add their inserts to `load` after the rows they reference (one function). Both places carry a comment.
- e2e command (Makefile `seed` and `e2e` run this, E2E_ENV from `make e2e`): `cd services/core && SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_e2e?sslmode=disable' SHOPPERSTOP_CORE_ADDR=':18080' SHOPPERSTOP_CORE_SESSION_PEPPER='e2e-pepper-e2e-pepper-e2e-pepper-00' SHOPPERSTOP_CORE_FILES_DIR="$PWD/data/e2e-files" SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174' sh -c 'go run ./cmd/core-admin migrate && go run ./cmd/core-admin seed-demo --reset'`. Not run here (the e2e database is not this lane's to touch); the dev database run below is the same code path.
- Output of `seed-demo` on success: `seed-demo: demo accounts loaded`, then one line per account (admin, customer with two addresses). No passwords are printed. On failure: `core-admin: seed-demo: insert demo admin: ERROR: duplicate key value violates unique constraint "staff_users_pkey" (SQLSTATE 23505)`, exit 1.
## Requests
- none. The L2 request (`...0102`, `...0103` store staff in `seed`, the store-id foreign key) stays with core-P2-L2; this lane did not touch those ids.
## Blockers
none
## Dev database check (`shopperstop_core` on localhost:5432, `go run`)
- `go run ./cmd/core-admin seed-demo --reset` → `seed-demo: demo accounts loaded` + two account lines, exit 0.
- Same command again → same output, exit 0.
- `go run ./cmd/core-admin seed-demo` (no `--reset`) → `core-admin: seed-demo: insert demo admin: ERROR: duplicate key value violates unique constraint "staff_users_pkey" (SQLSTATE 23505)`, exit 1.
- The stray `root@example.com` from the task 8 check is gone: `POST /api/core/v1/admin/auth/sign-in` for it answers 401 on a dev server started from the same database.
- Dev server (`cmd/core` built and run briefly, stopped after): `POST /api/core/v1/auth/sign-in` with `demo@shopperstop.local` / `demo12345` → 200; `POST /api/core/v1/admin/auth/sign-in` with `admin@shopperstop.local` / `admin12345` → 200.
## Timings (`GOFLAGS=-count=1 make test-core`, -race)
- `cmd/core` 1.36 s; `cmd/core-admin` 6.60 s; `internal/app` 45.49 s; `internal/auth` 9.53 s; `internal/seed` 29.84 s (`TestResetTwiceLeavesDemoAccounts` 16.2 s, `TestLoadTwiceFails` 9.3 s); `config` 2.36 s; `httpx` 2.85 s; `migrate` 2.72 s; `pg` 3.17 s.
- The seed package is slow because each reset pays two cost-12 hashes and the tests sign in twice; the spec asks for cost 12 and the brief accepted it.
## Judgement calls
- Red form: the test file imports a package with no source yet, so the red run is a build failure, the form tasks 1, 3 and 8 used.
- `cmd/core-admin/main_test.go` is outside this task's scope, so the `seed-demo` wiring has no unit test of its own; the existing usage test still covers the argument refusals, and the wiring is checked by the dev run above. A test there (exit 0 and 1 with a seeded database) is worth adding in a later task that may touch that file.
- Hashes are computed before the transaction opens, so bcrypt does not run while the truncate holds its lock (design Decision 21 does not forbid it; this is the order that keeps the lock short).
- The success output names the two accounts (no passwords) so the operator sees what `--reset` loaded, as the brief asked; the design's exact line is the first line.
- The truncate and the loader stay in one transaction (Decision 21), so an error in `load` after the truncate rolls the truncate back too.
## Deferred
- Store staff `...0102`, `...0103` and stores `...04xx`: core-P2-L2.
- Regenerating `packages/ui/src/api/core.d.ts` and the Postman collection: task 10 (no `make gen` in this task).
