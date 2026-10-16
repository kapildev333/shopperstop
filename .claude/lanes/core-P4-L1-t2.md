# core-P4-L1-t2 - store city (task 2 of core-catalog-filters-store-city)
Status: started
## Brief
- LANE-ID: core-P4-L1 (task 2 of 2, after task 1 is committed). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L1. Branch: lane/core-P4-L1-catalog-filters-store-city. Commit there; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-catalog-filters-store-city/`, task 2 in `tasks.md` (2.1, 2.2). Every code block you need is verbatim in `design.md` under "Task 2". A choice neither file settles: stop and report.
- Scope paths: `services/core/migrations/0009_store_city.sql` (new), `services/core/queries/store.sql` (`CreateStore`, `UpdateStore` only), sqlc output (`services/core/internal/store/db/store.sql.go` and every `services/core/internal/*/db/models.go`, regenerated only), `services/core/internal/store/store.go`, `services/core/internal/store/handlers.go`, `services/core/internal/seed/seed.go`, `services/core/internal/seed/seed_test.go`, `services/core/internal/app/admin_stores_test.go`, `services/core/internal/app/stores_test.go`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, `openspec/changes/core-catalog-filters-store-city/tasks.md` (ticks only), this file.
- Scenarios: serviceability "Public store view" (Public fields only; Store with a city; Unknown store); admin-stores "Admins create stores" (Create a store; Create a store with a city), "Store fields are validated" / City too long or null, "Admins change stores" / Set, keep and clear the city, "Demo stores" / Reset twice.
- Failing tests to start from: `services/core/internal/app/admin_stores_test.go` `TestCreateStoreCity` (red: city empty), `TestPatchStoreCity` (red: city empty), `TestCreateStoreValidation` (red: 201 for a 101-character city); `services/core/internal/app/stores_test.go` `TestPublicStoreCity` (red: column "city" does not exist); `services/core/internal/seed/seed_test.go` `TestResetTwiceLeavesDemoStores` (red: city empty).
- Commits, in order: `test: stores carry a city` (the three test diffs only, after you saw the five fail), then `feat: store city (migration 0009, admin create and change, demo stores)` (migration, SQL, `make gen` output, Go, `openapi.json` via the Task 2 script, regenerated `core.d.ts` and Postman collection, the 2.1 and 2.2 ticks). Author kapildev333 <47056817+kapildev333@users.noreply.github.com>, no attribution trailers.
- Gates: as task 1 (gofmt, vet, `go test -race -count=1 ./...` in `services/core`; `make gen postman` clean; `make test-web`; `openspec validate --all --strict`). Known: `make test-web` fails with TS2741 in `apps/admin/src/store-form.tsx` until admin's one line (`design.md` "Cross-area") is on main and merged into this branch. If that is the only failure, commit anyway and record it under Found; do not edit `apps/admin`.
- Rules: as task 1. Do not give `StoreCreate.city` a `default` in `openapi.json` (design Decision 7).
## Doing
Not started.
## Found
## Requests
## Blockers
