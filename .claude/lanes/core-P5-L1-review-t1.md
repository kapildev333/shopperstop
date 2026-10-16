# core-P5-L1-review-t1 - review of core-P5-L1 task 1 (payment method on placement and reads, core-payments)
Verdict: approve. No blocking findings. Commits 899694d (test) then 520b116 (feat).

Gates: from the acceptance at d088fce: gofmt empty, `go vet ./...` clean, `go test -race -count=1 ./...` every package ok; `openspec validate --all --strict` 20 of 20.
Scenarios: orders "Customers pay cash or online" (`TestPlaceOnline`, `TestPlaceCash`, `TestPlacePaymentMethodInvalid`), "Paying online needs a verified email" (`TestPlaceOnlineUnverified`), `TestPaymentStatusMatchesMethod` (schema check). All pass.

Findings (non-blocking):
1. openapi.json: two stray periods in descriptions. Fixed in task 2.
2. migrations/0011_payments.sql: the comment pointed to `LockEvents` before task 3 added it. Resolved by task 3.
3. Found at acceptance, not by the task review: the platform scenario "The contract lists every code" is pinned only for `method_not_allowed` (`TestWrongMethod`). Dropping `email_unverified` from the Error enum fails no test (mutation run at acceptance). Task 6 adds the check.
