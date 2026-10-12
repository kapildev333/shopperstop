# core-P2-L1-t3 - task 3: HTTP helpers (PATCH, paging, path ids, subject in the log)
Status: done
## Doing
Task 3 landed on `lane/core-P2-L1-accounts-auth`: commits `c7d9277` (test, red: build failure on the five missing symbols), `bf2b67b` (feat), `chore: tick tasks 3.1 3.2`. `make test-core` exit 0, `go vet ./...` and `gofmt -l` clean, `openspec validate --all --strict` 6 passed. Ready for task 4 (auth core).
## Found
- `httpx.ReadPatch(w, r, dst) error`: ReadJSON into `json.RawMessage`, then requires a JSON object (`[]`, `"x"`, `null` give 400 validation "invalid JSON"), then refuses any `null` member (400 validation, `field` = the member, sorted order), then unmarshals into `dst`.
- `httpx.Page(r) (page, pageSize int, err error)`: absent means 1 and 24; present-but-empty is not a whole number; `page < 1`, `pageSize` outside 1..100 and non-integers are 400 validation with `field` = parameter name. Values above MaxInt32 are refused (not in the spec; keeps `(page-1)*pageSize` from overflowing into a 500).
- `httpx.List[T]` and `httpx.NewList(items, page, pageSize, total)`: nil items encode as `[]`.
- `httpx.PathID(r, name) (string, error)`: canonical 36-character uuid, either case, via `chi.URLParam`; anything else is 404 `not_found`.
- `httpx.SetSubject(ctx, subjectType, id)`: `logAndRecover` puts a per-request holder in the context; the `request` log line adds `subjectType` and `subjectId` only when set. Outside `NewRouter` it is a no-op.
- Judgement calls for the reviewer: `Atoi` accepts a leading `+` (`pageSize=+5` is 5); PathID accepts any hex case but does not check the uuid version or variant (the brief says "canonical", the design says "either case").
## Requests
none
## Blockers
none
