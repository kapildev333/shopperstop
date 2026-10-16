# rider-P4-L1-T2 - rider 405 method_not_allowed with Allow (OpenSpec change rider-hygiene, task 2)
Status: done
## Doing
Worker: done. Commits `test: a wrong rider method answers 405 with Allow` (red), then `feat: rider 405 method_not_allowed with Allow` (code, `rider.d.ts`, tasks ticks 2.1 and 2.2). Gates green.
## Found
- Red run (before the code), `go test -race -count=1 -run 'TestWrongMethodIs405|TestUnknownRouteAndWrongMethod' ./internal/httpx/ ./internal/app/`:
  `router_test.go:89: DELETE /x/1: status 404, want 405` and `app_test.go:212: DELETE /api/rider/v1/healthz: got 404 {"error":{"code":"not_found",...}}, want 405 method_not_allowed`. Both FAIL.
- Green run after the design's code diff: `ok` for `internal/httpx` and `internal/app` with `-race -count=1`.
- `make gen` changed only `packages/ui/src/api/rider.d.ts` (the `Error.code` enum gains `method_not_allowed`, one line). `make postman` left `docs/postman/shopperstop-rider.postman_collection.json` unchanged. `core.d.ts` unchanged.
- Shared-worktree collision: while this worker ran, a commit amend put the T1 lane log (`.claude/lanes/rider-P4-L1-T1.md`) and the `tasks.md` tick of 1.1/1.2 into the test commit. The test commit is now `4a17f30` (it was `39ce4a6` before the amend); its test content is unchanged. Not rewritten by this worker, because T1 is in the same worktree. The manager should expect that commit to carry T1's log and ticks.
- `make test-rider` (GOFLAGS=-count=1, with T1's commits on the branch): exit 0, 10 packages ok.
- `openspec validate --all --strict`: `Totals: 19 passed, 0 failed (19 items)`.
- `make test-web` not run by this worker (ui's `api.test.ts` TS2344 is known; the file is not touched).
- Core's router was not touched; `router.go` now differs from core's only by the comment word "rider" (design claim), with `allowable` and `methodNotAllowed` byte-for-byte.
## Requests
None.
## Blockers
None.
