# admin-P2-L5-R4 - review of task 4 (the History tab) (reviewer)
Status: done

## Verdict
Approve with nits. No blocking finding.

## Gates (run by me, worktree root, Node 22.23.3)
- `make test-web`: exit 0. ui 25 files / 54 tests, admin 22 files / 252 tests, web 25 files / 140 tests.
- `openspec validate --all --strict`: 15 passed, 0 failed.
- Red-first in a throwaway worktree (removed afterwards): d1205fb `16 failed | 236 passed (252)`, as reported. d1205fb holds only the test file; 6a82fbd is the 4.1 tick.
- `git status --short` clean; `routeTree.gen.ts` untouched. No e2e, no docker, no touch of :18080/15173/15174.

## Findings
R4-1 NIT, `order-history.tsx` the pager and the page-past-end redirect: on a typed `page=9` the empty state "No delivered orders" shows for one render before the effect moves to the last page. Cosmetic; accept.
R4-2 NIT, `order-history.tsx` "finished" column falls back to `placedAt` when neither `deliveredAt` nor `cancelledAt` is set; core never returns a finished order without one, so the branch is dead flexibility. Accept.
R4-3 NIT, tab links drop `status` and `page` and the Delivered/Cancelled chips push a history entry even when already selected; harmless.
R4-4 NIT, process: the 4.1 tick is its own `test:` commit (6a82fbd) after the test commit; order still test, feat. Accept.

## Checked and correct
- Status filter: Delivered is the default (omitted from the URL), Cancelled `status=cancelled`; both reset to page 1; the query key carries status and page; `placeholderData` keeps rows only when the status is the same, so the other status's rows never show under a filter.
- Pager: `aria-disabled` + `idle`, handlers guarded (`page > 1`, `page < pages`), never `disabled`; stays mounted over kept rows so focus survives; busy rows are `aria-busy` and dimmed.
- URL state: `validateSearch` accepts only `tab=history`, `status=cancelled`, integer pages above 1 clamped to `maxPage` 100000 (below core's limit 89478486 at 24 a page); anything else is omitted. Past-the-end pages move (replace) to the last page, or to page 1 on an empty list.
- Store selector sends `{ store, tab }` only; board and history both `key={storeId}`; no leak between stores.
- Polling: history is not polled; board unmounts on the History tab; `orderQuery` stops polling once the status is finished. `useSetStatus` removes inactive `['admin','orders',storeId]` lists, so a history page from before a delivery is re-read, while the active board is kept.
- Data states: `data === undefined ? (isError ? alert : skeleton) : content`; failed refresh keeps rows (root notice); retry reloads; empty state per status.
- Scope: only brief paths; no dependency; tokens and `@shopperstop/ui` components only; `go` in `useCallback` as the effect needs.
- Test-first order holds: test, tick, feat.
