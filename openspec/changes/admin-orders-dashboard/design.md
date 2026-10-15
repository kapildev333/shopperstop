# Design

## Context
`apps/admin` on main with core-orders (#137), admin-catalog (#112) and admin-stock (admin-P2-L4) merged, plus admin-keep-data-on-refetch-error (admin-P2-L7), which merges first: this lane is rebased onto both before task 1. `/orders` and `/` are `PageHeader` placeholders. Pages read core through `openapi-fetch` and TanStack Query 5 (`retry: false`, a 403 thrown to the route's error boundary), inside the guard `routes/_staff.tsx`, which puts `staff` in the route context. Tests render the real router with `renderApp` and fake core at `fetch` with `fakeCore`.

No `docs/design/admin-P2-L5.md`: this file is enough. Every file of every task is below, verbatim, as built and measured in a spike on 2026-10-13.

## Assumptions (read in the code on e6d8e4b, in admin-stock at d106b53 and in admin-P2-L7 at 0aa0ab1)
- A1. `GET /admin/stores/{id}/orders` takes one `status` or none, `page`, `pageSize` 1 to 100; newest first (`placed_at desc`); each order whole (items, events, customer, address). Store staff of another store and an unknown store: 404 (`services/core/internal/order/handlers.go`).
- A2. `POST /admin/orders/{id}/status {status, note?}` answers 200 with the order after the move; 409 `conflict` for a move the table refuses; the table is `placed → accepted | cancelled`, `accepted → packing | cancelled`, `packing → ready`, `ready → out_for_delivery`, `out_for_delivery → delivered` (`status.go`). `note` at most 500 characters; on a cancel it becomes `cancelReason`.
- A3. `GET /admin/orders/{id}` answers the same `Order`; 404 for another store's staff.
- A4. `GET /admin/dashboard` answers `{items: DashboardStore[]}`: every store by name for an admin, one for store staff; `ordersToday` always has the seven keys; `lowStockCount`; `revenueTodayCents` (`internal/staff/dashboard.go`).
- A5. Core has no request limit on these routes (only sign-in is limited), so five list requests every 10 seconds per open board are accepted.
- A6. TanStack Query 5.104.2: `refetchInterval` does not run while the document is hidden (`refetchIntervalInBackground` is false by default) and `refetchOnWindowFocus` (default true) refetches a stale query on `visibilitychange`; an equal answer keeps the same `data` object (structural sharing); `cancelQueries` puts a query back to the state before its fetch and ignores the answer; a failed refetch leaves `data` and sets `isError`.
- A7. TanStack Router's `Link` marks itself `aria-current="page"` when its path matches and its search is contained in the current one, and passes an `aria-current` prop through when it does not consider itself active.
- A8. The ui `Dialog` and `Sheet` share `useModal`: each listens for Escape on `document` and restores focus to what had it when it opened. Two open at once would both close on one Escape.
- A9. `ink-muted` on `canvas` is 4.47:1 (area plan): `TabNav` links and muted text sit on `surface`.
- A10. With admin-stock: `src/stock.ts` exports `storeNameQuery(storeId)`; `/stock` validates `store` and `lowStock` in its search; `src/api.ts` gives a not-ok answer without core's error body an `internal` envelope, so `error.error.code` is always there.
- A13. With admin-P2-L7: `RefetchNotice` (`src/refetch-notice.tsx`) is mounted once in `routes/__root.tsx` above the `Outlet` and shows "Could not refresh. Showing what was loaded last." (`StatusMessage tone="warning"`) while any query with an observer holds data and failed last with a code other than `not_found`. No page imports it. TanStack Query tells observers one turn after an answer (`notifyManager`).
- A11. Seed (`services/core/internal/seed/seed.go`): Koramangala `…0401` holds SS-DEMOAAAB (`…0701`, delivered two days ago), SS-DEMOAAAC (`…0702`, cancelled a day ago) and SS-DEMOAAAD (`…0703`, placed ten minutes before the reset: one Banana Robusta `…0601` and three Pomegranate Bhagwa, ₹1,030, no fee); the customer has the phone +919800000000. Every `make e2e` suite reseeds first (`apps/admin/e2e/global-setup.ts`, `apps/web/e2e/global-setup.ts`).
- A12. `e2e/catalog.spec.ts` deletes only the product it creates ("E2E Curd Cup") and `e2e/stores.spec.ts` deletes nothing, so neither is broken by orders existing. No fix needed.

## Goals / Non-Goals
**Goals:** the 29 requirements of the delta; every scenario a named test; five worker tasks a Haiku worker can build by copying blocks; nothing outside `apps/admin/`.

**Non-Goals:** see proposal "Out of scope".

## Decisions
Asked for by the brief (D13: recommendation, one-line reason, proceeded on):

1. **The board is one query of five requests.** `boardQuery(storeId)` asks the five active statuses at `pageSize=100` together and holds one flat `Order[]`. Reason: core lists one status per request, and an unfiltered list would fill with finished orders within a day; one query means one error state, one poll and one cache entry to write after a change. Ceiling: the newest 100 of a status (see Accepted ceilings); request to core for an "active" filter.
2. **Hidden tab: no polling; shown again: asked at once.** TanStack Query's defaults, left alone. Reason: nobody reads a hidden board, and the announcement is only useful when the answer is fresh on return.
3. **While a status change runs the poll goes on; its answer is harmless.** An answer that arrives during the change shows the order where it was, which is still true on screen (the button reads "Saving…"). No pause logic.
4. **A poll answer never beats the change's answer.** In the mutation's `onSuccess`: `cancelQueries` on the board (and the order) and then `setQueryData` with core's answer. A poll read before the change and still in the air is dropped; one already answered is overwritten. The interval keeps running. Reason: the smallest rule that makes "a card never jumps back" true; proven by a test with a held poll.
5. **What is announced.** One always-present, visually hidden `<p role="status" aria-label="New orders">`. Its text is worked out during render when the board's `data` object changes: placed orders whose id the answer before did not hold, as "New order <number>" or "<n> new orders: <numbers>". The first answer for a store is the baseline; a failed poll brings no new `data`; an equal answer is the same object, so the region is not written again; a changed answer with nothing new empties it. The board is keyed by store, so another store starts from its own baseline. Hidden, not visible: the card appearing is the visible cue, and a visible line that says "New order" for ten seconds and then vanishes is noise. (Superseded by Decision 27: orders kept from an earlier visit are no baseline and nothing placed while the board was away is announced.)
6. **Time since placed.** `useSince(placedAt)` is a `useSyncExternalStore` whose snapshot is the text itself, ticked every 5 seconds: only the `<Since>` leaf renders again, and only when its text changes (once a minute). The board does not render on a tick.
7. **The status dialog.** Forward moves are one press; only "Mark delivered" asks first, because delivered is final and counts as revenue, while a wrong "Accept" can still be cancelled. Cancel has its own dialog with the reason.
8. **One status change at a time on a board.** While one runs every card's button is `aria-disabled`. Reason: one mutation observer, so "a second press sends nothing" is one guard and the result line always belongs to the last press. Ceiling: a store that wants to tap five cards in a second waits for each answer.
9. **A 409 is not a failure.** The mutation reads the order again and resolves with `{order, changedElsewhere: true}`: the cache is written the same way and the message says "<number> was changed by someone else first: it is now <Status>.". If that read fails, the change fails like any other.
10. **e2e and the seed.** `e2e/orders.spec.ts` moves `…0703` to delivered and cannot move it back; it relies on the reseed before every suite and says so in its head comment. It asserts nothing about today's counts on the dashboard (a run in the ten minutes after midnight IST would see the order placed yesterday). The "Deactivate instead" step checks the offer and presses "Cancel": the product stays active, nothing to restore.

Other decisions:

11. **Store, tab, status filter and page live in the URL; the open sheet does not.** `validateSearch` keeps `store` (a string), `tab` only when `history`, `status` only when `cancelled`, `page` only as a whole number above 1, cut to 100000. Ceiling: no link to one order.
12. **State that belongs to a store is dropped by `key={storeId}`** on `OrderBoard` and `OrderHistory`: announcements, the result of the last change, the open sheet, the placeholder rows. The selector sits outside them and keeps focus. Choosing a store keeps the tab and drops `status` and `page`.
13. **Keep data on a failed refetch; one notice, at the root** (web's fix #135 and the ruling of 2026-10-13 with admin-P2-L7): every query-driven view reads `data === undefined ? (isError ? alert : skeleton) : content`. The board, the history and the dashboard render no notice: L7's `RefetchNotice` at the root shows "Could not refresh. Showing what was loaded last." for any query on screen, these included (and the stores list, which therefore is no ceiling any more). The order sheet is the one exception: a modal sits over the root's notice, so it shows the same words itself while its own read is failed. No `not_found` branch is needed: the sheet always holds the card's order, and a list or the dashboard has no 404 of its own. No shared helper in this lane.
14. **The sheet has its own query**, `['admin', 'order', id]`, outside the store's list prefix. Opening writes the card's order into it (`setQueryData`), so the sheet shows at once, then reads the order (stale at once) and polls it while it is active (`refetchInterval` is `false` for a finished order). A status change writes core's answer into it. It is never refetched into a 404: store staff cannot open another store's order, and a failed read keeps the data.
15. **One modal at a time.** The cancel `Dialog` replaces the sheet (`<Sheet open={!asking}>`) and the sheet returns when it closes (A8). The dialog cannot be closed while the cancel runs.
16. **After a status change:** core's answer into the board and the order's query; `removeQueries({type: 'inactive'})` under `['admin', 'orders', storeId]`, so a history page kept from before is read again instead of shown as it was (task 4, with its test).
17. **Focus after a move.** The pressed button's card is unmounted from its column. An effect on the moved order puts a keyboard left on `body` onto `#next-<id>` (the card's new button) or onto the result line (`tabIndex={-1}`) when the order left the board. It never takes focus from somewhere else.
18. **Button names.** The next-status button is `aria-labelledby` its own text and the card's number ("Accept SS-…"), so the number is in the DOM once and "Saving…" is in the name while it runs. The number is a ghost `Button` that opens the sheet.
19. **`idle`** (`aria-disabled:cursor-not-allowed aria-disabled:opacity-50`) lives in `src/idle.ts`, one export, for this lane's three files; `/stock` keeps its own copy until a later lane or ui's `Button` change removes both.
20. **History is one status at a time** ("Delivered" / "Cancelled" chips, `aria-pressed`): core cannot page a merged list. Rows are kept while the next page of the same status loads (`aria-busy`, dimmed, own page number); a change of status shows the skeleton, never the other status's rows.
21. **Status badges (D28):** `statusBadge` in `src/orders.ts`: `accent` under way, `success` delivered, `neutral` cancelled; names from `statusLabel`, the same seven as web's vocabulary. The column count is a plain `neutral` Badge: a count, not a status.
22. **Dates** are `Intl.DateTimeFormat('en-IN', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata'})`: the stores' time, the same in every browser and in tests.
23. **The dashboard is not polled**; it refetches on mount and when the tab is shown again. "Orders today" also shows the sum of the seven.
24. **Tabs are two `Link`s to `/orders`** in a `TabNav` on a `surface` strip (A9), `activeOptions={{exact: true}}` plus an explicit `aria-current` (A7).
25. **Test fixtures live in `src/orders-fake.ts`** (test-only): `order(n, status, over)`, `ordersCore(storeId, orders)` with core's status table, `hold`/`release`/`fail` per part, `listRequests`, and `refreshFailed(router, key)`, which waits until the query has failed with its data kept and then one `notifyManager.schedule` turn, so the page has been told (L7's gotcha: without the second wait the assertions pass on a page that would drop its data). `src/fake-core.ts` is not edited. The whole fake arrives in task 1, although the status routes are first used in task 2 (as admin-stock did; one file, written once).
26. **Fake timers** only inside the tests that need the poll or the clock: `vi.useFakeTimers({ shouldAdvanceTime: true })`, undone by `vi.useRealTimers()` in `afterEach`. `shouldAdvanceTime` lets the fake clock also run with the real one, so Testing Library's `findBy` and `waitFor`, which wait on timers, keep working; `act(() => vi.advanceTimersByTimeAsync(ms))` jumps an interval; `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` where a click happens under fake timers. A hidden tab is `vi.spyOn(document, 'visibilityState', 'get')` plus a `visibilitychange` event on `window`.

