# web-P2-L10 - web-cart-write-failure: tell the customer when a cart write fails (team lead)
Status: started
## Doing
Change written and valid; waiting for the manager to launch worker web-P2-L10-T1 on `briefs/task-1.md`. Then `/opsx:verify`.
## Found
- Change: `openspec/changes/web-cart-write-failure/` (proposal; `web-app` delta: 2 ADDED requirements, "Customer cart write failure" and "Customer cart write failure cleared", 5 scenarios; design; tasks, one task; `briefs/task-1.md`). No `docs/design/web-P2-L10.md`: design.md is enough.
- Root cause: `setLine` in `src/cart.ts` drops the error `call()` returns; the `Stepper` snaps back when `asked` is cleared in `finally`. `call()` and the middleware already map every failure to an envelope with a message, so no new mapping and no new copy.
- Placement (design Decision 1): an `ErrorBanner` under the control the customer tapped (card, product page, drawer line incl. Remove). The bar is phone only and absent on an empty cart, the header button desktop only, the drawer only while open, a toast would overlap the bar and is a new ui pattern.
- State (Decision 2): component state per control through `useLineWrite` in `cart.ts`, fed by `setLine`'s new return value; clears on the next tap and on unmount, and shows only where the tap was (no double announcement with the drawer).
- Stock: core never refuses on stock; it clamps with 200 `clamped: true`, and the drawer's existing "Some quantities were lowered" notice stays the only stock message. `PUT /me/cart/items` answers 200, 400 `validation`, 401.
- Ceilings in design.md: checkout's Remove stays silent; core's 400 copy is terse ("product not available"); the card grows while the message shows; the product page has no test of its own; the in-flight overtaken check is verified by reading.
- `openspec validate web-cart-write-failure --strict` valid. Vitest not run by this lane (design only).
## Requests
- to web manager: launch web-P2-L10-T1 on `openspec/changes/web-cart-write-failure/briefs/task-1.md`; add to Backlog: checkout's Remove on an out-of-stock line still fails silently.
## Blockers
