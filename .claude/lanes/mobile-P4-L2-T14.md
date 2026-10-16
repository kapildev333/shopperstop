# mobile-P4-L2-T14 - search screen (mobile-serviceability-catalog task 14)
Status: done (tasks 14.1 to 14.3 ticked in the feat commit)
## Doing
Nothing open in this task.
## Found
- Commits on `lane/mobile-P4-L2-serviceability-catalog`: `20f4a1b` test (red: `src/catalog-search-submit.test.tsx` `search submits`, `src/catalog-search.test.tsx` `no query shows search for products`, `no results suggests categories`, `clear search`; failure `Cannot find module './app/search'`); `9a3c649` test (the same two files: the category links are awaited, because the screen loads categories after its first render, and the submit test reads `router.getSearchParams()`, because `toHaveSearchParams` is not typed on `renderRouter`'s result; both found by the typecheck and the first green run); `6a4e39a` feat (`src/app/search.tsx`, ticks 14.1 to 14.3); this log's chore commit follows.
- The brief's scenario names: `search submits`, `no results suggests categories`, `clear search`, and `no query shows search for products` (named in the brief's starts-from list, kept). Each renders its own map-based `renderRouter` with `QueryClientProvider`; only the submit test navigates (`setParams`).
- Clear search focus: RN's jest TextInput mock is a class whose `focus` is a prototype `jest.fn`; the test spies on `TextInput.prototype.focus`. Green, no act warnings.
- Design choices within the design file: the box is `accessibilityRole="search"`, not `role="search"`, because RN's `Role` union has no `search` (typecheck); the result count header is a level-1 `Text` passed into `ProductGrid`'s header, its total read through `useProductPages(storeId, { q })`, the same query key the grid uses (react-query shares it, no second request); the no-results and no-query states are one `Hint` component, not `EmptyState`, because the design's padding is 48 16 24 and `EmptyState` fixes 24.
- Ceiling: the search text is local state seeded from `q` at mount; a later `q` set from outside the screen does not overwrite what is typed. Not in the design; no scenario needs it.
- Not built: nothing from the design file "13 · Search" was left out. The Home search button is task 11's.
## Requests
None.
## Blockers
None for task 14.
- Gates (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0 (`eslint .`, no output). First run failed on an unused `storeId`; removed.
  - `npm run typecheck --workspace apps/mobile`: exit 0 (`tsc -p tsconfig.json`). First run failed on `role="search"` (not in RN's `Role`), the `TextInput` ref type, and `toHaveSearchParams`; fixed as above.
  - `npx jest --ci src/catalog-search-submit.test.tsx src/catalog-search.test.tsx`: `Tests: 4 passed, 4 total`.
  - `npm run test --workspace apps/mobile -- --run`: exit 1 from one suite only: `src/pincode-first-visit.test.tsx` `first visit opens the pincode sheet` (task 11's red test, expected). `Test Suites: 1 failed, 46 passed, 47 total`, `Tests: 1 failed, 162 passed, 163 total`. Task 10's sign-in and sheet tests are green on this branch now.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
- Not committed by this lane: `apps/mobile/src/catalog-home.test.tsx` (untracked, another worker's task 11 file) was left alone.
