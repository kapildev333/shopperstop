## ADDED Requirements

### Requirement: Customer checkout and order pages require sign-in
`/checkout`, `/orders` and `/orders/<id>` SHALL, whenever no token is held (on first render or after the token is dropped), replace themselves with `/sign-in?returnTo=<their own path>`.

#### Scenario: Signed-out checkout redirect
- **WHEN** the app renders `/checkout` with no token
- **THEN** the location becomes `/sign-in?returnTo=%2Fcheckout` and the level-1 heading is "Sign in"

#### Scenario: Signed-out order pages redirect
- **WHEN** the app renders `/orders`, and separately `/orders/00000000-0000-4000-8000-000000000703`, with no token
- **THEN** the locations become `/sign-in?returnTo=%2Forders` and `/sign-in?returnTo=%2Forders%2F00000000-0000-4000-8000-000000000703`

### Requirement: Customer checkout page
`/checkout` SHALL show the level-1 heading "Checkout", a "Delivery address" card and an "Order summary" card for the server cart: "From <store>" and "Delivery in N minutes" as `GET /stores/{id}` answers for the cart's `storeId` (never the pincode's store), each line with name, unit, "Qty <n>" and its line total as `Price`, "Subtotal", "Delivery fee" (or "Free"), "Total", "Cash on delivery", a "Place order (COD)" button and an "Edit cart" button opening the cart drawer.

#### Scenario: Checkout summary from the cart
- **WHEN** a token is held, the cart holds 2 of "Amul Taaza" (`500 ml`, 2700) and 1 of "Amul Butter" (`100 g`, 5600) at Koramangala with fee 2500 and free delivery from 19900, and the app renders `/checkout`
- **THEN** the "Order summary" card lists "Amul Taaza" with "Qty 2" and ₹54 and "Amul Butter" with "Qty 1" and ₹56, "Subtotal" ₹110, "Delivery fee" ₹25, "Total" ₹135, "Cash on delivery" and a "Place order (COD)" button, and choosing "Edit cart" opens the dialog "Your cart"

#### Scenario: Summary names the cart's store
- **WHEN** `560038` is stored and resolved to Indiranagar, the cart is at Koramangala whose `promisedMinutes` is 10, and the app renders `/checkout`
- **THEN** the summary shows "From Koramangala" and "Delivery in 10 minutes" and does not name Indiranagar

### Requirement: Customer checkout states
`/checkout` SHALL show, in place of the two cards: for an empty cart, "Your cart is empty" with a "Continue shopping" link to `/` and a "Your orders" link to `/orders`; while the cart loads, a skeleton; when the cart fails to load and none is held, an alert "Could not load your cart." with "Try again".

#### Scenario: Empty, loading and failed checkout
- **WHEN** the app renders `/checkout` with a token and an empty cart held; then before `GET /me/cart` answers; then with core unreachable and no cart held
- **THEN** "Your cart is empty" is shown with links to `/` and `/orders` and no "Place order (COD)" button; then a "Loading" status; then an alert "Could not load your cart." with a "Try again" button

### Requirement: Customer checkout address choice
The "Delivery address" card SHALL list `GET /me/addresses`, each with label, lines, pincode and a `Chip` whose text is "Deliver to <label>", pressed on the chosen address: the default at first, else the first listed. "Add address" SHALL open the address dialog; an address saved there SHALL be listed and chosen. With no address the card SHALL show "No addresses yet" and "Place order (COD)" SHALL be disabled.

#### Scenario: Default address chosen
- **WHEN** the customer's addresses are "Work" and "Home", "Home" the default, and the app renders `/checkout` with a cart above the minimum
- **THEN** "Deliver to Home" is pressed, "Deliver to Work" is not, and "Place order (COD)" is enabled

#### Scenario: Another address chosen
- **WHEN** "Deliver to Work" is chosen on that page
- **THEN** "Deliver to Work" is pressed and "Deliver to Home" is not

#### Scenario: No address yet
- **WHEN** the customer has no address and the app renders `/checkout` with a cart above the minimum
- **THEN** "No addresses yet" and an "Add address" button are shown and "Place order (COD)" is disabled

#### Scenario: Address added at checkout
- **WHEN** a customer with no address and a cart above the minimum opens `/checkout` against core, chooses "Add address" and saves "Home" with pincode `560034`
- **THEN** the dialog closes, "Deliver to Home" is pressed, "Place order (COD)" is enabled, and axe reports no violations on `/checkout` with the dialog open and with it closed

