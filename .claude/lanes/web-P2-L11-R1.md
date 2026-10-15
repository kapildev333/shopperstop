# web-P2-L11-R1 - review of web-P2-L11 task 1 (checkout failures)
Status: done
## Doing
Verdict: approve with nits. Gates re-run on 2964838: ui build, lint, typecheck, checkout.test.tsx 3x (23/23), full web Vitest 152/152, web build, git status clean, `openspec validate --all --strict` 15/15. Red commit 0af6d54 fails exactly the 3 new tests.
## Found
1. nit, apps/web/src/checkout.tsx:93-97: when the re-read returns an empty cart the page renders "Your cart is empty" for a tick before `navigate('/orders')` runs (same as the existing cartEmptied path, which sets the cache first). Acceptable; no fix needed.
2. nit, design.md: an `internal` that is core's own 500 after rollback also says "may have been placed". Conservative and safe; the copy never says "failed".
3. nit, checkout.test.tsx: no test that internal with a still-non-empty re-read stays on /checkout after a successful read; covered in effect by "core cannot be reached" only (read fails). Optional.
Checked and fine: MODIFIED requirements keep all old scenarios (Placement fails second half changed because unreachable is now internal; spec text matches); ShortLine reuses useLineWrite; place button stays enabled; double placement reasoning matches order.Place (cart row locked, cart cleared in the placement transaction, retry answers 400 cart empty); scope limited to checkout.tsx, its test, tasks, logs; no other test or e2e asserts the old copy.
## Requests
(none)
## Blockers
(none)
