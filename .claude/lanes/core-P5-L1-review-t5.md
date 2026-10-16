# core-P5-L1-review-t5 - review of core-P5-L1 task 5 (fix: system cancel only while payment is pending, core-payments)
Verdict: approve. Reviewed by the team lead at acceptance; the task had no separate review. Commits 6facad2 (test) then 616f316 (fix), 470d4d0 (lane log).

Test-first: with 616f316's `status.go` hunk reverted, `TestSystemCancelNeedsPendingPayment` fails as briefed (a paid order is cancelled with 200). With the fix it passes. The tree was restored afterwards.
Guard (`services/core/internal/order/status.go` `Transition`):
- It runs inside the transaction, after `LockOrder` (`for update`) and the table check. `SetPayment` takes the same row lock, so a concurrent `paid` and a timeout cancel serialise: either the cancel sees `paid` and is refused, or the payment sees a cancelled order (the kept late-paid case, review-t2 finding 3).
- `PaymentStatus == nil` (cash) and `paid`/`refunded` are refused 409 `conflict`. The refusal returns before `SetStatus`, `stock.Release` and `addEvent`, so nothing changes.
- Only the payment service maps to the `system` actor (`serviceActors` in handlers.go). Customer and staff cancels are untouched. A cancelled or delivered order still fails the table check first with the same code.
Spec delta: the requirement is now 479 characters. "only cancels an order awaiting payment" matches the guard. The new scenario matches the test. Dropping the `name` 1-to-80 sentence leaves that rule pinned only by the "No actor" scenario (blank or 81 characters), which is acceptable, and the living requirement's wording becomes slightly less explicit when archived. design.md and tasks.md were updated.
openapi.json: the status route's 409 description gained the system-cancel clause, and `core.d.ts` and the Postman collection were regenerated in the same commit. Accurate.

Findings (non-blocking):
1. For the cash order the test asserts status and stock but not the event count, which the scenario names ("events unchanged"). Task 6 adds one assertion.
