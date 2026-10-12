# core-P2-L1-t1 - task 1: schema, migrated test schemas, pg error mapping
Status: done
## Doing
Task 1 landed on `lane/core-P2-L1-accounts-auth`: commits `8224a0c` (test, red: build failure on the missing package) and `83d30df` (feat). `make test-core` green, `openspec validate --all --strict` 6 passed. Tasks 1.1 and 1.2 ticked. Ready for task 2 (sqlc).
## Found
- `testdb.Open` search path is now `"<schema>", public`; `testdb.Migrated(name)` applies `migrations.FS` under `pg_advisory_lock(727001)` and panics on error. `migrate` tests still use `Open`.
- `pg.Map` returns `*httpx.Error`; `pg.IsUnique` is 23505 only. Map's 23503 message is the design's "still in use", which reads oddly for an insert with an unknown reference; L2 must special-case `storeId` (already requested in core-P2-L1 Requests).
- Migration `0002_accounts.sql` was extracted from design.md lines 41-104 with `sed`, so it is byte-identical to the design block.
- pg tests use per-test email addresses inside the shared package schema; later packages should do the same.
## Requests
none
## Blockers
none
