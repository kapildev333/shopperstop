# mobile-P4-L2-T15 - follow-up: category filters, store city, cancel dialog (mobile-serviceability-catalog task 15)
Status: done (tasks 15.1 to 15.5 ticked; 15.5 in this chore commit)
## Doing
Nothing open in this task.
## Found
- Contract grep passed on `packages/ui/src/api/core.d.ts`: `inStock?: boolean` and `sort?: "price_asc" | "price_desc"` on the products query, `city?` on Store.
- Commits on `lane/mobile-P4-L2-serviceability-catalog`:
  - `d656ef6` test (red): `src/catalog-category-filters.test.tsx` `filters sent to core`, `src/catalog-home-city.test.tsx` `header names the city`. Both failed on the element they name (`Unable to find an element with role: button, name: In stock`; `... name: Delivering to 560034, Bengaluru`).
  - `1c3744f` feat: `ProductFilter` gains `inStock` and `sort`; the category screen holds the two chips "In stock" and "Price: low to high" in `CategoryBody` (state survives `setParams`), and sends only the filters that are on, so the query key changes and page one is read again. Chip row padding 8 8 0, gap 8.
  - `2908030` feat: Home's pincode button reads "Delivering to <pincode>, <city>" when the resolved store (open or closed) has a city; unchanged otherwise. The saved address label is not used (design.md Decision 14).
  - `8cdd5dd` refactor: `src/orders-cancel.tsx` imports `Dialog, DialogFooter` from `./ui/dialog`; Keep order first; the fallback comment is removed. `src/orders-cancel.test.tsx` and `src/orders-tracking-cancel.test.tsx` are unchanged and green (8 of 8). No edit was needed.
  - This chore commit: 15.5 ticked and this log.
- Gates (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0.
  - `npm run typecheck --workspace apps/mobile`: exit 0.
  - `npm run test --workspace apps/mobile -- --run`: exit 0, `Test Suites: 68 passed, 68 total`, `Tests: 235 passed, 235 total`.
  - `npm run build --workspace apps/mobile`: exit 0, `Exported: dist`.
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
- Flake check, `cd apps/mobile && npx jest --ci` five times in a row (after the gate run): 5 of 5 exit clean, each `Tests: 235 passed, 235 total`, `Test Suites: 68 passed, 68 total`. No `FAIL` line, no `✕`, no `console.error` or act() warning in any run. The one failure the manager saw in four earlier runs was not reproduced in these five (six runs in total including the gate run). Its test name was not captured, so it stays unidentified.
- Out of scope, seen and left alone: L5a's request to change the `test` script in `apps/mobile/package.json` (`jest --ci && node --test scripts/*.test.mjs`) is still open; task 6 keeps the `test` script on the branch as L5a's.
## Requests
- to mobile manager: the flake run above found no failing test in 5 full runs; the earlier failure is still uncaptured. If it comes back, the lane should keep the failing run's log (`npx jest --ci` output), not the summary.
## Blockers
None.
