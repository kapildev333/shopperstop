# mobile-P4-L3-T8 - Pincode sheet: a store change needs an answer (mobile-cart task 8)
Status: done
## Doing
Task 8 done (8.1 and 8.2 ticked). Commits, in order: `fa93017` `test: failed lookup keeps the cart's pincode` (red: 3 of the 4 tests failed, the empty-cart test passed as a regression guard); `052c2ef`/`11de238` are other tasks; `c694725` `test: a later load resolves the live cart, not the first read` (red); `b77b459` `fix: loadGuestCart resolves the current cart after the first read`; `05ac3f0` `feat: a store change needs an answer; a failed check keeps the pincode`; `ed3c5c1` `fix: type the guest cart read's pending promise as void (typecheck)`; then `docs` commit for this log and the tick.
## Found
- The stale read: `loadGuestCart()` memoised the first read's resolved value, so a later call returned the first snapshot. The rule compared against a stale cart and broke two L2 tests and the empty-cart test. Fixed at the root in `src/cart-guest.ts` by the manager's scope extension (one storage read kept; every later call resolves the live cart; `clearGuestCart()` still wins over a late read, Decision 2 test green).
- The fix also protects task 6's merge path (`mergeGuestCart` reads the guest cart after sign-in), which had the same stale read; that path now sees the cart the customer changed after the first read.
- `fix` commit typed the pending read as `Promise<void>` after typecheck caught `Promise<GuestCart>`.
- The rule: `loadCartSummary()` (guest and signed in) runs with the lookup in `Promise.all`; `!cart || (cart.count > 0 && !answer)` keeps the sheet open with "Could not check this pincode. Try again." (alert cleared on the next field change or Continue); "not serviceable" stays a real answer; L2's `open` ref and `pending` guard are unchanged.
- Test beyond the brief: `unreadable server cart keeps the cart's pincode` (the spec rule's "cannot be read" half).
## Gates (on `ed3c5c1`)
- `npm run build --workspace packages/ui`: exit 0
- `npm run lint --workspace apps/mobile`: exit 0
- `npm run typecheck --workspace apps/mobile`: exit 0 (after the `fix:` type commit)
- `npm run test --workspace apps/mobile -- --run`: 79 suites passed, 299 tests passed
- `npm run build --workspace apps/mobile`: exit 0
- `openspec validate mobile-cart --strict`: valid
## Requests
None.
## Blockers
None.
