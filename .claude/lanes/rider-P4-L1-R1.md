# rider-P4-L1-R1 - review of rider-P4-L1-T1 (migrate advisory lock)
Status: done
## Doing
Reviewed 1008ccb + db818ad in a detached checkout: approve.
## Found
- gofmt, vet clean; `go test -race -count=1 ./...` all ok; `-count=3 -run TestApplyConcurrentRunsSerialise` ok at db818ad, red 3/3 at 1008ccb (SQLSTATE 23505).
- migrate.go, migrate_test.go, testdb.go match core apart from module path, key, comments, provenance line, the rider-only embedded test. Core's testdb has no lock of its own (the worker's note in rider-P4-L1-T1.md is wrong).
- `openspec validate --all --strict`: 19 passed.
## Requests
## Blockers
