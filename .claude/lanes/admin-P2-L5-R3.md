# admin-P2-L5-R3 - review of task 3 (step A review fixes, step B order sheet and cancel) (reviewer)
Status: done

## Verdict
Approve with nits. No blocking finding; R2-1 and R2-2 are closed.

## Gates (run by me, worktree root, Node 22.23.3)
- `make test-web`: exit 0. ui 25 files / 54 tests, admin 21 files / 236 tests, web 25 files / 140 tests.
- `openspec validate --all --strict`: 15 passed, 0 failed.
- Red-first in a throwaway worktree (removed afterwards): 941c740 `1 failed | 222 passed (223)` (the named delivery test); 143efcc `13 failed | 223 passed (236)`. 941c740 holds only the appended test and the 3.1 tick.
- No e2e, no docker, no touch of :18080.

## Findings
R3-1 NIT, `order-sheet.tsx` cancel uses its own `useSetStatus`, so the board's "one change at a time" does not cover it; a card button could be pressed during a cancel only if the modal dialog were bypassed. Accept.
R3-2 NIT, `maxLength={500}` counts UTF-16 units, core counts runes after trimming: astral characters hit the limit earlier, never later. Safe side; accept.
R3-3 NIT, `cancel.data` ("Order cancelled." / conflict notice) stays on the sheet until it unmounts; intended by the scenarios. Accept.
R3-4 NIT, card number is now a ghost `Button`; the next-status button's `aria-labelledby` still resolves to its text. Accept.

## Checked and correct
- Sheet content: status badge via `statusBadge` (accent/success/neutral), items with line prices and totals, customer with `tel:` link or "No phone number", address with optional line 2, events with actor and note, cancel reason.
- Cancel: offered only for placed/accepted; empty reason sends nothing and shows the field error, cleared on typing; Keep order is the first footer button; Escape and Keep close via `closeDialog`, which returns early while pending and calls `reset()` only on error (not pending).
- `aria-disabled` + `idle` + "Cancelling…", never `disabled`/`loading`; `submit` returns early while pending, so a second press sends nothing.
- 409 is resolved by the shared mutation (re-read, `changedElsewhere`), bodiless failures arrive as `internal`; failed cancel shows an ErrorBanner in the dialog and keeps the reason.
- Late poll: `cancelQueries` awaited on both the board and the order key before `setQueryData`; terminal status leaves the board.
- Sheet over a refetching board: the order has its own key outside the store lists, seeded from the card in `show()`; sheet polls every 10 s; failed refresh keeps the data and shows the sheet's own notice (the allowed one).
- `Sheet open={!asking}` and a separate Dialog: no stacking, no Dialog inside the Sheet.
- Step A: result wrapper named `Status change`, dialog title no longer "undefined".
- Scope: only brief paths plus tasks.md ticks and the T3 log; `routeTree.gen.ts` untouched; no new dependency; colours from tokens.
- Test-first order holds: test, fix, test, feat.
