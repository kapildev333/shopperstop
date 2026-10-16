# mobile-P4-L3 - mobile-cart: cart sheet, cart empty, cart bar, guest cart and merge, D27 (team lead)
Status: started (proposal done; workers wait for L2 on main and task 0)
## Doing
Proposal committed; waiting for the manager to merge origin/main (L2 merged and archived), then task 0 (team lead), then group A (tasks 1, 2).
## Found
- Change `openspec/changes/mobile-cart/`: proposal; `specs/mobile-app/spec.md` (16 ADDED requirements, 49 scenarios); design.md (11 decisions, web-app mirror table, contract audit: no gaps, files, scenario-to-test map); tasks.md (task 0 team lead, workers 1 to 9, acceptance 10; groups A 1,2 / B 3 / C 4-8 / D 9). `docs/design/mobile-P4-L3.md` carries artboards 4, 14, the bar, interfaces.
- `openspec validate --all --strict`: 20 passed. ADDED only: L2's "Mobile cart counts before the cart" is REMOVED in task 0 once L2 is archived on main.
- `setQuantity` keeps its name but takes the product (the guest cart needs it to show lines); L2 callers and two L2 tests change in task 3.
- Manager's item from L2's review taken: design.md Decision 9, requirement "Mobile store change needs an answer", task 8 (`src/pincode-sheet.tsx`).
- For L4b (checkout): `useCart`, `setQuantity`, `useLineWrite`, `cartKey`, `CartView` from `src/cart.ts`; "Proceed to checkout" opens `/checkout` (not-found until L4b) or `/sign-in?returnTo=%2Fcheckout`.
## Requests
- to mobile manager: integration lines outside `src/cart*` named in design.md "Files" (`src/ui/sheet.tsx` footer, `src/auth.ts` merge line, `src/pincode-sheet.tsx`, `jest.setup.ts`, the card, product and four screen mounts, `_layout.tsx`); confirm or veto.
## Blockers
None.
