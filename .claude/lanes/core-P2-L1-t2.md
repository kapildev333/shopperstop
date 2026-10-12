# core-P2-L1-t2 - task 2: sqlc configuration and generated queries
Status: done
## Doing
Task 2 landed on `lane/core-P2-L1-accounts-auth`: commit `feat: sqlc config, account and address queries, generated code` (`chore: tick task 2` follows). `sqlc.yaml`, `queries/auth.sql` and `queries/address.sql` copied byte-for-byte from design.md fenced blocks with sed. Task 2.1 ticked. Gates: `make test-core` exit 0, `go vet ./...` ok, `make gen` (twice) leaves `git status` clean, `openspec validate --all --strict` 6 passed. Ready for task 3.
## Found
- `sqlc generate` (v1.31.1) produced `internal/auth/db/{db,models,auth.sql}.go` and `internal/address/db/{db,models,address.sql}.go`; headers read `sqlc v1.31.1`. Generated code is committed; no hand edits.
- Both packages use `emit_pointers_for_null_types`; uuid is `string`, nullable uuid `*string`. Task 4 and later must use these generated types, not hand-written row structs.
- `make gen` also runs the openapi-typescript step; `packages/ui/src/api/core.d.ts` was unchanged.
## Requests
- to platform: pin sqlc `v1.31.1` in `ci.yml` (still open from core-P2-L1 Requests; the generated headers carry the version).
## Blockers
none
