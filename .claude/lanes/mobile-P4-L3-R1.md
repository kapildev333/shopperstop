# mobile-P4-L3-R1 - review of mobile-P4-L3 tasks 0-8 (reviewer)
Status: done. Verdict: approve (no blocking findings); 5 non-blocking.
## Gates (committed state, 63624c5)
- apps/mobile: lint clean, typecheck clean, `npm test` pass (79 suites / 299 tests, node scripts 7/7); `npx jest --ci` x3 more pass, no flake. `openspec validate --all --strict`: 20 passed.
## Findings (non-blocking)
1. src/cart-sheet.tsx CartLineRow + src/cart.ts useQuantity: line Steppers read the open-store count, so any cart not at the resolved store shows ADD on its lines (spec text allows it, but it is reachable: cart at A, pincode saved as not serviceable, since the pincode rule only guards a resolved other store). Tapping ADD then PUTs quantity 1 at the cart's store. Fix: in the sheet use `pending ?? line.quantity` (export a `useLineQuantity(storeId, productId, fallback)`), or hide Steppers when store != view.storeId.
2. Same cause: src/cart.ts useCart prices a guest cart with the resolved store's fees; with no resolved store fees are zero, so minOrder is 0 and Proceed shows for a guest cart below A's minimum. Core re-checks at order; note for L4b or hold the last fees.
3. Replaced-notice sentence duplicated (src/cart-bar.tsx:23, src/cart-sheet.tsx:75). Fix: one `ReplacedNotice({view})` component.
4. src/cart-write-failure.test.tsx: 3x "overlapping act() calls" console errors (the only suite emitting them). Not failing; await the press before the next, or drop the Promise.all-style act.
5. src/cart-guest.ts dispatchGuest before the one read settles drops the stored lines and persists over them (Decision 2 chose it; ms window). Acceptable, documented.
## Checked and fine
Test-first order per task (test commit precedes each feat/fix, incl. b77b459 and c07af72); one read, clear wins, loadGuestCart resolves live cart; queued chain, stale-write skip, token-change skip, answer cached with clamp; useLineWrite alerts (role alert, overtaken shows none); merge in guest order, discard on failure per spec, dropped on session change, auth.ts one line; store change DELETE; pincode rule keeps open ref and pending guards, setUnchecked reset on typing; bar below content, absent on product; Remove button 44 high; tokens only; muted text only on surface; scope inside apps/mobile plus openspec/docs/lane files.
