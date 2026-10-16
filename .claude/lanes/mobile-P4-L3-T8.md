# mobile-P4-L3-T8 - Pincode sheet: a store change needs an answer (mobile-cart task 8)
Status: stopped, blocked (reported to the manager; task 8 not ticked)
## Doing
8.1 done: `fa93017` `test: failed lookup keeps the cart's pincode` (file `src/cart-pincode-check.test.tsx`, four tests: the three named scenarios plus `unreadable server cart keeps the cart's pincode`, which covers the rule's "cannot be read" half). Red run: 3 failed (failed lookup, unreadable cart, unread cart fetched), empty-cart test passed (regression guard). Full suite before my change: 290 passed, 3 failed (only my file).
8.2 not committed: `src/pincode-sheet.tsx` has an uncommitted edit (lookup and `loadCartSummary()` in `Promise.all`; `!cart || (cart.count > 0 && !answer)` keeps the sheet open with the alert; alert cleared on field change and on the next Continue; L2's `open` ref and `pending` guard kept).
## Found
- With that edit, two L2 tests in `src/pincode-sheet.test.tsx` go red (`store change confirmed`, `store change kept`) and my `failed lookup with an empty cart` goes red. Probe (temporary test, removed, not committed): `loadGuestCart()` returns the first read's snapshot forever. Sequence: `await loadGuestCart()` → `dispatchGuest(set 2 lines)` → `await loadGuestCart()` returns the old cart (0 lines).
- Cause: `src/cart-guest.ts` `loadGuestCart`: `loading = read().then(() => { ...; return cart })` memoises that resolved value. It should resolve to the current in-memory cart, not the value at the first read. Affects every caller of `loadGuestCart` / `loadCartSummary` (guest path) once a change follows the first read: task 8's rule compares against a stale empty cart, so it would store a pincode over a real cart at another store. Root-cause fix is in `cart-guest.ts` (task 1's file, outside this worker's scope). Candidate fix (not applied): `return loading.then(() => cart)` in `loadGuestCart`, plus a `cart-guest.test.ts` case (`load after a change returns the change`) as a `test:` then `fix:`.
- Not worked around in `pincode-sheet.tsx` (for example `await loadGuestCart()` then `getCartSummary()`): it would bypass `loadCartSummary`, which the design names, and hide the bug from the next caller.
## Requests
- to mobile team lead: decide whether task 1 gets a follow-up `test:` + `fix:` for `loadGuestCart` (out of this worker's scope: `src/cart-guest.ts`, `src/cart-guest.test.ts`), or whether task 8 waits for it. Then task 8.2 can commit as `feat:` with the two L2 tests green.
## Blockers
Task 8.2 blocked on the `cart-guest.ts` stale read above. No gate run on a feat commit yet.
