## MODIFIED Requirements

### Requirement: Ready orders list
`/` SHALL show "Ready to pick up" as the level-1 heading and a list named "Ready orders" with `aria-live="polite"`, one card per order from `GET /me/ready-orders` in the service's order, each showing the number in `tabular-nums`, the time since it was placed ("12 min ago"), the item count ("3 items"), the total in rupees and the pincode; a card whose `paymentMethod` is `cod` SHALL also show a neutral badge "Cash" beside the total, and no other card SHALL. The list SHALL be read again every 10 seconds while the page is open.

#### Scenario: Ready orders listed
- **WHEN** the service answers two ready orders, `SS-AAAA0001` placed 12 minutes ago with 3 items, ₹339 and pincode `560034`, then `SS-AAAA0002`
- **THEN** the "Ready orders" list has `aria-live="polite"` and two cards in that order, the first showing `SS-AAAA0001`, "12 min ago", "3 items", ₹339 and `560034`

#### Scenario: Cash orders marked
- **WHEN** the service answers a `cod` ready order and then an `online` ready order whose `paymentStatus` is `paid`
- **THEN** the first card shows "Cash" and the second does not

#### Scenario: New order appears without a reload
- **WHEN** the page shows one ready order and the service lists a second one at the next read
- **THEN** 10 seconds later the second card is in the list without any user action

### Requirement: Cash to collect
While a delivery is `assigned`, the delivery page SHALL show one amount line in a status message: "Collect ₹<total> in cash" when its payment method is `cod`, "Paid online" when its `paymentStatus` is `paid`, and "Awaiting payment" with the warning tone when its `paymentStatus` is `pending`. A delivered delivery SHALL show none of them.

#### Scenario: Cash on delivery
- **WHEN** the rider opens an assigned `cod` delivery with total 33900
- **THEN** the status message "Collect ₹339 in cash" shows

#### Scenario: Paid online
- **WHEN** the rider opens an assigned `online` delivery whose `paymentStatus` is `paid`
- **THEN** "Paid online" shows and no "Collect" text shows

#### Scenario: Awaiting payment
- **WHEN** the rider opens an assigned `online` delivery whose `paymentStatus` is `pending`
- **THEN** "Awaiting payment" shows, and neither "Collect" nor "Paid online" shows

#### Scenario: Delivered shows no collection
- **WHEN** the rider opens a delivered `cod` delivery, or a delivered `online` delivery whose `paymentStatus` is `paid`
- **THEN** neither "Collect" nor "Paid online" shows and there is no "Mark delivered" button

### Requirement: Cross-app delivery flow
The e2e suite SHALL drive the web, admin and rider previews together: a customer places an order at checkout on web, store staff move it to Ready on the admin Orders board, a rider picks it up and marks it delivered on the rider app, and the customer's tracking page shows it out for delivery and then delivered without a reload.

#### Scenario: Customer to rider to delivered
- **WHEN** a new customer places a cash on delivery order at store `...0401`, Koramangala staff press Accept, Start packing and Mark ready, and `rider2-koramangala@shopperstop.local` picks it up and marks it delivered
- **THEN** the order's ready card shows "Cash", its delivery page shows the status message "Collect ₹<total> in cash" before delivered, the tracking page shows "Your order is out for delivery." after the pick up and "Your order was delivered." after delivered, and core's order read names the rider "Meera Iyer"