After the review of task 1 (2026-10-13, manager's rulings):

27. **Only an answer core gave since the board was opened can be a baseline or news** (R1-1): the announcement block also requires `board.isFetchedAfterMount && !board.isError`. Orders kept in the cache from an earlier visit show at once but are no baseline, so coming back to a store, or to `/orders` from another page, announces nothing for what was placed meanwhile; the first good answer after opening is the silent baseline. `!isError` because `isFetchedAfterMount` also turns true on a failed fetch (read in `queryObserver.ts`): without it a failed first refresh would make the kept orders the baseline. A tab hidden and shown again is different: the board stayed open, so an order placed meanwhile IS announced when the tab shows.
28. **Cards are ordered by `Date.parse(placedAt)`** (R1-2): core trims zeros from the fraction, so the strings do not sort. Ceiling: two orders in the same millisecond keep core's order (newest first).
29. **A column's heading has `aria-label` "<Status>, <n> orders"** ("1 order") (R1-7): the visible text stays the name and the count badge; the region is named by the heading, so it reads the same. The e2e's `/^Placed/` still matches.
30. **Pins from R1-6**, green when written: one of the five requests failing fails the whole board (`Promise.all`): the alert on a first load, the kept board with the root notice on a later poll; the poll stops when the board unmounts. On sign-out and on a 401 the board unmounts too (`signOut` navigates to `/sign-in`; `onUnauthorized` clears the cache and re-runs the guard, which redirects), and the observer's interval goes with it; `queryClient.clear()` alone would not stop a mounted observer.
31. **Task 3's cancel has the held-poll test too** ("a poll answer read before a cancel never puts the order back on the board"): same `cancelQueries` then `setQueryData` in `useSetStatus`.
32. **The dashboard renders no level-2 heading but the store names** while it shows cards (the e2e expects exactly the two); its unit test asserts the list of h2s.

Ceilings from the review, one line each: R1-3 the newest 100 per status and a count of what is shown (core's active filter is backlog, not Phase 2); R1-4 five reads are not one snapshot, so an order moved between two of them can show twice or not at all for one poll; R1-5 one 5-second interval per card (a shared ticker is more code than this line; revisit if a board holds hundreds); R1-8 "30 h 0 min ago" has no "yesterday", and an unparsable `placedAt` would read "NaN".

After the review of task 2 (2026-10-15, `.claude/lanes/admin-P2-L5-R2.md`), folded into task 3 as its step A:

33. **The delivered dialog's title has no "undefined"** (R2-1): ``title={confirm ? `Mark ${confirm.number} delivered?` : ''}``. Not observable (the ui `Dialog` renders nothing while closed, so the old string never reached the DOM): a cleanup inside step A's `fix:` commit with the suite green, no test and no guard.
34. **The place the keyboard goes after a delivery is a named group** (R2-2): the result wrapper is `role="group" aria-label="Status change"`, so a screen reader landing on it hears what it is before the message. A group, not a region (no landmark for a one-line result); an `aria-label` on a role-less `div` is prohibited in ARIA 1.2 and flagged by axe. One new scenario ("Order status change in progress › Result named") and one test appended to `src/orders-status.test.tsx`.
35. **Step A is two exact line replacements in `src/order-board.tsx`**, not a whole-file block: the file is replaced whole again in step B by the task-3 block, which holds both lines. A whole step-A copy would be 150 lines of design.md for two changed lines.

Accepted from the review of task 2, no change: R2-3 the delivered dialog sends what it snapshotted, and a move by someone else meanwhile comes back as the 409 path ("changed by someone else"); R2-4 `cancelQueries` after a change also drops a poll carrying other orders' news, repaired by the next poll (Decision 4, already a risk below); R2-5 the column heading's `aria-label` replaces the visible text and badge in its name, label-in-name holds (the name starts with the visible word); R2-6 one 5-second interval per card (R1-5).

Accepted from the review of task 3 (2026-10-15, `.claude/lanes/admin-P2-L5-R3.md`), no change, nothing folded into task 4: R3-1 the sheet's cancel has its own `useSetStatus`, outside the board's one change at a time; the modal cancel dialog keeps the board's buttons out of reach while it runs; R3-2 `maxLength={500}` counts UTF-16 units where core counts runes after trimming, so astral characters reach the limit earlier, never later (the safe side); R3-3 the cancel's result ("Order cancelled." or the conflict notice) stays on the sheet until it closes, as the scenarios want; R3-4 the card's number is a ghost `Button` and the next-status button's `aria-labelledby` still resolves to its text. Task 4 re-spiked on the branch with task 3 landed (236): `16 failed | 236 passed (252)`, then 252; task 5 `7 failed | 252 passed (259)`, then 259; lint, typecheck and build green; `make test-web` exit 0 after task 4 (ui 54, admin 252, web 140).

## Files (all under `apps/admin/`)
| File | Task | What |
|---|---|---|
| `e2e/orders.spec.ts` (new) | 1 | written first, run in task 6 |
| `e2e/catalog.spec.ts` | 1 | one test appended, run in task 6 |
| `src/orders-fake.ts` (new, test-only) | 1 | fixtures and the fake order routes |
| `src/orders-board.test.tsx`, `src/orders-rules.test.ts` (new) | 1, 9 tests appended to the first in 2 | 15 + 9 tests |
| `src/orders.ts` (new) | 1, replaced whole in 2, 3, 4 | types, vocabulary, queries, the status change, `since`, `when` |
| `src/order-board.tsx` (new) | 1, replaced whole in 2 (twice) and 3 (two lines in step A, then whole) | the board |
| `src/routes/_staff/orders.tsx` | 1 (replaces the placeholder), replaced whole in 4 | store, tabs, URL |
| `src/orders-status.test.tsx` (new), `src/idle.ts` (new) | 2, one test appended to the first in 3 | 9 tests; the `idle` class |
| `src/order-sheet.test.tsx` (new), `src/order-sheet.tsx` (new) | 3 | 13 tests; the sheet and the cancel dialog |
| `src/orders-history.test.tsx` (new), `src/order-history.tsx` (new) | 4 | 16 tests; the history table |
| `src/dashboard.test.tsx` (new), `src/routes/_staff/index.tsx` (replaces the placeholder) | 5 | 7 tests; the dashboard |

`src/routeTree.gen.ts`, `src/fake-core.ts`, `package.json` and every existing test are unchanged. `src/shell.test.tsx` and `src/sign-in.test.tsx` open `/` without a dashboard route in their fake: the page then shows its alert under the "Dashboard" heading they look for, and they pass unchanged (measured).

## Rebase onto main with admin-stock and admin-P2-L7
The lane's documents were written on e6d8e4b. admin-stock has merged since; admin-P2-L7 merges before this lane. The spike ran on this branch's tree with `apps/`, `packages/` and `services/core/openapi.json` of `lane/admin-P2-L7-keep-data-on-refetch-error` laid over it (that branch is main with admin-stock plus L7's fix): the stage replay at its commit b31884f (base 179), the final tree and `make test-web` at 0aa0ab1 (base 180, one test more in L7).

| File | Conflict | Resolve |
|---|---|---|
| anything under `apps/` | none: this lane's commits so far touch only `openspec/changes/admin-orders-dashboard/` and `.claude/lanes/admin-P2-L5.md` | nothing |
| `.claude/areas/admin.md`, `openspec/specs/admin-app/spec.md` | not edited here | nothing; the delta is ADDED only and shares no requirement name with admin-stock ("Stock …") or L7 |
| `src/stock.ts`, `src/routes/_staff/stock.tsx` | not edited here; task 1 imports `storeNameQuery` from `./stock`, task 5 links to `/stock` with `store` and `lowStock` | if either has another name or shape on main, stop: the team lead revises the two sites |
| `src/routes/__root.tsx`, `src/refetch-notice.tsx` (L7) | not edited here | three tests assert L7's notice text "Could not refresh. Showing what was loaded last."; if L7 lands with other words, the team lead changes the four strings (three tests and the sheet) |
| `src/routes/_staff/index.tsx`, `src/routes/_staff/orders.tsx` | L7 does not touch the two placeholders (checked at 0aa0ab1) | replaced whole by tasks 5 and 1 |
| `src/idle.ts` vs the `idle` constant in `stock.tsx` | duplicate, not a conflict | left for a later lane |
| `e2e/catalog.spec.ts` | neither lane touches it | append as written |

Counts: the admin suite on e6d8e4b alone is `95 passed`; with admin-stock at d106b53 `160`; on L7's branch at 0aa0ab1 `180 passed (180)` in 17 files. Every count in tasks.md is "base + n" with base 180 in brackets; if the rebased branch starts elsewhere, only the base moves. Playwright: base + 3 (two in `orders.spec.ts`, one in `catalog.spec.ts`).

Not buildable before the rebase: task 1 needs `storeNameQuery` and the root notice, task 5 the typed `/stock` search. Step 0 of brief 1 checks both.

## Tests (scenario -> test)
Test files: B `src/orders-board.test.tsx`, R `src/orders-rules.test.ts`, S `src/orders-status.test.tsx`, D `src/order-sheet.test.tsx`, H `src/orders-history.test.tsx`, X `src/dashboard.test.tsx`, E `e2e/orders.spec.ts`, C `e2e/catalog.spec.ts`.

| Requirement › Scenario | Test | Task |
|---|---|---|
| Orders board › Board listed | B "the board shows a column per active status with each order's number, time since placed, item count, total and pincode"; R "the item count of a card is the quantities added up" | 1 |
| Orders board › Orders placed in the same second | B "cards are in the order the orders were placed, also within one second and whatever the digits core trimmed" | 2 |
| Orders board › Column name | B "a column is named by its status and how many orders it holds" | 2 |
| Orders store for admins › Choose a store | B "choosing a store puts it in the URL and never shows or announces the other store's orders" | 1 |
| Orders store for admins › Store in the URL | B "a store in the URL is the one shown, and one that is not a store shows the first store" | 1 |
| Orders store for store staff › Store staff see their own store | B "store staff see the board of their own store by name, with no store selector and no stores request" | 1 |
| Orders store for store staff › Store name unavailable | B "store staff get the board without a store name when the name cannot be read" | 1 |
| Orders board polling › Poll | B "the board asks core again every 10 seconds and shows an order where it now stands" | 1 |
| Orders board polling › Hidden tab | B "a hidden tab is not polled, and showing it again asks core at once" | 1 |
| Orders board polling › Board left | B "the poll stops when the board is left" | 2 |
| Orders board announcements › New placed order announced once | B "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing" | 1 |
| Orders announced only while the board is open › Back to a store | B "coming back to a store announces nothing for an order placed while its board was away" | 2 |
| Orders announced only while the board is open › Back to the orders page | B "leaving the orders page and coming back announces nothing for an order placed meanwhile" | 2 |
| Orders announced only while the board is open › First refresh after coming back fails | B "orders kept from an earlier visit are no baseline when the first refresh after coming back fails" | 2 |
| Orders announced only while the board is open › Placed while the tab was hidden | B "an order placed while the tab was hidden is announced when the tab shows again" | 2 |
| Orders time since placed › A minute passes | B "the time since placed moves on without core being asked" | 1 |
| Orders time since placed › Wording | R "an order placed %i seconds ago reads %j" (8 runs) | 1 |
| Orders board states › Board loading | B "the board shows a skeleton while loading" | 1 |
| Orders board states › Board load failure | B "a board that cannot be loaded offers a retry that reloads" | 1 |
| Orders board states › One list fails on the first load | B "one of the five requests failing on the first load is a board that could not be loaded" | 2 |
| Orders board states › No active orders | B "a store with no active orders shows the empty state" | 1 |
| Orders board states › No stores | B "an admin with no stores is told to create one" | 1 |
| Orders board states › Stores load failure | B "stores that cannot be loaded offer a retry that reloads" | 1 |
| Orders kept on a failed refresh › Failed poll keeps the board | B "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new" | 1 |
| Orders kept on a failed refresh › One list fails on a later poll | B "one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh" | 2 |
| Orders kept on a failed refresh › Failed refresh keeps the sheet | D "a failed refresh keeps the order on the sheet and says it could not refresh" | 3 |
| Orders kept on a failed refresh › Failed refresh keeps the history | H "a failed refresh keeps the history list; the next good answer shows what core then holds" | 4 |
| Order next status › One button per card | S "each card has one button, for the next status of its order, named with the order number" | 2 |
| Order next status › Accept | S "a press sends the next status once, moves the card with core's answer and says so, without listing the orders again" | 2 |
| Order status change in progress › Second press during a change | S "while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card's button send nothing" | 2 |
| Order status change in progress › Focus after a move | S "after a move the keyboard is on the card's new button" | 2 |
| Order status change in progress › Result named | S "the keyboard after a delivery is on a result named for what it holds" | 3 (step A) |
| Order delivered asks first › Mark delivered | S "Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result" | 2 |
| Order status conflict › Accepted by someone else, Cancelled by the customer | S "a 409 reads the order again, shows it where it stands and says someone else changed it" | 2 |
| Order status failure › Status change fails | S "a status change that fails says so, leaves the card where it is and can be tried again" | 2 |
| Order status failure › Conflict that cannot be read | S "a 409 whose order cannot be read again is a failed status change" | 2 |
| Order status change and a poll in the air › Late poll answer | S "a poll answer read before a status change never moves the card back" | 2 |
| Order cancel and a poll in the air › Late poll answer after a cancel | D "a poll answer read before a cancel never puts the order back on the board" | 3 |
| Order detail sheet › Order opened from its card | D "a card's number opens the order: status, items, totals, customer with phone, address and events" | 3 |
| Order detail sheet › Sheet closed | D "closing the sheet puts the keyboard back on the card" | 3 |
| Order sheet follows core › Order changed since the last poll | D "the sheet shows the order as core holds it, not as the card did: a second address line, no phone, a note" | 3 |
| Order sheet follows core › Open sheet polled | D "an open sheet follows the order every 10 seconds" | 3 |
| Order sheet follows core › Finished order not polled | H "a history row opens the order without a cancel, read once and not polled" | 4 |
| Order cancel with a reason › Cancel offered | D "only a placed or an accepted order can be cancelled from the sheet" | 3 |
| Order cancel with a reason › Order cancelled | D "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason" | 3 |
| Order cancel with a reason › Reason missing | D "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed" | 3 |
| Order cancel with a reason › Keep order | D "Keep order and Escape close the dialog without sending and bring the sheet back" | 3 |
| Order cancel in progress and refused › Second press during a cancel | D "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays" | 3 |
| Order cancel in progress and refused › Cancel fails | D "a cancel that fails says so in the dialog, keeps the reason and can be tried again" | 3 |
| Order cancel in progress and refused › Cancel refused once packing | D "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board" | 3 |
| Order status badges › Badge of an order under way and of a cancelled one | D "a card's number opens the order: …" (accent) and "a cancel sends the reason as the note once, …" (neutral) | 3 |
| Orders history › Delivered orders listed | H "the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered" | 4 |
| Orders history › Tabs | H "Board and History are tabs held in the URL, and the store stays chosen" | 4 |
| Orders history › Cancelled orders | H "Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows" | 4 |
| Orders history › No finished orders | H "a store with no cancelled orders shows the empty state" | 4 |
| Orders history › History loading and load failure | H "the history shows a skeleton while loading, and a list that cannot be loaded offers a retry that reloads" | 4 |
| Orders history pager › Pager | H "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" | 4 |
| Orders URL values › Unreadable values | H "?%s in the URL is read as %s" (5 runs) | 4 |
| Orders URL values › Over-large page | H "a page in the URL beyond what core accepts is cut to one it does, then to the last page" | 4 |
| Orders history and the store › Store chosen on History | H "choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store's rows" | 4 |
| Orders history and the store › History after a delivery | H "a history page kept from before a status change is read again, never shown as it was" | 4 |
| Dashboard › Dashboard cards | X "an admin sees a card per store in core's order, with today's orders by status and in all, revenue and the low-stock count" | 5 |
| Dashboard › Dashboard links | X "a card links to its store's orders and to its stock filtered to low stock" | 5 |
| Dashboard › Store staff dashboard | X "store staff see the one card core gives them, for their own store" | 5 |
| Dashboard states › Dashboard loading | X "the dashboard shows a skeleton while loading" | 5 |
| Dashboard states › Dashboard load failure | X "a dashboard that cannot be loaded offers a retry that reloads" | 5 |
| Dashboard states › Failed refresh keeps the dashboard | X "a failed refresh keeps the cards; the next good answer shows the new numbers" | 5 |
| Dashboard states › No stores on the dashboard | X "an admin with no stores is told to create one" | 5 |
| Orders against core › Store staff take the placed order to delivered | E "store staff take the placed order to delivered and find it in History" | written 1, run 6 |
| Orders against core › Admin sees the dashboard and a store's orders | E "an admin sees the dashboard cards and opens a store's orders from one" | written 1, run 6 |
| Ordered product against core › Ordered product offers Deactivate instead | C "an ordered product cannot be deleted and offers to be deactivated instead" | written 1, run 6 |

72 scenarios; 79 Vitest runs (68 tests, two of them `test.each`) and 3 Playwright tests.

## Test strategy
- Vitest and Testing Library through `renderApp` (the real router, guard and shell) and `fakeCore` at `fetch`; no mock of a module, of the query client or of the router.
- `ordersCore(storeId, orders)` holds the array the test passes and changes: a test plays another staff member or a customer by replacing an element (`orders[0] = { ...orders[0], status: 'accepted' }`) or pushing an order. The list route reads the array when it is asked and answers after the gate, so a held answer is an old answer, as from a real server. An order pushed after `ordersCore` was called has no `/admin/orders/{id}` routes; no test opens or moves one.
- A held answer is `core.hold(part)` then `core.release(part)`; a failing one `core.fail(part)` then `core.fail(part, false)`; parts are `lists`, `order` (the single read) and `status` (the change, logged in `core.posts` before the gate).
- Fake timers: Decision 26. Only eight tests use them (B poll, announce, hidden tab, failed poll, time; S late poll; D sheet poll; H finished order), each by calling `vi.useFakeTimers({ shouldAdvanceTime: true })` on its first line; `afterEach` restores real timers in every file that uses them.
- A refetch without timers (history, dashboard): a `visibilitychange` event on `window`, which makes TanStack Query refetch stale queries.
- A failed refresh: the trigger (a poll or the event), then `await refreshFailed(router, key)` (Decision 25), then the assertions: the content is still there, there is no alert, and the root's notice shows. The three page tests go through `renderApp`, so the root route and L7's `RefetchNotice` are mounted; they are red without L7 on the branch. The sheet's test looks for the words inside the sheet only.
- What only e2e proves: the five list requests, the status `POST` and the dashboard as the real core answers them; store staff's 404 isolation is core's test, not repeated; axe; the tab strip's contrast.

### e2e
`e2e/orders.spec.ts`, two tests, serial in the file. The first changes the database for good within a run (SS-DEMOAAAD delivered); the reseed in `e2e/global-setup.ts` before every run is what makes it repeatable, and the file's head comment says so. The second test asserts nothing that depends on the first having run or on the time of day. Web's suite runs before admin's inside one `make e2e` and reseeds for itself, so it still sees SS-DEMOAAAD placed.

`e2e/catalog.spec.ts` gets a third test (Decision 10).

Tried in the first spike (before the root-notice ruling, which changed no string or element the specs use) on a scratch `vite preview` (port 25174) against a stateful `page.route` fake of core with a 60 ms answer delay, each of the three tests twice: 6 of 6 passed, axe clean on the board, the sheet, the cancel dialog, the delivered dialog, the result line, History, the history sheet, the dashboard and the delete dialog. The first try failed axe `color-contrast` on the tab strip (A9), fixed by `bg-surface` on the `TabNav`. Not run against the real core or the database: task 6, the manager's slot.

## Mutation guards (for the reviewer; each run on the final tree of the spike on 2026-10-15, task 2 landed and tasks 3 to 5 laid over it, 79 lane tests, only the named tests red, then restored)

| # | Mutation | File | Tests that turn red |
|---|---|---|---|
| G1 | poll interval off | `src/orders.ts` | "a poll answer read before a status change never moves the card back"; "a poll answer read before a cancel never puts the order back on the board"; "the board asks core again every 10 seconds and shows an order where it now stands"; "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing"; "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"; "coming back to a store announces nothing for an order placed while its board was away"; "orders kept from an earlier visit are no baseline when the first refresh after coming back fails"; "one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh"; "the poll stops when the board is left" |
| G2 | poll in a hidden tab | `src/orders.ts` | "a hidden tab is not polled, and showing it again asks core at once"; "an order placed while the tab was hidden is announced when the tab shows again" |
| G3 | first answer announced | `src/order-board.tsx` | "choosing a store puts it in the URL and never shows or announces the other store's orders"; "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing"; "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"; "coming back to a store announces nothing for an order placed while its board was away"; "leaving the orders page and coming back announces nothing for an order placed meanwhile"; "orders kept from an earlier visit are no baseline when the first refresh after coming back fails"; "an order placed while the tab was hidden is announced when the tab shows again" |
| G4 | any new order announced, whatever its status | `src/order-board.tsx` | "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing" |
| G5 | old news kept under a changed answer | `src/order-board.tsx` | "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing" |
| G6 | board error state before data | `src/order-board.tsx` | "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"; "one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh" |
| G8 | board not keyed by store | `src/routes/_staff/orders.tsx` | "choosing a store puts it in the URL and never shows or announces the other store's orders"; "coming back to a store announces nothing for an order placed while its board was away" |
| G9 | store staff ask for the stores | `src/routes/_staff/orders.tsx` | "store staff see the board of their own store by name, with no store selector and no stores request" |
| G10 | columns newest first (`Date.parse(b.placedAt) - Date.parse(a.placedAt)`) | `src/order-board.tsx` | "the board shows a column per active status with each order's number, time since placed, item count, total and pincode"; "cards are in the order the orders were placed, also within one second and whatever the digits core trimmed" |
| G11 | no guard while a status change runs | `src/order-board.tsx` | "while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card's button send nothing" |
| G12 | next button disabled while busy | `src/order-board.tsx` | "while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card's button send nothing" |
| G13 | poll in the air not dropped | `src/orders.ts` | "a poll answer read before a status change never moves the card back"; "a poll answer read before a cancel never puts the order back on the board" |
| G14 | board refetched instead of written | `src/orders.ts` | "a press sends the next status once, moves the card with core's answer and says so, without listing the orders again"; "a 409 reads the order again, shows it where it stands and says someone else changed it"; "a poll answer read before a status change never moves the card back"; "a poll answer read before a cancel never puts the order back on the board" |
| G15 | 409 thrown as a failure | `src/orders.ts` | "a 409 reads the order again, shows it where it stands and says someone else changed it"; "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board" |
| G16 | delivered without asking | `src/order-board.tsx` | "Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result"; "the keyboard after a delivery is on a result named for what it holds"; "a history page kept from before a status change is read again, never shown as it was" |
| G17 | no focus after a move | `src/order-board.tsx` | "after a move the keyboard is on the card's new button"; "Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result"; "the keyboard after a delivery is on a result named for what it holds" |
| G18 | sheet does not start from the card | `src/order-board.tsx` | "a failed refresh keeps the order on the sheet and says it could not refresh" |
| G7 | no notice on the sheet | `src/order-sheet.tsx` | "a failed refresh keeps the order on the sheet and says it could not refresh" |
| G19 | sheet error state before data | `src/order-sheet.tsx` | "a failed refresh keeps the order on the sheet and says it could not refresh" |
| G20 | cancel offered in every status | `src/order-sheet.tsx` | "a history row opens the order without a cancel, read once and not polled"; "an open sheet follows the order every 10 seconds"; "only a placed or an accepted order can be cancelled from the sheet"; "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason"; "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board" |
| G21 | empty reason sent | `src/order-sheet.tsx` | "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed" |
| G22 | reason error stays on edit | `src/order-sheet.tsx` | "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed" |
| G23 | no guard while a cancel runs | `src/order-sheet.tsx` | "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays" |
| G24 | dialog closable while a cancel runs | `src/order-sheet.tsx` | "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays" |
| G25 | cancel button disabled while pending | `src/order-sheet.tsx` | "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays" |
| G26 | sheet and dialog open together | `src/order-sheet.tsx` | "a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed"; "Keep order and Escape close the dialog without sending and bring the sheet back"; "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason"; "while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays"; "a cancel that fails says so in the dialog, keeps the reason and can be tried again"; "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board"; "a poll answer read before a cancel never puts the order back on the board" |
| G27 | detail cache not written after a change | `src/orders.ts` | "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason"; "a cancel refused with 409 shows where the order stands instead, on the sheet and on the board" |
| G28 | status badge colours | `src/orders.ts` | "a card's number opens the order: status, items, totals, customer with phone, address and events"; "a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason" |
| G29 | finished order polled | `src/orders.ts` | "a history row opens the order without a cancel, read once and not polled" |
| G30 | history keeps the other status's rows | `src/orders.ts` | "Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows" |
| G31 | no placeholder rows at all | `src/orders.ts` | "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" |
| G32 | history not marked busy | `src/order-history.tsx` | "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" |
| G33 | pager prints the URL page | `src/order-history.tsx` | "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" |
| G34 | pager end not guarded | `src/order-history.tsx` | "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" |
| G35 | page not cut | `src/routes/_staff/orders.tsx` | "a page in the URL beyond what core accepts is cut to one it does, then to the last page" |
| G36 | no move to the last page | `src/order-history.tsx` | "a page in the URL beyond what core accepts is cut to one it does, then to the last page" |
| G37 | any status accepted from the URL | `src/routes/_staff/orders.tsx` | "?tab=history&status=placed in the URL is read as delivered orders" |
| G38 | history error state before data | `src/order-history.tsx` | "a failed refresh keeps the history list; the next good answer shows what core then holds" |
| G39 | history not keyed by store | `src/routes/_staff/orders.tsx` | "choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store's rows" |
| G40 | kept lists not dropped after a change | `src/orders.ts` | "a history page kept from before a status change is read again, never shown as it was" |
| G41 | store switch loses the tab | `src/routes/_staff/orders.tsx` | "choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store's rows" |
| G42 | store switch keeps the page | `src/routes/_staff/orders.tsx` | "choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store's rows" |
| G43 | router marks both tabs | `src/routes/_staff/orders.tsx` | "the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered"; "the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number" |
| G44 | dashboard error state before data | `src/routes/_staff/index.tsx` | "a failed refresh keeps the cards; the next good answer shows the new numbers" |
| G45 | low-stock link without the filter | `src/routes/_staff/index.tsx` | "a card links to its store's orders and to its stock filtered to low stock"; "store staff see the one card core gives them, for their own store" |
| G46 | elapsed time read once | `src/orders.ts` | "the time since placed moves on without core being asked" |
| G47 | status change conflict message same as success | `src/order-board.tsx` | "a 409 reads the order again, shows it where it stands and says someone else changed it" |
| G48 | filter change keeps the page | `src/order-history.tsx` | "Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows" |
| G49 | orders kept from an earlier visit are the baseline | `src/order-board.tsx` | "coming back to a store announces nothing for an order placed while its board was away"; "leaving the orders page and coming back announces nothing for an order placed meanwhile"; "orders kept from an earlier visit are no baseline when the first refresh after coming back fails" |
| G50 | a failed first refresh makes the kept orders the baseline | `src/order-board.tsx` | "orders kept from an earlier visit are no baseline when the first refresh after coming back fails" |
| G51 | cards sorted by the time as a string | `src/order-board.tsx` | "cards are in the order the orders were placed, also within one second and whatever the digits core trimmed" |
| G52 | column heading named by its text alone | `src/order-board.tsx` | "a column is named by its status and how many orders it holds" |
| G53 | one list request failing leaves its column empty | `src/orders.ts` | "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"; "a board that cannot be loaded offers a retry that reloads"; "orders kept from an earlier visit are no baseline when the first refresh after coming back fails"; "one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh"; "one of the five requests failing on the first load is a board that could not be loaded" |
| G54 | result of a change unnamed | `src/order-board.tsx` | "the keyboard after a delivery is on a result named for what it holds" |

54 guards, none without a red test. Three had none on the first run (G5, G42, G48: the behaviour converged through another path); the tests gained an assertion each and the guards were run again. G6, G38 and G44 (the alert shown although data is held) are caught by `queryByRole('alert')` after `refreshFailed`. G49 to G53 guard the fixes from the review of task 1. The G54 of the revision of 2026-10-13 removed the same line as G13 and is merged into it (G13 turns both held-poll tests red); G54 is now the unnamed result from the review of task 2 (R2-2). R2-1 has no guard: the closed `Dialog` renders nothing, so its title never reaches the DOM.

## Code and tests per task (spiked; workers copy it byte for byte)

Every block is a whole file unless its heading says otherwise. The blocks were written out to files by a script from the spike's stage directories, and the stages were then built again in order, tests first, with the counts in tasks.md.

### Task 1: the board, read-only: store, polling, announcements, states, and the e2e specs

#### `e2e/orders.spec.ts` (new; written and committed first, run in task 6)

```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed. The e2e database is reset before every run (e2e/global-setup.ts), which this file needs:
// the first test moves the seeded placed order SS-DEMOAAAD (...0703) to delivered, and nothing can move it back.
// SS-DEMOAAAB (...0701) is seeded delivered and SS-DEMOAAAC (...0702) cancelled, all three at Koramangala.
const koramangala = '00000000-0000-4000-8000-000000000401'

async function signIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('store staff take the placed order to delivered and find it in History', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  const nav = page.getByRole('navigation', { name: 'Admin' })
  await nav.getByRole('link', { name: 'Orders' }).click()
  await expect(page.getByText('Store: Koramangala')).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)

  // The card of the seeded order, in the Placed column.
  const card = page.getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })
  await expect(page.getByRole('region', { name: /^Placed/ }).getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })).toBeVisible()
  await expect(card).toContainText('4 items, pincode 560034')
  await expect(card).toContainText('₹1,030')
  await expect(card).toContainText(/\d+ min ago/)
  await expectNoAxeViolations(page)

  // The detail sheet, and its cancel dialog left unused.
  await card.getByRole('button', { name: 'SS-DEMOAAAD', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Order SS-DEMOAAAD' })
  await expect(sheet).toContainText('Demo Customer')
  await expect(sheet.getByRole('link', { name: '+919800000000' })).toBeVisible()
  await expect(sheet).toContainText('Home: 12 80 Feet Rd, Koramangala, 560034')
  await expect(sheet).toContainText('3 × Pomegranate Bhagwa, 1 kg')
  await expect(sheet).toContainText('Placed by the customer')
  await expectNoAxeViolations(page)
  await sheet.getByRole('button', { name: 'Cancel order' }).click()
  const cancel = page.getByRole('dialog', { name: 'Cancel order SS-DEMOAAAD?' })
  await expect(cancel.getByLabel('Reason')).toBeFocused()
  await expectNoAxeViolations(page)
  await cancel.getByRole('button', { name: 'Keep order' }).click()
  await sheet.getByRole('button', { name: 'Close' }).click()

  // One step at a time, as the store does it.
  for (const [button, status] of [['Accept', 'Accepted'], ['Start packing', 'Packing'], ['Mark ready', 'Ready'], ['Send out', 'Out for delivery']]) {
    await page.getByRole('button', { name: `${button} SS-DEMOAAAD` }).click()
    await expect(page.getByRole('status').filter({ hasText: `SS-DEMOAAAD is now ${status}.` })).toBeVisible()
    await expect(page.getByRole('region', { name: new RegExp(`^${status}`) }).getByRole('listitem').filter({ hasText: 'SS-DEMOAAAD' })).toBeVisible()
  }
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Mark delivered SS-DEMOAAAD' }).click()
  const confirm = page.getByRole('dialog', { name: 'Mark SS-DEMOAAAD delivered?' })
  await expectNoAxeViolations(page)
  await confirm.getByRole('button', { name: 'Mark delivered' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'SS-DEMOAAAD is now Delivered.' })).toBeVisible()
  await expect(card).toHaveCount(0)
  await expectNoAxeViolations(page)

  // History: delivered now holds it next to the seeded delivered order; cancelled holds the seeded cancelled one.
  await page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'History' }).click()
  const history = page.getByRole('table', { name: 'Order history' })
  await expect(history.getByRole('button', { name: 'SS-DEMOAAAD' })).toBeVisible()
  await expect(history.getByRole('button', { name: 'SS-DEMOAAAB' })).toBeVisible()
  await expectNoAxeViolations(page)
  await history.getByRole('button', { name: 'SS-DEMOAAAD' }).click()
  await expect(sheet).toContainText('Delivered by staff')
  await expect(sheet.getByRole('button', { name: 'Cancel order' })).toHaveCount(0)
  await expectNoAxeViolations(page)
  await sheet.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Cancelled' }).click()
  await expect(history.getByRole('button')).toHaveText(['SS-DEMOAAAC'])
  await page.reload()
  await expect(history.getByRole('button')).toHaveText(['SS-DEMOAAAC'])
  await expect(page).toHaveURL(/\/admin\/orders\?tab=history&status=cancelled$/)
})

test('an admin sees the dashboard cards and opens a store\'s orders from one', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Indiranagar', 'Koramangala'])
  const store = page.getByRole('region', { name: 'Koramangala' })
  await expect(store).toContainText('Orders today')
  await expect(store).toContainText('Revenue today')
  await expect(store).toContainText(/Low stock\d+ products/)
  await expect(store.getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/admin/stock?store=${koramangala}&lowStock=true`)
  await expectNoAxeViolations(page)

  await store.getByRole('link', { name: 'Orders at Koramangala' }).click()
  await expect(page).toHaveURL(new RegExp(`/admin/orders\\?store=${koramangala}$`))
  await expect(page.getByLabel('Store', { exact: true }).locator('option:checked')).toHaveText('Koramangala')
  await expect(page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'Board' })).toHaveAttribute('aria-current', 'page')
  await page.getByRole('navigation', { name: 'Orders' }).getByRole('link', { name: 'History' }).click()
  await expect(page.getByRole('table', { name: 'Order history' }).getByRole('button', { name: 'SS-DEMOAAAB' })).toBeVisible()
  await expectNoAxeViolations(page)
})
```

#### `e2e/catalog.spec.ts` (append this test at the end of the file, after one empty line; change nothing above; same commit as `e2e/orders.spec.ts`)

```ts
// Banana Robusta (...0601) is on the seeded orders, so core refuses to delete it. The offer is checked and not taken:
// other specs and the customer site's suite rely on the product staying active.
test('an ordered product cannot be deleted and offers to be deactivated instead', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.goto('./products/00000000-0000-4000-8000-000000000601')
  await expect(page.getByRole('heading', { level: 1, name: 'Banana Robusta' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete product' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete Banana Robusta?' })
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.')
  await expect(dialog.getByRole('button')).toHaveText(['Cancel', 'Deactivate instead'])
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Banana Robusta' })).toBeVisible()
})
```

#### `src/orders-fake.ts` (new; test-only helpers, used by every later task and never changed)

```ts
import { notifyManager, type QueryClient, type QueryKey } from '@tanstack/react-query'
import { act, waitFor } from '@testing-library/react'
import { expect } from 'vitest'
import type { Order, OrderStatus } from './orders'
import { apiError, indiranagar, json } from './fake-core'

