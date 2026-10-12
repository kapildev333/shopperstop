# core-P1-L1 task 3 - migrations and test database (plan task 7)
Status: done
## Doing
Done: tasks 3.1 and 3.2 ticked; gates green; dev migrate applied 0001_init then reported nothing to apply. Awaiting reviewer.
## Found
- Commits on `lane/core-P1-L1-core-service`: `bd93a41` test: migrations apply once in order and roll back on failure (includes go.mod/go.sum with pgx v5.11.0, pgxpool, and `internal/testdb`); `fbae3c9` feat: migration runner, baseline migration, core-admin migrate and seed-demo stub; `50dfbfc` chore: tick tasks 3.1 3.2.
- `testdb.Open(name)` schema is `test_<name>_<pid>`, reset on open, dropped on cleanup; panics when the database is unreachable.
- `migrate.Apply(ctx, pool, fsys) ([]string, error)` validates every `*.sql` name before creating `schema_migrations`; a failed file rolls back with its version insert and returns `migrate <file>: <cause>`.
- `go.mod` now requires `github.com/jackc/pgx/v5` (direct) plus indirect pgpassfile, pgservicefile, puddle/v2, x/sync, x/text.
- `core-admin` is `run(args, stdout, stderr) int` so the exit codes are one place; `migrate` prints `applied <version>` lines or `nothing to apply`; `seed-demo` takes an optional `--reset`.
- Judgement call: `migrate` and `seed-demo` both run through the same usage path; `seed-demo` with a second argument other than `--reset` exits 2.
- Read platform-P1-L9: its request to core (`core-admin seed-demo --reset` exits 0 before make dev and make e2e) is met by the stub.
## Requests
(none)
## Blockers
(none)
