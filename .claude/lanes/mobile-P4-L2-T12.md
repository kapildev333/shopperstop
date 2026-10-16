# mobile-P4-L2-T12 - category screen (mobile-serviceability-catalog task 12)
Status: done (tasks 12.1 to 12.3 ticked; task 10's worker runs in this worktree in parallel)
## Doing
Nothing open in this task.
## Found
- Commits on `lane/mobile-P4-L2-serviceability-catalog`: `1734dd6` test (red: `src/catalog-category-tabs.test.tsx`, `src/catalog-category.test.tsx`; failure `Cannot find module './app/category/[slug]'`, 2 suites failed, 0 tests); `9d57884`-era task 10 commits are not mine; `18ad020`-level test tweak and feat below.
- Commits: `<hash> test: the tab list is found by its label, a tablist is not an accessibility element in RNTL` (test change after red: RNTL's `getByRole('tablist')` does not match a `View` without `accessible`; `accessible` would hide the tabs from VoiceOver/TalkBack, so the test queries `getByLabelText('Subcategories')`); `31e195f` test (the two files wrap the screen in `QueryClientProvider` because a map-based `renderRouter` skips the root layout; `router.getPathname()` instead of `toHavePathname`, which has no types in this expo-router, see Blockers); `db98e61` feat (`src/app/category/[slug].tsx`, `useCategories` in `src/catalog.ts`); `18ad020` chore (ticks 12.1 to 12.3).
- Design choices, flagged: the screen header (Back, parent title, Search) sits outside `StoreGate` (design Decision 3: each screen keeps its header outside the gate), so the title needs the store: `useStore()` in the screen and `useCategories(storeId | undefined)` disabled until a store is open (`enabled: !!storeId`; the design's signature took a string). The header title is empty until the tree loads.
- Selected tab's bar (4 wide, `accent`, top and bottom 8) is drawn; tab names use `fontFamily(600)` when selected.
- "All" is the parent; its tile image is the parent's.
- Search button pushes `/search` (task 14 creates the route; until then the header button leads to an unmatched route, not tested).
- Gates (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0 (`eslint .`, no output).
  - `npm run typecheck --workspace apps/mobile`: no errors in this task's files. Remaining errors are task 10's (in progress, uncommitted/red): `src/pincode-sheet.test.tsx(8,30)` cannot find `./pincode-sheet`; `src/pincode-sign-in.test.tsx(20,18)` and `(21,18)` `toHavePathname` / `toHaveSearchParams` not in the type of `expect` (no typings in this expo-router version).
  - `npm run test --workspace apps/mobile -- --run`: jest `Test Suites: 3 failed, 40 passed, 43 total`, `Tests: 2 failed, 144 passed, 146 total`. The three failing suites are task 10's red files (`pincode-sheet.test.tsx`, `pincode-first-visit.test.tsx`, `pincode-sign-in.test.tsx`). Both category suites pass (`Tests: 2 passed, 2 total`, no console output). The chain stopped before `node --test`.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
## Requests
- To the mobile manager / task 10 worker: `toHavePathname` and `toHaveSearchParams` lack typings in this expo-router version, so `pincode-sign-in.test.tsx` fails typecheck. Use `getPathname()` / `getSearchParams()` as this task does.
## Blockers
None for task 12. Full suite red only on task 10's red tests.