// Test-only: orders as core serves them to staff, and one store's order routes with core's status table.
export const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// Order `n` (1 to 99) of Indiranagar unless `over` says otherwise: number SS-TEST000n, one Banana Robusta and three Pomegranate Bhagwa (4 items, ₹1,030), placed `n` minutes ago.
export function order(n: number, status: OrderStatus, over: Partial<Order> = {}): Order {
  return {
    id: `00000000-0000-4000-8000-0000000007${String(n).padStart(2, '0')}`,
    number: `SS-TEST${String(n).padStart(4, '0')}`,
    storeId: indiranagar.id,
    status,
    customerName: 'Demo Customer',
    customerPhone: '+919800000000',
    address: { label: 'Home', line1: '12 80 Feet Rd, Koramangala', pincode: '560034' },
    subtotalCents: 103000,
    deliveryFeeCents: 0,
    totalCents: 103000,
    paymentMethod: 'cod',
    placedAt: minutesAgo(n),
    items: [
      { productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 7000, mrpCents: 7000, quantity: 1 },
      { productId: '00000000-0000-4000-8000-000000000604', name: 'Pomegranate Bhagwa', unitLabel: '1 kg', priceCents: 32000, mrpCents: 32000, quantity: 3 },
    ],
    events: [{ toStatus: 'placed', actorType: 'customer', createdAt: minutesAgo(n) }],
    ...over,
  }
}

// services/core/internal/order/status.go
const moves: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ['accepted', 'cancelled'],
  accepted: ['packing', 'cancelled'],
  packing: ['ready'],
  ready: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
}

type Part = 'lists' | 'order' | 'status'

// `orders` is what core holds, and a test may change it (another staff member acting, a customer placing an order).
// `posts` logs every status change asked for. `hold(part)` makes that part's answers wait until `release(part)`;
// `fail(part)` makes them 500 until `fail(part, false)`. Each order in `orders` when this is called gets its two routes.
export function ordersCore(storeId: string, orders: Order[]) {
  const posts: { id: string; body: unknown }[] = []
  const gates: Partial<Record<Part, { wait: Promise<void>; open: () => void }>> = {}
  const failing = new Set<Part>()
  const pass = async (part: Part) => {
    await gates[part]?.wait
    return failing.has(part) ? apiError(500, 'internal') : undefined
  }
  const routes: Record<string, (request: Request) => Promise<Response>> = {
    [`GET /admin/stores/${storeId}/orders`]: async (request) => {
      // Read first, answer later: a held answer carries the orders as they were when core was asked.
      const read = [...orders]
      const refused = await pass('lists')
      if (refused) return refused
      const query = new URL(request.url).searchParams
      const page = Number(query.get('page') ?? 1)
      const pageSize = Number(query.get('pageSize') ?? 24)
      const match = read.filter((order) => !query.get('status') || order.status === query.get('status')).sort((a, b) => b.placedAt.localeCompare(a.placedAt))
      return json(200, { items: match.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: match.length })
    },
  }
  for (const { id } of orders) {
    const held = () => orders.find((order) => order.id === id)!
    routes[`GET /admin/orders/${id}`] = async () => (await pass('order')) ?? json(200, held())
    routes[`POST /admin/orders/${id}/status`] = async (request) => {
      const body = (await request.json()) as { status: OrderStatus; note?: string }
      posts.push({ id, body })
      const refused = await pass('status')
      if (refused) return refused
      const current = held()
      if (!moves[current.status]?.includes(body.status)) return apiError(409, 'conflict', `cannot move an order from ${current.status} to ${body.status}`)
      const now = new Date().toISOString()
      const moved: Order = {
        ...current,
        status: body.status,
        events: [...current.events, { fromStatus: current.status, toStatus: body.status, actorType: 'staff', ...(body.note ? { note: body.note } : {}), createdAt: now }],
        ...(body.status === 'delivered' ? { deliveredAt: now } : {}),
        ...(body.status === 'cancelled' ? { cancelledAt: now, ...(body.note ? { cancelReason: body.note } : {}) } : {}),
      }
      orders[orders.indexOf(current)] = moved
      return json(200, moved)
    }
  }
  return {
    posts,
    routes,
    hold(part: Part) {
      let open = () => {}
      gates[part] = { wait: new Promise<void>((resolve) => (open = resolve)), open }
    },
    release(part: Part) {
      gates[part]?.open()
      delete gates[part]
    },
    fail(part: Part, on = true) {
      if (on) failing.add(part)
      else failing.delete(part)
    },
  }
}

// Resolves once a refresh of `key` has failed with its data kept AND the page has been told. TanStack Query tells its
// observers one turn after the answer: without the second wait the assertions that follow would look at the page as it
// was before the failure, and pass whatever the page does with it.
export async function refreshFailed(router: { options: { context: { queryClient: QueryClient } } }, key: QueryKey) {
  const client = router.options.context.queryClient
  await waitFor(() => expect(client.getQueryState(key)).toMatchObject({ status: 'error', fetchStatus: 'idle' }))
  expect(client.getQueryData(key)).toBeDefined()
  await act(() => new Promise<void>((told) => notifyManager.schedule(told)))
}

