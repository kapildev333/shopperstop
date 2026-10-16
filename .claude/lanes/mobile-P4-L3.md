# mobile-P4-L3 - mobile-cart: cart sheet, cart empty, cart bar, guest cart and merge, D27 (team lead)
Status: started (proposal done; workers wait for L2 on main and task 0)
## Doing
Task 0 done; group A (tasks 1, 2) ready to launch.
## Found
- Change `openspec/changes/mobile-cart/`: proposal; `specs/mobile-app/spec.md` (16 ADDED requirements, 47 scenarios); design.md (11 decisions, web-app mirror table, contract audit: no gaps, files, scenario-to-test map); tasks.md (task 0 team lead, workers 1 to 9, acceptance 10; groups A 1,2 / B 3 / C 4-8 / D 9). `docs/design/mobile-P4-L3.md` carries artboards 4, 14, the bar, interfaces.
- `openspec validate --all --strict`: 20 passed. ADDED only: L2's "Mobile cart counts before the cart" is REMOVED in task 0 once L2 is archived on main.
- `setQuantity` keeps its name but takes the product (the guest cart needs it to show lines); L2 callers and two L2 tests change in task 3.
- Manager's item from L2's review taken: design.md Decision 9, requirement "Mobile store change needs an answer", task 8 (`src/pincode-sheet.tsx`).
- For L4b (checkout): `useCart`, `setQuantity`, `useLineWrite`, `cartKey`, `CartView` from `src/cart.ts`; "Proceed to checkout" opens `/checkout` (not-found until L4b) or `/sign-in?returnTo=%2Fcheckout`.
- 2026-10-16 task 0: reconciled against L2 as merged (#283, #284): `src/cart.ts` names, `setQuantity` callers (catalog-card, product screen; tests pincode-sheet, catalog-product-count, cart.test), mount points and `jest.setup.ts` match the design file. Brief changes: task 8 keeps L2's dismissal `open` ref and `pending` guards; task 5 keeps `inkMuted` text on `surface` only (L2's axe finding); task 9 reuses `signedIn` (pincode preset) and catalog.spec's `sheet`/`savePincode`. REMOVED "Mobile cart counts before the cart" added; `openspec validate --all --strict` 20 passed.
- 2026-10-16 T1's question answered (with the manager): a no-op `set` leaves the late read to load (T1's reading, kept); `clearGuestCart()` always wins over a late read, even on an empty in-memory cart. design.md Decision 2, the design file's interface and task 1.3 (follow-up `test:` then `fix:`) updated.
- 2026-10-16 mobile-P4-L4b's two requests taken into task 3: `queued` exported from `src/cart.ts`; `storeOptions(id)` caches the whole store under `['store', id]`, `useStoreName` selects the name. Design file interfaces and task 3's unit tests updated.
## Requests
- (answered 2026-10-16) to mobile manager: integration lines outside `src/cart*`; manager confirmed all six decisions as proposed (Sheet footer, auth.ts merge line, pincode-sheet rule, useLineWrite alerts, jest.setup line; setQuantity takes the product; no bar on the product screen; bar below content; bar total incl. delivery; ink text for the minimum-order block).
## Blockers
None.
