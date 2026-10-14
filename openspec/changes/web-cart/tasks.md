# Tasks

Five tasks, one worker each, in order 1 → 2 → 2b → 3a → 3b on branch `lane/web-P2-L3-cart` (each imports the previous). Task 1 can start now (pure module, no generated types). Task 2 starts once web-P2-L1 task 2 (`src/cart.ts` stub, `src/product-card.tsx`, `src/test-data.ts` builders) is on main; core-P2-L4 (`/me/cart*` in `packages/ui/src/api/core.d.ts`) is (#106), and design.md was reconciled with it on 2026-10-13. Tasks 3a and 3b: web-P2-L1 is merged (#119) and this branch is re-stacked on it; design.md was re-read against that code on 2026-10-13. The branch is rebased on main before each start. Read `design.md`: it fixes files, interfaces, copy and test names. Where the generated types or web-P2-L1's landed code differ from design.md, follow them and note it in the lane log; stop and report on a behaviour difference.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`: `npm install` (after each rebase), `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build, and for tasks 2 and 3 the e2e with the Makefile `E2E_ENV` exported: `CI=1 npm run e2e --workspace apps/web` (ask the manager first: one e2e at a time), and `openspec validate web-cart --strict`. Commit as the repo's configured author, no trailers.

## 1. Guest cart model

Scope: `apps/web/src/guest-cart.ts`, `src/guest-cart.test.ts`, `src/test-setup.ts` (one `clearGuestCart()` line in `afterEach`), this file's checkboxes.
Scenarios: Customer guest cart lines › all three; Customer guest cart storage › both; Customer cart totals › "Guest totals follow the store's fees"; Customer cart merge at sign-in › "Merge bodies in guest order".
Failing tests: `src/guest-cart.test.ts` › "guest line set and removed", "guest line clamped", "another store replaces the guest cart", "guest cart persisted and restored", "guest cart with blocked storage", "guest totals follow the store's fees", "merge bodies in guest order".

- [x] 1.1 Tests committed red (`test: guest cart reducer, storage and totals`)
- [x] 1.2 `guest-cart.ts` and the `test-setup.ts` line (`feat: guest cart model`); lint, typecheck, Vitest, build green

## 2. Server cart, the cart hook and the merge at sign-in

Scope: `apps/web/src/cart.ts` (replace web-P2-L1's stub, keep `useCartQuantity(product)`), `src/cart.test.tsx`, `src/auth.ts` (`openSession` awaits `mergeGuestCart()`), `src/guest-cart.ts` (type only: `CartView` gains `replaced?: boolean; replacedStoreId?: string`), `src/guest-cart.test.ts` (one pin test), `src/product-card.test.tsx` (only the two lines resolving a store, if "add shows the count" lacks them), `e2e/cart.spec.ts` (one test), this file's checkboxes.
Scenarios: Customer cart behind every Stepper › all three; Customer cart merge at sign-in › "Guest cart discarded after merge", "Guest cart merges against core"; Customer guest cart lines › "Out of stock at another store keeps the guest cart".
Failing tests: `src/cart.test.tsx` › "card adds to the guest cart", "card shows the server cart", "card ignores a cart at another store", "guest cart discarded after merge"; `e2e/cart.spec.ts` › "guest cart merges against core". Pin, green on arrival (say so in the commit body): `src/guest-cart.test.ts` › "out of stock at another store keeps the guest cart".
The cart shown is always the one core answered: cache every `PUT` answer whole and read `items` and `storeId` from it; never work the cart out from the request, `clamped` or `replaced` (design.md, `src/cart.ts` and Decision 15).
For task 3's replaced notice (D27) this task keeps where a replaced cart was, as `replacedStoreId` on the cached answer: `setLine` reads the cached cart's `storeId` before the `PUT`; the merge reads `GET /me/cart` before its pushes and also carries `replaced` from any push. No Vitest test can reach it (no HTTP mocks); task 3's two e2e tests prove it.

- [x] 2.1 Tests committed red (`test: cart hook over guest and server carts, merge at sign-in`)
- [x] 2.2 `cart.ts`, `auth.ts` (`feat: server cart and guest merge at sign-in`); all gates green, e2e green (smoke, auth, account, browse, cart)

## 2b. Quick taps each count (fix from the task 2 review)

Scope: `apps/web/src/cart.ts` (the write queue of design.md "Write queue": `asked`, `queued`, `useAsked`; `setLine`, `clearCart`, `mergeGuestCart` through it; `useCartQuantity` reads `useAsked` first), `src/cart.test.tsx` (three tests), `e2e/cart.spec.ts` (one test), this file's checkboxes.
Scenarios: Customer cart quick taps › "Quick taps each count", "Failed write returns to the cart's count", "Quick taps against core"; Customer cart behind every Stepper › "Guest taps each count".
Failing tests: `src/cart.test.tsx` › "quick taps each count", "failed write returns to the cart's count" (both red on the first count after a tap: the card shows 1, not 2); `e2e/cart.spec.ts` › "quick taps against core" (red: the card ends on 1 or the line is gone). Pin, green on arrival (say so in the commit body): `src/cart.test.tsx` › "guest taps each count".
Vitest proves what the Stepper shows and that it returns to the cart's count; only the e2e proves the order of the writes, that the last quantity wins and that the cache ends on core's latest answer (design.md, Test strategy, "Quick taps").

- [x] 2b.1 Tests committed red (`test: quick taps each count`)
- [x] 2b.2 The write queue in `cart.ts` (`fix: quick taps each count, cart writes one at a time`); all gates green, e2e green

## 3a. Drawer, bar and header cart button

Scope: `apps/web/src/cart-drawer.tsx`, `src/cart-drawer.test.tsx`, `src/routes/__root.tsx` (`<CartButton />` in the banner, `<CartBar />` and `<CartSheet />` after `main`; `main`'s classes unchanged), `src/test-setup.ts` (`closeCart()` in `afterEach`), `e2e/cart.spec.ts` (two tests), `e2e/browse.spec.ts` (the unknown-product visit appended to "product pages against core"), this file's checkboxes. Not in scope: `cart.ts`, `guest-cart.ts`, `catalog.ts`, `pincode-sheet.tsx`, `product-card.tsx`, the pages, `packages/ui`.
Scenarios: Customer cart drawer › all four; Customer cart drawer states › "Empty, loading and failed cart"; Customer cart minimum order › "Below the minimum order"; Customer cart bar and header button › both; Customer server cart › "Server cart clamps above stock", "Line clamped away"; Customer cart quick taps › "Quick taps in the drawer".
Failing tests: `src/cart-drawer.test.tsx` › "drawer lines and totals", "free delivery", "checkout link signed in and out", "out-of-stock line", "empty, loading and failed cart", "below the minimum order", "bar and header follow the cart", "line clamped away", "quick taps in the drawer"; `e2e/cart.spec.ts` › "cart drawer against core", "server cart clamps above stock". Folded in by the manager (design Decision 16; expected green on arrival, say so in the commit body): in `e2e/browse.spec.ts` › "product pages against core", `/p/no-such-product` shows the level-1 heading "Product not found" with no axe violations.
Easy to get wrong: no cart state in component state and nothing mounted under `StoreGate` (Decision 10); no link to `/p/...` in the drawer, bar or header button; the bar's spacer, not padding on `main` (Decision 12); a line's Stepper value is `useAsked(view.storeId, product.id) ?? quantity` and it writes at `view.storeId`, never the resolved store's; `view` is checked before `isError`; the clamp notice also sits over the empty state; fee tests override `store()`'s `freeDeliveryAboveCents` and `minOrderCents` (both 0 by default); the replaced notice is 3b's.

- [x] 3a.1 Tests committed red (`test: cart drawer, bar and header cart button`)
- [x] 3a.2 `cart-drawer.tsx`, root wiring, `test-setup.ts` (`feat: cart drawer, sticky bar and header cart button`); all gates green, e2e green (every spec), axe clean. As landed: design Decision 17 (one extra harness commit `test: drawer tests wait for the router's shell` between red and feat).

## 3b. Store-change confirm and the replaced notice

Starts after 3a is reviewed. Scope: `apps/web/src/store-change.tsx`, `src/store-change.test.tsx`, `src/catalog.ts` (`serviceabilityOptions` lifted out of `useServiceability`, nothing else), `src/pincode-sheet.tsx` (`PincodeForm`'s submit and its button's `loading`, nothing else), `src/cart-drawer.tsx` (`storeKey`, `ReplacedNotice`, its place in `CartContent` and in `CartBar`, the spacer's `h-40`, and the effect in `CartSheet` that opens the drawer on a replaced answer), `src/cart-drawer.test.tsx` (three tests and one pin), `src/routes/__root.tsx` (`<StoreChangeDialog />`), `src/test-setup.ts` (`cancelStoreChange()` in `afterEach`), `e2e/cart.spec.ts` (three tests), this file's checkboxes.
Scenarios: Customer store change confirm › both; Customer store change outcome › all three; Customer cart replaced notice › all four.
Failing tests: `src/store-change.test.tsx` › "same store or empty cart", "store change confirmed", "store change cancelled", "emptying the server cart fails"; `src/cart-drawer.test.tsx` › "replaced notice names the old store", "replaced notice without the old store", "replace opens the drawer once"; `e2e/cart.spec.ts` › "store change against core", "replaced notice against core", "merge replaces another store's cart". Pin from the 3a review, green on arrival (say so in the commit body): `src/cart-drawer.test.tsx` › "clamp notice above the lines".
Easy to get wrong: the store, not the pincode, is compared (560034 and 560095 are both Koramangala), so the new pincode is resolved first, with `fetchQuery(serviceabilityOptions(next))` under the pages' own key; a guest with an empty cart stores the pincode synchronously (web-P2-L1's `pincode-sheet.test.tsx` stays green untouched, as do `catalog.test.ts` and `store-gate.test.tsx`); the pending change is a module store, the dialog is mounted in `__root.tsx`; the sheet closes before the dialog opens; a failed `DELETE` keeps the dialog and the old pincode; the notice is the existing `StatusMessage`, sits in `CartContent`'s items state above the clamp notice and first inside the bar's `aside`, names the store from `GET /stores/{id}` by `view.replacedStoreId`, and says "another store" when that is missing, pending or failed; no confirm before a card's ADD (D27); nothing added to the header button (Decision 15). The drawer opens by itself when a replaced answer lands, at every width, from the effect in `CartSheet` keyed on the answer object (`replacedAnswer`), never from `cart.ts` (not in scope) and never keyed on `view.replaced` alone or run every render: it must not reopen after the customer closes it, and a later answer with `replaced: false` must not open it. In the e2e nothing but the answer opens the drawer; the bar is checked after "Close".

- [ ] 3b.1 Tests committed red (`test: store-change confirm and replaced notice`)
- [ ] 3b.2 `store-change.tsx`, `serviceabilityOptions`, sheet submit, `ReplacedNotice`, root wiring (`feat: store-change confirm and notice when another store's cart is replaced`); all gates green, e2e green (every spec), axe clean

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-cart` after 3b.2 lands.
- Area manager archives the change by PR after the feature PR merges.
