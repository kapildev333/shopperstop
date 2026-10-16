## Why

core-P5-L1 (#335) lets a customer pay online: `Order.paymentMethod` (`cod|online`), `Order.paymentStatus` (`pending|paid|refunded`, omitted on cash), `Order.paymentReference`, 409 `payment_pending` when staff accept an order whose payment is pending, and payment changes recorded as order events by `system` (`actorName` `payment`) whose `fromStatus` equals `toStatus`. The admin panel shows none of it: staff cannot see which orders are paid, the board offers "Accept" on an order core will refuse, and the sheet reads a payment event as "Placed by payment".

## What Changes

- Board cards, the order sheet and History rows show the payment as a `Badge` in words, with PLAN.md D53's tones: "Cash on delivery" `neutral`, "Awaiting payment" `warning`, "Paid" `success`, "Refunded" `neutral`.
- While a placed order's payment is pending, its "Accept <number>" button is `aria-disabled` and described by the visible "Awaiting payment" badge; a press sends nothing. A 409 `payment_pending` (a race the page cannot see) reads the order again and says "<number> is awaiting payment: accept it once it is paid." with no alert.
- The sheet shows "Payment reference: <reference>", the total as "Total, online payment" for an online order, and a payment event by its note: "<note>, by <actorName>, <when>" (the core request relayed in the admin area plan).
- History gains a "Payment" column and a "Payment" `Select` (Any, Cash on delivery, Awaiting payment, Paid, Refunded) that filters the loaded page client-side.
- e2e: the seeded paid order SS-DEMOAAAE shows "Paid"; an online order the suite places through core as the demo customer shows "Awaiting payment" with Accept held; the sheet's payment event; the History filter; axe on each.

Out of scope: a core payment query parameter for History (client-side filter, ceiling in design.md), the payment service itself, refunds from the panel, the dashboard, any core or ui change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-app`: six ADDED requirements ("Orders payment badge", "Accept waits for the payment", "Accept refused for a pending payment", "Order sheet payment", "Orders history payment", "Payments against core"). No existing requirement is rewritten: each existing one stays true for cash orders, and the added ones state the exceptions for online orders.

## Impact

- Area: admin. Files: `apps/admin/src/orders.ts`, `order-board.tsx`, `order-sheet.tsx`, `order-history.tsx`, `orders-fake.ts`, `orders-board.test.tsx`, `orders-status.test.tsx`, `order-sheet.test.tsx`, `orders-history.test.tsx`, `apps/admin/e2e/orders.spec.ts`.
- Cross-area contracts relied on: `services/core/openapi.json` `Order.paymentMethod`, `paymentStatus`, `paymentReference`, `OrderEvent.actorType` `system` and `actorName`, `Error.code` `payment_pending` (on main, #335) through `@shopperstop/ui/api`; `Badge`, `BadgeVariant`, `Button`, `FormField`, `Select`, `EmptyState`, `StatusMessage` from `@shopperstop/ui` (ui-P3-L1's `aria-disabled` styling on `Button`); core's demo seed: `SS-DEMOAAAE` (`...0704`, Koramangala, placed, paid, reference `fake_demo_0a01`) and the demo customer `demo@shopperstop.local` with a verified email (`orders` "The demo order paid online", `accounts`).
