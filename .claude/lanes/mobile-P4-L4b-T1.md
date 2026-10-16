# mobile-P4-L4b-T1 - checkout logic (`src/checkout.ts`, task 1 of mobile-checkout)
Status: done
## Doing
Done: test commits 35aacfe and 253ecde, feat commit e103fff; tasks 1.1 and 1.2 ticked.
## Found
- Red (before feat): `npx jest --ci src/checkout.test.ts` → `Cannot find module './checkout' from 'src/checkout.test.ts'` (packages/ui built first, as the gate needs).
- Green: `src/checkout.test.ts` 19/19 (2 scenarios, outcome table 8 rows, refusal copy 7 rows, mark text, block precedence).
- `src/checkout.ts` exports `postOrder`, `cartEmptied`, `placeOrder`, `refusalOf`, `outcomeOf`, `shortText`, `blockReason`, types `Refusal`, `Outcome`. Imports `queued`, `cartKey`, `CartView`, `CartProduct` from `./cart` (L3 exports); no edit to `src/cart.ts`.
- Out-of-stock refusal carries `detail: 'Remove them to place your order.'` (design.md Decision 7 and module interface); web's `refusalOf` has no detail. The red test was corrected to the design before feat (commit 253ecde).
- Full gate chain (`packages/ui` build, lint, typecheck, `jest --ci` plus scripts, app build, `openspec validate mobile-checkout --strict`) exit 0: 82/82 suites, 328/328 tests. One earlier run had `src/account.test.tsx` "Profile shown" fail under parallel load (passes alone, 13/13); the next full run was green.
## Requests
none
## Blockers
none
