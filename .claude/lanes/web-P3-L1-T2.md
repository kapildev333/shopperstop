# web-P3-L1-T2 - web-rider-tracking task 2: rider names in the history, countdown from the order (worker)
Status: done
## Doing
2026-10-15: task 2.1 tests written (red), committed as `test: rider names in the history and the order's own promise`. 2.2 feat landed (design Decisions 5 and 6), tasks 2.1 and 2.2 ticked.
## Found
- Red on commit 1: exactly three failing in `src/order-tracking.test.tsx` (21 tests, 18 pass):
  - "rider events name the rider": no "Picked up by Asha" text in the history.
  - "countdown uses the order's promise": no "Arriving in 17 minutes" (the page reads the store's 10 and shows 7 instead).
  - "no countdown once finished": fails at its control step, "Arriving in 7 minutes" not shown, because the page has no store read (the store is no longer seeded here, so the countdown is absent). The control is what the brief names as red for this test.
- Gates on commit 1: `npm run lint --workspace apps/web` exit 0; `npm run typecheck --workspace apps/web` exit 0.
- Feat (design Decisions 5 and 6, `order-tracking.tsx` only): 21 of 21 pass; the full apps/web suite 26 files, 163 tests pass.
- Gates on the feat commit: `npm run lint --workspace apps/web` exit 0; `npm run typecheck --workspace apps/web` exit 0; `npm run test --workspace apps/web -- --run` 26 files, 163 tests passed; `npm run build --workspace apps/web` exit 0; `git status` after the build shows only the feat file; `openspec validate web-rider-tracking --strict`: "Change 'web-rider-tracking' is valid".
- Shell note: the worktree's shell is zsh, so `PIPESTATUS` is unset; exit codes were captured without pipes.
## Requests
None.
## Blockers
None.
