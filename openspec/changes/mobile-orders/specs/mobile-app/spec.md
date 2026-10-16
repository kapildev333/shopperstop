## ADDED Requirements

### Requirement: Mobile order history
While a token is held, the Orders tab SHALL show the heading "Your orders" and the first page of `GET /orders` in core's order, one card per order: number (tabular), status `Badge`, placed time, item count ("1 item" or "N items", the sum of the quantities) and total in `₹`. The whole card SHALL be one link named "View order <number>" that opens `/orders/<id>`. When `total` is above the orders listed, the list SHALL end with "Showing your latest N orders.".

#### Scenario: History lists orders
- **WHEN** `GET /orders` answers `SS-DEMOAAAD` (`placed` today at 10:02 local time, quantities 3 and 1, total 103000) and then `SS-DEMOAAAC` (`cancelled`, one line of quantity 1, total 39900) with `total` 2, and the Orders tab is shown
- **THEN** two cards are listed in that order: the first is a link named "View order SS-DEMOAAAD" holding "Placed", "Today, 10:02 · 4 items" and "₹1,030", the second holds "Cancelled" and "1 item", and no "Showing your latest" text is shown; with `total` 30 the list ends with "Showing your latest 2 orders."

#### Scenario: Card opens the order
- **WHEN** the Orders tab lists `SS-DEMOAAAD` with id `00000000-0000-4000-8000-000000000703` and the customer presses "View order SS-DEMOAAAD"
- **THEN** the path is `/orders/00000000-0000-4000-8000-000000000703` and the level-1 heading is "Order SS-DEMOAAAD"

### Requirement: Mobile order placed time
The history card's placed time SHALL read "Today, HH:MM" on the device's current day, "D Mon, HH:MM" on another day of the current year and "D Mon YYYY, HH:MM" in another year, in the device's local time on a 24-hour clock.

#### Scenario: Placed time wording
- **WHEN** the placed time is asked, with the device clock at 16 October 2026 15:00 local, for 16 October 2026 10:02, 12 October 2026 19:40 and 4 October 2025 21:05 local
- **THEN** it is "Today, 10:02", "12 Oct, 19:40" and "4 Oct 2025, 21:05"

### Requirement: Mobile order history signed out
With no token held, the Orders tab SHALL show "Sign in to see your orders" and a "Sign in" button that opens `/sign-in?returnTo=%2Forders`, and send no request; it SHALL not redirect, so Back from sign-in does not loop.

#### Scenario: Signed-out Orders tab
- **WHEN** the Orders tab is shown with no token
- **THEN** "Sign in to see your orders" and a "Sign in" button are shown and no request is sent to core

#### Scenario: Sign in from the Orders tab
- **WHEN** the Orders tab is shown with no token and the customer presses "Sign in"
- **THEN** the path is `/sign-in` with `returnTo` `/orders`

### Requirement: Mobile order history states
The Orders tab SHALL show, while the list loads, a skeleton named "Loading"; when the customer has no orders, the empty state "No orders yet" with "Your past and current orders show up here." and a "Start shopping" button that opens Home; and when the read fails with nothing held, the `ErrorBanner` with "Try again", which reads the list again.

#### Scenario: Orders loading
- **WHEN** the Orders tab is shown with a token and `GET /orders` has not answered
- **THEN** an element named "Loading" is shown

#### Scenario: No orders yet
- **WHEN** `GET /orders` answers no orders with `total` 0
- **THEN** "No orders yet", "Your past and current orders show up here." and a "Start shopping" button are shown

#### Scenario: Start shopping opens Home
- **WHEN** the empty state is shown and the customer presses "Start shopping"
- **THEN** the path is `/`

#### Scenario: Orders fail to load
- **WHEN** core cannot be reached and no list is held; then core answers one order and "Try again" is pressed
- **THEN** an alert "You're offline" with a "Try again" button is shown; then the order's card is shown

### Requirement: Mobile order history read again on return
The Orders tab SHALL read `GET /orders` again each time it is shown again after the first time, keeping the list on screen while it reads; a read that fails SHALL keep the list it holds, with no alert.

#### Scenario: Statuses current on return
- **WHEN** the Orders tab shows `SS-DEMOAAAD` as "Placed", the customer opens the Home tab, core now answers it `packing`, and the customer opens the Orders tab again
- **THEN** its card shows "Packing" and core received two `GET /orders`

