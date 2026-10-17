# admin-P5-L2-R1 - review of tasks 1 and 2 (store location fields and errors)
Status: done
## Doing
Reviewed 16e9456, a6ede83, 2cd05f9, 4311e2c against admin-store-location-dispatch. Verdict: approve.
## Found
- Test-first verified in a scratch worktree: 16e9456 red 2 of 336 (the two T1 tests), 2cd05f9 red 3 of 339 (the three T2 tests); feat commits green.
- Gates on HEAD: lint clean, typecheck clean, vitest 339 passed (27 files). No Playwright run.
- Scope: store-form.tsx, store-form.test.tsx, e2e/stores.spec.ts, tasks.md only (plus the team lead's change commit).
- Low: `String(store.location.lat)` renders values under 1e-6 as "1e-7", which the coordinate regex refuses, so an unrelated save on such a store is blocked. Not realistic for stores; optional.
## Requests
none
## Blockers
none

# R2 - review of task 3 (dispatch line), 2b45c6b and e3ac612
Status: done
## Doing
Reviewed against the dispatch scenarios, design decisions 5-7 and rider.d.ts on main. Verdict: approve.
## Found
- Test-first: 2b45c6b checked out in a scratch worktree: exactly 4 red of 343 (the four dispatch tests); e3ac612 green 343.
- Gates on HEAD: lint clean, typecheck clean, vitest 343 passed (28 files). No Playwright.
- Copy matches: open `offered` entry first with ceil(eta/60); off plus ": store has no location" only when the loaded store lacks `location`; online 0; waiting. Read enabled only for ready; card and sheet share the key `['rider','dispatch',id]`; refetchInterval pollMs; failed read renders nothing, no alert. Scope: only the listed files.
- Low: riders-fake.ts `...{ isOnline: false }` (three places) is needless; `Rider.isOnline` is optional in rider.d.ts, plain `isOnline: false` types fine.
- Low: a store read failure leaves the line at "Dispatch off" (no reason); acceptable.
## Requests
none
## Blockers
none
