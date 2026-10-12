# core-P2-L3-t2 - files directory config and disk blob store (tasks 2.1, 2.2 of core-catalog)
Status: done (task 2 of 6)
## Doing
Task 2 landed on `lane/core-P2-L3-catalog`: test commit `29027ab`, feat commit `c268fd3`, tick commit follows. Task 3 (admin categories) not started; it wires `app.New` and `cmd/core`.
## Found
- Gates: `GOFLAGS=-count=1 make test-core` exit 0 (cmd/core 2.2s, cmd/core-admin 20.7s, app 49.0s, auth 8.9s, blob 2.4s, catalog 1.9s, config 2.0s, httpx 2.8s, migrate 3.1s, pg 3.3s, seed 40.4s). `openspec validate --all --strict`: 8 passed, 0 failed.
- `config.Config.FilesDir` (`SHOPPERSTOP_CORE_FILES_DIR`) is required and trimmed; a blank value is named as required in the joined error.
- `internal/blob`: `Store` (Put, Open returning `io.ReadSeekCloser` and mod time) and `Disk{Dir}`. Put writes a temp file in the target directory and renames it over the key; Open and Put refuse keys that are not `filepath.IsLocal`.
- `cmd/core-admin/main_test.go` `TestSeedDemoExitCodes` builds its own env; it gained `SHOPPERSTOP_CORE_FILES_DIR` set to `t.TempDir()` in the test commit. No other test constructs the env; `cmd/core` tests do not call `config.Load`.
## Requests
- to core-P2-L4 / manager: none new. `blob.Store` and `blob.Disk{Dir}` are the names task 3 and later use.
## Blockers
