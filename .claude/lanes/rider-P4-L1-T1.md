# rider-P4-L1-T1 - Concurrent migrate runs serialise (task 1 of rider-hygiene)
Status: done
## Doing
Task 1 done: lock committed (1008ccb test, feat commit after it); gates green.
## Red run (before the lock, commit 1008ccb)
Command: `cd services/rider && SHOPPERSTOP_RIDER_TEST_DATABASE_URL=... go test -race -count=3 -run TestApplyConcurrentRunsSerialise ./internal/migrate/`

```
--- FAIL: TestApplyConcurrentRunsSerialise (0.33s)
    migrate_test.go:254: run 2: migrate 0001_a.sql: ERROR: duplicate key value violates unique constraint "pg_type_typname_nsp_index" (SQLSTATE 23505)
--- FAIL: TestApplyConcurrentRunsSerialise (0.32s)
    migrate_test.go:254: run 1: migrate: create schema_migrations: ERROR: duplicate key value violates unique constraint "pg_type_typname_nsp_index" (SQLSTATE 23505)
--- FAIL: TestApplyConcurrentRunsSerialise (0.32s)
    migrate_test.go:254: run 1: migrate: create schema_migrations: ERROR: duplicate key value violates unique constraint "pg_type_typname_nsp_index" (SQLSTATE 23505)
FAIL
FAIL	github.com/kapildev333/shopperstop/services/rider/internal/migrate	1.309s
```

## Green run (after the lock)
`go test -race -count=3 -run TestApplyConcurrentRunsSerialise ./internal/migrate/` → `ok ... internal/migrate` (x2 runs, both ok).
`go test -race -count=1 ./internal/migrate/... ./internal/testdb/...` → ok.
`gofmt -l`, `go vet ./internal/migrate/ ./internal/testdb/` → clean.

## Gates
- `GOFLAGS=-count=1 make test-rider` → exit 0 (full log in scratchpad t1-gate.log); migrate and internal/app ok.
- `openspec validate --all --strict` → `Totals: 19 passed, 0 failed (19 items)`, exit 0.
- `make gen postman` not run by this task (T2 owns the generated files; the gate is the lane's final step).

## Found
- `testdb.Migrated` no longer takes its own lock; the serialisation now lives in `migrate.Apply`. Core's testdb still has its own lock (not in scope).
- The lane's `rider-P4-L1.md` Doing line was not written: the brief's staging list excluded it. The orchestrator or lane owner should add the `Worker:` line.

## Requests
## Blockers
