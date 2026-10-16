# rider-P4-L1-T1 - Concurrent migrate runs serialise (task 1 of rider-hygiene)
Status: started
## Doing
Red run recorded; committing the failing test, then the lock.
## Red run (before the lock)
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
## Found
## Requests
## Blockers
