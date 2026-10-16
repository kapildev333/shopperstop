# core-P3-L3-review-t1

Reviewer: core-P3-L3 Task 1 (migrate advisory lock), 68e7fe7 + e349ef8. Read-only.

## Verdict: approve

No blocking findings.

## Checks
- Test-first: at 68e7fe7 TestApplyConcurrentRunsSerialise failed 3 of 3 runs (duplicate key on pg_type / schema_migrations from the second runner); passes at e349ef8. The test's pg_sleep(0.3) makes the race deterministic.
- Lock taken (migrate.go:61-65) before bookkeeping and the version read, on the hijacked connection; `defer conn.Close(context.Background())` runs on every return and on panic, ends the session, releases the lock even with a cancelled ctx. Lock-failure path also closes the conn. Hijack frees the pool slot, so no leak and no locked conn re-enters the pool. Runtime params (search_path) stay with the connection, so per-package test schemas still work.
- Key 727001: only use in core is migrate.go (grep `advisory`); the testdb copy is removed, so no self-deadlock. Rider has its own database.
- Callers of Apply: cmd/core-admin/main.go:73, internal/order/schema_test.go:201,219 (sequential, fine), testdb.Migrated, migrate tests. cmd/core startup does not call Apply (only core-admin); core-admin test package passes.
- Isolation: the one global key serialises migrations of all test packages in the database (as the old testdb lock did); acceptable and documented as the ceiling in design.md decision 3.
- Matches design.md decision 3; scope limited to migrate.go, its test, testdb.go.

## Findings (all minor, optional)
1. low, migrate.go:61: with ctx cancelled during the wait, pgx cancels the query; fine. No fix needed. (Noted only because the wait is otherwise unbounded; cmd/core-admin passes its own ctx.)
2. nit, testdb.go: `fmt`/imports still used (builds, vet clean). None.

## Gates
- gofmt -l .: empty
- go vet ./...: ok
- go test -race -count=1 ./... (test DB): all packages ok
- openspec validate --all --strict: 16 passed, 0 failed
