# mobile-P4-L2-T9 - catalog queries, product card, paged grid (mobile-serviceability-catalog task 9)
Status: done
## Doing
9.1 to 9.3 done and ticked in the feat commit. Next: none in this lane's brief (tasks 10 and 11 are the next lanes').
## Found
- Commits: `7d6609c` test (red: `src/catalog.test.ts`, `src/catalog-card.test.tsx`, `src/catalog-grid.test.tsx`); `1d71c4c` feat (`src/catalog.ts`, `src/catalog-card.tsx`, `src/catalog-grid.tsx`, ticks 9.1 to 9.3).
- Red run `cd apps/mobile && npx jest --ci src/catalog.test.ts src/catalog-card.test.tsx src/catalog-grid.test.tsx` -> `Cannot find module './catalog' from 'src/catalog.test.ts'`, `Cannot find module './catalog-card' from 'src/catalog-card.test.tsx'`, `Cannot find module './catalog-grid' from 'src/catalog-grid.test.tsx'`; `Test Suites: 3 failed, 3 total`, `Tests: 0 total`.
- Green after the feat: the three suites 11 passed, 11 total.
- Test names are the brief's scenario names: card `card links and prices`, `add shows the count`, `out-of-stock card`; grid `load more while pages remain`, `end of the list loads the next page`, `no load more at the last page`; catalog `stock label reads the count`, `findCategory finds a child under its parent`, `imageUrl prefixes the core origin`, `picks are the first 12 in stock`.
- Deviation, flagged: `initialNumToRender={pageSize}` (24 rows, two pages of products) on the grid. The default 10 rows showed 20 of the first page's 24 products in Jest, and a scroll event did not render page 2's items either, so the load-more scenario could not be observed. The comment in `catalog-grid.tsx` names the ceiling.
- Deviation, flagged: the brief's Starts-from names no test for `CategoryGrid`, which 9.2 lists. Added one red test in `src/catalog-card.test.tsx`: `category grid links each parent`.
- Deviation, flagged: the design's "empty flex:1 cell" for an odd last product is a `View` cell with `flex: 1, maxWidth: '50%'` around each `ProductCard`. Layout only; no test.
- Not built here, on purpose (no test in this task names them, and the screens that use them are tasks 11 to 13): `useCategories`, `useProduct`, `useMoreIn`, `findCategoryById`, and the `ProductCard` `width` prop for Home's rail. Task 11 and 12 add them to `catalog.ts`.
- Gates (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 0 (`eslint .`, no output).
  - `npm run typecheck --workspace apps/mobile` exit 0 (`tsc -p tsconfig.json`), after typing the page list (`StoreProductList`) and the footer `undefined`.
  - `npm run test --workspace apps/mobile -- --run` exit 0: jest `Test Suites: 37 passed, 37 total`, `Tests: 141 passed, 141 total`; node:test `# tests 7`, `# fail 0`. No act or console warnings in the run. Task 8's suites are in this run and pass.
  - `npm run build --workspace apps/mobile` exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
- The worktree had task 8's files untracked at the start of this run; they are committed by task 8 (`beb2e43`) and this lane's commits sit on top. Only the explicit paths of this task were staged.
## Requests
None.
## Blockers
None.
