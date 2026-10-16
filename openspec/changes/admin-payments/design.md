## Context

core-P5-L1 (#335, archived into `openspec/specs/orders`) added online payment to orders. The admin board (`apps/admin/src/order-board.tsx`), the order sheet (`order-sheet.tsx`) and History (`order-history.tsx`) read `Order` from `@shopperstop/ui/api`, which already carries the new fields; nothing in the app uses them yet. The work package is in `.claude/areas/admin.md` "Phase 5 work package" > admin-P5-L1, with core's request (relayed there) to render a payment event by its note.

The whole change was spiked on `lane/admin-P5-L1-payments` at 2fb56ed, cut into the six patches under `patches/`, re-applied in order on a clean tree (identical result) and the tree restored. Admin Vitest counts per step: base 327; 1.1 red 3 / 330; 1.2 330; 2.1 red 2 / 332; 2.2 332; 3.1 red 2 / 333; 3.2 333. Lint, typecheck and `vite build` clean on the final tree. The e2e test was not run (the manager holds the slot).

## Goals / Non-Goals

Goals: staff see every order's payment; Accept cannot be pressed into a certain 409; the sheet tells payment events apart from status steps; History can narrow a page by payment.

Non-goals: finding every order of one payment across pages (needs a core query parameter), refunds or payment actions from the panel, the dashboard, any change in `packages/ui` or `services/core`.

## Decisions

1. One table, `paymentBadge: Record<Payment, {variant, label}>` in `orders.ts`, keyed by `payment(order) = order.paymentStatus ?? 'cod'`. Core omits `paymentStatus` exactly on cash orders (`orders` "Customers pay cash or online"), so the method needs no second lookup. The History `Select` options are the same table, so labels cannot drift.
2. `PaymentBadge` is a three-line component exported from `order-sheet.tsx` (the board and History already import that file). Not a ui component: it is a domain mapping over the existing `Badge`, no new pattern.
3. The "visible hint" is the badge itself: the pending card's Accept carries `aria-describedby` pointing at the "Awaiting payment" badge. No second line of text on the card.
4. `awaitsPayment(order)` (`placed` and `pending`) gates both the button's `aria-disabled` and `advance()`, so a press, mouse or keyboard, sends nothing. Other moves of a pending order (cancel from the sheet) are untouched, as core allows them.
5. 409 `payment_pending` follows the existing 409 `conflict` path in `useSetStatus` (read the order again, write it to the board and the sheet cache) and returns `awaitingPayment: true`; the board shows the warning status "<number> is awaiting payment: accept it once it is paid.". The mutation result gains one boolean; `changedElsewhere` keeps its meaning.
6. A payment event (`fromStatus === toStatus`) renders as "<note>, by <actorName ?? actor>, <when>". `actorName` is core's service name (`payment`), shown as is.
7. The sheet's total reads "Total, online payment" for an online order (pending orders are not "paid"), "Total, cash on delivery" otherwise, which keeps the existing sheet scenario true.
8. History: a "Payment" column before the finished time (keeps the existing "last column is Delivered/Cancelled" assertions), and the filter in component state (reset on a store change by the route's `key={storeId}`, kept across status and page changes), not in the URL, like the product filters (admin-P2-L3).
9. e2e places the online order through core with Playwright's `request` against `http://localhost:18080/api/core/v1/` as `demo@shopperstop.local` (email verified in the seed): `DELETE /me/cart`, `PUT /me/cart/items` (Koramangala, Pomegranate Bhagwa `...0604`, 1, ₹320, above the ₹99 minimum, seeded stock 38), `POST /orders {addressId: Home, paymentMethod: online}`. It signs the panel in as the Koramangala store staff, not the admin, because admin@ is the email nearest core's 10 sign-ins per hour (admin area `## Found`). The test is the third in `orders.spec.ts`, so it runs after the first test in the same worker.

## Simplifications and ceilings

- History payment filter is client-side on the loaded page of 24: the pager and "n orders" count the unfiltered list, and a page can show "No orders on this page match" while other pages hold matches. Upgrade: a `paymentStatus` (or `payment`) query parameter on `GET /admin/stores/{id}/orders` in core, then the filter goes into the URL and the query key. Worth asking for only if stores search History by payment.
- The filter is not in the URL (lost on reload).
- A pending order's Accept is re-enabled only by the board's 10 s poll; nothing pushes the payment change.

## Files

`apps/admin/src/orders.ts`, `order-board.tsx`, `order-sheet.tsx`, `order-history.tsx`, `orders-fake.ts` (409 `payment_pending` in the fake status route, mirroring core), `orders-board.test.tsx`, `orders-status.test.tsx`, `order-sheet.test.tsx`, `orders-history.test.tsx`, `apps/admin/e2e/orders.spec.ts`. All in `apps/admin`.

## Tests (scenario to test)

| Scenario | Test |
|---|---|
| Orders payment badge > Payment on the cards | `orders-board.test.tsx` "each card carries its payment as a badge: cash on delivery, awaiting payment, paid" |
| Accept waits for the payment > Accept held until paid | `orders-status.test.tsx` "Accept waits for the payment: aria-disabled and described by \"Awaiting payment\", a press sends nothing; once paid it accepts" |
| Accept refused for a pending payment > Payment pending at core | `orders-status.test.tsx` "a 409 payment_pending reads the order again, keeps it in Placed awaiting payment and says so, with no alert" |
| Order sheet payment > Order paid online | `order-sheet.test.tsx` "the sheet of an order paid online shows its payment, its reference, an online total and the payment event by its note" |
| Order sheet payment > Order refunded | `order-sheet.test.tsx` "the sheet of a refunded order shows Refunded, the refund reference and the refund event after the cancel" |
| Orders history payment > Payment column | `orders-history.test.tsx` "the History tab lists delivered orders, newest first, with number, placed, customer, items, total and when delivered" (headers and row gain "Payment") |
| Orders history payment > Filter the page by payment | `orders-history.test.tsx` "the Payment filter keeps the loaded page's orders of one payment, asks core nothing, and says when none on the page match" |
| Payments against core > Paid and awaiting payment on the board | `e2e/orders.spec.ts` "the board shows each order's payment: the seeded order paid, an online order awaiting payment with Accept held" |

## Gates

`export PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`; once per worktree `npm ci` and `npm run build --workspace packages/ui`; then `npm run lint --workspace apps/admin`, `npm run typecheck --workspace apps/admin`, `npm run test --workspace apps/admin -- --run`, `npm run build --workspace apps/admin`; `openspec validate admin-payments --strict`. The manager runs `make e2e` with the slot (task 4).

## Risks

- `rider-dialog.test.tsx` "an admin creates a rider at a store; the new rider is listed and the dialog closes" failed once in four full runs during the spike (1146 ms, a `findBy` past its 1 s default under load) and passed on rerun; it is untouched by this change. A worker who sees it fails reruns once and reports it.
- The e2e order is placed against core directly at `:18080`; if `make e2e` ever moves core's port, the constant in `orders.spec.ts` moves with it.
- The work package names `SS-DEMOAAAC` as the paid seed order; core's seed made it `SS-DEMOAAAE` (`SS-DEMOAAAC` is the cancelled one). This change uses `SS-DEMOAAAE`.
