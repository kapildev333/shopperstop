# web-P2-L11 - web-checkout-failures: checkout Remove failure and unconfirmed placement (team lead)
Status: started
## Doing
Change written and valid; waiting for the manager to launch the worker on `briefs/task-1.md`; then acceptance (`/opsx:verify web-checkout-failures`).
## Found
- Change: `openspec/changes/web-checkout-failures/` (proposal; `web-app` delta: MODIFIED "Customer cart write failure" (+ "Failed removal at checkout"), MODIFIED "Customer checkout refusals" ("Placement fails" second case is now a 400 `addressId`), ADDED "Customer checkout unconfirmed placement" (2 scenarios); design; tasks, one task; `briefs/task-1.md`). No `docs/design/web-P2-L11.md`: design.md is enough. `openspec validate web-checkout-failures --strict` valid, `--all --strict` 15 of 15. Requirement texts 478, 461, 482 characters.
- Core placement (read-only check of `order/place.go`, `cart/cart.go`, `openapi.json`): no idempotency key, none needed for one cart: the transaction locks the cart `FOR UPDATE` and empties it before commit, so a second `POST /orders` answers 400 "cart is empty" (the page already goes to `/orders`). Only a cart refilled between presses can place again, which is a new order, not a double.
- Decisions (D13): `internal` at placement reads "We could not confirm your order. It may have been placed, so check Your orders before you place it again." with a "Your orders" link; "Place order (COD)" stays enabled (a retry is safe, and a request that never left the browser must not strand the customer); when the re-read cart is empty after `internal`, go to `/orders`. Checkout's Remove becomes a per-line `ShortLine` using `useLineWrite`. Two files only: `checkout.tsx`, `checkout.test.tsx`. No packages/ui change, no core request.
- Ceilings in design.md: the move to `/orders` says nothing; with core down the alert and link are all there is; safety of a retry depends on core emptying the cart in the placement transaction; a failed Remove whose re-read changes the quantity unmarks the line and drops the alert.
## Requests
## Blockers
