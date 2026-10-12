# web-P2-L3 - web-cart: guest and server cart, drawer, sticky bar, header button, store-change confirm (team lead)
Status: started
## Doing
Change proposed and valid (`openspec validate web-cart --strict`; `--all --strict` 8 passed). Task 1 can start now; task 2 waits on core-P2-L4 and web-P2-L1 task 2 on main; task 3 on web-P2-L1 task 4 on main. The manager launches workers.
## Found
- Change: `openspec/changes/web-cart/` (proposal; `web-app` delta: 12 ADDED requirements, 25 scenarios; design with interfaces, decisions and the scenario-to-test map; tasks 1 to 3). No `docs/design/web-P2-L3.md`: design.md is enough.
- One `CartView` shape for both backends: guest totals are computed in the browser from the resolved `Store` with core's formula (core-stock-cart Decision 7). `src/guest-cart.ts` is structural (`CartProduct` subset of `StoreProduct`) and imports no generated type, so task 1 runs before core-P2-L4 lands.
- Files this lane edits that web-P2-L1 creates: `src/cart.ts` (body replaced, `useCartQuantity(product)` signature kept), `src/catalog.ts` (`serviceabilityOptions` extracted from `useServiceability`, same key and `staleTime`), `src/pincode-sheet.tsx` (submit calls `changePincode`), `src/routes/__root.tsx` (cart button, bar, sheet, dialog), `src/test-setup.ts`. Also `src/auth.ts` from web-P2-L2 (`openSession` awaits the merge).
- For web-P2-L4: the server cart is `useCart()` / `cartKey(token)` / `cartOptions(token)` / `setLine` / `clearCart` in `src/cart.ts`; "Proceed to checkout" is a plain `ButtonLink href="/checkout"` (full load) until L4 adds the route and switches it to `RouterButtonLink to="/checkout"`; the bottom bar shows on every page, so L4 hides it on `/checkout` if wanted; `openCart()`/`closeCart()` in `src/cart-drawer.tsx`.
- Stepper maximum stays web-P2-L1's (`quantity`, at most 10 by D7); 20 is only a guard. Escalated in the report.
- Task 1 done: `src/guest-cart.ts` (structural `CartProduct`, `cartReducer`, `cartView` with zero fees when no store is resolved, `mergeBodies`, `itemCount`, guarded `shopperstop:cart` store with a shape check on read), tests in `src/guest-cart.test.ts` (7 named tests, all green), one `clearGuestCart()` line in `test-setup.ts`. Gates green: lint, typecheck, Vitest 27/27, build, `openspec validate web-cart --strict`. Red commit `1802e75`, feat commit below. Deviation from brief: none. Task 2 still waits on core-P2-L4 and web-P2-L1 task 2.
- Review fixes on task 1 (worker): `cartReducer` now treats a non-numeric quantity as zero (`Math.trunc(action.quantity) || 0`). Red `b24ddea` (test: NaN existing line kept as NaN), fix `acac966`. Added pin test "free delivery at exactly the threshold" (subtotal = threshold gives fee 0, shortfall 0; passes, pins core's at-or-above rule). Gates: lint, typecheck, Vitest 29/29, build all exit 0.
## Requests
- to core (core-P2-L4, via the web area plan): confirm generated schema names `Cart`, `CartLine`, `CartItemSet`, `CartUpdate`, `CartLine.product` = `StoreProduct`, and `storeId` omitted (not `""`) on the empty cart.
## Blockers
- Task 2 waits on core-P2-L4 (with `/me/cart*` in `core.d.ts`) and web-P2-L1 task 2 on main; task 3 on web-P2-L1 task 4 on main.
