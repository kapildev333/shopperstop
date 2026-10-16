# rider-P4-L3-R2 - review of task T2 (commit 0fa5038)
Status: done (approve)
## Found
- Deleted `since`, `useSince`, `when` in `apps/rider/src/format.ts` are byte-identical to `packages/ui/src/app/time.ts`; `time.test.tsx` covers since, when (IST) and useSince ticking.
- `itemCount` kept with its test; `ready.tsx` and `history.tsx` import from `@shopperstop/ui/app` (exported via `index.ts`); no leftover copies or dead imports; grep for `useSyncExternalStore|Intl.DateTimeFormat|openapi-fetch'` empty.
- Refactor without a failing test is justified: pure move, behaviour tested in ui and rider page tests.
- Scope: only the brief's files plus tasks.md and the T2 log.
- Gates (scratch worktree at 0fa5038, ui built): rider lint, typecheck clean; test 10 files / 61 passed; build ok.
## Blockers
None.