// The status and page size of every order list request, in the order core got them.
export function listRequests(calls: Request[]) {
  return calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/orders')).map((call) => Object.fromEntries(new URL(call.url).searchParams))
}
```

#### `src/orders-board.test.tsx` (new)

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { listRequests, order, ordersCore, refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const news = () => screen.getByRole('status', { name: 'New orders' })

// Fake timers for one test, for the 10 s poll. `shouldAdvanceTime` lets the fake clock also run with the real one, so
// Testing Library's `findBy` and `waitFor` (which wait on timers) keep working; `poll()` jumps the clock one interval.
function useFakeClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
}
const poll = (ms = 10_000) => act(() => vi.advanceTimersByTimeAsync(ms))

test('the board shows a column per active status with each order\'s number, time since placed, item count, total and pincode', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [
    order(1, 'placed'),
    order(2, 'placed', { address: { label: 'Work', line1: '100 Feet Rd', pincode: '560038' }, totalCents: 4550, items: [{ productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 4550, mrpCents: 7000, quantity: 1 }] }),
    order(3, 'accepted'),
    order(4, 'out_for_delivery', { placedAt: new Date(Date.now() - 125 * 60_000).toISOString() }),
    order(5, 'delivered'),
    order(6, 'cancelled'),
  ])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: /^Placed/ })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Placed2', 'Accepted1', 'Packing0', 'Ready0', 'Out for delivery1'])
  // The longest waiting order is first in its column.
  const placed = within(column('Placed')).getAllByRole('listitem')
  expect(placed.map((card) => within(card).getByText(/^SS-/).textContent)).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(placed[0]).toHaveTextContent('2 min ago')
  expect(placed[0]).toHaveTextContent('1 item, pincode 560038')
  expect(placed[0]).toHaveTextContent('₹45.50')
  expect(placed[1]).toHaveTextContent('1 min ago')
  expect(placed[1]).toHaveTextContent('4 items, pincode 560034')
  expect(placed[1]).toHaveTextContent('₹1,030')
  expect(within(column('Out for delivery')).getByRole('listitem')).toHaveTextContent('2 h 5 min ago')
  expect(within(column('Packing')).getByText('No orders')).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0005')).not.toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0006')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  // Core lists one status per request: five requests, the largest page each.
  expect(listRequests(calls)).toEqual(['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'].map((status) => ({ status, pageSize: '100' })))
})

test('store staff see the board of their own store by name, with no store selector and no stores request', async () => {
  setToken('tok')
  const own = storeStaff.storeId!
  const calls = fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET /stores/${own}`]: () => json(200, { id: own, name: 'Whitefield', isOpen: true, deliveryFeeCents: 2500, freeDeliveryAboveCents: 19900, minOrderCents: 9900, promisedMinutes: 10 }),
    ...ordersCore(own, [order(1, 'placed', { storeId: own })]).routes,
  })

  renderApp(`/orders?store=${koramangala.id}`)

  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(await screen.findByText('Whitefield')).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect([...new Set(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', '')))].sort()).toEqual(['/admin/me', `/admin/stores/${own}/orders`, `/stores/${own}`])
})

test('store staff get the board without a store name when the name cannot be read', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff), ...ordersCore(storeStaff.storeId!, [order(1, 'placed', { storeId: storeStaff.storeId })]).routes })

  renderApp('/orders')

  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.queryByText(/^Store:/)).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store in the URL is the one shown, and one that is not a store shows the first store', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes, ...ordersCore(koramangala.id, [order(2, 'placed', { storeId: koramangala.id })]).routes })

  const router = renderApp(`/orders?store=${koramangala.id}`)
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)

  await act(() => router.navigate({ to: '/orders', search: { store: 'nope' } }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
})

test('choosing a store puts it in the URL and never shows or announces the other store\'s orders', async () => {
  setToken('tok')
  const other = ordersCore(koramangala.id, [order(2, 'placed', { storeId: koramangala.id })])
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes, ...other.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  other.hold('lists')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  other.release('lists')
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  // The orders the other store already had are not new orders.
  expect(news()).toBeEmptyDOMElement()
  expect(screen.getByLabelText('Store')).toHaveFocus()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
})

test('the board asks core again every 10 seconds and shows an order where it now stands', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(listRequests(calls)).toHaveLength(5)

  // Another staff member accepts it.
  orders[0] = { ...orders[0], status: 'accepted' }
  await poll(9_000)
  expect(listRequests(calls)).toHaveLength(5)
  await poll(1_000)
  expect(listRequests(calls)).toHaveLength(10)
  await waitFor(() => expect(within(column('Accepted')).getByText('SS-TEST0001')).toBeInTheDocument())
  expect(within(column('Placed')).getByText('No orders')).toBeInTheDocument()
})

test('a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  expect(news()).toBeEmptyDOMElement()
  expect(news()).toHaveClass('sr-only')

  orders.push(order(2, 'placed'), order(3, 'accepted'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0002$/))
  expect(screen.getByText('SS-TEST0003')).toBeInTheDocument()

  // The same answer again: the region is not written again, so nothing is read out twice.
  const written = vi.fn()
  const observer = new MutationObserver(written)
  observer.observe(news(), { childList: true, characterData: true, subtree: true })
  await poll()
  await poll()
  expect(news()).toHaveTextContent(/^New order SS-TEST0002$/)
  expect(written).not.toHaveBeenCalled()
  observer.disconnect()

  // A changed answer with no new order empties the region, ready for the next news.
  orders[2] = { ...orders[2], status: 'packing' }
  await poll()
  await waitFor(() => expect(news()).toBeEmptyDOMElement())

  orders.push(order(4, 'placed'), order(5, 'placed'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^2 new orders: SS-TEST0004, SS-TEST0005$/))
})

test('a hidden tab is not polled, and showing it again asks core at once', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await poll(30_000)
  expect(listRequests(calls)).toHaveLength(5)

  visibility.mockReturnValue('visible')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(listRequests(calls)).toHaveLength(10))
})

test('a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('lists')
  orders.push(order(2, 'placed'))
  await poll()
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  // The alert is for a board with nothing to show; this one keeps its order. (The root of the app says a refresh failed.)
  expect(screen.getByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: /^Placed/ })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  expect(screen.queryByText('SS-TEST0002')).not.toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()

  core.fail('lists', false)
  await poll()
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
  expect(news()).toHaveTextContent(/^New order SS-TEST0002$/)
})

test('the time since placed moves on without core being asked', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(3, 'placed')]).routes })

  renderApp('/orders')
  expect(await screen.findByText('3 min ago')).toBeInTheDocument()
  const asked = calls.length
  await poll(9_000)
  expect(calls).toHaveLength(asked)
  await poll(56_000)
  expect(screen.getByText('4 min ago')).toBeInTheDocument()
})

test('the board shows a skeleton while loading', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  core.hold('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Store')).toHaveValue(indiranagar.id)
  core.release('lists')
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
})

test('a board that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  core.fail('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  core.fail('lists', false)
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store with no active orders shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(5, 'delivered')]).routes })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: 'No active orders' })).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/orders')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(listRequests(calls)).toEqual([])
})

test('stores that cannot be loaded offer a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([indiranagar])),
    ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes,
  })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('SS-TEST0001')).toBeInTheDocument()
})
```

#### `src/orders-rules.test.ts` (new)

```ts
import { expect, test } from 'vitest'
import { itemCount, since } from './orders'
import { order } from './orders-fake'

const placed = '2026-10-13T09:20:00Z'
const after = (seconds: number) => Date.parse(placed) + seconds * 1000

test.each([
  [0, 'just now'],
  [59, 'just now'],
  [60, '1 min ago'],
  [599, '9 min ago'],
  [3599, '59 min ago'],
  [3600, '1 h 0 min ago'],
  [7500, '2 h 5 min ago'],
  [-30, 'just now'],
])('an order placed %i seconds ago reads %j', (seconds, text) => {
  expect(since(placed, after(seconds))).toBe(text)
})

test('the item count of a card is the quantities added up', () => {
  expect(itemCount(order(1, 'placed'))).toBe('4 items')
  expect(itemCount({ ...order(1, 'placed'), items: [order(1, 'placed').items[0]] })).toBe('1 item')
})
```

#### `src/orders.ts` (new)

```ts
import { queryOptions } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
// What the URL of /orders holds. Absent means: the first store (admins).
export type OrdersSearch = { store?: string }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
// The statuses with a column, in the order an order moves through them (services/core/internal/order/status.go).
export const activeStatuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const satisfies readonly OrderStatus[]
export const statusLabel: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

async function listOrders(storeId: string, query: { status: OrderStatus; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// Core lists one status per request, so the board is five requests, answered together or not at all.
// ponytail: a column holds the newest 100 orders of its status (core's largest page); ask core for an "active" filter with a total if a store ever has more waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: async () => (await Promise.all(activeStatuses.map((status) => listOrders(storeId, { status, pageSize: 100 })))).flatMap((list) => list.items),
    refetchInterval: pollMs,
  })

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(placedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
```

#### `src/order-board.tsx` (new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, EmptyState, ErrorBanner, Price, Skeleton } from '@shopperstop/ui'
import { activeStatuses, boardQuery, itemCount, statusLabel, useSince, type Order } from './orders'

// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink tabular-nums">{order.number}</span>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      <Price cents={order.totalCents} />
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  if (board.data && heard?.from !== board.data) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? board.data.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: board.data, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data
  return (
    <>
      <p role="status" aria-label="New orders" className="sr-only">{heard?.news}</p>
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first.
            const column = orders.filter((order) => order.status === status).sort((a, b) => a.placedAt.localeCompare(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
```

#### `src/routes/_staff/orders.tsx` (replace the whole placeholder file)

```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, ErrorBanner, FormField, PageHeader, Select, Skeleton } from '@shopperstop/ui'
import { OrderBoard } from '../../order-board'
import type { OrdersSearch } from '../../orders'
import { storeNameQuery } from '../../stock'
import { storesQuery } from '../../stores'

function Orders() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  // Store staff get no selector; their store's name is shown when it can be read, and left out when it cannot.
  const ownStore = useQuery({ ...storeNameQuery(staff.storeId ?? ''), enabled: !!staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = staff.storeId ?? items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" />
      {!staff.storeId && stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="list" count={5} />
        )
      ) : storeId ? (
        <>
          {ownStore.data && (
            <p className="text-body text-ink">
              Store: <span className="font-semibold">{ownStore.data}</span>
            </p>
          )}
          {!staff.storeId && (
            <Card className="flex flex-wrap items-end gap-4 p-4">
              <FormField label="Store">
                <Select value={storeId} onChange={(event) => void navigate({ search: { store: event.target.value } })}>
                  {items.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </Select>
              </FormField>
            </Card>
          )}
          <OrderBoard key={storeId} storeId={storeId} />
        </>
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then its orders show here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/orders')({
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
  }),
  component: Orders,
})
```

### Task 2: review fixes (step A), then status actions (step B)

Step A, from the review of task 1 (`.claude/lanes/admin-P2-L5-R1.md`; Decisions 27 to 30).

#### `src/orders-board.test.tsx` (step A: append this block at the end of the file; it starts with one empty line; change nothing above)

```tsx

// From the review of task 1.
// Another list request fails for one status only, while `failing.status` names it.
function oneStatusFails(storeId: string, routes: Record<string, (request: Request) => Promise<Response>>) {
  const failing: { status?: string } = {}
  const key = `GET /admin/stores/${storeId}/orders`
  const lists = async (request: Request) => (new URL(request.url).searchParams.get('status') === failing.status ? apiError(500, 'internal') : routes[key](request))
  return { failing, routes: { ...routes, [key]: lists } }
}

test('coming back to a store announces nothing for an order placed while its board was away', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes, ...ordersCore(koramangala.id, [order(9, 'placed', { storeId: koramangala.id })]).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await user.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await screen.findByText('SS-TEST0009')
  orders.push(order(2, 'placed'))
  await user.selectOptions(screen.getByLabelText('Store'), indiranagar.id)

  // The orders kept from the first visit show at once; the order placed since then arrives with the board's first answer.
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
  // From here on the board is open, and a new order is news.
  orders.push(order(3, 'placed'))
  await poll()
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0003$/))
})

test('leaving the orders page and coming back announces nothing for an order placed meanwhile', async () => {
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  orders.push(order(2, 'placed'))
  await act(() => router.navigate({ to: '/orders' }))

  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
})

test('orders kept from an earlier visit are no baseline when the first refresh after coming back fails', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  orders.push(order(2, 'placed'))
  core.fail('lists')
  await act(() => router.navigate({ to: '/orders' }))
  await screen.findByText('SS-TEST0001')
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  core.fail('lists', false)
  await poll()
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(news()).toBeEmptyDOMElement()
})

test('an order placed while the tab was hidden is announced when the tab shows again', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed')]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  orders.push(order(2, 'placed'))
  await poll(30_000)
  expect(news()).toBeEmptyDOMElement()

  // The board stayed open: what came in while nobody looked is news.
  visibility.mockReturnValue('visible')
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(news()).toHaveTextContent(/^New order SS-TEST0002$/))
})

test('cards are in the order the orders were placed, also within one second and whatever the digits core trimmed', async () => {
  setToken('tok')
  // As core writes them: no fraction, ".5" and ".501" of the same second. As strings they sort 3, 2, 1.
  fakeCore({
    ...asAdmin,
    ...ordersCore(indiranagar.id, [
      order(1, 'placed', { placedAt: '2026-10-13T09:20:00Z' }),
      order(2, 'placed', { placedAt: '2026-10-13T09:20:00.5Z' }),
      order(3, 'placed', { placedAt: '2026-10-13T09:20:00.501Z' }),
    ]).routes,
  })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  expect(within(column('Placed')).getAllByRole('listitem').map((card) => within(card).getByText(/^SS-/).textContent)).toEqual(['SS-TEST0001', 'SS-TEST0002', 'SS-TEST0003'])
})

test('a column is named by its status and how many orders it holds', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'placed'), order(3, 'accepted')]).routes })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.getAttribute('aria-label'))).toEqual(['Placed, 2 orders', 'Accepted, 1 order', 'Packing, 0 orders', 'Ready, 0 orders', 'Out for delivery, 0 orders'])
  expect(within(screen.getByRole('region', { name: 'Accepted, 1 order' })).getByText('SS-TEST0003')).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Placed, 2 orders' })).toHaveTextContent(/^Placed2$/)
})

test('one of the five requests failing on a later poll keeps the whole board, with the notice that it could not refresh', async () => {
  useFakeClock()
  setToken('tok')
  const orders = [order(1, 'placed'), order(2, 'ready')]
  const core = oneStatusFails(indiranagar.id, ordersCore(indiranagar.id, orders).routes)
  fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // The placed order is accepted elsewhere, and core cannot list the ready orders.
  orders[0] = { ...orders[0], status: 'accepted' }
  core.failing.status = 'ready'
  await poll()
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'board'])

  // No column of the new answer next to columns of the old one: the board is as it was.
  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(within(column('Ready')).getByText('SS-TEST0002')).toBeInTheDocument()
  expect(within(column('Accepted')).getByText('No orders')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
})

test('one of the five requests failing on the first load is a board that could not be loaded', async () => {
  setToken('tok')
  const core = oneStatusFails(indiranagar.id, ordersCore(indiranagar.id, [order(1, 'placed')]).routes)
  core.failing.status = 'packing'
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})

test('the poll stops when the board is left', async () => {
  useFakeClock()
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  const router = renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await poll()
  expect(listRequests(calls)).toHaveLength(10)
  await act(() => router.navigate({ to: '/' }))
  await screen.findByRole('heading', { level: 1, name: 'Dashboard' })
  await poll(30_000)

  expect(listRequests(calls)).toHaveLength(10)
})
```

#### `src/order-board.tsx` (step A: replace the whole file)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Card, EmptyState, ErrorBanner, Price, Skeleton } from '@shopperstop/ui'
import { activeStatuses, boardQuery, itemCount, statusLabel, useSince, type Order } from './orders'

// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order }: { order: Order }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold text-ink tabular-nums">{order.number}</span>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      <Price cents={order.totalCents} />
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  // Only an answer core gave since this board was opened counts: orders kept from an earlier visit (the cache shows them
  // at once) are not a baseline, or what was placed while the board was away would be read out on opening it.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  if (board.data && board.isFetchedAfterMount && !board.isError && heard?.from !== board.data) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? board.data.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: board.data, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data
  return (
    <>
      <p role="status" aria-label="New orders" className="sr-only">{heard?.news}</p>
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first, by the time itself: core trims zeros, so the strings do not sort ("…00.5Z", "…00.25Z").
            const column = orders.filter((order) => order.status === status).sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} aria-label={`${statusLabel[status]}, ${column.length === 1 ? '1 order' : `${column.length} orders`}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </>
  )
}
```

Step B, the status actions.

#### `src/orders-status.test.tsx` (step B: new)

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, fakeCore, indiranagar, json, storeList } from './fake-core'
import { listRequests, order, ordersCore } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar]) }
const column = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) })
const button = (name: string) => screen.getByRole('button', { name })

