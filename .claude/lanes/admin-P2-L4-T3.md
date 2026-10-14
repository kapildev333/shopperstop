# admin-P2-L4-T3 - worker log, task 3 of admin-stock (step A: review fixes; step B: store switch dialog, save failures, 500-row cut, URL values, store name)
Status: started
## Doing
Step A, 3.1 committed `0f49b36` (red `4 failed | 127 passed (131)`). 3.2 step A route file: admin `131 passed (131)`; `make test-web` exit 0 (ui 54, admin 131, web 20); `openspec validate admin-stock --type change --strict` valid; `git status --short` only the route file before the commit. Committed as `bf3e6ac`. 3.3 e2e line: one line added in `e2e/stock.spec.ts` (written, not run); `npm run lint` exit 0, `npm run typecheck` exit 0, admin `131 passed (131)`. Committing. Next: 3.4 step B red tests.
## Found
- Blocks were copied from design.md by a line-range extractor (byte copy of each fenced block), not retyped.
- Step A red run: the four named tests failed (in-flight replaced test, focus test, value-as-stored test, URL store change test); "a save that answers after the store changed" is green by design.
## Requests
None.
## Blockers
None.
