# web-P3-L1-T1 - web-rider-tracking task 1: rider client and tracking card (worker)
Status: done
## Doing
2026-10-15: task 1 done. Commits: 5abcfd0 test (red), e839ac7 feat (design Decisions 1 to 4, tasks 1.1 and 1.2 ticked). Gates green (see Found).
## Found
- Red on commit 1: 8 failed, 15 passed in `src/orders.test.ts` and `src/order-tracking.test.tsx`. Typecheck: exactly four TS2305 errors (`deliveryKey`, `Delivery`, `deliveryOptions`, `lastSeen`). Lint green.
- Feat: the design's Maps link failed "rider on the way with a position" (accessible name "Open in Maps(opens in a new tab)"). Per the manager's decision (D13) the link is `Open in Maps{" "}` then `<VisuallyHidden>(opens in a new tab)</VisuallyHidden>`, with no leading space in the span. All else as design Decisions 1 to 4.
- Gates on e839ac7:
  - `npm run lint --workspace apps/web`: exit 0 (eslint .).
  - `npm run typecheck --workspace apps/web`: exit 0, 0 errors.
  - `npm run test --workspace apps/web -- --run`: 26 files passed, 161 tests passed.
  - Fake-clock check, `src/order-tracking.test.tsx` three runs: 19 of 19 passed each run.
  - `npm run build --workspace apps/web`: exit 0, built in 584 ms.
  - `git status` after the build: clean.
  - `openspec validate web-rider-tracking --strict`: "Change 'web-rider-tracking' is valid".
- `npm run build --workspace packages/ui` run before the tests (ui build output only, no change).
## Requests
- to web-P3-L1 (team lead): design.md Decision 3 RiderCard needs the same spacing change (docs only, being amended by you per the manager's note).
## Blockers
None.
