# core-P4-L1-review-t2

Reviewer: core-P4-L1 Task 2 (store city), 5c3be9e + 55895a3. Read-only.

## Verdict: approve

No blocking findings.

## Checks
- Test-first: 5c3be9e makes five tests red (`TestCreateStoreCity`, `TestPatchStoreCity`, `TestCreateStoreValidation` city cases, `TestPublicStoreCity`, `TestResetTwiceLeavesDemoStores`); green at 55895a3.
- Covers serviceability "Public store view" (all three), admin-stores create (both), "City too long or null", "Set, keep and clear the city", "Reset twice"; other admin-stores scenarios stay green.
- `city` omitted when empty (`omitempty`), stored trimmed, 100-character limit, `""` clears on PATCH, absent keeps.
- Scope: migration 0009, `queries/store.sql`, sqlc regen (`store.sql.go`, `models.go` per package), `store.go`, `handlers.go`, `seed.go`, the three test files, `openapi.json`, generated `core.d.ts` and Postman collection, tasks.md ticks.

## Findings (nits, no fix needed)
1. nit, tests: no PATCH `{"city":null}` case; the shared null handling for patch fields already covers it (create-side null is tested).
2. nit, `migrations/0009_store_city.sql` comment wording.

## Gates
- gofmt -l .: empty; go vet ./...: ok; go test -race -count=1 ./...: all ok
- make gen postman: tree clean; make test-web: ok; openspec validate --all --strict: passed
