# mobile-P4-L2-T1 - Price primitive (mobile-serviceability-catalog task 1)
Status: done
## Doing
Task 1 done: Price in src/ui/price.tsx, tests green (5/5), gates run.
## Found
- Red run before the module: `npx jest --ci src/ui/price.test.tsx` -> Cannot find module './price' (1 failed suite, 0 tests).
- Green: 5 passed, 5 total.
- Gates: lint clean; typecheck has no error in price files, the remaining errors are other tasks' red tests (dialog, image-tile, status-message, stepper); full test shows 4 failing suites, all other tasks' files (image-tile, states, status-message, stepper); build exit 0; openspec validate: valid.
- Needed `npm run build --workspace packages/ui` once in the worktree so `@shopperstop/ui/format` resolves (dist is not tracked).
## Requests
## Blockers
