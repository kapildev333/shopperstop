# core-P2-L5-t7b - dashboard today starts at midnight Asia/Kolkata (test-only follow-up to task 6 review)
Status: done
## Doing
Test commit 4523cbc (`test: dashboard today starts at midnight Asia/Kolkata`) added `TestDashboardMidnightKolkata` to `services/core/internal/app/dashboard_test.go`; it passed on its first run with no product code touched. Then this chore commit. Gates: `GOFLAGS=-count=1 make test-core` exit 0; `make gen postman` exit 0 with `git status --short` empty; `openspec validate --all --strict` exit 0 (13 passed).
## Found
- First-run numbers: the test ran, not skipped (IST time about 20:53 on 2026-10-13). Fresh store with three delivered orders: A (1111, placed and delivered at midnight minus 1 minute), B (2222, placed and delivered at midnight plus 1 minute), C (3333, placed at midnight minus 1 minute, delivered at midnight plus 1 minute). Dashboard: `ordersToday.delivered` 1, the other six statuses 0, `revenueTodayCents` 5555 (B and C). Matches the brief.
- The product query is `date_trunc('day', now(), 'Asia/Kolkata')` in `queries/order.sql` (placed count and delivered revenue); the test pins that boundary.
- Not done: no temporary UTC mutation was run to watch the test go red. Running it would have meant editing product code, which this brief rules out. The red check is therefore by reasoning only: with a UTC day start (05:30 IST) and the run after 05:30 IST, B (placed at IST midnight plus a minute) falls before the window, so `delivered` would be 0 and revenue 0, and the test fails.
- The test sets `subtotal_cents` and `total_cents` in its SQL update, since `orderIn` inserts fixed totals of 2000.
## Requests
- none
## Blockers
- none