test('each card has one button, for the next status of its order, named with the order number', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'accepted'), order(3, 'packing'), order(4, 'ready'), order(5, 'out_for_delivery')]).routes })

  renderApp('/orders')

  await screen.findByText('SS-TEST0001')
  const names = ['Accept SS-TEST0001', 'Start packing SS-TEST0002', 'Mark ready SS-TEST0003', 'Send out SS-TEST0004', 'Mark delivered SS-TEST0005']
  ;['Placed', 'Accepted', 'Packing', 'Ready', 'Out for delivery'].forEach((name, i) => {
    expect(within(column(name)).getAllByRole('button', { name: /^(Accept|Start packing|Mark ready|Send out|Mark delivered) / })).toEqual([within(column(name)).getByRole('button', { name: names[i] })])
  })
})

test('a press sends the next status once, moves the card with core\'s answer and says so, without listing the orders again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toHaveAttribute('role', 'status')
  expect(within(column('Accepted')).getByRole('button', { name: 'Start packing SS-TEST0001' })).toBeInTheDocument()
  expect(within(column('Placed')).getAllByRole('listitem')).toHaveLength(1)
  expect(core.posts).toEqual([{ id: order(1, 'placed').id, body: { status: 'accepted' } }])
  expect(listRequests(calls)).toHaveLength(5)
})

test('while a status change runs the pressed button reads Saving…, keeps focus and is never disabled; a second press and another card\'s button send nothing', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed'), order(2, 'accepted')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.hold('status')
  await userEvent.click(button('Accept SS-TEST0001'))

  const pressed = await screen.findByRole('button', { name: 'Saving… SS-TEST0001' })
  expect(pressed).toHaveFocus()
  expect(pressed).toBeEnabled()
  expect(pressed).toHaveAttribute('aria-disabled', 'true')
  expect(button('Start packing SS-TEST0002')).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(pressed)
  await userEvent.click(button('Start packing SS-TEST0002'))
  expect(core.posts).toHaveLength(1)

  core.release('status')
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
  expect(button('Start packing SS-TEST0002')).toHaveAttribute('aria-disabled', 'false')
})

test('after a move the keyboard is on the card\'s new button', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [order(1, 'placed')]).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Accept SS-TEST0001'))

  await waitFor(() => expect(button('Start packing SS-TEST0001')).toHaveFocus())
})

test('Mark delivered asks first: Cancel sends nothing, confirming takes the order off the board and the keyboard goes to the result', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery'), order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Mark delivered SS-TEST0001'))
  const dialog = screen.getByRole('dialog', { name: 'Mark SS-TEST0001 delivered?' })
  expect(within(dialog).getAllByRole('button').map((each) => each.textContent)).toEqual(['Cancel', 'Mark delivered'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(core.posts).toEqual([])
  expect(button('Mark delivered SS-TEST0001')).toHaveFocus()

  await userEvent.click(button('Mark delivered SS-TEST0001'))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))

  const said = await screen.findByText('SS-TEST0001 is now Delivered.')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(core.posts).toEqual([{ id: order(1, 'placed').id, body: { status: 'delivered' } }])
  await waitFor(() => expect(said.parentElement).toHaveFocus())
})

test('a 409 reads the order again, shows it where it stands and says someone else changed it', async () => {
  setToken('tok')
  const orders = [order(1, 'placed'), order(2, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // Another staff member accepted the first order and the customer cancelled the second; this board has not polled since.
  orders[0] = { ...orders[0], status: 'accepted' }
  orders[1] = { ...orders[1], status: 'cancelled' }
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByText('SS-TEST0001 was changed by someone else first: it is now Accepted.')).toHaveAttribute('role', 'status')
  expect(within(column('Accepted')).getByRole('button', { name: 'Start packing SS-TEST0001' })).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
  expect(calls.filter((call) => call.method === 'GET' && call.url.endsWith(`/admin/orders/${orders[0].id}`))).toHaveLength(1)

  await userEvent.click(button('Accept SS-TEST0002'))
  expect(await screen.findByText('SS-TEST0002 was changed by someone else first: it is now Cancelled.')).toBeInTheDocument()
  expect(screen.queryByText('SS-TEST0002')).not.toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a status change that fails says so, leaves the card where it is and can be tried again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('status')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the status of SS-TEST0001. Try again.')
  expect(within(column('Placed')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(button('Accept SS-TEST0001')).toHaveFocus()

  core.fail('status', false)
  await userEvent.click(button('Accept SS-TEST0001'))
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.posts).toHaveLength(2)
})

test('a 409 whose order cannot be read again is a failed status change', async () => {
  setToken('tok')
  const orders = [order(1, 'placed')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  orders[0] = { ...orders[0], status: 'accepted' }
  core.fail('order')
  await userEvent.click(button('Accept SS-TEST0001'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not change the status of SS-TEST0001. Try again.')
  expect(screen.queryByText(/is now/)).not.toBeInTheDocument()
})

test('a poll answer read before a status change never moves the card back', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // The poll leaves, and core reads the order as placed; its answer is still in the air when the press is answered.
  core.hold('lists')
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(listRequests(calls)).toHaveLength(10)
  await user.click(button('Accept SS-TEST0001'))
  expect(await screen.findByText('SS-TEST0001 is now Accepted.')).toBeInTheDocument()

  core.release('lists')
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  expect(within(column('Accepted')).getByText('SS-TEST0001')).toBeInTheDocument()
  expect(within(column('Placed')).getByText('No orders')).toBeInTheDocument()

  // The poll goes on afterwards.
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  await waitFor(() => expect(listRequests(calls)).toHaveLength(15))
})
```

#### `src/idle.ts` (step B: new)

```ts
// For a button that cannot act now but must stay focusable: `disabled` would drop keyboard focus from the button just
// pressed. Use with `aria-disabled` and a handler that does nothing meanwhile.
// ponytail: an app-level class until ui's Button styles `aria-disabled` itself (asked of ui by admin-P2-L4).
export const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'
```

#### `src/orders.ts` (step B: replace the whole file)

```ts
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
// What the URL of /orders holds. Absent means: the first store (admins).
export type OrdersSearch = { store?: string }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
// The statuses with a column, in the order an order moves through them (services/core/internal/order/status.go).
export const activeStatuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const satisfies readonly OrderStatus[]
export const statusLabel: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
// The one move staff make from each active status, and what the card's button says.
export const nextStatus = { placed: 'accepted', accepted: 'packing', packing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered' } as const satisfies Partial<Record<OrderStatus, OrderStatus>>
export const nextLabel: Record<keyof typeof nextStatus, string> = {
  placed: 'Accept',
  accepted: 'Start packing',
  packing: 'Mark ready',
  ready: 'Send out',
  out_for_delivery: 'Mark delivered',
}
export const isActive = (status: OrderStatus): status is keyof typeof nextStatus => status in nextStatus

async function listOrders(storeId: string, query: { status: OrderStatus; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// Core lists one status per request, so the board is five requests, answered together or not at all.
// ponytail: a column holds the newest 100 orders of its status (core's largest page); ask core for an "active" filter with a total if a store ever has more waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: async () => (await Promise.all(activeStatuses.map((status) => listOrders(storeId, { status, pageSize: 100 })))).flatMap((list) => list.items),
    refetchInterval: pollMs,
  })

// A status change. Core answers 409 when the order is no longer where this page showed it (someone else moved it, or the
// customer cancelled): the order is then read again, so the page can show where it stands and say so.
export function useSetStatus(storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sent: { order: Order; status: OrderStatus; note?: string }) => {
      const params = { path: { id: sent.order.id } }
      const { data, error } = await api.POST('/admin/orders/{id}/status', { params, body: { status: sent.status, note: sent.note } })
      if (!error) return { order: data, changedElsewhere: false }
      if (error.error.code !== 'conflict') throw error.error
      const read = await api.GET('/admin/orders/{id}', { params })
      if (read.error) throw read.error.error
      return { order: read.data, changedElsewhere: true }
    },
    onSuccess: async ({ order }) => {
      const board = boardQuery(storeId).queryKey
      // A poll still in the air was read before this answer: drop it, or it would put the card back where it was.
      await queryClient.cancelQueries({ queryKey: board })
      queryClient.setQueryData(board, (orders) => orders && [...orders.filter((other) => other.id !== order.id), ...(isActive(order.status) ? [order] : [])])
    },
  })
}

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(placedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
```

#### `src/order-board.tsx` (step B: replace the whole file; it keeps step A's three fixes)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, Price, Skeleton, StatusMessage } from '@shopperstop/ui'
import { idle } from './idle'
import { activeStatuses, boardQuery, isActive, itemCount, nextLabel, nextStatus, statusLabel, useSetStatus, useSince, type Order } from './orders'


// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order, busy, saving, onNext }: { order: Order; busy: boolean; saving: boolean; onNext: () => void }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span id={`number-${order.id}`} className="font-semibold text-ink tabular-nums">{order.number}</span>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      <Price cents={order.totalCents} />
      {isActive(order.status) && (
        // Named by its own text and the order's number: "Accept SS-…".
        <Button id={`next-${order.id}`} aria-labelledby={`next-${order.id} number-${order.id}`} aria-disabled={busy} className={idle} onClick={onNext}>
          {saving ? 'Saving…' : nextLabel[order.status]}
        </Button>
      )}
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  // Only an answer core gave since this board was opened counts: orders kept from an earlier visit (the cache shows them
  // at once) are not a baseline, or what was placed while the board was away would be read out on opening it.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  if (board.data && board.isFetchedAfterMount && !board.isError && heard?.from !== board.data) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? board.data.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: board.data, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // One status change at a time on a board: while one runs, every card's button waits.
  const move = useSetStatus(storeId)
  const [confirm, setConfirm] = useState<Order>()
  const result = useRef<HTMLDivElement>(null)
  const moved = move.data?.order
  // The pressed button went with the card's old place. If that left the keyboard nowhere, go to the card's new button,
  // or to the result when the order has left the board.
  useEffect(() => {
    if (moved && document.activeElement === document.body) (document.getElementById(`next-${moved.id}`) ?? result.current)?.focus()
  }, [moved])

  function advance(order: Order) {
    if (move.isPending || !isActive(order.status)) return
    // Delivered ends the order and cannot be taken back: ask first.
    if (order.status === 'out_for_delivery') return setConfirm(order)
    move.mutate({ order, status: nextStatus[order.status] })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data
  return (
    <>
      <p role="status" aria-label="New orders" className="sr-only">{heard?.news}</p>
      <div ref={result} tabIndex={-1}>
        {move.isError && <ErrorBanner message={`Could not change the status of ${move.variables.order.number}. Try again.`} />}
        {move.data &&
          (move.data.changedElsewhere ? (
            <StatusMessage tone="warning">
              {move.data.order.number} was changed by someone else first: it is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ) : (
            <StatusMessage tone="success">
              {move.data.order.number} is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ))}
      </div>
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first, by the time itself: core trims zeros, so the strings do not sort ("…00.5Z", "…00.25Z").
            const column = orders.filter((order) => order.status === status).sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} aria-label={`${statusLabel[status]}, ${column.length === 1 ? '1 order' : `${column.length} orders`}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} busy={move.isPending} saving={move.isPending && move.variables.order.id === order.id} onNext={() => advance(order)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
      <Dialog open={confirm !== undefined} onClose={() => setConfirm(undefined)} title={`Mark ${confirm?.number} delivered?`}>
        <p className="mt-2 text-body text-ink">This finishes the order. It cannot be taken back.</p>
        <DialogFooter onCancel={() => setConfirm(undefined)}>
          <Button
            onClick={() => {
              setConfirm(undefined)
              if (confirm) move.mutate({ order: confirm, status: 'delivered' })
            }}
          >
            Mark delivered
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
```

### Task 3: the detail sheet and the cancel with a reason

Step A, from the review of task 2 (Decisions 33 to 35): one test appended, then two lines of the board changed. Step B, the sheet and the cancel, as before.

#### `src/orders-status.test.tsx` (step A: append this block at the end of the file; it starts with one empty line; change nothing above)

```tsx

test('the keyboard after a delivery is on a result named for what it holds', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery'), order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  await userEvent.click(button('Mark delivered SS-TEST0001'))
  await userEvent.click(within(screen.getByRole('dialog', { name: 'Mark SS-TEST0001 delivered?' })).getByRole('button', { name: 'Mark delivered' }))

  const result = await screen.findByRole('group', { name: 'Status change' })
  await waitFor(() => expect(result).toHaveFocus())
  expect(result).toHaveTextContent('SS-TEST0001 is now Delivered.')
})
```

#### `src/order-board.tsx` (step A: replace exactly these two lines, each found once in the file; change nothing else)

```diff
-      <div ref={result} tabIndex={-1}>
+      <div ref={result} role="group" aria-label="Status change" tabIndex={-1}>
-      <Dialog open={confirm !== undefined} onClose={() => setConfirm(undefined)} title={`Mark ${confirm?.number} delivered?`}>
+      <Dialog open={confirm !== undefined} onClose={() => setConfirm(undefined)} title={confirm ? `Mark ${confirm.number} delivered?` : ''}>
```

#### `src/order-sheet.test.tsx` (step B: new)

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, fakeCore, indiranagar, json, storeList } from './fake-core'
import { listRequests, order, ordersCore } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar]) }
const placedAt = '2026-10-13T09:20:00Z'
const first = order(1, 'placed', { placedAt, events: [{ toStatus: 'placed', actorType: 'customer', createdAt: placedAt }] })
const orderRequests = (calls: Request[], id: string) => calls.filter((call) => call.method === 'GET' && call.url.endsWith(`/admin/orders/${id}`))

// Opens the sheet of an order from its card.
async function openSheet(number = 'SS-TEST0001') {
  await userEvent.click(await screen.findByRole('button', { name: number }))
  return screen.getByRole('dialog', { name: `Order ${number}` })
}

test('a card\'s number opens the order: status, items, totals, customer with phone, address and events', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first]).routes })

  renderApp('/orders')
  const sheet = await openSheet()

  expect(sheet).toHaveTextContent('Placed 13 Oct 2026, 2:50 pm')
  // D28: an order under way is accent.
  expect(within(sheet).getByText('Placed', { exact: true })).toHaveClass('bg-accent-soft')
  expect(within(sheet).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    '1 × Banana Robusta, 1 kg₹70',
    '3 × Pomegranate Bhagwa, 1 kg₹960',
    'Placed by the customer, 13 Oct 2026, 2:50 pm',
  ])
  expect(sheet).toHaveTextContent('Subtotal₹1,030Delivery fee₹0Total, cash on delivery₹1,030')
  expect(sheet).toHaveTextContent('Demo Customer')
  expect(within(sheet).getByRole('link', { name: '+919800000000' })).toHaveAttribute('href', 'tel:+919800000000')
  expect(sheet).toHaveTextContent('Home: 12 80 Feet Rd, Koramangala, 560034')
  expect(within(sheet).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Items', 'Customer', 'Address', 'History'])
  // The sheet shows the card's order at once and reads the order itself once.
  await waitFor(() => expect(orderRequests(calls, first.id)).toHaveLength(1))
})

test('the sheet shows the order as core holds it, not as the card did: a second address line, no phone, a note', async () => {
  setToken('tok')
  const orders = [first]
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  // Since the board's last poll another staff member accepted it with a note.
  orders[0] = {
    ...first,
    status: 'accepted',
    customerPhone: undefined,
    address: { ...first.address, line2: 'Flat 4' },
    events: [...first.events, { fromStatus: 'placed', toStatus: 'accepted', actorType: 'staff', note: 'Packing now', createdAt: '2026-10-13T09:21:00Z' }],
  }
  const sheet = await openSheet()

  expect(await within(sheet).findByText('Accepted by staff, 13 Oct 2026, 2:51 pm: Packing now')).toBeInTheDocument()
  expect(sheet).toHaveTextContent('Home: 12 80 Feet Rd, Koramangala, Flat 4, 560034')
  expect(within(sheet).getByText('No phone number')).toBeInTheDocument()
  expect(within(sheet).queryByRole('link')).not.toBeInTheDocument()
})

test('an open sheet follows the order every 10 seconds', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const orders = [first]
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, orders).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))
  const sheet = screen.getByRole('dialog', { name: 'Order SS-TEST0001' })
  await waitFor(() => expect(orderRequests(calls, first.id)).toHaveLength(1))

  orders[0] = { ...first, status: 'packing' }
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(await within(sheet).findByText('Packing')).toBeInTheDocument()
  expect(orderRequests(calls, first.id)).toHaveLength(2)
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
})

test('a failed refresh keeps the order on the sheet and says it could not refresh', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await screen.findByText('SS-TEST0001')
  core.fail('order')
  const sheet = await openSheet()

  // The sheet says it itself: it is a modal over the notice at the root of the app.
  expect(await within(sheet).findByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  expect(orderRequests(calls, first.id)).toHaveLength(1)
  expect(sheet).toHaveTextContent('3 × Pomegranate Bhagwa')
  expect(within(sheet).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('only a placed or an accepted order can be cancelled from the sheet', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first, order(2, 'accepted'), order(3, 'packing')]).routes })

  renderApp('/orders')
  for (const [number, offered] of [['SS-TEST0001', true], ['SS-TEST0002', true], ['SS-TEST0003', false]] as const) {
    const sheet = await openSheet(number)
    expect(within(sheet).queryAllByRole('button', { name: 'Cancel order' })).toHaveLength(offered ? 1 : 0)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  }
})

test('closing the sheet puts the keyboard back on the card', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [first]).routes })

  renderApp('/orders')
  const sheet = await openSheet()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'SS-TEST0001' })).toHaveFocus()
})

test('a cancel needs a reason: without one nothing is sent, the field says so, and the message goes when a reason is typed', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))

  // One modal at a time: the sheet steps aside for its dialog.
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveAccessibleName('Cancel order SS-TEST0001?')
  expect(within(dialog).getAllByRole('button').map((each) => each.textContent)).toEqual(['Keep order', 'Cancel order'])
  const reason = within(dialog).getByLabelText('Reason')
  expect(reason).toHaveFocus()
  expect(reason).toHaveAttribute('maxlength', '500')
  await userEvent.type(reason, '   ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  expect(reason).toHaveAccessibleDescription('Enter a reason.')
  expect(reason).toBeInvalid()
  expect(core.posts).toEqual([])

  await userEvent.type(reason, 'x')
  expect(reason).not.toHaveAccessibleDescription()
  expect(reason).toBeValid()
})

test('Keep order and Escape close the dialog without sending and bring the sheet back', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.click(screen.getByRole('button', { name: 'Keep order' }))
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Order SS-TEST0001')

  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Order SS-TEST0001')
  expect(core.posts).toEqual([])
})

test('a cancel sends the reason as the note once, takes the order off the board and shows it cancelled with the reason', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first, order(2, 'placed')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), ' Out of stock ')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Order cancelled.')).toHaveAttribute('role', 'status')
  // D28: cancelled is neutral, never a danger or a warning colour.
  expect(within(sheet).getByText('Cancelled')).toHaveClass('bg-canvas')
  expect(within(sheet).getByText('Reason for cancelling: Out of stock')).toBeInTheDocument()
  expect(within(sheet).getByText(/^Cancelled by staff, .*: Out of stock$/)).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  expect(core.posts).toEqual([{ id: first.id, body: { status: 'cancelled', note: 'Out of stock' } }])

  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.getByText('SS-TEST0002')).toBeInTheDocument()
})

test('while a cancel runs the button reads Cancelling…, keeps focus and is never disabled; a second press sends nothing and the dialog stays', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  core.hold('status')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

  const pressed = await screen.findByRole('button', { name: 'Cancelling…' })
  expect(pressed).toHaveFocus()
  expect(pressed).toBeEnabled()
  expect(pressed).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(pressed)
  await userEvent.click(screen.getByRole('button', { name: 'Keep order' }))
  await userEvent.keyboard('{Escape}')
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Cancel order SS-TEST0001?')
  expect(core.posts).toHaveLength(1)

  core.release('status')
  expect(await screen.findByText('Order cancelled.')).toBeInTheDocument()
  expect(core.posts).toHaveLength(1)
})

test('a cancel that fails says so in the dialog, keeps the reason and can be tried again', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  await userEvent.click(within(await openSheet()).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  core.fail('status')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

  const dialog = screen.getByRole('dialog', { name: 'Cancel order SS-TEST0001?' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not cancel the order. Try again.')
  expect(screen.getByLabelText('Reason')).toHaveValue('Out of stock')

  core.fail('status', false)
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
  expect(await screen.findByText('Order cancelled.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.posts).toHaveLength(2)
})

test('a cancel refused with 409 shows where the order stands instead, on the sheet and on the board', async () => {
  setToken('tok')
  const orders = [order(1, 'accepted')]
  const core = ordersCore(indiranagar.id, orders)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders')
  const opened = await openSheet()
  await waitFor(() => expect(within(opened).getByRole('button', { name: 'Cancel order' })).toBeInTheDocument())
  await userEvent.click(within(opened).getByRole('button', { name: 'Cancel order' }))
  await userEvent.type(screen.getByLabelText('Reason'), 'Out of stock')
  // Packing has started at the store meanwhile: staff can no longer cancel.
  orders[0] = { ...orders[0], status: 'packing' }
  await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))

  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Someone else changed this order first: it is now Packing.')).toHaveAttribute('role', 'status')
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  expect(within(sheet).queryByText('Order cancelled.')).not.toBeInTheDocument()
  await userEvent.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('button', { name: 'Mark ready SS-TEST0001' })).toBeInTheDocument()
})

test('a poll answer read before a cancel never puts the order back on the board', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const core = ordersCore(indiranagar.id, [first, order(2, 'placed')])
  const calls = fakeCore({ ...asAdmin, ...core.routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))
  await user.click(within(screen.getByRole('dialog', { name: 'Order SS-TEST0001' })).getByRole('button', { name: 'Cancel order' }))
  await user.type(screen.getByLabelText('Reason'), 'Out of stock')
  // The poll leaves, and core reads the order as placed; its answer is still in the air when the cancel is answered.
  core.hold('lists')
  await act(() => vi.advanceTimersByTimeAsync(10_000))
  expect(listRequests(calls)).toHaveLength(10)
  await user.click(screen.getByRole('button', { name: 'Cancel order' }))
  const sheet = await screen.findByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Order cancelled.')).toBeInTheDocument()

  core.release('lists')
  await act(() => vi.advanceTimersByTimeAsync(1_000))
  await user.click(within(sheet).getByRole('button', { name: 'Close' }))
  expect(screen.queryByText('SS-TEST0001')).not.toBeInTheDocument()
  expect(screen.getByText('SS-TEST0002')).toBeInTheDocument()
})
```

#### `src/orders.ts` (step B: replace the whole file)

```ts
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
// What the URL of /orders holds. Absent means: the first store (admins).
export type OrdersSearch = { store?: string }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
// The statuses with a column, in the order an order moves through them (services/core/internal/order/status.go).
export const activeStatuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const satisfies readonly OrderStatus[]
export const statusLabel: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
// The one move staff make from each active status, and what the card's button says.
export const nextStatus = { placed: 'accepted', accepted: 'packing', packing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered' } as const satisfies Partial<Record<OrderStatus, OrderStatus>>
export const nextLabel: Record<keyof typeof nextStatus, string> = {
  placed: 'Accept',
  accepted: 'Start packing',
  packing: 'Mark ready',
  ready: 'Send out',
  out_for_delivery: 'Mark delivered',
}
export const isActive = (status: OrderStatus): status is keyof typeof nextStatus => status in nextStatus

async function listOrders(storeId: string, query: { status: OrderStatus; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// Core lists one status per request, so the board is five requests, answered together or not at all.
// ponytail: a column holds the newest 100 orders of its status (core's largest page); ask core for an "active" filter with a total if a store ever has more waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: async () => (await Promise.all(activeStatuses.map((status) => listOrders(storeId, { status, pageSize: 100 })))).flatMap((list) => list.items),
    refetchInterval: pollMs,
  })

// One order is ['admin', 'order', id]: not under a store's lists, so dropping those never empties an open sheet.
// The sheet follows the order like the board does.
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/orders/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
    refetchInterval: pollMs,
  })

// D28, as on the customer site: an order under way is `accent`, delivered `success`, cancelled `neutral`; the badge
// always carries the status as text, and a status is never `danger` or `warning`.
export const statusBadge = (status: OrderStatus) => (status === 'delivered' ? 'success' : status === 'cancelled' ? 'neutral' : 'accent')

// A status change. Core answers 409 when the order is no longer where this page showed it (someone else moved it, or the
// customer cancelled): the order is then read again, so the page can show where it stands and say so.
export function useSetStatus(storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sent: { order: Order; status: OrderStatus; note?: string }) => {
      const params = { path: { id: sent.order.id } }
      const { data, error } = await api.POST('/admin/orders/{id}/status', { params, body: { status: sent.status, note: sent.note } })
      if (!error) return { order: data, changedElsewhere: false }
      if (error.error.code !== 'conflict') throw error.error
      const read = await api.GET('/admin/orders/{id}', { params })
      if (read.error) throw read.error.error
      return { order: read.data, changedElsewhere: true }
    },
    onSuccess: async ({ order }) => {
      const board = boardQuery(storeId).queryKey
      // A poll still in the air was read before this answer: drop it, or it would put the card back where it was.
      await queryClient.cancelQueries({ queryKey: board })
      queryClient.setQueryData(board, (orders) => orders && [...orders.filter((other) => other.id !== order.id), ...(isActive(order.status) ? [order] : [])])
      const detail = orderQuery(order.id).queryKey
      await queryClient.cancelQueries({ queryKey: detail })
      queryClient.setQueryData(detail, order)
    },
  })
}

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(placedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))

// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
export const when = (at: string) => stamp.format(new Date(at))

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
```

#### `src/order-sheet.tsx` (step B: new)

```tsx
import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Price, Sheet, StatusMessage } from '@shopperstop/ui'
import { idle } from './idle'
import { orderQuery, statusBadge, statusLabel, useSetStatus, when, type Order } from './orders'

// Core takes a note of at most 500 characters (services/core/internal/order/handlers.go).
const maxReason = 500
const actor = { customer: 'the customer', staff: 'staff', system: 'the system' }

function Details({ order }: { order: Order }) {
  return (
    <div className="flex flex-col gap-4 text-body text-ink">
      <p className="flex flex-wrap items-center gap-2">
        <Badge variant={statusBadge(order.status)}>{statusLabel[order.status]}</Badge>
        Placed {when(order.placedAt)}
      </p>
      {order.cancelReason && <p>Reason for cancelling: {order.cancelReason}</p>}
      <section aria-labelledby="order-items" className="flex flex-col gap-2">
        <h3 id="order-items" className="text-h3">Items</h3>
        <ul className="flex flex-col gap-1">
          {order.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3">
              <span>
                <span className="tabular-nums">{item.quantity}</span> × {item.name}, {item.unitLabel}
              </span>
              <Price cents={item.priceCents * item.quantity} />
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-1 border-t border-line pt-2">
          <dt>Subtotal</dt>
          <dd className="text-right"><Price cents={order.subtotalCents} /></dd>
          <dt>Delivery fee</dt>
          <dd className="text-right"><Price cents={order.deliveryFeeCents} /></dd>
          <dt className="font-semibold">Total, cash on delivery</dt>
          <dd className="text-right"><Price cents={order.totalCents} /></dd>
        </dl>
      </section>
      <section aria-labelledby="order-customer" className="flex flex-col gap-1">
        <h3 id="order-customer" className="text-h3">Customer</h3>
        <p>{order.customerName}</p>
        {order.customerPhone ? (
          <a href={`tel:${order.customerPhone}`} className="text-accent underline tabular-nums">{order.customerPhone}</a>
        ) : (
          <p>No phone number</p>
        )}
      </section>
      <section aria-labelledby="order-address" className="flex flex-col gap-1">
        <h3 id="order-address" className="text-h3">Address</h3>
        <p>
          {order.address.label}: {order.address.line1}
          {order.address.line2 && `, ${order.address.line2}`}, <span className="tabular-nums">{order.address.pincode}</span>
        </p>
      </section>
      <section aria-labelledby="order-events" className="flex flex-col gap-1">
        <h3 id="order-events" className="text-h3">History</h3>
        <ol className="flex flex-col gap-1">
          {order.events.map((event, i) => (
            <li key={i}>
              {statusLabel[event.toStatus]} by {actor[event.actorType]}, {when(event.createdAt)}
              {event.note && `: ${event.note}`}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

// One order, opened from a card or a history row that put what it knew of the order in the cache.
// The sheet steps aside while its dialog is open: the ui modals do not stack (each closes on Escape).
export function OrderSheet({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const query = useQuery(orderQuery(orderId))
  const order = query.data
  const cancel = useSetStatus(order?.storeId ?? '')
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [missing, setMissing] = useState(false)
  if (!order) return null

  // The dialog stays while the cancel runs: closing it would hide a request that is still changing the order.
  function closeDialog() {
    if (cancel.isPending) return
    setAsking(false)
    setMissing(false)
    if (cancel.isError) cancel.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (cancel.isPending || !order) return
    const note = reason.trim()
    if (!note) return setMissing(true)
    cancel.mutate({ order, status: 'cancelled', note }, { onSuccess: () => setAsking(false) })
  }

  return (
    <>
      <Sheet open={!asking} onClose={onClose} title={`Order ${order.number}`}>
        <div className="flex flex-col gap-4">
          {/* The one notice a page of this lane shows itself: the sheet is a modal over the app's own notice. */}
          {query.isError && <StatusMessage tone="warning">Could not refresh. Showing what was loaded last.</StatusMessage>}
          {cancel.data &&
            (cancel.data.changedElsewhere ? (
              <StatusMessage tone="warning">Someone else changed this order first: it is now {statusLabel[cancel.data.order.status]}.</StatusMessage>
            ) : (
              <StatusMessage tone="success">Order cancelled.</StatusMessage>
            ))}
          <Details order={order} />
          {(order.status === 'placed' || order.status === 'accepted') && (
            <Button variant="secondary" onClick={() => setAsking(true)}>Cancel order</Button>
          )}
        </div>
      </Sheet>
      <Dialog open={asking} onClose={closeDialog} title={`Cancel order ${order.number}?`}>
        <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
          <p className="text-body text-ink">Its items go back into stock. The customer sees the reason.</p>
          {cancel.isError && <ErrorBanner message="Could not cancel the order. Try again." />}
          <FormField label="Reason" error={missing ? 'Enter a reason.' : undefined}>
            <Input
              maxLength={maxReason}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
                setMissing(false)
              }}
            />
          </FormField>
          <DialogFooter onCancel={closeDialog} cancelLabel="Keep order">
            <Button type="submit" aria-disabled={cancel.isPending} className={idle}>
              {cancel.isPending ? 'Cancelling…' : 'Cancel order'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}
```

#### `src/order-board.tsx` (step B: replace the whole file; it keeps task 2's fixes and step A's two lines)

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, Price, Skeleton, StatusMessage } from '@shopperstop/ui'
import { idle } from './idle'
import { OrderSheet } from './order-sheet'
import { activeStatuses, boardQuery, isActive, itemCount, nextLabel, nextStatus, orderQuery, statusLabel, useSetStatus, useSince, type Order } from './orders'


// Its own component, so a minute passing renders this text and nothing else on the board.
function Since({ at }: { at: string }) {
  return (
    <time dateTime={at} className="text-small text-ink-muted">
      {useSince(at)}
    </time>
  )
}

function OrderCard({ order, busy, saving, onNext, onOpen }: { order: Order; busy: boolean; saving: boolean; onNext: () => void; onOpen: () => void }) {
  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Button variant="ghost" id={`number-${order.id}`} className="tabular-nums" onClick={onOpen}>{order.number}</Button>
        <Since at={order.placedAt} />
      </div>
      <p className="text-small text-ink">
        {itemCount(order)}, pincode <span className="tabular-nums">{order.address.pincode}</span>
      </p>
      <Price cents={order.totalCents} />
      {isActive(order.status) && (
        // Named by its own text and the order's number: "Accept SS-…".
        <Button id={`next-${order.id}`} aria-labelledby={`next-${order.id} number-${order.id}`} aria-disabled={busy} className={idle} onClick={onNext}>
          {saving ? 'Saving…' : nextLabel[order.status]}
        </Button>
      )}
    </Card>
  )
}