#### Scenario: Failed read on return keeps the list
- **WHEN** the Orders tab shows `SS-DEMOAAAD`, the customer opens the Home tab, core can no longer be reached, and the customer opens the Orders tab again
- **THEN** the card "View order SS-DEMOAAAD" is still shown and no alert is shown

### Requirement: Mobile order tracking screen
While a token is held, `/orders/<id>` SHALL show the order `GET /orders/{id}` answers, in this order: a brand header with "Back", the level-1 heading "Order <number>" (tabular), the headline and the status message; the "Order status" timeline; the rider card; the products card; the address card; "Cancel order"; and a "Need help?" button that opens `/account`. The document title SHALL be "Order <number> · ShopperStop".

#### Scenario: Need help opens the account
- **WHEN** a held order is shown and the customer presses "Need help?"
- **THEN** the path is `/account`

### Requirement: Mobile order products and address
The products card SHALL be headed "<N> products · Cash on delivery" (N the lines, "1 product" for one), with a row "<quantity> × <name>" and the line total per line, "Delivery fee" with the fee or "Free", and "Pay on delivery" with the total while the order is under way, "Total" otherwise. The address card SHALL be headed "Delivering to <label>" while under way, "Address: <label>" otherwise, over `line1`, `line2` when present and `pincode` joined by ", ".

#### Scenario: Tracking shows the order
- **WHEN** order `SS-DEMOAAAD` is `placed`, holds 2 of "Toned milk" at 2900 and 1 of "Whole wheat bread" at 5000, subtotal 10800, fee 2500, total 13300, to "Home", "12 80 Feet Rd", "Koramangala", `560034`, and `/orders/<its id>` is shown
- **THEN** the level-1 heading is "Order SS-DEMOAAAD", "2 products · Cash on delivery", "2 × Toned milk" with ₹58, "1 × Whole wheat bread" with ₹50, "Delivery fee" with ₹25, "Pay on delivery" with ₹133, "Delivering to Home" and "12 80 Feet Rd, Koramangala, 560034" are shown, and a "Need help?" button is shown

#### Scenario: Finished order labels
- **WHEN** the order is `delivered` with fee 0, total 9500 and one line of quantity 1
- **THEN** "1 product · Cash on delivery", "Delivery fee" with "Free", "Total" with ₹95 and "Address: Home" are shown, and neither "Pay on delivery" nor "Delivering to" is shown

### Requirement: Mobile order tracking states
A 404 SHALL show the level-1 heading "Order not found" and a "Your orders" button that opens `/orders`. While nothing is held the heading SHALL be "Your order", over a skeleton named "Loading" while the read runs or, when it failed, the `ErrorBanner` with "Try again" and the line "Your order is safe. We just couldn't load its latest status.".

#### Scenario: Unknown order
- **WHEN** core answers `GET /orders/{id}` with 404
- **THEN** the level-1 heading is "Order not found" and a "Your orders" button is shown

#### Scenario: Your orders from an unknown order
- **WHEN** "Order not found" is shown and the customer presses "Your orders"
- **THEN** the path is `/orders`

#### Scenario: Tracking loading
- **WHEN** `/orders/<id>` is shown with a token and `GET /orders/{id}` has not answered
- **THEN** the level-1 heading is "Your order" and an element named "Loading" is shown

#### Scenario: Tracking fails with nothing held
- **WHEN** core answers `GET /orders/{id}` with 500 `internal` and nothing is held
- **THEN** the level-1 heading is "Your order", an alert "Something went wrong on our side" with "Try again" is shown, and "Your order is safe. We just couldn't load its latest status." is shown

### Requirement: Mobile order tracking requires sign-in
With no token held, `/orders/<id>` SHALL replace itself with `/sign-in?returnTo=` and its own path, encoded, so the customer comes back to the order after signing in.

#### Scenario: Signed-out tracking redirect
- **WHEN** the app opens `/orders/00000000-0000-4000-8000-000000000703` with no token
- **THEN** the path is `/sign-in` with `returnTo` `/orders/00000000-0000-4000-8000-000000000703`

### Requirement: Mobile order status names
The app SHALL name an order's status in badges "Placed", "Accepted", "Packing", "Ready", "Out for delivery", "Delivered" or "Cancelled", with the `Badge` variant `accent` for the first five, `success` for delivered and `neutral` for cancelled (PLAN.md D28).

