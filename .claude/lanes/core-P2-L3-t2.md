# core-P2-L3-t2 - files directory config and disk blob store (tasks 2.1, 2.2 of core-catalog)
Status: done (task 2 of 6, review fixes applied)
## Doing
Task 2 landed on `lane/core-P2-L3-catalog`. Review fixes applied: test `TestDiskRefusesNonLocalKey` and mode assertion in `TestDiskPutOpen` committed red, then the fix. Task 3 (admin categories) not started; it wires `app.New` and `cmd/core`.
## Found
- Commits: `29027ab` test (files dir config and disk blob store), `c268fd3` feat (SHOPPERSTOP_CORE_FILES_DIR and internal/blob disk store), `7b456cb` tick tasks 2.1 2.2, then review fix: `test: blob refuses keys that are not kind/name; files are world-readable` and `fix: blob key rule is exactly kind/name; 0644 files`, then this lane log.
- Key rule: a key must be exactly `<kind>/<name>`, each part non-empty, with no `/` or `\` and no leading dot; `filepath.IsLocal` still checked after. Red cases before the fix: `products/../products/x`, `a//b`, `a\b`, `products/.hidden`, `products/a/b/c` (plus `products` and the empty key, which were also accepted).
- Stored files are 0644 (`tmp.Chmod` before the rename); `TestDiskPutOpen` asserts the mode. Red before the fix: mode was -rw-------.
- Gates after the fix: `go test -race -count=1 ./internal/blob/` ok; `GOFLAGS=-count=1 make test-core` exit 0 (cmd/core 1.3s, cmd/core-admin 18.9s, app 46.8s, auth 9.5s, blob 1.7s, catalog 2.5s, config 2.2s, httpx 2.9s, migrate 3.2s, pg 2.7s, seed 39.4s). `openspec validate --all --strict` passed earlier (8 passed); blob and config changes do not touch OpenSpec.
- Judgement: `Open` applies the same key rule as `Put`.
## Requests
- to core-P2-L4 / manager: none new. Keys are `<kind>/<name>` only; task 3 and later should build keys as `products/<id>.png` and `categories/<id>.png`.
## Blockers