// One store's board. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
export function OrderBoard({ storeId }: { storeId: string }) {
  const board = useQuery(boardQuery(storeId))
  // What the last answer announced, and that answer. A failed poll brings no new answer, and an equal answer is the
  // same object (structural sharing), so neither announces anything; a changed answer with nothing new empties the region.
  // Only an answer core gave since this board was opened counts: orders kept from an earlier visit (the cache shows them
  // at once) are not a baseline, or what was placed while the board was away would be read out on opening it.
  const [heard, setHeard] = useState<{ from: Order[]; news: string }>()
  if (board.data && board.isFetchedAfterMount && !board.isError && heard?.from !== board.data) {
    const known = new Set(heard?.from.map((order) => order.id))
    // The first answer is what the store already had: nothing in it is new.
    const fresh = heard ? board.data.filter((order) => order.status === 'placed' && !known.has(order.id)) : []
    const numbers = fresh.map((order) => order.number).join(', ')
    setHeard({ from: board.data, news: fresh.length === 0 ? '' : fresh.length === 1 ? `New order ${numbers}` : `${fresh.length} new orders: ${numbers}` })
  }

  // One status change at a time on a board: while one runs, every card's button waits.
  const move = useSetStatus(storeId)
  const [confirm, setConfirm] = useState<Order>()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string>()
  const result = useRef<HTMLDivElement>(null)
  const moved = move.data?.order
  // The pressed button went with the card's old place. If that left the keyboard nowhere, go to the card's new button,
  // or to the result when the order has left the board.
  useEffect(() => {
    if (moved && document.activeElement === document.body) (document.getElementById(`next-${moved.id}`) ?? result.current)?.focus()
  }, [moved])

  // The sheet starts from the card, the newest this page knows of the order, and reads the order itself from there.
  function show(order: Order) {
    queryClient.setQueryData(orderQuery(order.id).queryKey, order)
    setOpen(order.id)
  }

  function advance(order: Order) {
    if (move.isPending || !isActive(order.status)) return
    // Delivered ends the order and cannot be taken back: ask first.
    if (order.status === 'out_for_delivery') return setConfirm(order)
    move.mutate({ order, status: nextStatus[order.status] })
  }

  // A poll that fails keeps the board: the alert is only for a board with nothing to show. (The app's root says that a
  // refresh failed, once for the whole page.)
  if (board.data === undefined) {
    return board.isError ? <ErrorBanner message="Could not load the orders." onRetry={() => void board.refetch()} /> : <Skeleton variant="list" count={5} />
  }
  const orders = board.data
  return (
    <>
      <p role="status" aria-label="New orders" className="sr-only">{heard?.news}</p>
      <div ref={result} role="group" aria-label="Status change" tabIndex={-1}>
        {move.isError && <ErrorBanner message={`Could not change the status of ${move.variables.order.number}. Try again.`} />}
        {move.data &&
          (move.data.changedElsewhere ? (
            <StatusMessage tone="warning">
              {move.data.order.number} was changed by someone else first: it is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ) : (
            <StatusMessage tone="success">
              {move.data.order.number} is now {statusLabel[move.data.order.status]}.
            </StatusMessage>
          ))}
      </div>
      {orders.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No active orders" description="New orders show here within 10 seconds." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5 lg:gap-4">
          {activeStatuses.map((status) => {
            // The longest waiting first, by the time itself: core trims zeros, so the strings do not sort ("…00.5Z", "…00.25Z").
            const column = orders.filter((order) => order.status === status).sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))
            return (
              <section key={status} aria-labelledby={`orders-${status}`} className="flex flex-col gap-3">
                <h2 id={`orders-${status}`} aria-label={`${statusLabel[status]}, ${column.length === 1 ? '1 order' : `${column.length} orders`}`} className="flex items-center gap-2 text-h3 text-ink">
                  {statusLabel[status]}
                  <Badge className="tabular-nums">{column.length}</Badge>
                </h2>
                {column.length === 0 ? (
                  <p className="text-small text-ink">No orders</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {column.map((order) => (
                      <li key={order.id}>
                        <OrderCard order={order} busy={move.isPending} saving={move.isPending && move.variables.order.id === order.id} onNext={() => advance(order)} onOpen={() => show(order)} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
      {open && <OrderSheet orderId={open} onClose={() => setOpen(undefined)} />}
      <Dialog open={confirm !== undefined} onClose={() => setConfirm(undefined)} title={confirm ? `Mark ${confirm.number} delivered?` : ''}>
        <p className="mt-2 text-body text-ink">This finishes the order. It cannot be taken back.</p>
        <DialogFooter onCancel={() => setConfirm(undefined)}>
          <Button
            onClick={() => {
              setConfirm(undefined)
              if (confirm) move.mutate({ order: confirm, status: 'delivered' })
            }}
          >
            Mark delivered
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
```

### Task 4: the History tab

#### `src/orders-history.test.tsx` (new)

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, fakeCore, indiranagar, json, koramangala, storeList } from './fake-core'
import { listRequests, order, ordersCore, refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }
const delivered = (n: number) => order(n, 'delivered', { placedAt: `2026-10-13T09:${String(n).padStart(2, '0')}:00Z`, deliveredAt: `2026-10-13T10:${String(n).padStart(2, '0')}:00Z` })
const cancelled = (n: number) => order(n, 'cancelled', { placedAt: `2026-10-12T09:${String(n).padStart(2, '0')}:00Z`, cancelledAt: `2026-10-12T09:${String(n + 2).padStart(2, '0')}:00Z`, cancelReason: 'Ordered by mistake' })
// Thirty delivered orders, SS-TEST0001 to SS-TEST0030: two pages of 24, the newest (0030) first.
const thirty = Array.from({ length: 30 }, (_, i) => delivered(i + 1))
const tab = (name: string) => within(screen.getByRole('navigation', { name: 'Orders' })).getByRole('link', { name })
const numbers = () => within(screen.getByRole('table', { name: 'Order history' })).getAllByRole('button').map((each) => each.textContent)
const last = (calls: Request[]) => listRequests(calls).at(-1)

test('the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1), delivered(2), cancelled(3), order(4, 'placed')]).routes })

  renderApp('/orders?tab=history')

  const table = await screen.findByRole('table', { name: 'Order history' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Order', 'Placed', 'Customer', 'Items', 'Total', 'Delivered'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(numbers()).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent?.replace(/^(Order|Placed|Customer|Items|Total|Delivered)/, ''))).toEqual([
    'SS-TEST0001',
    '13 Oct 2026, 2:31 pm',
    'Demo Customer',
    '4 items',
    '₹1,030',
    '13 Oct 2026, 3:31 pm',
  ])
  expect(screen.getByText('Page 1 of 1, 2 orders')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Delivered' })).toHaveAttribute('aria-pressed', 'true')
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
  expect(tab('Board')).not.toHaveAttribute('aria-current')
  expect(listRequests(calls)).toEqual([{ status: 'delivered', page: '1', pageSize: '24' }])
})

test('Board and History are tabs held in the URL, and the store stays chosen', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(koramangala.id, [delivered(1), order(2, 'placed')]).routes })

  const router = renderApp(`/orders?store=${koramangala.id}`)
  await screen.findByText('SS-TEST0002')
  expect(tab('Board')).toHaveAttribute('aria-current', 'page')
  expect(tab('History')).not.toHaveAttribute('aria-current')
  await userEvent.click(tab('History'))

  await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0001'])
  expect(router.state.location.search).toEqual({ store: koramangala.id, tab: 'history' })
  expect(screen.queryByRole('region')).not.toBeInTheDocument()

  await userEvent.click(tab('Board'))
  expect(await screen.findByText('SS-TEST0002')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
  act(() => router.history.back())
  await screen.findByRole('table', { name: 'Order history' })
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
})

test('Cancelled lists the cancelled orders with when they were cancelled, from page 1, never under the delivered rows', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [...thirty, cancelled(40)])
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history&page=2')
  await screen.findByText('Page 2 of 2, 30 orders')
  core.hold('lists')
  await userEvent.click(screen.getByRole('button', { name: 'Cancelled' }))

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveFocus()
  core.release('lists')
  const table = await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0040'])
  expect(within(table).getAllByRole('columnheader').at(-1)).toHaveTextContent('Cancelled')
  expect(within(table).getAllByRole('row')[1]).toHaveTextContent('12 Oct 2026, 3:12 pm')
  expect(screen.getByRole('button', { name: 'Cancelled' })).toHaveAttribute('aria-pressed', 'true')
  expect(router.state.location.search).toEqual({ tab: 'history', status: 'cancelled' })
  // One request for the cancelled list, at page 1: the page of the delivered list is not carried over.
  expect(listRequests(calls).slice(1)).toEqual([{ status: 'cancelled', page: '1', pageSize: '24' }])

  await userEvent.click(screen.getByRole('button', { name: 'Delivered' }))
  await screen.findByText('Page 1 of 2, 30 orders')
  expect(router.state.location.search).toEqual({ tab: 'history' })
})

test('the pager moves between pages and keeps focus; rows kept while the next page loads are marked busy under their own page number', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, thirty)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history')
  await screen.findByText('Page 1 of 2, 30 orders')
  expect(numbers()).toHaveLength(24)
  expect(numbers()[0]).toBe('SS-TEST0030')
  const previous = screen.getByRole('button', { name: 'Previous' })
  const next = screen.getByRole('button', { name: 'Next' })
  expect(previous).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(previous)
  expect(listRequests(calls)).toHaveLength(1)

  core.hold('lists')
  await userEvent.click(next)
  const busy = screen.getByRole('table', { name: 'Order history' }).closest('[aria-busy]')
  expect(busy).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByText('Page 1 of 2, 30 orders')).toBeInTheDocument()
  expect(numbers()[0]).toBe('SS-TEST0030')
  core.release('lists')

  await screen.findByText('Page 2 of 2, 30 orders')
  expect(numbers()).toEqual(['SS-TEST0006', 'SS-TEST0005', 'SS-TEST0004', 'SS-TEST0003', 'SS-TEST0002', 'SS-TEST0001'])
  expect(busy).toHaveAttribute('aria-busy', 'false')
  expect(next).toHaveFocus()
  expect(next).toHaveAttribute('aria-disabled', 'true')
  expect(next).toBeEnabled()
  expect(router.state.location.search).toEqual({ tab: 'history', page: 2 })
  expect(tab('History')).toHaveAttribute('aria-current', 'page')
  expect(tab('Board')).not.toHaveAttribute('aria-current')
  await userEvent.click(next)
  expect(listRequests(calls)).toHaveLength(2)
})

test.each([
  ['tab=archive', 'the board'],
  ['tab=history&status=placed', 'delivered orders'],
  ['tab=history&page=banana', 'page 1'],
  ['tab=history&page=0', 'page 1'],
  ['tab=history&page=1.5', 'page 1'],
])('?%s in the URL is read as %s', async (query, shown) => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1), cancelled(2), order(3, 'placed')]).routes })

  renderApp(`/orders?${query}`)

  if (shown === 'the board') {
    expect(await screen.findByText('SS-TEST0003')).toBeInTheDocument()
    expect(tab('Board')).toHaveAttribute('aria-current', 'page')
  } else {
    await screen.findByRole('table', { name: 'Order history' })
    expect(numbers()).toEqual(['SS-TEST0001'])
    expect(last(calls)).toEqual({ status: 'delivered', page: '1', pageSize: '24' })
  }
})

test('a page in the URL beyond what core accepts is cut to one it does, then to the last page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, thirty).routes })

  const router = renderApp('/orders?tab=history&page=2147483648')

  await screen.findByText('Page 2 of 2, 30 orders')
  expect(listRequests(calls).map((query) => query.page)).toEqual(['100000', '2'])
  expect(router.state.location.search).toEqual({ tab: 'history', page: 2 })
})

test('a history row opens the order without a cancel, read once and not polled', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [cancelled(1)]).routes })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

  renderApp('/orders?tab=history&status=cancelled')
  await user.click(await screen.findByRole('button', { name: 'SS-TEST0001' }))

  const sheet = screen.getByRole('dialog', { name: 'Order SS-TEST0001' })
  expect(within(sheet).getByText('Reason for cancelling: Ordered by mistake')).toBeInTheDocument()
  expect(within(sheet).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument()
  const read = () => calls.filter((call) => call.url.endsWith(`/admin/orders/${cancelled(1).id}`))
  await waitFor(() => expect(read()).toHaveLength(1))
  await act(() => vi.advanceTimersByTimeAsync(30_000))
  expect(read()).toHaveLength(1)
  expect(listRequests(calls)).toHaveLength(1)
})

test('a failed refresh keeps the history list; the next good answer shows what core then holds', async () => {
  setToken('tok')
  const orders = [delivered(1)]
  const core = ordersCore(indiranagar.id, orders)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  const router = renderApp('/orders?tab=history')
  await screen.findByRole('table', { name: 'Order history' })
  core.fail('lists')
  orders.push(delivered(2))
  // Coming back to the tab asks core again.
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await refreshFailed(router, ['admin', 'orders', indiranagar.id, 'history', 'delivered', 1])

  // The alert is for a list with nothing to show; this one keeps its rows. (The root of the app says a refresh failed.)
  expect(numbers()).toEqual(['SS-TEST0001'])
  expect(screen.getByText('Page 1 of 1, 1 orders')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')

  core.fail('lists', false)
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await screen.findByText('Page 1 of 1, 2 orders')
  expect(numbers()).toEqual(['SS-TEST0002', 'SS-TEST0001'])
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
  expect(listRequests(calls)).toHaveLength(3)
})

test('the history shows a skeleton while loading, and a list that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [delivered(1)])
  core.hold('lists')
  core.fail('lists')
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders?tab=history')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: 'Delivered' })).toBeInTheDocument()
  core.release('lists')
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the orders.')
  core.fail('lists', false)
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  await screen.findByRole('table', { name: 'Order history' })
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a store with no cancelled orders shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, [delivered(1)]).routes })

  renderApp('/orders?tab=history&status=cancelled')

  expect(await screen.findByRole('heading', { level: 2, name: 'No cancelled orders' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
})

test('choosing a store on the History tab keeps the tab, starts at page 1 and never shows the other store\'s rows', async () => {
  setToken('tok')
  const other = ordersCore(koramangala.id, [delivered(40)])
  const calls = fakeCore({ ...asAdmin, ...ordersCore(indiranagar.id, thirty).routes, ...other.routes })

  const router = renderApp('/orders?tab=history&page=2')
  await screen.findByText('Page 2 of 2, 30 orders')
  other.hold('lists')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  other.release('lists')
  await screen.findByText('Page 1 of 1, 1 orders')
  expect(numbers()).toEqual(['SS-TEST0040'])
  expect(router.state.location.search).toEqual({ store: koramangala.id, tab: 'history' })
  // One request to each store: the other store is asked for page 1, not for the page left behind.
  expect(listRequests(calls).map((query) => query.page)).toEqual(['2', '1'])
})

test('a history page kept from before a status change is read again, never shown as it was', async () => {
  setToken('tok')
  const core = ordersCore(indiranagar.id, [order(1, 'out_for_delivery')])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/orders?tab=history')
  expect(await screen.findByRole('heading', { level: 2, name: 'No delivered orders' })).toBeInTheDocument()
  await userEvent.click(tab('Board'))
  await userEvent.click(await screen.findByRole('button', { name: 'Mark delivered SS-TEST0001' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark delivered' }))
  await screen.findByText('SS-TEST0001 is now Delivered.')
  core.hold('lists')
  await userEvent.click(tab('History'))

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: 'No delivered orders' })).not.toBeInTheDocument()
  core.release('lists')
  await screen.findByRole('table', { name: 'Order history' })
  expect(numbers()).toEqual(['SS-TEST0001'])
})
```

#### `src/orders.ts` (replace the whole file)

```ts
import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Order = components['schemas']['Order']
export type OrderStatus = Order['status']
export type Finished = 'delivered' | 'cancelled'
// What the URL of /orders holds. Absent means: the first store (admins), the board, delivered orders, page 1.
export type OrdersSearch = { store?: string; tab?: 'history'; status?: 'cancelled'; page?: number }

// The board asks core again this often (Spec 2 §8). TanStack Query stops the interval while the tab is hidden and asks at once when it shows again.
export const pollMs = 10_000
export const pageSize = 24
// A page core does not refuse as too large (its limit at 24 a page is 89478486).
export const maxPage = 100000
// The statuses with a column, in the order an order moves through them (services/core/internal/order/status.go).
export const activeStatuses = ['placed', 'accepted', 'packing', 'ready', 'out_for_delivery'] as const satisfies readonly OrderStatus[]
export const statusLabel: Record<OrderStatus, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}
// The one move staff make from each active status, and what the card's button says.
export const nextStatus = { placed: 'accepted', accepted: 'packing', packing: 'ready', ready: 'out_for_delivery', out_for_delivery: 'delivered' } as const satisfies Partial<Record<OrderStatus, OrderStatus>>
export const nextLabel: Record<keyof typeof nextStatus, string> = {
  placed: 'Accept',
  accepted: 'Start packing',
  packing: 'Mark ready',
  ready: 'Send out',
  out_for_delivery: 'Mark delivered',
}
export const isActive = (status: OrderStatus): status is keyof typeof nextStatus => status in nextStatus

async function listOrders(storeId: string, query: { status: OrderStatus; page?: number; pageSize: number }) {
  const { data, error } = await api.GET('/admin/stores/{id}/orders', { params: { path: { id: storeId }, query } })
  if (error) throw error.error
  return data
}

// Keys: everything listed for a store is under ['admin', 'orders', storeId]; the board is ['admin', 'orders', storeId, 'board'].
// Core lists one status per request, so the board is five requests, answered together or not at all.
// ponytail: a column holds the newest 100 orders of its status (core's largest page); ask core for an "active" filter with a total if a store ever has more waiting.
export const boardQuery = (storeId: string) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'board'],
    queryFn: async () => (await Promise.all(activeStatuses.map((status) => listOrders(storeId, { status, pageSize: 100 })))).flatMap((list) => list.items),
    refetchInterval: pollMs,
  })

// One page of a store's finished orders, newest first: ['admin', 'orders', storeId, 'history', status, page].
export const historyQuery = (storeId: string, status: Finished, page: number) =>
  queryOptions({
    queryKey: ['admin', 'orders', storeId, 'history', status, page],
    queryFn: () => listOrders(storeId, { status, page, pageSize }),
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never the other status's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[4] === status ? keepPreviousData(previous) : undefined),
  })

// One order is ['admin', 'order', id]: not under a store's lists, so dropping those never empties an open sheet.
// The sheet follows the order like the board does, until the order is finished: nothing changes after that.
export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'order', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/orders/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
    refetchInterval: (query) => (query.state.data && !isActive(query.state.data.status) ? false : pollMs),
  })

// D28, as on the customer site: an order under way is `accent`, delivered `success`, cancelled `neutral`; the badge
// always carries the status as text, and a status is never `danger` or `warning`.
export const statusBadge = (status: OrderStatus) => (status === 'delivered' ? 'success' : status === 'cancelled' ? 'neutral' : 'accent')

// A status change. Core answers 409 when the order is no longer where this page showed it (someone else moved it, or the
// customer cancelled): the order is then read again, so the page can show where it stands and say so.
export function useSetStatus(storeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (sent: { order: Order; status: OrderStatus; note?: string }) => {
      const params = { path: { id: sent.order.id } }
      const { data, error } = await api.POST('/admin/orders/{id}/status', { params, body: { status: sent.status, note: sent.note } })
      if (!error) return { order: data, changedElsewhere: false }
      if (error.error.code !== 'conflict') throw error.error
      const read = await api.GET('/admin/orders/{id}', { params })
      if (read.error) throw read.error.error
      return { order: read.data, changedElsewhere: true }
    },
    onSuccess: async ({ order }) => {
      const board = boardQuery(storeId).queryKey
      // A poll still in the air was read before this answer: drop it, or it would put the card back where it was.
      await queryClient.cancelQueries({ queryKey: board })
      queryClient.setQueryData(board, (orders) => orders && [...orders.filter((other) => other.id !== order.id), ...(isActive(order.status) ? [order] : [])])
      const detail = orderQuery(order.id).queryKey
      await queryClient.cancelQueries({ queryKey: detail })
      queryClient.setQueryData(detail, order)
      // Lists kept from before (history pages) no longer hold what core holds: the next visit reads them again.
      queryClient.removeQueries({ queryKey: ['admin', 'orders', storeId], type: 'inactive' })
    },
  })
}

// "12 min ago" for a card; whole minutes, hours above 59.
export function since(placedAt: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
  if (minutes === 0) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
}

// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
function everyFewSeconds(tick: () => void) {
  const id = setInterval(tick, 5_000)
  return () => clearInterval(id)
}
export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))

// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
export const when = (at: string) => stamp.format(new Date(at))

export function itemCount(order: Order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return count === 1 ? '1 item' : `${count} items`
}
```

#### `src/order-history.tsx` (new)

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button, Card, Chip, EmptyState, ErrorBanner, Price, Skeleton, Table, cn, type Column } from '@shopperstop/ui'
import { idle } from './idle'
import { OrderSheet } from './order-sheet'
import { historyQuery, itemCount, orderQuery, pageSize, statusLabel, when, type Finished, type Order, type OrdersSearch } from './orders'

// One store's finished orders. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
// `go` changes the URL; the status filter starts again at page 1.
export function OrderHistory({ storeId, status, page, go }: { storeId: string; status: Finished; page: number; go: (change: OrdersSearch, replace?: boolean) => void }) {
  const queryClient = useQueryClient()
  const history = useQuery(historyQuery(storeId, status, page))
  const [open, setOpen] = useState<string>()
  // Rows kept from the page before, while the one asked for loads: shown dimmed.
  const stale = history.isPlaceholderData
  const total = history.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / pageSize))

  // A page past the end (a typed URL) moves to the last page that has rows.
  const pastEnd = page > 1 && !stale && history.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) go({ page: last > 1 ? last : undefined }, true)
  }, [pastEnd, total, go])

  // The sheet starts from the row and reads the order itself from there.
  function show(order: Order) {
    queryClient.setQueryData(orderQuery(order.id).queryKey, order)
    setOpen(order.id)
  }

  const columns: Column<Order>[] = [
    { key: 'order', header: 'Order', cell: (order) => <Button variant="ghost" className="tabular-nums" onClick={() => show(order)}>{order.number}</Button> },
    { key: 'placed', header: 'Placed', cell: (order) => when(order.placedAt) },
    { key: 'customer', header: 'Customer', cell: (order) => order.customerName },
    { key: 'items', header: 'Items', cell: (order) => itemCount(order) },
    { key: 'total', header: 'Total', cell: (order) => <Price cents={order.totalCents} /> },
    { key: 'finished', header: statusLabel[status], cell: (order) => when(order.deliveredAt ?? order.cancelledAt ?? order.placedAt) },
  ]

  return (
    <>
      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        <Chip selected={status === 'delivered'} onClick={() => go({ status: undefined, page: undefined })}>Delivered</Chip>
        <Chip selected={status === 'cancelled'} onClick={() => go({ status: 'cancelled', page: undefined })}>Cancelled</Chip>
      </div>
      {history.data === undefined ? (
        history.isError ? (
          <ErrorBanner message="Could not load the orders." onRetry={() => void history.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : (
        <>
          {history.data.items.length === 0 ? (
            <Card className="p-6">
              <EmptyState title={`No ${status} orders`} description="Orders show here once they are delivered or cancelled." />
            </Card>
          ) : (
            <>
              <Card aria-busy={stale} className={cn('overflow-hidden', stale && 'opacity-50')}>
                <Table stack caption="Order history" columns={columns} rows={history.data.items} rowKey={(order) => order.id} />
              </Card>
              <nav aria-label="Pages" className="flex items-center justify-between gap-4">
                <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
                  Previous
                </Button>
                <p className="text-body text-ink tabular-nums">
                  Page {history.data.page} of {pages}, {total} orders
                </p>
                <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
                  Next
                </Button>
              </nav>
            </>
          )}
        </>
      )}
      {open && <OrderSheet orderId={open} onClose={() => setOpen(undefined)} />}
    </>
  )
}
```

#### `src/routes/_staff/orders.tsx` (replace the whole file)

```tsx
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback } from 'react'
import { Card, EmptyState, ErrorBanner, FormField, PageHeader, Select, Skeleton, TabNav } from '@shopperstop/ui'
import { OrderBoard } from '../../order-board'
import { OrderHistory } from '../../order-history'
import { maxPage, type OrdersSearch } from '../../orders'
import { storeNameQuery } from '../../stock'
import { storesQuery } from '../../stores'

function Orders() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  // Store staff get no selector; their store's name is shown when it can be read, and left out when it cannot.
  const ownStore = useQuery({ ...storeNameQuery(staff.storeId ?? ''), enabled: !!staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = staff.storeId ?? items.find((store) => store.id === search.store)?.id ?? items[0]?.id
  const go = useCallback((change: OrdersSearch, replace?: boolean) => void navigate({ search: (current) => ({ ...current, ...change }), replace }), [navigate])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Orders" />
      {!staff.storeId && stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="list" count={5} />
        )
      ) : storeId ? (
        <>
          {ownStore.data && (
            <p className="text-body text-ink">
              Store: <span className="font-semibold">{ownStore.data}</span>
            </p>
          )}
          {!staff.storeId && (
            <Card className="flex flex-wrap items-end gap-4 p-4">
              <FormField label="Store">
                {/* Another store starts again: its board or the first page of its history. */}
                <Select value={storeId} onChange={(event) => void navigate({ search: { store: event.target.value, tab: search.tab } })}>
                  {items.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </Select>
              </FormField>
            </Card>
          )}
          {/* Both tabs are /orders, so the router's own "active" (same path, search contained) would mark Board on
              History too: `exact` leaves it to mark only an equal URL, and `aria-current` here says the rest. */}
          <TabNav label="Orders" className="bg-surface px-4">
            <Link to="/orders" search={{ store: search.store }} activeOptions={{ exact: true }} aria-current={search.tab ? undefined : 'page'}>Board</Link>
            <Link to="/orders" search={{ store: search.store, tab: 'history' }} activeOptions={{ exact: true }} aria-current={search.tab ? 'page' : undefined}>History</Link>
          </TabNav>
          {search.tab ? (
            <OrderHistory key={storeId} storeId={storeId} status={search.status ?? 'delivered'} page={search.page ?? 1} go={go} />
          ) : (
            <OrderBoard key={storeId} storeId={storeId} />
          )}
        </>
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then its orders show here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/orders')({
  // The router reads search values as JSON: `page=2` is a number. What core would answer 400 to is not sent:
  // a status that is not one of the two, a page far beyond any list.
  validateSearch: (search: Record<string, unknown>): OrdersSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    tab: search.tab === 'history' ? 'history' : undefined,
    status: search.status === 'cancelled' ? 'cancelled' : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? Math.min(search.page, maxPage) : undefined,
  }),
  component: Orders,
})
```

### Task 5: the dashboard

#### `src/dashboard.test.tsx` (new)

```tsx
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeStaff } from './fake-core'
import { refreshFailed } from './orders-fake'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

type DashboardStore = components['schemas']['DashboardStore']
const quiet = { placed: 0, accepted: 0, packing: 0, ready: 0, out_for_delivery: 0, delivered: 0, cancelled: 0 }
const atIndiranagar: DashboardStore = { storeId: indiranagar.id, storeName: 'Indiranagar', ordersToday: quiet, lowStockCount: 1, revenueTodayCents: 0 }
const atKoramangala: DashboardStore = {
  storeId: koramangala.id,
  storeName: 'Koramangala',
  ordersToday: { placed: 1, accepted: 2, packing: 3, ready: 4, out_for_delivery: 5, delivered: 6, cancelled: 7 },
  lowStockCount: 20,
  revenueTodayCents: 618050,
}
const asAdmin = { 'GET /admin/me': () => json(200, admin) }
const card = (name: string) => screen.findByRole('region', { name })
// The card's figures as "label: value" lines.
const figures = (region: HTMLElement) => {
  const terms = within(region).getAllByRole('term').map((term) => term.textContent)
  return within(region).getAllByRole('definition').map((value, i) => `${terms[i]}: ${value.textContent}`)
}

test('an admin sees a card per store in core\'s order, with today\'s orders by status and in all, revenue and the low-stock count', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [atIndiranagar, atKoramangala] }) })

  renderApp('/')

  expect(figures(await card('Koramangala'))).toEqual([
    'Orders today: 28',
    'Placed: 1',
    'Accepted: 2',
    'Packing: 3',
    'Ready: 4',
    'Out for delivery: 5',
    'Delivered: 6',
    'Cancelled: 7',
    'Revenue today: ₹6,180.50',
    'Low stock: 20 products',
  ])
  expect(figures(await card('Indiranagar')).filter((line) => !line.endsWith(': 0'))).toEqual(['Revenue today: ₹0', 'Low stock: 1 product'])
  expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))).toEqual(['/admin/me', '/admin/dashboard'])
})

