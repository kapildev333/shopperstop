# core-P3-L1 Task 2 review (cbf0632..e03e4db, merge 1ceb5e9)
Verdict: APPROVE. No blocking findings.

Gates (review worktree at 1ceb5e9): gofmt -l empty; go vet clean; go test -race -count=1 ./... all ok; make gen postman leaves git status clean (postman 17 pass); make test-web exit 0 (admin typecheck passes with the rider actor key); openspec validate --all --strict 15 passed.
Test-first: at 84d380f the new tests fail (500 invalid uuid "" on a service body); 22ffbc0 turns them green.

Scenarios: all five "A service moves orders for a rider", both "Orders name their rider", and Delivered are covered (TestServiceActorRules, TestRiderHandoff, TestStaffOutForDeliveryHasNoRider). 403 is decided before the order read (handlers.go SetStatus). Migration 0007 is additive and nullable; constraint name order_events_actor_type_check matches the inline check in 0006 (suite migrates fresh). Coalesce snapshot is correct; customer reads include riderName via views(). Staff path unchanged. Concurrency unchanged (same lock + tx). Merge: no conflicts, only admin #200 and ui #199 content.

Findings (all low, non-blocking)
1. services/core/internal/order/status_test.go:32-35: allowed() gained a rider branch and a default-false, but the table test checks only staff and customer. Add a rider row (out_for_delivery and delivered only; never cancelled) and assert an unknown actor type is false. Fix in a follow-up or here, one small test.
2. services/core/internal/app/orders_rider_test.go: 403 "before the order is read" is not pinned. Add a row: service cancelled on a random uuid order expects 403, not 404. Today the code order guarantees it.
3. handlers.go actorOf: service plus invalid actor plus non-rider target answers 400 before 403 (validation first). Acceptable and consistent with the spec; note only.

Worker choice (packing and ready events added to the 200 example before the rider event): fine. It makes the example a coherent history ending at the rider move, and openapi example validity is tested. Keep.

Carry-over, config.go serviceTokens whitespace: not fixed in this lane. Entries are TrimSpace'd, but name and token around the colon are not ("rider : tok" yields name "rider " that never matches, and a token with a leading space can never be sent as a bearer). It fails closed (the rider gets 401), so it is not a security issue. Recommend a one-line follow-up (TrimSpace both sides, or reject), separate lane or chore, not core-P3-L1.
