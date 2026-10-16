# core-P5-L1-t6 - test: every error code a test expects is in the contract (task 6 of core-payments)
Status: done (red seen, gates green; committed as "test: every error code a test expects is in the contract")
## Brief
- LANE-ID: core-P5-L1 (task 6). Area: core. Role: worker. Worktree `.worktrees/core-P5-L1`, branch `lane/core-P5-L1-payments`. Starts after the acceptance commit.
- Scope: `services/core/internal/app/app_test.go`, `services/core/internal/app/catalog_categories_test.go`, `services/core/internal/app/orders_payment_test.go`, `openspec/changes/core-payments/tasks.md` (tick 6.1), this file. Nothing else. No product code changes.
- Scenarios: platform "Error envelope" / "The contract lists every code" (`email_unverified`, `payment_pending`; today only `method_not_allowed` is pinned, by `TestWrongMethod`); orders "The payment service cannot cancel a paid order" ("events unchanged" for the cash order).
- Changes:
  1. `app_test.go`: lift the anonymous spec struct and the read out of `TestWrongMethod` into
     ```go
     // errorCodes answers the code enum of openapi.json's Error schema, read once.
     var errorCodes = sync.OnceValues(func() ([]string, error) {
     	doc, err := os.ReadFile("../../openapi.json")
     	if err != nil {
     		return nil, err
     	}
     	var spec struct { /* the same struct TestWrongMethod declares today */ }
     	if err := json.Unmarshal(doc, &spec); err != nil {
     		return nil, err
     	}
     	return spec.Components.Schemas.Error.Properties.Error.Properties.Code.Enum, nil
     })
     ```
     `TestWrongMethod` calls `codes, err := errorCodes()` (t.Fatal on err) in place of its own read; the rest is unchanged.
  2. `catalog_categories_test.go` `expectError`: after the existing status/code check, add
     ```go
     codes, err := errorCodes()
     if err != nil {
     	t.Fatal(err)
     }
     if !slices.Contains(codes, code) {
     	t.Fatalf("%s: code %s is not in openapi.json's Error code enum %v", what, code, codes)
     }
     ```
  3. `orders_payment_test.go` `TestSystemCancelNeedsPendingPayment`: after the cash order's status check, assert `eventCount(t, cash.ID) == 1`.
- Red (test-only task, behaviour already holds): drop `"payment_pending"` from the `Error` code enum in `services/core/openapi.json`, run `go test -race -count=1 -run TestAcceptAwaitsPayment ./internal/app` and see it fail naming the enum; restore the file with `git checkout services/core/openapi.json`. Do not run `make gen` while the file is altered. Record the failure line in Found.
- Commit: one, `test: every error code a test expects is in the contract`, identity kapildev333 <47056817+kapildev333@users.noreply.github.com>, no trailers. Never push.
- Gates (from `services/core`, `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`): `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`; from the worktree root `openspec validate --all --strict`; `git status --short` clean after the commit. No `make gen postman` needed (no openapi.json change), no docker, no e2e.
- Stop and report if any existing `expectError` call names a code outside the enum (none at acceptance: conflict, email_unverified, forbidden, not_found, not_serviceable, out_of_stock, payment_pending, unauthorized, validation).
## Doing
2026-10-16: task 6 done. Red by mutation: removed "payment_pending" from the Error code enum in openapi.json; restored with git checkout.
## Found
- Red (enum mutated, `go test -race -count=1 -run TestAcceptAwaitsPayment ./internal/app`): `orders_payment_test.go:146: accept pending: code payment_pending is not in openapi.json's Error code enum [validation unauthorized forbidden not_found conflict out_of_stock not_serviceable rate_limited method_not_allowed email_unverified internal]`. Restored.
- Note: the BSD sed used to drop the enum line failed ('-i' took the script as a suffix); the mutation was made with perl and the restore was a checkout. No make gen run.
- Gates green: gofmt empty; go vet clean; go test -race -count=1 ./... all packages ok (app 90s); openspec validate --all --strict 20 of 20 passed.
- The cash-order check in TestSystemCancelNeedsPendingPayment asserts status placed and 1 event in one line (eventCount == 1 folded with the status check).
## Requests
## Blockers
