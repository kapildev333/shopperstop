# core-P3-L3-review-t3

Status: approve

Reviewer: 2026-10-15 Task 3 (37217ad test, 11b6747 feat), core-hygiene decision 5.

- Test-first: the test commit adds four assertSQL lines to TestResetLoadsDemoOrders; the lane log records red ("orders with a rider: 0, want 1"). The assertions cannot pass without the seed change.
- Seed matches the spec: ...0701 rider_name 'Arjun Rao'; its out_for_delivery and delivered events actor_type rider, actor ...0801, actor_name 'Arjun Rao'; other orders get null rider_name; staff and customer events get null actor_name. Migration 0007 allows actor_type 'rider'.
- Rider seed on main (services/rider/internal/seed/seed.go): rider ...0801 "Arjun Rao" at Koramangala, delivery ...0901 for order ...0701 SS-DEMOAAAB, status delivered, assigned_at placed+6 min, delivered_at placed+11 min: equals core's out_for_delivery (+6) and delivered (+11) events. No contradiction.
- Idempotence: TestResetLoadsDemoOrders resets twice and asserts exactly one rider order and two rider events; green.
- Scope: seed.go, seed_test.go, tasks.md ticks, lane log only. Complexity: minimal (two case arms).

## Findings
1. Low, internal/seed/seed_test.go:601-604: the read-back is by SQL only. No test fetches SS-DEMOAAAB through the router to see riderName (customer and staff) and actorName on the events. The mapping is covered for live orders by internal/app/orders_rider_test.go, so risk is low. Smallest fix: add riderName "Arjun Rao" and Events[4..5].ActorName checks to TestDemoOrdersThroughTheRouter (internal/app side). Not blocking; the brief only requires that test to stay green.
2. Info: rider delivery total_cents 33900 is hard-coded in the rider seed; core's total is computed from items and the fee rule. Not verified here, pre-existing and outside this task.

## Gates (services/core, test database only)
- gofmt -l .: clean
- go vet ./...: ok
- go test -race -count=1 ./internal/seed/ ./internal/app/: both ok (37.9 s, 76.0 s)
- openspec validate --all --strict: 16 passed, 0 failed
