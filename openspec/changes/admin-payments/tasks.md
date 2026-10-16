Each task applies its two patches from `patches/` in order with `git apply` (test patch, see it red, commit `test:`; code patch, see it green, commit `feat:`). Expected admin Vitest counts are in design.md "Context".

## 1. Payment badge on cards and sheet, payment events (admin-P5-L1-T1)

Scope: `apps/admin/src/orders.ts`, `order-board.tsx`, `order-sheet.tsx`, `orders-board.test.tsx`, `order-sheet.test.tsx`. Scenarios: "Orders payment badge" > "Payment on the cards"; "Order sheet payment" > "Order paid online", "Order refunded".

- [x] 1.1 `test:` apply `patches/1.1-payment-badge-tests.diff`: `orders-board.test.tsx` "each card carries its payment as a badge: cash on delivery, awaiting payment, paid"; `order-sheet.test.tsx` "the sheet of an order paid online shows its payment, its reference, an online total and the payment event by its note" and "the sheet of a refunded order shows Refunded, the refund reference and the refund event after the cancel"; see 3 fail (330 total)
- [x] 1.2 `feat:` apply `patches/1.2-payment-badge.diff`: `Payment`, `payment`, `paymentBadge` in `orders.ts`; `PaymentBadge`, reference line, total label and payment-event rendering in `order-sheet.tsx`; the badge beside the card's price in `order-board.tsx`; 330 pass

## 2. Accept waits for the payment (admin-P5-L1-T2)

Scope: `apps/admin/src/orders.ts`, `order-board.tsx`, `order-sheet.tsx`, `orders-fake.ts`, `orders-status.test.tsx`. Scenarios: "Accept waits for the payment" > "Accept held until paid"; "Accept refused for a pending payment" > "Payment pending at core".

- [x] 2.1 `test:` apply `patches/2.1-accept-waits-tests.diff`: the fake status route answers 409 `payment_pending` on accepting a pending order; `orders-status.test.tsx` "Accept waits for the payment: aria-disabled and described by \"Awaiting payment\", a press sends nothing; once paid it accepts" and "a 409 payment_pending reads the order again, keeps it in Placed awaiting payment and says so, with no alert"; see 2 fail (332 total)
- [x] 2.2 `feat:` apply `patches/2.2-accept-waits.diff`: `awaitsPayment` and the `payment_pending` branch of `useSetStatus` in `orders.ts`; `aria-disabled`, `aria-describedby`, the `advance()` guard and the awaiting-payment message in `order-board.tsx`; `PaymentBadge` takes an `id`; 332 pass

## 3. History payment column and filter, e2e (admin-P5-L1-T3)

Scope: `apps/admin/src/order-history.tsx`, `orders-history.test.tsx`, `apps/admin/e2e/orders.spec.ts`. Scenarios: "Orders history payment" > "Payment column", "Filter the page by payment"; "Payments against core" > "Paid and awaiting payment on the board" (written here, run in task 4).

- [x] 3.1 `test:` apply `patches/3.1-history-filter-and-e2e-tests.diff`: the first History test expects the "Payment" column; "the Payment filter keeps the loaded page's orders of one payment, asks core nothing, and says when none on the page match"; the third `e2e/orders.spec.ts` test; see 2 fail (333 total)
- [x] 3.2 `feat:` apply `patches/3.2-history-filter.diff`: the "Payment" column, the "Payment" `Select` and the no-match state in `order-history.tsx`; 333 pass

## 4. e2e against core (area manager)

- [ ] 4.1 `make e2e` with the slot: admin `orders.spec.ts` passes, including "the board shows each order's payment: the seeded order paid, an online order awaiting payment with Accept held", and every other suite stays green
