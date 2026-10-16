# core-P4-L1-t2 - store city (task 2 of core-catalog-filters-store-city)
Status: done (5c3be9e test, 55895a3 feat; reviewed: approve)
## Brief
- LANE-ID: core-P4-L1 (task 2 of 2, after task 1 is committed). Area: core. Role: worker.
- Worktree: /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/core-P4-L1. Branch: lane/core-P4-L1-catalog-filters-store-city. Commit there; never push; never touch the root checkout.
- OpenSpec change: `openspec/changes/core-catalog-filters-store-city/`, task 2 in `tasks.md` (2.1, 2.2). Every code block you need is verbatim in `design.md` under "Task 2". A choice neither file settles: stop and report.
- Scope paths: `services/core/migrations/0009_store_city.sql` (new), `services/core/queries/store.sql` (`CreateStore`, `UpdateStore` only), sqlc output (`services/core/internal/store/db/store.sql.go` and every `services/core/internal/*/db/models.go`, regenerated only), `services/core/internal/store/store.go`, `services/core/internal/store/handlers.go`, `services/core/internal/seed/seed.go`, `services/core/internal/seed/seed_test.go`, `services/core/internal/app/admin_stores_test.go`, `services/core/internal/app/stores_test.go`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, `openspec/changes/core-catalog-filters-store-city/tasks.md` (ticks only), this file.
- Commits, in order: `test: stores carry a city`, `feat: store city (migration 0009, admin create and change, demo stores)`.
## Doing
Done. Both commits made; gates green (see Found).
## Found
- Red before code: TestCreateStoreValidation (201 for 101 chars), TestCreateStoreCity and TestPatchStoreCity (city empty), TestPublicStoreCity (column "city" does not exist), TestResetTwiceLeavesDemoStores (no city in serviceability). Five of five as the brief expects.
- Diffs applied verbatim with git apply; openapi.json script run verbatim (its replacements matched, diff is 32 insertions and 2 description lines).
- `make gen` regenerated sqlc models.go in every service that reads `stores` (address, auth, cart, catalog, order, stock, store): one added `City string` line each, as the brief allows. rider.d.ts regenerated with no change.
- `make test-web` exit 0 with no TS2741: the admin `Field = Exclude<keyof StoreCreate, 'city'>` line from #270 is already in this branch via fe082ae.
- Gates: gofmt empty; go vet clean; `go test -race -count=1 ./...` all 15 packages ok; `make postman` 17/17 tests pass; `openspec validate --all --strict` 20 passed, 0 failed.
## Requests
## Blockers