### Requirement: Customer checkout minimum order
While the cart's subtotal is below `minOrderCents`, `/checkout` SHALL show "Minimum order is ₹<min>. Add ₹<missing> more to place the order." and "Place order (COD)" SHALL be disabled.

#### Scenario: Checkout below the minimum
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900 and the app renders `/checkout` with a default address
- **THEN** "Minimum order is ₹99. Add ₹45 more to place the order." is shown and "Place order (COD)" is disabled

### Requirement: Customer places an order
"Place order (COD)" SHALL send `POST /orders` with the chosen `addressId`, after any cart change still being written, and be busy meanwhile. On 201 the site SHALL hold the answered order, show the cart as empty and navigate to `/orders/<id>`. A 409 `conflict` SHALL be sent once more before it counts as a failure. A 400 `validation` without a `field` (the cart was already empty: the order was placed from elsewhere) SHALL navigate to `/orders`.

#### Scenario: Order placed
- **WHEN** a customer on `/checkout` with "Home" chosen chooses "Place order (COD)" and the answer is 201 with order `SS-ABCDEFGH`
- **THEN** one request was sent with Home's id, the location is `/orders/<that order's id>`, the held cart is empty and the held order is the answered one

#### Scenario: Order number collision retried once
- **WHEN** the first answer is 409 `conflict` and the second is 201; and separately both answers are 409 `conflict`
- **THEN** the first time two requests were sent and the location is `/orders/<id>`; the second time exactly two requests were sent, the location is still `/checkout` and an alert "Could not place your order. Try again." is shown

#### Scenario: Cart already empty goes to orders
- **WHEN** the answer is 400 `validation` with message "cart is empty" and no `field`
- **THEN** the location is `/orders` and the held cart is empty

#### Scenario: Order placed against core
- **WHEN** a guest with `560034` chosen adds a product above the store's minimum, chooses "Proceed to checkout" in the cart drawer, signs in as a customer with one address, and chooses "Place order (COD)" on `/checkout`
- **THEN** the browser is on `/orders/<id>` with the level-1 heading "Order SS-" and eight more characters, the status reads "Order placed. Waiting for the store to accept it.", the product is listed, the banner's cart button reads "Cart", `GET /me/cart` answers the empty cart, and axe reports no violations on `/checkout` and on the order page

### Requirement: Customer checkout out of stock
On 409 `out_of_stock` the cart SHALL be kept and read again, an alert SHALL read "Some products are not available in the quantity you chose.", and each line named in `productIds` SHALL show, until its quantity changes, a `danger` `Badge` ("Out of stock" when its product is not in stock, "Only N left" when its stock is below the line's quantity, else "Not enough stock") and a "Remove <name>" button that sets the line to 0 through the cart.

#### Scenario: Out-of-stock lines marked
- **WHEN** the cart holds 3 of "Amul Taaza" whose product shows `quantity` 2, and 1 of "Amul Butter" whose product is not in stock, and 1 of "Amul Curd", and placing answers 409 `out_of_stock` with the ids of Amul Taaza and Amul Butter
- **THEN** the alert is shown, the Amul Taaza line shows "Only 2 left" and a "Remove Amul Taaza" button, the Amul Butter line shows "Out of stock" and a "Remove Amul Butter" button, the Amul Curd line shows neither, and the location is still `/checkout`

#### Scenario: Out of stock at checkout against core
- **WHEN** a customer's cart holds a product above the minimum, the store's stock of it is set to 0, and the customer chooses "Place order (COD)" and then "Remove <name>"
- **THEN** after placing the alert and "Out of stock" on that line are shown and no order exists for the customer; after the removal `/checkout` shows "Your cart is empty"; and axe reports no violations with the alert showing

### Requirement: Customer checkout refusals
A refusal other than `out_of_stock` SHALL keep `/checkout` and the cart, with an alert: 409 `not_serviceable` with field `addressId`, "<store> does not deliver to this address. Choose another address or add one." and a `warning` `Badge` "Not delivered here" on that address; without a field, "<store> is closed right now."; 400 with field `subtotal`, "Your cart is below the store's minimum order."; else "Could not place your order. Try again.".

#### Scenario: Address not served
- **WHEN** the cart is at Koramangala, "Work" is chosen and placing answers 409 `not_serviceable` with field `addressId`
- **THEN** an alert reads "Koramangala does not deliver to this address. Choose another address or add one.", the "Work" address shows "Not delivered here", and the cart lines are still shown

#### Scenario: Store closed at placement
- **WHEN** placing answers 409 `not_serviceable` without a field
- **THEN** an alert reads "Koramangala is closed right now." and no address shows "Not delivered here"

#### Scenario: Placement fails
- **WHEN** placing answers 400 with field `subtotal`; and separately core cannot be reached
- **THEN** the alert reads "Your cart is below the store's minimum order." the first time and "Could not place your order. Try again." the second, and each time "Place order (COD)" is no longer busy

#### Scenario: Address not served against core
- **WHEN** a customer whose only address has pincode `560038` and whose cart is at Koramangala above the minimum chooses "Place order (COD)" on `/checkout`
- **THEN** the alert names Koramangala, the address shows "Not delivered here", `GET /me/cart` still answers the line, and axe reports no violations

### Requirement: Customer checkout refusal cleared
Choosing another address after an address was refused SHALL remove that alert; the "Not delivered here" badge SHALL stay on the refused address until "Place order (COD)" is next pressed or the addresses are read again.

#### Scenario: Choosing another address clears the alert
- **WHEN** placing with "Work" chosen answered 409 `not_serviceable` with field `addressId`, and "Deliver to Home" is then chosen
- **THEN** no alert is shown, "Work" still shows "Not delivered here" and "Home" does not

### Requirement: Customer order tracking page
`/orders/<id>` SHALL show the order `GET /orders/{id}` answers: "Order <number>" as the level-1 heading, its status message, a list "Status history" of its events oldest first (status name and time), its items (name, unit, "Qty <n>", line total as `Price`), "Subtotal", "Delivery fee" (or "Free"), "Total", "Cash on delivery", the delivery address, and an "All orders" link to `/orders`. A 404 SHALL show "Order not found" with a link to `/orders`.

#### Scenario: Tracking shows the order
- **WHEN** the customer's order `SS-DEMOAAAD` is `placed` then `accepted` in its events, holds 1 of "Banana Robusta" (`1 kg`, 7000) with subtotal 7000, fee 2500 and total 9500, to "Home", "12 80 Feet Rd, Koramangala", `560034`, and the app renders its page
- **THEN** the level-1 heading is "Order SS-DEMOAAAD", "Status history" lists "Placed" then "Accepted", each with a time, the item shows "Qty 1" and ₹70, "Total" is ₹95, "Cash on delivery" and the three address lines are shown, and an "All orders" link points to `/orders`

#### Scenario: Unknown order
- **WHEN** core answered 404 for the id and the app renders its page
- **THEN** the level-1 heading is "Order not found" and a link points to `/orders`

#### Scenario: Tracking against core
- **WHEN** the demo customer signs in and opens `/orders/00000000-0000-4000-8000-000000000701` against core with the demo seed
- **THEN** the level-1 heading is "Order SS-DEMOAAAB", the status reads "Your order was delivered.", "Status history" holds six entries ending in "Delivered", and axe reports no violations

### Requirement: Customer order status names
The site SHALL name an order's status "Placed", "Accepted", "Packing", "Ready", "Out for delivery", "Delivered" or "Cancelled", and SHALL show it in lists as a `Badge`: `accent` while the order is under way (the first five), `success` when delivered, `neutral` when cancelled.

#### Scenario: Status names and badges
- **WHEN** the name and badge variant are asked for each of core's seven statuses
- **THEN** they are "Placed", "Accepted", "Packing", "Ready" and "Out for delivery" with `accent`, "Delivered" with `success` and "Cancelled" with `neutral`

### Requirement: Customer order status message
The tracking page SHALL show the status in one `StatusMessage` (role `status`) that stays in place when the status changes, so the change is announced: "Order placed. Waiting for the store to accept it.", "The store accepted your order.", "Your order is being packed.", "Your order is packed and ready to leave the store.", "Your order is out for delivery.", "Your order was delivered." or "This order was cancelled.", the last followed by "Reason: <cancelReason>" when there is one.

#### Scenario: Status change announced
- **WHEN** the tracking page shows a `placed` order and the next read answers it `accepted`
- **THEN** the element with role `status` that read "Order placed. Waiting for the store to accept it." is the same element and reads "The store accepted your order."

#### Scenario: Cancelled order shows the reason
- **WHEN** the order is `cancelled` with `cancelReason` "Ordered by mistake"; and separately `cancelled` with none
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake" the first time and "This order was cancelled." the second

### Requirement: Customer order tracking poll
While the order held is not `delivered` or `cancelled`, the tracking page SHALL read `GET /orders/{id}` again every 10 seconds, not while the tab is hidden, and SHALL stop once it is `delivered` or `cancelled`. A repeat that fails SHALL leave the page as it is, with no alert, and the repeats SHALL go on.

#### Scenario: Poll interval follows the status
- **WHEN** the tracking read's repeat interval is asked for an order in each status, for an unknown order and for no answer yet
- **THEN** it is 10 seconds for `placed`, `accepted`, `packing`, `ready` and `out_for_delivery`, none for `delivered`, `cancelled`, the unknown order and no answer, and the read does not repeat in the background

#### Scenario: Failed poll keeps the order
- **WHEN** a `placed` order is held, the app renders its page, and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Order SS-DEMOAAAD" and the status message are still shown and no alert is shown

#### Scenario: Tracking follows the order against core
- **WHEN** a customer has their own `placed` order open on its page and store staff move it step by step to `delivered`
- **THEN** without a reload the status comes to read "Your order was delivered.", "Status history" ends in "Delivered", and in the following 11 seconds the page sends no `GET /orders/{id}`

### Requirement: Customer order countdown
While the order is under way and its store is known from `GET /stores/{id}`, the tracking page SHALL show "Arriving in N minutes" ("1 minute" at 1), N the whole minutes, rounded up, from now to `placedAt` plus the store's `promisedMinutes`, kept current as time passes; once that moment has passed, "Running late. We are getting your order to you.". It SHALL show neither once the order is `delivered` or `cancelled`, nor while the store is not known.

#### Scenario: Countdown counts down
- **WHEN** the order was placed 3 minutes ago, the store promises 10 minutes, and then 60 seconds pass; and separately it was placed 9 minutes and 30 seconds ago
- **THEN** "Arriving in 7 minutes" is shown and then "Arriving in 6 minutes"; and separately "Arriving in 1 minute"

#### Scenario: Countdown after the promise
- **WHEN** the order was placed 10 minutes ago, and separately 3 hours ago, and the store promises 10 minutes
- **THEN** "Running late. We are getting your order to you." is shown both times and no "Arriving in" text

#### Scenario: No countdown once finished
- **WHEN** the tracking page shows a `delivered` order, and separately a `placed` order whose store is not known
- **THEN** neither "Arriving in" nor "Running late" is shown

### Requirement: Customer order cancel
The tracking page SHALL show "Cancel order" only while the order is `placed` or `accepted`. It SHALL open a `Dialog` "Cancel this order?" with "Keep order" first and "Cancel order"; confirming SHALL send `POST /orders/{id}/cancel` with the body `{}` and show the answered order. A refusal SHALL keep the dialog open with an alert: on 409, "This order can no longer be cancelled.", with the order read again; otherwise "Could not cancel the order. Try again.".

#### Scenario: Cancel offered while placed or accepted
- **WHEN** the tracking page shows a `placed` order, an `accepted` order and a `packing` order
- **THEN** a "Cancel order" button is shown for the first two and not for the third

#### Scenario: Order cancelled
- **WHEN** "Cancel order" is chosen on a `placed` order, then "Cancel order" in the dialog, and the answer is the order `cancelled`
- **THEN** the dialog "Cancel this order?" opened with "Keep order" as its first button, and afterwards it is closed, the status reads "This order was cancelled." and no "Cancel order" button is shown

#### Scenario: Cancel refused
- **WHEN** confirming answers 409 `conflict`; and separately core cannot be reached
- **THEN** the dialog stays open with an alert "This order can no longer be cancelled." the first time and "Could not cancel the order. Try again." the second

#### Scenario: Cancel against core
- **WHEN** a customer opens their own `placed` order's page against core, chooses "Cancel order" and confirms
- **THEN** the status reads "This order was cancelled.", `GET /orders/{id}` answers `cancelled`, no "Cancel order" button is shown, and axe reports no violations with the dialog open and after it closes

### Requirement: Customer order history
`/orders` SHALL show the level-1 heading "Your orders" and the first page of `GET /orders`, newest first, one card per order with its number, placed date, status `Badge`, item count ("1 item", "N items", the sum of quantities), total as `Price` and a "View order <number>" link to `/orders/<id>`, and "Showing your latest N orders." when `total` is above the N listed.

#### Scenario: History lists orders
- **WHEN** `GET /orders` answered `SS-DEMOAAAD` (`placed`, 4 units, 103000) and then `SS-DEMOAAAC` (`cancelled`, 1 unit, 39900) with `total` 2, and the app renders `/orders`
- **THEN** two cards are listed in that order, the first with "Placed", "4 items", ₹1,030 and a "View order SS-DEMOAAAD" link to its page, the second with "Cancelled" and "1 item", and no "Showing your latest" text; with `total` 30 the page shows "Showing your latest 2 orders."

### Requirement: Customer order history states
`/orders` SHALL show "No orders yet" with a "Start shopping" link to `/` when the customer has no orders, a skeleton while the list loads, and an alert "Could not load your orders." with "Try again" when it fails to load and none is held.

#### Scenario: No orders yet
- **WHEN** `GET /orders` answered no orders; and separately core cannot be reached and nothing is held
- **THEN** "No orders yet" is shown with a "Start shopping" link to `/`; and separately an alert "Could not load your orders." with a "Try again" button

#### Scenario: History against core
- **WHEN** the demo customer signs in and opens `/orders` against core with the demo seed, then follows "View order SS-DEMOAAAB"
- **THEN** three cards are listed, `SS-DEMOAAAD`, `SS-DEMOAAAC` showing "Cancelled" and `SS-DEMOAAAB` showing "Delivered", the browser lands on `/orders/00000000-0000-4000-8000-000000000701`, and axe reports no violations on `/orders`

### Requirement: Customer order links
The account page's header SHALL hold a "Your orders" link to `/orders`.

#### Scenario: Account links to orders
- **WHEN** a signed-in customer's `/account` renders
- **THEN** a "Your orders" link points to `/orders`

### Requirement: Customer checkout and order page layout
At 390 px wide, `/checkout`, `/orders` and `/orders/<id>` SHALL not scroll sideways, every button, chip and button link in a card SHALL lie inside that card and be at least 44 px tall, and the order number and every amount SHALL be set in tabular numerals.

#### Scenario: Checkout and orders on a phone
- **WHEN** a 390 px wide browser opens, against core, `/checkout` with a cart and an address, then `/orders`, then a `placed` order's page
- **THEN** on each page the document is no wider than the viewport; "Deliver to <label>", "Add address", "Edit cart", "Place order (COD)", "View order <number>" and "Cancel order" each lie inside their card and are at least 44 px tall; and the order heading and the "Total" amount compute `font-variant-numeric` `tabular-nums`

## MODIFIED Requirements

### Requirement: Customer cart bar and header button
While the cart has lines, every page except `/checkout` SHALL show on phone a bar fixed to the bottom with `shadow-sheet` holding the item count ("1 item", "N items", the sum of quantities), the total as `Price` and a "View cart" button opening the drawer; the bar SHALL be absent while the cart is empty, and on `/checkout`. The banner SHALL hold on desktop a cart button opening the drawer, named "Cart" while the cart is empty and "<count> <total>" otherwise.

#### Scenario: Bar and header follow the cart
- **WHEN** the app renders `/` with an empty cart, and then with a cart of 2 of a product priced 2700 (fee 2500)
- **THEN** first no "View cart" button is shown and the banner's cart button is named "Cart"; then the bar shows "2 items" and ₹79, the banner's cart button is named "2 items ₹79", and choosing "View cart" opens the dialog "Your cart"

#### Scenario: Cart drawer against core
- **WHEN** a guest on a 390 px wide screen with `560034` chosen adds two products on Home, chooses "View cart", and adds one more of the first in the drawer
- **THEN** the drawer lists two lines, the bar reads "3 items", "Proceed to checkout" points to `/sign-in?returnTo=%2Fcheckout`, and axe reports no violations on `/` with the bar shown and with the drawer open

#### Scenario: No bar on checkout
- **WHEN** a token is held, the cart has lines, and the app renders `/checkout`
- **THEN** no "Cart summary" bar and no "View cart" button are shown, and the banner's cart button is still there
