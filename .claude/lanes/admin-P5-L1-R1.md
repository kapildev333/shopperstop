# admin-P5-L1-R1 - review of admin-P5-L1 (admin-payments)
Status: done, approve with one non-blocking finding
## Doing
2026-10-16: re-ran lint, typecheck, vitest (333/333), build; checked out each test commit in a throwaway worktree: red 3/330, 2/332, 2/333 as named. e2e not run.
## Found
- A cancelled online order whose payment stayed `pending` (payment timeout cancel) shows "Awaiting payment" (warning) in History and the sheet.
## Requests
None.
## Blockers
None.

## R2 (2026-10-16, commits b0759d6, 4000dab, 365a84e)
Status: done, approve
- Test-first: 4000dab alone = 2 failed / 332 passed (334), the two named tests (sheet Not paid, History Select option). 365a84e = 334/334.
- Scope: apps only `orders.ts`, `order-sheet.tsx`, `order-sheet.test.tsx`, `orders-history.test.tsx`; rest is openspec (spec delta, design, proposal, tasks, patches).
- `payment()` maps cancelled + pending to `unpaid` (neutral "Not paid"); `awaitsPayment` still requires status placed, so Accept logic untouched. `?? ''` guard is one token.
- Gates: lint clean, typecheck clean, vitest 27 files / 334 passed.
## Found
None blocking.
