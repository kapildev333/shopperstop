# mobile-P4-L2-T7 - cart counts stub (mobile-serviceability-catalog task 7)
Status: done
## Doing
7.1 to 7.3 done and ticked in the feat commit. Next: none in this lane's brief (task 8 is the next lane's).
## Found
- Commits: `f5584a4` test (red: `src/cart.test.ts`, `counts belong to one store` and `clear empties the counts`); `1d26a22` test (the first test unmounts its hook at its end, see below); `9928597` feat (`src/cart.ts`, the `jest.setup.ts` line, ticks 7.1 to 7.3).
- Red run `cd apps/mobile && npx jest --ci src/cart.test.ts` -> `Cannot find module './cart' from 'src/cart.test.ts'`, 0 tests run. The `jest.setup.ts` line went in with the feat commit, so the red commit does not break every other suite.
- Module: state `{ storeId?, quantities, summary }` replaced on each change; `useSyncExternalStore` with the summary cached inside the state (so `useCartSummary` has a stable snapshot). `setQuantity` at another store drops the old counts first; quantity 0 deletes the line. `clearCart` is an async function resolving `undefined`. The `ponytail:` comment names the ceiling: counts vanish on reload until L3.
- Deviation, flagged: the brief's scope has no mention of this, but the first test needed `hook.unmount()` at its end. The `jest.setup` `afterEach` calls `clearCart()` before the Testing Library cleanup unmounts the hook, so the hook's listener updated outside `act` (two `not wrapped in act` warnings). The fix is in the test (`1d26a22`), not in the module; `clearCart` is unchanged.
- `jest.setup.ts`: `import { clearCart } from './src/cart'` and `await clearCart()` after `closePincodeSheet()` in `afterEach`. One import line and one call, as the brief says.
- Gates (worktree root, PATH line from the brief): `npm run build --workspace packages/ui` exit 0 (`tsc -p tsconfig.build.json`); `npm run lint --workspace apps/mobile` exit 0 (`eslint .`); `npm run typecheck --workspace apps/mobile` exit 0 (`tsc -p tsconfig.json`); `npm run test --workspace apps/mobile -- --run` exit 0: jest `Test Suites: 32 passed, 32 total`, `Tests: 123 passed, 123 total`, node:test `# tests 7 # pass 7 # fail 0`; `npm run build --workspace apps/mobile` exit 0 (`Exported: dist`); `openspec validate mobile-serviceability-catalog --strict` exit 0 (`Change 'mobile-serviceability-catalog' is valid`).
- Not in scope, left alone: the `test` script and `expo-splash-screen` (L5a's, Decision 12).
## Requests
None.
## Blockers
None.
