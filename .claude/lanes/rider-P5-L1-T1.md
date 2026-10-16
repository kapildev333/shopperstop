# rider-P5-L1-T1 - rider service passes core's payment through (task 1 of rider-collect-cash)
Status: test commit in progress (red confirmed)

## Brief
- LANE-ID: rider-P5-L1 (task T1). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L1`. Branch: `lane/rider-P5-L1-collect-cash`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend. Never run docker or touch containers.
- Change: `openspec/changes/rider-collect-cash/`, task 1 (`tasks.md` 1.1, 1.2). Read `design.md` Decisions 1, 2 and 6, then "Code".
- Scenarios (deliveries): "Payment passes through", "Claim keeps the payment"; every existing rider test stays green.
- Scope paths (nothing else): `services/rider/migrations/0004_delivery_payment_status.sql` (new, from the diff), `services/rider/queries/deliveries.sql`, `services/rider/internal/core/core.go`, `services/rider/internal/delivery/delivery.go`, `services/rider/openapi.json`, `services/rider/internal/app/deliveries_test.go`, `services/rider/internal/migrate/migrate_test.go`; generated only by `make gen postman`: `services/rider/internal/delivery/db/deliveries.sql.go`, `services/rider/internal/delivery/db/models.go`, `services/rider/internal/auth/db/models.go`, `packages/ui/src/api/rider.d.ts`, `docs/postman/shopperstop-rider.postman_collection.json`; `openspec/changes/rider-collect-cash/tasks.md` (ticks 1.1, 1.2); this file.
- Failing tests to start from: `services/rider/internal/app/deliveries_test.go` `TestReadyOrdersPassPaymentThrough`, `TestClaimKeepsPayment` (compile error `o.PaymentStatus undefined (type core.Order has no field or method PaymentStatus)`); `services/rider/internal/migrate/migrate_test.go` `TestEmbeddedMigrationsApplyOnce` (wants `0004_delivery_payment_status`).

## Steps and commits
0. Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.
1. Copy design.md "Task 1: tests" (text between the fences) to a scratch file outside the repo; `git apply` it. From `services/rider`: `go vet ./internal/app/` must print the undefined-field error above. Paste it under "Red run". Commit `test: rider ready orders and deliveries carry core's payment` (the two test files and this file).
2. Apply "Task 1: code" the same way. From the worktree root: `make gen postman`; `git status --short` must list only the scope files (the five generated ones included). Gates: `GOFLAGS=-count=1 make test-rider` (every package ok), `openspec validate --all --strict`. Tick 1.1 and 1.2 in tasks.md. Commit `feat: rider passes paymentMethod and paymentStatus through, payment_status kept at the claim` (all remaining scope files). Then run `make gen postman` once more: `git status --short` must be empty.

If a diff does not apply, the red differs, a generated file outside the list changes or a gate fails, stop and write it under Blockers; do not improvise. Never edit `apps/`, other services, `packages/ui` by hand, or the lane log `rider-P5-L1.md`.

## Red run
`go vet ./internal/app/` (services/rider):
```
vet: internal/app/deliveries_test.go:56:21: o.PaymentStatus undefined (type core.Order has no field or method PaymentStatus)
```
`go test -count=1 -run TestEmbeddedMigrationsApplyOnce ./internal/migrate/` (shopperstop_rider_test):
```
--- FAIL: TestEmbeddedMigrationsApplyOnce (0.04s)
    migrate_test.go:220: applied [0001_init 0002_riders 0003_deliveries], want [0001_init 0002_riders 0003_deliveries 0004_delivery_payment_status]
```
## Green run
## Gates
## Found
## Blockers
