# admin-P3-L1-R2 - review of tasks 2 and 3 (rider on card and sheet; one active-orders poll; Open or Closed) (reviewer)
Status: done

## Verdict
Changes needed (one real bug, small). Everything else approves.

## Gates (run by me in /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1-review, HEAD fa47279, Node 22.23.3)
- `npm ci`: ok.
- `make test-web`: ui 30 files / 83 tests, admin 25 files / 299 tests, web 26 files / 153 tests, all passed. Matches the worker's `299 passed (299)`.
- `openspec validate admin-riders --strict`: "Change 'admin-riders' is valid".
- Test-first, run by me: at 40355a2 `Tests 2 failed | 295 passed (297)` (the two rider-name tests, for want of the rider text). At 66f6c40 `Tests 9 failed | 290 passed (299)`: the board/poll/hidden/left/status request-count tests, the "more than one page" test, the dashboard Open test, and the cancel-poll test in order-sheet.test.tsx. All fail for the right reason (five requests instead of one, no `active` parameter, no note, no badge). Order test, feat, log is right. HEAD restored.
- Not run: `make e2e`, Playwright, docker, `make db`, `make dev`.

## Findings
1. BUG, `apps/admin/src/orders.ts:99` (`useSetStatus` onSuccess) with `apps/admin/src/order-board.tsx:105`. The cache write keeps core's old `total` and only changes `items`. Failing scenario: a store with 5 active orders (total 5), staff deliver one (or cancel one). `isActive(delivered)` is false, the order is filtered out, items has 4, total is still 5, so `total > orders.length` and the board says "Showing the newest 4 of 5 active orders." although nothing is hidden. It stays until the next poll (up to 10 s, and the poll is cancelled by `cancelQueries` just before). Cancel through the sheet takes the same path. The same drift runs the other way on the 409 path (an order not on the board added to items). No test covers a total after a status change (the only "Showing" tests are the 130 case and the absent case). Smallest fix: write `total: list.total - (before.length - kept.length) + (added ? 1 : 0)`, i.e. adjust total by the change in item count when the order leaves or joins; add a test: board of 2 active orders, deliver one, assert no "Showing the newest" text (test commit first).
2. NIT, `apps/admin/src/dashboard.test.tsx` (new test). It pins badge colour through classes `bg-canvas` / `bg-success-soft`. That is the spec's wording ("neutral surface", "success surface") and the other tests in the repo do the same for Badge, so accepted, but it breaks on any Badge restyle in ui; the text "Open"/"Closed" is what carries the meaning.
3. NIT, `apps/admin/src/routes/_staff/index.tsx:35-38`. Badge semantics are right against CLAUDE.md: `success` for Open (success status colour), `neutral` for Closed (not `danger`, so a closed store is not read as an error), the state is also in text so colour is not the only carrier, green is not used as an action colour. Layout wraps (`flex-wrap`). No finding.

## Spec coverage
Task 2
- Rider on the card: test with ready, out-for-delivery with `riderName`, out-for-delivery without; asserts "Rider: Arjun Rao" on the second card only, the other two name none. Card order (0003 before 0002) is the longest-waiting rule. Covered.
- Rider and rider events: delivered order opened from History, "Rider: Arjun Rao" and the four event lines including "Out for delivery by Arjun Rao" and "Delivered by Arjun Rao". `actorName ?? actor[actorType]` falls back for customer/staff events. Covered.
Task 3
- Board listed: `listRequests` equals `[{active:'true', pageSize:'100'}]` and no "Showing" text. Covered.
- More active orders than one page: total 130, one item, status role, card shown. Covered (the "n of total" note is `total > orders.length`, pageSize 100 sent).
- Poll: 1 request at 9 s, 2 at 10 s, card moves to Accepted. Hidden tab: 1 after 30 s hidden, 2 on show. Board left: 2, stays 2. Covered.
- One list fails on first load: now `core.fail('lists')` on the single list and the alert asserted. Proves the scenario as reworded ("the one request").
- One list fails on a later poll: accepted elsewhere, `core.fail('lists')`, `refreshFailed` on the board key, then Placed/Ready columns unchanged, no alert, notice with role status. This proves the scenario (the "no mixed columns" comment was dropped because a single request cannot mix; the assertion on Placed still holding the stale order covers it). Accepted.
- Open or closed: both badges, Closed absent on the open card. Covered.
- Stale-answer guards: `cancelQueries` before `setQueryData` is unchanged and still applied to the new `{items,total}` shape; the existing status and cancel stale-poll tests were updated only in counts (10 to 2, 15 to 3) and pass, and the cancel test appears among the nine that failed red, so it exercises the guard. The `heard` baseline compares `answer` (items array identity), which changes only on a new answer; fine. Only gap is finding 1.

## Scope and complexity
- Files touched match the brief scope plus the worker log and tasks ticks. `orders-fake.ts` gains `active=true` filtering that mirrors core's definition (not delivered, not cancelled); needed by the tests, small. The `oneStatusFails` helper was deleted with its last users. No creep, nothing speculative. The `ponytail:` comment in orders.ts names the ceiling (100) and says the board now tells the user; accurate.
- The list type widening (`status?`, `active?: 'true'`) matches the generated core.d.ts parameter; core's openapi forbids `active` with `status`, and the code never sends both.
