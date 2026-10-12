# Tasks

Three tasks, one worker each, in order 1 → 2 → 3 on branch `lane/web-P2-L3-cart` (each imports the previous). Task 1 can start now (pure module, no generated types). Task 2 starts once core-P2-L4 (`core-stock-cart`, with `/me/cart*` in `packages/ui/src/api/core.d.ts`) and web-P2-L1 task 2 (`src/cart.ts` stub, `src/product-card.tsx`, `src/test-data.ts` builders) are on main. Task 3 starts once web-P2-L1 task 4 is on main (its last edit to the files task 3 touches). The branch is rebased on main before each start. Read `design.md`: it fixes files, interfaces, copy and test names. Where the generated types or web-P2-L1's landed code differ from design.md, follow them and note it in the lane log; stop and report on a behaviour difference.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`: `npm install` (after each rebase), `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build, and for tasks 2 and 3 the e2e with the Makefile `E2E_ENV` exported: `CI=1 npm run e2e --workspace apps/web` (ask the manager first: one e2e at a time), and `openspec validate web-cart --strict`. Commit as the repo's configured author, no trailers.

## 1. Guest cart model

Scope: `apps/web/src/guest-cart.ts`, `src/guest-cart.test.ts`, `src/test-setup.ts` (one `clearGuestCart()` line in `afterEach`), this file's checkboxes.
Scenarios: Customer guest cart lines › all three; Customer guest cart storage › both; Customer cart totals › "Guest totals follow the store's fees"; Customer cart merge at sign-in › "Merge bodies in guest order".
Failing tests: `src/guest-cart.test.ts` › "guest line set and removed", "guest line clamped", "another store replaces the guest cart", "guest cart persisted and restored", "guest cart with blocked storage", "guest totals follow the store's fees", "merge bodies in guest order".

- [x] 1.1 Tests committed red (`test: guest cart reducer, storage and totals`)
- [x] 1.2 `guest-cart.ts` and the `test-setup.ts` line (`feat: guest cart model`); lint, typecheck, Vitest, build green

## 2. Server cart, the cart hook and the merge at sign-in

Scope: `apps/web/src/cart.ts` (replace web-P2-L1's stub, keep `useCartQuantity(product)`), `src/cart.test.tsx`, `src/auth.ts` (`openSession` awaits `mergeGuestCart()`), `e2e/cart.spec.ts` (one test), this file's checkboxes.
Scenarios: Customer cart behind every Stepper › both; Customer cart merge at sign-in › "Guest cart discarded after merge", "Guest cart merges against core".
Failing tests: `src/cart.test.tsx` › "card adds to the guest cart", "card shows the server cart", "guest cart discarded after merge"; `e2e/cart.spec.ts` › "guest cart merges against core".

- [ ] 2.1 Tests committed red (`test: cart hook over guest and server carts, merge at sign-in`)
- [ ] 2.2 `cart.ts`, `auth.ts` (`feat: server cart and guest merge at sign-in`); all gates green, e2e green (smoke, auth, account, browse, cart)

## 3. Drawer, bar, header button and store-change confirm

Scope: `apps/web/src/cart-drawer.tsx`, `src/cart-drawer.test.tsx`, `src/store-change.tsx`, `src/store-change.test.tsx`, `src/catalog.ts` (`serviceabilityOptions` only), `src/pincode-sheet.tsx` (the submit line only), `src/routes/__root.tsx`, `src/test-setup.ts` (`closeCart()` in `afterEach`, if used), `e2e/cart.spec.ts` (three tests), this file's checkboxes.
Scenarios: Customer server cart › "Server cart clamps above stock"; Customer cart drawer › all four; Customer cart drawer states › "Empty, loading and failed cart"; Customer cart minimum order › "Below the minimum order"; Customer cart bar and header button › both; Customer store change confirm › both; Customer store change outcome › all three.
Failing tests: `src/cart-drawer.test.tsx` › "drawer lines and totals", "free delivery", "checkout link signed in and out", "out-of-stock line", "empty, loading and failed cart", "below the minimum order", "bar and header follow the cart"; `src/store-change.test.tsx` › "same store or empty cart", "store change confirmed", "store change cancelled", "emptying the server cart fails"; `e2e/cart.spec.ts` › "server cart clamps above stock", "cart drawer against core", "store change against core".

- [ ] 3.1 Tests committed red (`test: cart drawer, bar, header button and store change`)
- [ ] 3.2 `cart-drawer.tsx`, `store-change.tsx`, `serviceabilityOptions`, sheet submit, root wiring (`feat: cart drawer, sticky bar, header cart and store-change confirm`); all gates green, e2e green, axe clean

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-cart` after 3.2 lands.
- Area manager archives the change by PR after the feature PR merges.