#### Scenario: Status names and badges
- **WHEN** the name and badge variant are asked for each of core's seven statuses
- **THEN** they are "Placed", "Accepted", "Packing", "Ready" and "Out for delivery" with `accent`, "Delivered" with `success` and "Cancelled" with `neutral`

### Requirement: Mobile order status message
The tracking header SHALL show the status in one element with the role `status` and a polite live region, which stays in place when the status changes: "Order placed. Waiting for the store to accept it.", "The store accepted your order.", "Your order is being packed.", "Your order is packed and ready to leave the store.", "Your order is out for delivery.", "Your order was delivered." or "This order was cancelled.", the last followed by " Reason: <cancelReason>" when there is one.

#### Scenario: Status change announced in place
- **WHEN** the tracking screen shows a `placed` order and the next read answers it `accepted`
- **THEN** the element with the role `status` that read "Order placed. Waiting for the store to accept it." is the same element and reads "The store accepted your order."

#### Scenario: Cancelled order shows the reason
- **WHEN** the order is `cancelled` with `cancelReason` "Ordered by mistake"; and separately `cancelled` with none
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake" the first time and "This order was cancelled." the second

### Requirement: Mobile order headline
The tracking header SHALL show a headline, outside the status element so a minute changing is not announced: while the order is under way, "Arriving in N min", N the whole minutes, rounded up, from now to `placedAt` plus the order's own `promisedMinutes`, kept current as time passes; once that moment has passed, "Running late"; "Delivered" once `delivered`; "Cancelled" once `cancelled`.

#### Scenario: Headline wording
- **WHEN** the headline is asked for an order under way placed 3 minutes ago, 9 minutes 30 seconds ago, 10 minutes ago and 3 hours ago with `promisedMinutes` 10, and for a `delivered` and a `cancelled` order
- **THEN** it is "Arriving in 7 min", "Arriving in 1 min", "Running late", "Running late", "Delivered" and "Cancelled"

#### Scenario: Headline kept current
- **WHEN** the headline shows "Arriving in 7 min" for a `placed` order with `promisedMinutes` 10 and 60 seconds pass with no new read
- **THEN** it shows "Arriving in 6 min"

### Requirement: Mobile order timeline
The tracking screen SHALL show a card "Order status" with the order's steps. For an order not cancelled the steps SHALL be "Order placed", "Accepted by store", "Packing your order", "Ready for pickup", "Out for delivery" and "Delivered", for `placed` to `delivered`. A reached step SHALL show its latest event's time as HH:MM, local 24-hour; the current step SHALL be bold, earlier steps done, later steps muted without a time; a delivered order's steps are all done.

#### Scenario: Timeline of a packing order
- **WHEN** a `packing` order's events are `placed` at 10:02, `accepted` at 10:03 and `packing` at 10:04 local time
- **THEN** the six step names are shown in order, "10:02", "10:03" and "10:04" are shown under the first three, no time is shown under the other three, and "Packing your order" is set in bold

### Requirement: Mobile cancelled order timeline
For a cancelled order the "Order status" steps SHALL be its events oldest first, each under its step name or "Cancelled", each with its time.

#### Scenario: Timeline of a cancelled order
- **WHEN** a `cancelled` order's events are `placed` at 10:02 and `cancelled` at 10:05 local time
- **THEN** the steps are "Order placed" with "10:02" and "Cancelled" with "10:05", and "Accepted by store" is not shown

### Requirement: Mobile timeline names the rider
Under a step made by a rider (`actorType` `rider`) with an `actorName`, the timeline SHALL show "Picked up by <actorName>" for `out_for_delivery` and "Delivered by <actorName>" for `delivered`, and no actor line under any other step.

#### Scenario: Rider steps name the rider
- **WHEN** a `delivered` order's events are placed by the customer, accepted, packing and ready by staff, then `out_for_delivery` and `delivered` by the rider "Asha"
- **THEN** "Picked up by Asha" and "Delivered by Asha" are shown, and no other step shows "by"

### Requirement: Mobile order tracking poll
While the order held is not `delivered` or `cancelled`, the tracking screen SHALL read `GET /orders/{id}` again every 10 seconds and SHALL stop once it is `delivered` or `cancelled`, or is unknown. A repeat that fails SHALL leave the screen as it is, with no alert, and the repeats SHALL go on.

