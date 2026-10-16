# mobile-P4-L3-T6 - Merge at sign-in and the server store change (mobile-cart task 6)
Status: done for task 6 (commits `11de238`, `052c2ef`, `c07af72`); full mobile suite red only on task 8's pincode-sheet suites (below), not on task 6
## Doing
Nothing. Task 6 ticked (6.1 and 6.2) in the feat commit.
## Found
- Red: `11de238` `test: merge bodies in guest order` (`src/cart-merge.test.ts`, three tests). Run before the feature: `merge bodies in guest order` FAILED (sign-in sent no `PUT`, bodies `[]`); `guest cart discarded after merge` FAILED (guest cart still held Taaza 2). `merge dropped when the session changed` PASSED before the feature: with no merge, no request is sent and the guest line stays, so the test pins the rule rather than a red state.
- `052c2ef` `test: server cart emptied on a store change` (`src/cart-store-change.test.tsx`, two tests): PASSED before any feature. `Server cart emptied on a store change` (DELETE `/me/cart` 204, cache empty, pincode 560038 stored) and `Emptying the server cart fails` (DELETE unreachable: "Could not empty your cart.", pincode unchanged, cart kept) were already true from tasks 3 and L2's dialog. Committed as `test:` with no `feat:` needed, per the brief.
- Feat `c07af72` `feat: merge the guest cart at sign-in and empty it (mobile-cart task 6)`: `mergeGuestCart()` in `src/cart.ts` (web's `mergeGuestCart` with two changes: it awaits `loadGuestCart()` first, as the design file says, and reads the guest lines inside `queued`, after the token check, so a change made while the merge waits is the one sent); `await mergeGuestCart()` after `startSession` in `openSession` in `src/auth.ts`. Ticks 6.1 and 6.2 in `openspec/changes/mobile-cart/tasks.md`.
- Gates on the worktree at `c07af72` plus the other worker's uncommitted `src/pincode-sheet.tsx` (task 8, not staged by me):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0.
  - `npm run typecheck --workspace apps/mobile`: exit 0.
  - `npx jest --ci src/cart-merge.test.ts src/cart-store-change.test.tsx src/auth.test.ts src/cart.test.ts`: 4 suites, 20 tests passed.
  - `npm run test --workspace apps/mobile -- --run` (full): 2 suites failed, 3 tests: `src/cart-pincode-check.test.tsx` `failed lookup with an empty cart` (task 8's committed red test `fa93017`), and `src/pincode-sheet.test.tsx` `store change confirmed` and `store change kept` (they wait for the "Switch to the Indiranagar store?" heading after Continue; the in-progress `next()` in `src/pincode-sheet.tsx` is the other worker's uncommitted edit). Nothing in the failing suites imports `mergeGuestCart` or `src/auth.ts`; the task 6 diff is additive to `src/cart.ts` and touches no pincode code. Reported, not fixed.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-cart --strict`: `Change 'mobile-cart' is valid`.
## Requests
- to mobile-P4-L3 (task 8 worker and manager): `src/pincode-sheet.test.tsx` `store change confirmed` and `store change kept` fail on the current worktree. If task 8's `next()` change is the cause, it needs to keep those tests green (the brief says every test there stays green unchanged).
## Blockers
None for task 6.
