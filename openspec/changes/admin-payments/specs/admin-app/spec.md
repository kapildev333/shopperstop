## ADDED Requirements

### Requirement: Orders payment badge
Each board card, the order sheet and each History row SHALL show the order's payment as a `Badge` in words (PLAN.md D53): "Cash on delivery" (`neutral`) for a cash order; for an online order, after its `paymentStatus`, "Awaiting payment" (`warning`), "Paid" (`success`) or "Refunded" (`neutral`).

#### Scenario: Payment on the cards
- **WHEN** the board holds a placed cash order, a placed online order whose payment is `pending` and an accepted online order whose payment is `paid`
- **THEN** their cards read "Cash on delivery" on the neutral surface, "Awaiting payment" on the warning surface and "Paid" on the success surface

### Requirement: Accept waits for the payment
While a placed order's `paymentStatus` is `pending`, its "Accept <number>" button SHALL stay on the card, `aria-disabled` (never `disabled`) and described by the visible badge "Awaiting payment", and a press SHALL send nothing. Once a poll brings the order paid, the button SHALL work as for any placed order.

#### Scenario: Accept held until paid
- **WHEN** the board holds SS-TEST0001 awaiting payment and a cash SS-TEST0002, staff press "Accept SS-TEST0001", the payment is then marked paid, 10 seconds pass and staff press it again
- **THEN** the first press sent nothing, the button was `aria-disabled`, not disabled and described by "Awaiting payment", and "Accept SS-TEST0002" was not `aria-disabled`; after the poll the button is neither, the second press sends one `POST` and "SS-TEST0001 is now Accepted." shows

### Requirement: Accept refused for a pending payment
When core answers an accept with 409 `payment_pending`, the page SHALL read the order again with `GET /admin/orders/{id}`, show it as core holds it and say "<number> is awaiting payment: accept it once it is paid." in a `role="status"` region, with no alert. Nothing SHALL be sent again, and the pressed button keeps focus.

#### Scenario: Payment pending at core
- **WHEN** the board shows SS-TEST0001 paid, core holds its payment as `pending`, and staff press "Accept SS-TEST0001"
- **THEN** one `POST` and one `GET` of the order were sent, the message shows as a status, the card is in "Placed" reading "Awaiting payment" with its Accept button `aria-disabled` and focused, and there is no alert and no "changed by someone else" message

### Requirement: Order sheet payment
The sheet SHALL show the payment badge after the status badge, "Payment reference: <reference>" when core sends one, and the total as "Total, online payment" for an online order. An event whose `fromStatus` equals its `toStatus` (a payment change) SHALL read "<note>, by <actorName>, <when>", never as a status step.

#### Scenario: Order paid online
- **WHEN** staff open a placed order paid online with reference `pay_123`, whose second event is from `placed` to `placed` by `system` named `payment` with the note "Payment paid, reference pay_123"
- **THEN** the sheet shows "Paid" on the success surface, "Payment reference: pay_123", "Total, online payment" ₹1,030, and the events "Placed by the customer, 13 Oct 2026, 2:50 pm" and "Payment paid, reference pay_123, by payment, 13 Oct 2026, 2:50 pm"

#### Scenario: Order refunded
- **WHEN** staff open from History a cancelled online order refunded with reference `rfnd_9`, whose events are its placement, its payment, its cancel by staff and the refund
- **THEN** the sheet shows "Refunded" on the neutral surface, "Payment reference: rfnd_9", and the events end with "Cancelled by staff, 13 Oct 2026, 2:52 pm: Out of stock" and "Payment refunded, reference rfnd_9, by payment, 13 Oct 2026, 2:53 pm"

### Requirement: Orders history payment
History's table SHALL have a "Payment" column with the badge, before the delivered or cancelled time, and a "Payment" `Select` (Any, Cash on delivery, Awaiting payment, Paid, Refunded) that keeps only the loaded page's orders of that payment, asking core nothing. The pager SHALL still count the whole list; with no match on the page, "No orders on this page match" SHALL replace the table.

#### Scenario: Payment column
- **WHEN** an admin opens History and the store has a delivered cash order
- **THEN** the headings read "Order", "Placed", "Customer", "Items", "Total", "Payment", "Delivered" and the order's row reads "Cash on delivery" under "Payment"

#### Scenario: Filter the page by payment
- **WHEN** History lists a delivered cash order SS-TEST0001 and two delivered orders paid online, and the admin chooses "Paid", "Cash on delivery", "Refunded", then "Any"
- **THEN** the table lists SS-TEST0003 and SS-TEST0002, then SS-TEST0001, then no table with "No orders on this page match" and "Page 1 of 1, 3 orders", then all three; the selector keeps focus and core was asked for the list once

### Requirement: Payments against core
The admin e2e suite SHALL cover payments against the real core and the demo seed, reset before every run: the seeded paid order SS-DEMOAAAE, an online order the suite places through core as the demo customer, the sheet's payment event and the History filter, with axe on every page and sheet it visits.

#### Scenario: Paid and awaiting payment on the board
- **WHEN** the suite places a Koramangala order online through core as `demo@shopperstop.local`, and the Koramangala store staff open Orders, open SS-DEMOAAAE, then History filtered to "Cash on delivery"
- **THEN** SS-DEMOAAAE's card reads "Paid" and its Accept is not `aria-disabled`; the new order's card reads "Awaiting payment" and its Accept is `aria-disabled` and described by it; the sheet shows "Payment reference: fake_demo_0a01" and "Payment paid, reference fake_demo_0a01, by payment"; History lists SS-DEMOAAAB; axe finds no violation