#### Scenario: Poll interval follows the status
- **WHEN** the tracking read's repeat interval is asked for an order in each status, for an unknown order and for no answer yet
- **THEN** it is 10 seconds for `placed`, `accepted`, `packing`, `ready` and `out_for_delivery`, and none for `delivered`, `cancelled`, the unknown order and no answer

#### Scenario: Failed poll keeps the order
- **WHEN** a `placed` order is shown and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Order SS-DEMOAAAD" and the status message are still shown and no alert is shown

### Requirement: Mobile order cancel
The tracking screen SHALL show "Cancel order" only while the order is `placed` or `accepted`. It SHALL open a dialog "Cancel this order?" that says the order has not been packed and nothing has been charged, offers an optional reason of four choices (none chosen at first; pressing the chosen one clears it), and holds "Keep order" first, then "Cancel order". "Keep order" SHALL close the dialog and send nothing.

#### Scenario: Cancel offered while placed or accepted
- **WHEN** the tracking screen shows a `placed` order, an `accepted` order and a `packing` order
- **THEN** a "Cancel order" button is shown for the first two and not for the third

#### Scenario: Cancel dialog contents
- **WHEN** "Cancel order" is pressed on the `placed` order `SS-DEMOAAAD`
- **THEN** a dialog "Cancel this order?" shows "Order SS-DEMOAAAD hasn't been packed yet, so you can still cancel it. Nothing has been charged.", "Reason (optional)" with "Ordered by mistake", "Want to change items", "Delivery is taking too long" and "Other", none of them selected, and its buttons are "Keep order" and then "Cancel order"

#### Scenario: Keep order
- **WHEN** the dialog is open and "Keep order" is pressed
- **THEN** the dialog is closed and no `POST /orders/{id}/cancel` was sent

### Requirement: Mobile order cancel sent
Confirming SHALL send `POST /orders/{id}/cancel` with `{"reason": "<choice>"}`, or `{}` when none is chosen, once while it is pending, close the dialog and show the answered order. A refusal SHALL keep the dialog open with an alert: on 409, "This order can no longer be cancelled.", with the order read again; otherwise "Could not cancel the order. Try again.".

#### Scenario: Order cancelled with a reason
- **WHEN** "Cancel order" is pressed on a `placed` order, "Ordered by mistake" is chosen, "Cancel order" is pressed in the dialog, and core answers the order `cancelled` with `cancelReason` "Ordered by mistake"
- **THEN** the dialog "Cancel this order?" opened with "Keep order" as its first button, core received the body `{"reason":"Ordered by mistake"}`, and afterwards the dialog is closed, the status reads "This order was cancelled. Reason: Ordered by mistake" and no "Cancel order" button is shown

#### Scenario: Order cancelled without a reason
- **WHEN** "Ordered by mistake" is chosen and pressed again, then "Cancel order" is pressed in the dialog
- **THEN** core received the body `{}`

#### Scenario: Cancel refused
- **WHEN** confirming answers 409 `conflict`; and separately core cannot be reached
- **THEN** the dialog stays open with an alert "This order can no longer be cancelled." the first time, after which core received another `GET /orders/{id}`, and "Could not cancel the order. Try again." the second