test('a card links to its store\'s orders and to its stock filtered to low stock', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [atIndiranagar, atKoramangala] }) })

  const router = renderApp('/')
  const region = await card('Koramangala')

  expect(within(region).getByRole('link', { name: 'Orders at Koramangala' })).toHaveAttribute('href', `/orders?store=${koramangala.id}`)
  expect(within(region).getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/stock?store=${koramangala.id}&lowStock=true`)
  await userEvent.click(within(region).getByRole('link', { name: 'Low stock at Koramangala' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/stock'))
  expect(router.state.location.search).toEqual({ store: koramangala.id, lowStock: true })
})

test('store staff see the one card core gives them, for their own store', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, storeStaff), 'GET /admin/dashboard': () => json(200, { items: [{ ...atKoramangala, storeId: storeStaff.storeId }] }) })

  renderApp('/')

  expect(await card('Koramangala')).toBeInTheDocument()
  expect(screen.getAllByRole('region')).toHaveLength(1)
  expect(screen.getByRole('link', { name: 'Low stock at Koramangala' })).toHaveAttribute('href', `/stock?store=${storeStaff.storeId}&lowStock=true`)
})

test('the dashboard shows a skeleton while loading', async () => {
  setToken('tok')
  let release = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  fakeCore({
    ...asAdmin,
    'GET /admin/dashboard': async () => {
      await held
      return json(200, { items: [atKoramangala] })
    },
  })

  renderApp('/')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  release()
  expect(await card('Koramangala')).toBeInTheDocument()
})

test('a dashboard that cannot be loaded offers a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => (fail ? apiError(500, 'internal') : json(200, { items: [atKoramangala] })) })

  renderApp('/')

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the dashboard.')
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await card('Koramangala')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed refresh keeps the cards; the next good answer shows the new numbers', async () => {
  setToken('tok')
  let answer = () => json(200, { items: [atKoramangala] })
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => answer() })

  const router = renderApp('/')
  await card('Koramangala')
  answer = () => apiError(500, 'internal')
  // Coming back to the tab asks core again.
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await refreshFailed(router, ['admin', 'dashboard'])

  // The alert is for a dashboard with nothing to show; this one keeps its card. (The root of the app says a refresh failed.)
  expect(figures(screen.getByRole('region', { name: 'Koramangala' }))).toContain('Orders today: 28')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')

  answer = () => json(200, { items: [{ ...atKoramangala, ordersToday: { ...atKoramangala.ordersToday, placed: 2 } }] })
  act(() => void window.dispatchEvent(new Event('visibilitychange')))
  await waitFor(() => expect(figures(screen.getByRole('region', { name: 'Koramangala' }))).toContain('Orders today: 29'))
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, 'GET /admin/dashboard': () => json(200, { items: [] }) })

  renderApp('/')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByRole('region')).not.toBeInTheDocument()
})
```

#### `src/routes/_staff/index.tsx` (replace the whole placeholder file)

```tsx
import { queryOptions, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, buttonClass } from '@shopperstop/ui'
import type { components } from '@shopperstop/ui/api'
import { api } from '../../api'

type DashboardStore = components['schemas']['DashboardStore']

// One line per store the staff member may see: every store by name for an admin, their own for store staff.
const dashboardQuery = queryOptions({
  queryKey: ['admin', 'dashboard'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/dashboard')
    if (error) throw error.error
    return data.items
  },
})

// The seven statuses, in the order an order moves through them.
const counts: [keyof DashboardStore['ordersToday'], string][] = [
  ['placed', 'Placed'],
  ['accepted', 'Accepted'],
  ['packing', 'Packing'],
  ['ready', 'Ready'],
  ['out_for_delivery', 'Out for delivery'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
]

function StoreCard({ store }: { store: DashboardStore }) {
  const total = counts.reduce((sum, [status]) => sum + store.ordersToday[status], 0)
  const heading = `dashboard-${store.storeId}`
  return (
    <Card role="region" aria-labelledby={heading} className="flex flex-col gap-4 p-4 text-body text-ink">
      <h2 id={heading} className="text-h2">{store.storeName}</h2>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
        <dt className="font-semibold">Orders today</dt>
        <dd className="text-right font-semibold tabular-nums">{total}</dd>
        {counts.flatMap(([status, label]) => [
          <dt key={status}>{label}</dt>,
          <dd key={`${status}-count`} className="text-right tabular-nums">{store.ordersToday[status]}</dd>,
        ])}
        <dt className="mt-2 font-semibold">Revenue today</dt>
        <dd className="mt-2 text-right"><Price cents={store.revenueTodayCents} /></dd>
        <dt className="font-semibold">Low stock</dt>
        <dd className="text-right tabular-nums">{store.lowStockCount === 1 ? '1 product' : `${store.lowStockCount} products`}</dd>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Link to="/orders" search={{ store: store.storeId }} className={buttonClass({ variant: 'secondary' })} aria-label={`Orders at ${store.storeName}`}>Orders</Link>
        <Link to="/stock" search={{ store: store.storeId, lowStock: true }} className={buttonClass({ variant: 'secondary' })} aria-label={`Low stock at ${store.storeName}`}>Low stock</Link>
      </div>
    </Card>
  )
}

function Dashboard() {
  const dashboard = useQuery(dashboardQuery)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" />
      {dashboard.data === undefined ? (
        dashboard.isError ? (
          <ErrorBanner message="Could not load the dashboard." onRetry={() => void dashboard.refetch()} />
        ) : (
          <Skeleton variant="list" count={2} />
        )
      ) : (
        <>
          {dashboard.data.length === 0 ? (
            <Card className="p-6">
              <EmptyState title="No stores yet" description="Create a store, then its day shows here." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {dashboard.data.map((store) => (
                <StoreCard key={store.storeId} store={store} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/')({
  component: Dashboard,
})
```

## Risks / Trade-offs
- Five requests every 10 seconds per open board (A5). Fine for a store's few screens; the request to core for one "active" list removes four of them.
- Fake timers with `shouldAdvanceTime` run on the real clock too: a test that takes longer than its interval would see an extra poll. Each timer test counts requests right after its own `advanceTimersByTimeAsync`, and the suite ran green three times in a row on each of the two spike bases; a flake there is a finding, not something to retry around.
- Three tests depend on admin-P2-L7's notice text and mount point. If L7 changes either after this proposal, they fail loudly on the missing text.
- The announcement is worked out during render (state set under a guard on the `data` object), the pattern admin-stock's review accepted for its search field. It settles in one extra render. An effect would trip `react-hooks/set-state-in-effect`.
- `cancelQueries` on success also drops a poll that would have brought a new placed order: that order shows and is announced one interval later.
- The typed `Link` to `/stock` ties the dashboard to admin-stock's search shape; a change there is a type error here, which is the point.
- The red commit of task 1 does not typecheck (`src/orders-fake.ts` and `src/orders-rules.test.ts` import `./orders`, which arrives with the `feat:` commit), and `orders-rules.test.ts` fails as a file, so Vitest counts 15 failed tests and 2 failed files. Lint passes.
- The e2e delivers SS-DEMOAAAD for good within a run (Decision 10).

## Accepted ceilings
- A column shows the newest 100 orders of its status, and its count is of what it shows; the 101st and older are not on the board and nothing says so. `ponytail:` comment in `src/orders.ts`. Upgrade: core's "active" filter with a total, then a "showing 100 of n" line.
- One status change at a time per board (Decision 8).
- New orders are announced to assistive technology only: no sound, no visible marker. Upgrade: a ui pattern with a Figma state.
- A poll that moves or removes a card whose button has focus leaves the keyboard on `body` (only this user's own change restores focus, Decision 17).
- The sheet is page state: no URL for one order, and Back does not close it.
- Closing the sheet after its card moved returns focus to `body`.
- The status cannot be moved from the sheet; "Cancel order" cannot be reached from the card without opening the sheet.
- A cancel needs a reason although core does not (the customer sees it).
- History shows one status at a time and has no search or date range; `Page 1 of 1, 1 orders` is not singular.
- The dashboard is as old as its last load or tab focus.
- A `store` in the URL that is no store falls back to the first store without a message (as `/stock`).
- The two store-name and stores-list reads fail silently into "no name" and the alert respectively; a 403 on any query goes to the route's not-found page, as everywhere in this app.
- `idle` exists twice (`src/idle.ts`, `stock.tsx`) until a later lane or ui's `Button` takes it.
- With the sheet open over a failed refresh the words are on the page twice: the root's notice behind the modal and the sheet's own. Only the sheet's is reachable while it is open.
- A 404 on the sheet's read (not reachable: store staff cannot open another store's order) would keep the order with the sheet's notice and none at the root (L7 leaves `not_found` out).
- The ui modals do not stack (A8); the cancel dialog swaps with the sheet instead.
- Times are shown in Asia/Kolkata whatever the staff member's time zone.

## Migration Plan
None: no data, no config, no dependency. The two placeholders are replaced; every URL that worked before still does (`/orders` and `/` ignored search params before and now read `store`, `tab`, `status`, `page`).
