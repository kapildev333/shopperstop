# admin-P3-L1-R4 - review of task 3b (the board's total after a status change; R2 finding 1, R1 nit 1) (reviewer)
Status: done

## Verdict
Approve with one nit. R2 finding 1 is fixed; no blocking finding.

## Gates (run by me in /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1-review, HEAD 41c178b, Node 22.23.3)
- `npm ci`: ok.
- `make test-web`: exit 0. ui 30 files / 83 tests, admin 27 files / 324 tests, web 26 files / 153 tests. Admin matches the worker's `324 passed (324)`.
- `openspec validate admin-riders --strict`: "Change 'admin-riders' is valid".
- Not run: `make e2e`, Playwright, docker, `make db`, `make dev`.

## Test-first
Checked out 60cb80f and ran the admin suite: `Tests 2 failed | 322 passed (324)`. Both failures are the new tests, and both fail on the last assertion, `queryByText(/^Showing the newest/)` finds the note (the order is gone, `SS-TEST0002` is present). That is the R2 finding, not a setup error. 92d3f13 turns them green. Order test, fix is right. HEAD restored to 41c178b.

## Arithmetic (`apps/admin/src/orders.ts:99-104`)
`total: list.total + items.length - list.items.length` moves total by exactly the change in item count, so `total - items.length` is unchanged by any status change.
- Leaves the board (delivered, cancelled): filter removes one, nothing added, delta -1. Right.
- Stays (advanced but still active): removed and re-added, delta 0. Right.
- Joins (409 path, order read back is active but not in items): delta +1. Right when the order was not counted before.
- Never below the item count: core's total is at least its item count, and the invariant `total - items.length >= 0` is preserved by every path, so `total >= items.length`. The board's note is `total > orders.length`, so it cannot show for a fully shown board.
- `if (!list) return list` keeps the no-cache case (the old code did the same through `list &&`).
- Guards: `cancelQueries` before `setQueryData` for the board and the detail is untouched, so the poll and cancel stale-answer tests still hold (they are in the 324 green).

## Findings
1. NIT (only above 100 active orders), `orders.ts:101-103`. When core's total exceeds the 100 shown, an order outside the window is not in `list.items`, so the delta is wrong by one: a 409 read-back of an order that left the board while hidden leaves total 1 too high; one that is still active and joins items counts +1 although total already held it. Both fix themselves at the next poll (10 s), and the cap is already a named ceiling in the `ponytail:` comment. No change needed; mention only so nobody trusts the total to be exact beyond 100.

## Scope
Files in 60cb80f/92d3f13: the two test files (one test appended each), `orders.ts`, `routes/_staff/stock.tsx` (the double blank line removed, R1 nit 1), `tasks.md` ticks, the T3b worker log. All inside the brief. The patches 3b.1 and 3b.2 sit in an earlier team-lead commit (446e12c). No creep, no new abstraction; the fix is three lines.
