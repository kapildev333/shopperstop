# mobile-P4-L2-T8 - store resolution and notices (mobile-serviceability-catalog task 8)
Status: done
## Doing
8.1 to 8.3 done and ticked in the feat commit. Next: none in this lane's brief (task 9 runs in parallel in this worktree).
## Found
- Commits: `9c3e823` test (red: `src/serviceability-gate.test.tsx`, six scenarios, and `src/serviceability.test.ts`, `resolvePincode caches the answer`); `e926f36` test (level-2 headings checked through `aria-level`, see below); `beb2e43` feat (`src/serviceability.ts`, `src/serviceability-gate.tsx`, ticks 8.1 to 8.3).
- Red run `cd apps/mobile && npx jest --ci src/serviceability-gate.test.tsx src/serviceability.test.ts` -> `Cannot find module './serviceability'` and `Cannot find module './serviceability-gate'`, 0 tests run.
- Green run of the same two files: `Test Suites: 2 passed, 2 total`, `Tests: 7 passed, 7 total`.
- Choices, flagged for the team lead:
  1. `resolvePincode` resolves `{ store?: Store }`; a 404 `not_serviceable` answers `{}`. The interface in design.md / design file names this type, but Decision 3's prose says the query answers `{ notServiceable: true }`. I followed the interface type; the two are equivalent for every caller.
  2. The serviceability query has `staleTime` 60 s (a `ponytail:` comment). Without it `resolvePincode` followed by `useStore` refetches on mount (TanStack's default staleTime is 0), which breaks the "no second request" scenario. Decision 3 is silent on it.
  3. `loading while the pincode is unknown` is the first test in its file. The store has no reset: its one storage read starts at the first render in a module graph, so only the first test can see the pincode unknown. Jest runs a file's tests in order, so this is deterministic; a comment says so.
  4. This RNTL version has no `level` option for `getByRole`; the level is checked with `toHaveProp('aria-level', 2)` on the heading.
- Gate runs (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0.
  - `npm run typecheck --workspace apps/mobile`: exit 2. All five errors are in task 9's files, not this task's: `src/catalog.ts` (lines 55, `'last' is of type 'unknown'`, four errors) and `src/catalog-grid.test.tsx` (`Cannot find module './catalog-grid'`). No error in `serviceability*.ts(x)`.
  - `npm run test --workspace apps/mobile -- --run`: exit 1. `Test Suites: 1 failed, 36 passed, 37 total`; `Tests: 3 failed, 138 passed, 141 total`. The one failing suite is `src/catalog-grid.test.tsx`, task 9's committed red test (`7d6609c`), not this task.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: exit 0 (`Change 'mobile-serviceability-catalog' is valid`).
- Not in scope, left alone: the `test` script and `expo-splash-screen` (L5a's, Decision 12); task 9's untracked `src/catalog.ts`, `src/catalog-card.tsx`, `src/catalog-grid.tsx`.
## Requests
- To the team lead: decide choice 1 (`{}` for a 404 versus `{ notServiceable: true }`) and choice 2 (the 60 s staleTime) in design.md, or accept them as written.
## Blockers
None for task 8. The typecheck and test gates stay red until task 9 lands its fixes.
