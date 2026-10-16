# ui-P4-L2 T2 - time helpers (task 2)
Status: done
## Doing
Committed `test: relative and stamped times` (acb3958, red on the missing `./time`), then `feat: since, useSince and when in the app entry` (time.ts; tasks 2.1 to 2.3 gates green). `src/app/index.ts` untouched; T3 adds the export line.
## Found
- `src/app/time.ts` is `apps/rider/src/format.ts` minus `itemCount`, unchanged in behaviour: `since`, the 5 000 ms `everyFewSeconds`, `useSince` via `useSyncExternalStore`, the module-level `Intl.DateTimeFormat` for `when` (Asia/Kolkata).
- The file is not exported from `@shopperstop/ui/app` until T3 adds `export * from './time'` to `index.ts`.
- Shared worktree `node_modules` was broken during the run (T1's `npm ci` in progress); waited for it to finish, then re-ran.
## Requests
None.
## Blockers
None.