### Requirement: Mobile order rider card
While the order is `out_for_delivery` or `delivered` and a rider name is known (`Order.riderName`, else the rider read's `riderName`), the tracking screen SHALL show a card headed "Your rider" with the name and the order's status `Badge`. When the rider read carries a `location`, the card SHALL also show "Last seen <relative time>" and an "Open in Maps" button that opens `https://www.google.com/maps?q=<lat>,<lng>` through the device.

#### Scenario: Rider on the way with a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha", the rider read answers `assigned` with location 12.9352, 77.6245 recorded 3 minutes ago, and "Open in Maps" is pressed
- **THEN** "Your rider", "Asha", the badge "Out for delivery" and "Last seen 3 minutes ago" are shown, the rider read carried the customer's bearer, and the device was asked to open `https://www.google.com/maps?q=12.9352,77.6245`

#### Scenario: Rider without a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha" and the rider read answers `assigned` with no location
- **THEN** "Your rider" and "Asha" are shown and neither "Last seen" nor "Open in Maps"

#### Scenario: No rider card before a rider
- **WHEN** the order is `ready`; and separately `out_for_delivery` with no `riderName` and the rider read answering 404
- **THEN** no "Your rider" card is shown either time, and for the `ready` order no request to `/api/rider/` was sent

#### Scenario: Delivered order names the rider from the rider read
- **WHEN** the order is `delivered` with no `riderName` and the rider read answers "Arjun Rao" `delivered` with no location
- **THEN** "Your rider", "Arjun Rao" and the badge "Delivered" are shown, and no "Open in Maps"

### Requirement: Mobile rider last seen
"Last seen" SHALL count whole minutes, rounded down, from the location's `recordedAt` to now: "just now" under one minute (or when `recordedAt` is ahead of the device clock), "1 minute ago", "N minutes ago" under an hour, then "1 hour ago" or "N hours ago" in whole hours.

#### Scenario: Last seen wording
- **WHEN** the wording is asked for a position recorded 30 seconds, 1 minute, 59 minutes, 60 minutes and 150 minutes before now, and 2 minutes after now
- **THEN** it is "Last seen just now", "Last seen 1 minute ago", "Last seen 59 minutes ago", "Last seen 1 hour ago", "Last seen 2 hours ago" and "Last seen just now"

### Requirement: Mobile order rider read
The app SHALL read `GET /api/rider/v1/orders/{orderId}/delivery` from `EXPO_PUBLIC_RIDER_URL` (default `http://localhost:8081`) with the customer's token and the same failed-answer handling as core reads, only while the order is `out_for_delivery` or `delivered`: every 10 seconds on `out_for_delivery`, once on `delivered`. A 404 SHALL mean no rider; a failed read SHALL show no alert and keep what is shown.

#### Scenario: Default rider URL
- **WHEN** the rider client is built with `EXPO_PUBLIC_RIDER_URL` unset
- **THEN** its base URL is `http://localhost:8081/api/rider/v1`

#### Scenario: Rider read follows the status
- **WHEN** the rider read's options are asked for an order in each of the seven statuses
- **THEN** the read is enabled only for `out_for_delivery` (repeating every 10 seconds) and `delivered` (not repeating)

#### Scenario: Failed rider read keeps the card
- **WHEN** the rider card shows "Asha" with "Last seen 3 minutes ago" and the next rider read fails because the rider service cannot be reached
- **THEN** the card still shows "Asha" and "Last seen 3 minutes ago", and no alert is shown

### Requirement: Mobile tab bar landmark
The bottom tab bar SHALL sit inside a navigation landmark named "Main", so every tab label is inside a landmark on the web export (axe `region`) and screen readers can jump to it.

#### Scenario: Tab bar in a navigation landmark
- **WHEN** the app shows a tab screen
- **THEN** the element holding the "Home", "Categories" and "Orders" tabs has the role `navigation` and the name "Main"

### Requirement: Mobile orders end-to-end suite
The mobile Playwright suite SHALL drive the order screens on the web export at 390×844 against core with the demo seed, creating any order it changes through core's HTTP API as a customer registered for the run, and SHALL run axe on every screen it visits, the cancel dialog open included, with no violation allowed.

#### Scenario: History and a delivered order against core
- **WHEN** the demo customer is signed in, opens the Orders tab, then presses "View order SS-DEMOAAAB"
- **THEN** three cards are listed, `SS-DEMOAAAD` with "Placed", `SS-DEMOAAAC` with "Cancelled" and `SS-DEMOAAAB` with "Delivered"; the tracking screen's heading is "Order SS-DEMOAAAB" with the headline "Delivered", the status "Your order was delivered.", six timeline steps, "Your rider" with "Arjun Rao" and no "Open in Maps"; and axe reports no violations on both screens

#### Scenario: Tracking follows the order against core
- **WHEN** a customer registered for the run has a `placed` order made through core's API open on its tracking screen, and store staff move it through core's API step by step to `delivered`
- **THEN** the headline first reads "Arriving in N min", and without a reload the status comes to read "Your order was delivered." within 15 seconds of the last move, the headline reads "Delivered", and axe reports no violations

#### Scenario: Cancel against core
- **WHEN** a customer registered for the run opens their `placed` order from the Orders tab, presses "Cancel order", chooses "Ordered by mistake" and confirms
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake", core's `GET /orders/{id}` answers `cancelled` with that reason, no "Cancel order" button is shown, and axe reports no violations with the dialog open and after it closes
