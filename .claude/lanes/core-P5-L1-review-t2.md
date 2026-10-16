# core-P5-L1-review-t2 - review of core-P5-L1 task 2 (payment route, accept guard, service actor table, services per route, core-payments)
Verdict: approve. Commits 49ec29e (test) then f34c0d5 (feat).

Gates: as recorded for task 1 (acceptance run at d088fce, all green).
Scenarios: orders "Staff accept only paid online orders" (`TestAcceptAwaitsPayment`, `TestPendingOnlineOrderCancels`), "The payment service marks payments paid or refunded" (`TestPaymentPaidThenRefunded`, `TestPaymentConflicts`, `TestPaymentValidation`, `TestPaymentRouteForServicesOnly`), "A service moves orders for a rider" (`TestRiderHandoff`, `TestServiceActorRules`, `TestServiceForbiddenBeforeLookup`, `TestPaymentTimeoutCancels`, `TestPaymentServiceActorRules`), "Transitions are recorded" (`TestStatusDelivered`), "Orders name their rider" (`TestRiderHandoff`, `TestStaffOutForDeliveryHasNoRider`); platform service tokens, per-route services and contract scenarios (`TestLoadServiceTokens`, `TestLoadRefusesBadServiceTokens`, `TestService*`, `TestContractNames{Undeclared,Refused}ServiceRoute`). All pass.

Findings:
1. The rider service's 403 on `POST /admin/orders/{id}/payment` is asserted only in `TestServiceRoutesByName`. Enough; non-blocking.
2. A system cancel of a paid order was admitted (the actor table allowed `system` to cancel any `placed` order). Fixed by task 5 (6facad2, 616f316).
3. A late `paid` after a timeout cancel lands on a cancelled order. Kept by design: the payment service refunds it (relayed to payment, PR #331).
4. `reference` accepts control characters. It is trimmed, capped at 100 runes and logged through slog (which quotes it), so it is not an injection path. Non-blocking.
5. Found at acceptance: `payment_pending` is not pinned to the Error enum by any test (see review-t1 finding 3). Task 6.
