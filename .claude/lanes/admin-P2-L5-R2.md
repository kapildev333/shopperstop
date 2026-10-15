# admin-P2-L5-R2 - review of task 2 (step A review fixes, step B status actions) (reviewer)
Status: done

## Verdict
Approve with nits. No blocking finding; R1-1, R1-2, R1-6, R1-7 are closed.

## Gates (run by me, worktree root, Node 22.23.3)
- `make test-web`: exit 0. ui 25 files / 54 tests, admin 20 files / 222 tests, web 25 files / 140 tests.
- `openspec validate --all --strict`: 15 passed, 0 failed.
- Red-first confirmed in a throwaway worktree (removed afterwards): at c3d9c46 `5 failed | 208 passed (213)`, the five named tests; at 11b204f `9 failed | 213 passed (222)`.
- `git status --short` clean; product diff touches only brief paths (order-board.tsx, orders.ts, idle.ts, two test files) plus tasks.md ticks and the lane log. No e2e, no docker.

## Findings
R2-1 NIT, `order-board.tsx` Dialog title: `Mark ${confirm?.number} delivered?` renders "Mark undefined delivered?" while `confirm` is unset (and during any close transition). Closed dialog is out of the accessibility tree so no user sees it; fix if cheap: `confirm ? \`Mark ${confirm.number} delivered?\` : ''`.
R2-2 NIT, `order-board.tsx` result region: the `tabIndex={-1}` div is the focus target after a delivered order leaves, but it has no accessible name; a screen reader lands on a region reading only the status text (fine since the StatusMessage is inside). Accept.
R2-3 NIT, `order-board.tsx` `confirm` holds a snapshot: if a poll moves the order while the dialog is open, "Mark delivered" sends `delivered` and core answers 409, which the 409 path handles (re-read, "changed by someone else"). Correct; accept.
R2-4 NIT, `orders.ts` `useSetStatus.onSuccess`: `cancelQueries` also aborts a poll that may have carried other orders' fresh state; the next poll (10 s) repairs it. Accept (design decision).
R2-5 NIT, heading `aria-label` replaces the visible text and badge in the accessible name ("Placed, 2 orders"); WCAG label-in-name holds (name starts with the visible word). Accept.
R2-6 NIT (carried from R1-5), one 5 s `setInterval` per card; unchanged, accept.

## Checked and correct
- Announcement baseline: `board.isFetchedAfterMount && !board.isError` both needed, each with its test; cached cards still show at once.
- Sort by `Date.parse`; column `aria-label` count wording singular and plural.
- Button: never `disabled`/`loading`; `aria-disabled` + `idle` class; `advance` returns early while pending; label "Saving…" only on the pressed card; name from `aria-labelledby` (own id + number id).
- Mutation: 409 resolves with a re-read (`changedElsewhere`), a failed re-read throws the error body (bodiless arrives as `internal` from api.ts); `cancelQueries` awaited before `setQueryData`; the array is written whole; a terminal status removes the card. `reset()` is never called, so no reset-while-pending.
- Focus: effect runs only when focus fell to `body`; goes to the new button or, for a delivered/cancelled order, the result region.
- Page pattern `data === undefined ? (isError ? alert : skeleton) : content` kept; failed poll keeps the board.
- Delivered confirmation: Cancel sends nothing; confirm closes then mutates.
- Spec scenarios of task 2 (One button per card, Accept, Second press, Focus after a move, Mark delivered, Accepted by someone else, Cancelled by the customer, Status change fails, Conflict that cannot be read, Late poll answer, and step A's Back to a store, Back to the orders page, First refresh fails, Column name, Same second, one-of-five) each map to a test. "Cancelled by the customer" is covered by the 409 test's read-back path (order shown at its cancelled status leaves the board); "Sheet" scenarios are tasks 4 and 5.
- No scope creep: no sheet, no `removeQueries`, no fake-core change.
