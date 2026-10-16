# mobile-P4-L3 - mobile-cart: cart sheet, cart empty, cart bar, guest cart and merge, D27 (team lead)
Status: started (proposal done; workers wait for L2 on main and task 0)
## Doing
Decisions confirmed by the manager; idle until L2 merges and the manager merges origin/main, then task 0 (team lead), then group A (tasks 1, 2).
## Found
- Change `openspec/changes/mobile-cart/`: proposal; `specs/mobile-app/spec.md` (16 ADDED requirements, 47 scenarios); design.md (11 decisions, web-app mirror table, contract audit: no gaps, files, scenario-to-test map); tasks.md (task 0 team lead, workers 1 to 9, acceptance 10; groups A 1,2 / B 3 / C 4-8 / D 9). `docs/design/mobile-P4-L3.md` carries artboards 4, 14, the bar, interfaces.
- `openspec validate --all --strict`: 20 passed. ADDED only: L2's "Mobile cart counts before the cart" is REMOVED in task 0 once L2 is archived on main.
- `setQuantity` keeps its name but takes the product (the guest cart needs it to show lines); L2 callers and two L2 tests change in task 3.
- Manager's item from L2's review taken: design.md Decision 9, requirement "Mobile store change needs an answer", task 8 (`src/pincode-sheet.tsx`).
- For L4b (checkout): `useCart`, `setQuantity`, `useLineWrite`, `cartKey`, `CartView` from `src/cart.ts`; "Proceed to checkout" opens `/checkout` (not-found until L4b) or `/sign-in?returnTo=%2Fcheckout`.
## Requests
- (answered 2026-10-16) to mobile manager: integration lines outside `src/cart*`; manager confirmed all six decisions as proposed (Sheet footer, auth.ts merge line, pincode-sheet rule, useLineWrite alerts, jest.setup line; setQuantity takes the product; no bar on the product screen; bar below content; bar total incl. delivery; ink text for the minimum-order block).
## Blockers
None.
