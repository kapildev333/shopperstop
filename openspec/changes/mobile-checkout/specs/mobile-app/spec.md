## ADDED Requirements

### Requirement: Mobile checkout requires sign-in
With no token held, `/checkout` SHALL replace itself with `/sign-in?returnTo=%2Fcheckout`, on first render and when the token is dropped while it shows, so the customer comes back to checkout after signing in.

#### Scenario: Signed-out checkout redirect
- **WHEN** the app opens `/checkout` with no token
- **THEN** the "Sign in" screen is shown, the path is `/sign-in` and `returnTo` is `/checkout`

### Requirement: Mobile checkout screen
`/checkout` SHALL show a header with a "Back to cart" button and the level-1 heading "Checkout", set the document title "Checkout · ShopperStop", and for the server cart a lines card headed "Delivery in <N> minutes" with "From <store>", both from `GET /stores/{id}` for the cart's `storeId` (never the pincode's store), and per line its image, name, "<quantity> × <unit>" and line total. "Back to cart" SHALL go back and open the cart sheet.

#### Scenario: Checkout summary from the cart
- **WHEN** a token is held, the default address is "Home", the cart at Koramangala (10 minutes) holds 2 of "Amul Taaza" (`500 ml`, 2700) and 1 of "Amul Butter" (`100 g`, 5600) with fee 2500, and `/checkout` is shown
- **THEN** the level-1 heading is "Checkout", "Delivery in 10 minutes" and "From Koramangala" are shown, "Amul Taaza" with "2 × 500 ml" and ₹54, and "Amul Butter" with "1 × 100 g" and ₹56

#### Scenario: Summary names the cart's store
- **WHEN** `560038` is stored and resolves to Indiranagar, the cart is at Koramangala whose `promisedMinutes` is 10, and `/checkout` is shown
- **THEN** "From Koramangala" and "Delivery in 10 minutes" are shown and "Indiranagar" is not

#### Scenario: Back to cart opens the cart sheet
- **WHEN** the checkout screen is shown with a cart and the customer chooses "Back to cart"
- **THEN** the checkout screen is gone and the sheet "My cart" is open

### Requirement: Mobile checkout payment and bill
The checkout screen SHALL show a "Payment" card with the one method "Cash on delivery", "Pay the rider in cash" and the note "UPI and cards come with the payment service.", and a bill with "Items total" (the subtotal), "Delivery fee" ("FREE" at 0) and "To pay" (the total), every amount in tabular numerals.

#### Scenario: Cash on delivery and bill
- **WHEN** the checkout screen shows the cart of "Checkout summary from the cart"
- **THEN** "Payment", "Cash on delivery", "Pay the rider in cash" and "UPI and cards come with the payment service." are shown, and "Items total" ₹110, "Delivery fee" ₹25 and "To pay" ₹135

#### Scenario: Free delivery at checkout
- **WHEN** the cart's `deliveryFeeCents` is 0
- **THEN** "Delivery fee" reads "FREE"

### Requirement: Mobile checkout states
In place of its cards the checkout screen SHALL show: for an empty cart, the empty state "Your cart is empty" with a "Start shopping" button to Home and a "Your orders" button to `/orders`, and no "Place order"; while the cart loads, a skeleton named "Loading"; when the cart fails to load and none is held, the error state with "Try again", which reads the cart again.

#### Scenario: Empty checkout
- **WHEN** a token is held, `GET /me/cart` answers the empty cart, and `/checkout` is shown
- **THEN** "Your cart is empty", a "Start shopping" button and a "Your orders" button are shown, and no "Place order" button

#### Scenario: Loading and failed checkout
- **WHEN** `/checkout` is shown before `GET /me/cart` answers; and separately while core cannot be reached, after which core answers a cart and "Try again" is chosen
- **THEN** an element named "Loading" is shown; then the alert "You're offline" with "Try again", and after the choice the cart's lines

### Requirement: Mobile checkout address card
The address card SHALL show the chosen address, which is the one chosen on this screen, else the default, else the first of `GET /me/addresses`: "Delivering to <label>" over `line1`, `line2` when present and `pincode` joined by ", ", and a "Change" button. With no address it SHALL show "No addresses yet" and an "Add address" button.

#### Scenario: Default address shown
- **WHEN** the customer's addresses are "Work" (`1 Park St`, `560038`) and "Home" (`12 80 Feet Rd`, `Koramangala`, `560034`), "Home" the default
- **THEN** the card shows "Delivering to Home" and "12 80 Feet Rd, Koramangala, 560034"

#### Scenario: No address yet
- **WHEN** `GET /me/addresses` answers no address
- **THEN** the card shows "No addresses yet" and an "Add address" button

### Requirement: Mobile checkout address choice
"Change" SHALL open a sheet titled "Choose address" listing every address with its label, lines and a "Default" badge on the default, each a radio "Deliver to <label>" in one group "Deliver to", checked on the chosen address, and an "Add address" button. Choosing a radio SHALL make that address the chosen one and close the sheet.

#### Scenario: Choice sheet lists the addresses
- **WHEN** the card shows "Home" of "Default address shown" and "Change" is chosen
- **THEN** the sheet "Choose address" holds the group "Deliver to" with the radios "Deliver to Work", not checked, and "Deliver to Home", checked

#### Scenario: Another address chosen
- **WHEN** "Deliver to Work" is chosen in that sheet
- **THEN** the sheet is closed and the card shows "Delivering to Work"

### Requirement: Mobile checkout address added
"Add address", on the card or in the "Choose address" sheet, SHALL open L1's address sheet "Add address" (closing the "Choose address" sheet first, so one sheet shows at a time); an address saved there SHALL become the chosen address.

#### Scenario: Address added at checkout
- **WHEN** a customer with only "Home" opens "Change", chooses "Add address", and saves "Work" with `1 Park St` and `560038`, and core answers 201 and then lists "Home" and "Work"
- **THEN** the address sheet is closed and the card shows "Delivering to Work"

### Requirement: Mobile checkout place order bar
Below its scrolling content the checkout screen SHALL show a "Place order" button with the amount to pay or, in its place, a block naming why the order cannot be placed: "Remove the marked products to continue." while a line is marked, else "Minimum order is ₹<min>. Add ₹<missing> more to place the order." while the subtotal is below `minOrderCents`, else "Add an address to place the order." while there is no address.

#### Scenario: Checkout below the minimum
- **WHEN** the cart's subtotal is 5400, `minOrderCents` 9900, and the customer has a default address
- **THEN** "Minimum order is ₹99. Add ₹45 more to place the order." is shown and no "Place order" button

#### Scenario: No address blocks placing
- **WHEN** the cart is above the minimum and `GET /me/addresses` answers no address
- **THEN** "Add an address to place the order." is shown and no "Place order" button

#### Scenario: Place order shows the amount
- **WHEN** the cart of "Checkout summary from the cart" is shown with "Home" chosen
- **THEN** the "Place order" button shows ₹135

### Requirement: Mobile places an order
"Place order" SHALL send `POST /orders` with the chosen address's id after any cart change still being written, show busy meanwhile, and send nothing on a second press while busy. A 409 `conflict` SHALL be sent once more before it counts as a failure. On 201 the app SHALL hold the answered order, hold the cart as empty and replace the screen with `/orders/<id>`. A 400 `validation` without a field SHALL hold the cart as empty and replace the screen with `/orders`.

#### Scenario: Order placed
- **WHEN** a customer with "Home" chosen chooses "Place order" and core answers 201 with order `SS-ABCDEFGH`
- **THEN** one `POST /orders` carried Home's id, the path is `/orders/<that order's id>`, the heading "Order SS-ABCDEFGH" is shown, and the cart counts nothing

#### Scenario: Order placed after a pending cart change
- **WHEN** a cart write's answer is held back and placing is asked for
- **THEN** no `POST /orders` is sent until the write has answered, and then one is

#### Scenario: Order number collision retried once
- **WHEN** the first answer is 409 `conflict` and the second 201; and separately both answers are 409 `conflict`
- **THEN** each time exactly two `POST /orders` are sent; the first time placing ends with the order, the second with the `conflict` error

#### Scenario: Place order sent once
- **WHEN** "Place order" is pressed twice before core answers
- **THEN** one `POST /orders` was sent and the button is busy

#### Scenario: Cart already empty goes to orders
- **WHEN** placing is answered 400 `validation` "cart is empty" with no field
- **THEN** the path is `/orders` and the cart counts nothing

### Requirement: Mobile checkout out of stock
On 409 `out_of_stock` the screen SHALL stay, read the cart again and show an alert "Some products are not available in the quantity you chose." with "Remove them to place your order.". Each line named in `productIds` SHALL show, until its quantity changes, "Out of stock" (not in stock), "Only N left" (stock below its quantity) or "Not enough stock" in place of its unit, and a "Remove <name>" button in place of its price that sets the line to 0 through the cart.

#### Scenario: Out-of-stock lines marked
- **WHEN** the cart holds 3 of "Amul Taaza" whose product shows `quantity` 2, 1 of "Amul Butter" not in stock and 1 of "Amul Curd", and placing answers 409 `out_of_stock` naming Amul Taaza and Amul Butter
- **THEN** the alert is shown, Amul Taaza shows "Only 2 left" and "Remove Amul Taaza", Amul Butter "Out of stock" and "Remove Amul Butter", Amul Curd neither, "Remove the marked products to continue." is shown, and the screen is still Checkout

#### Scenario: Marked line removed
- **WHEN** only Amul Butter is marked, "Remove Amul Butter" is chosen, and core answers the cart without it
- **THEN** `PUT /me/cart/items` carried quantity 0 for Amul Butter, its line is gone, and the "Place order" button is shown

#### Scenario: Failed removal at checkout
- **WHEN** Amul Butter is marked, core cannot be reached, and "Remove Amul Butter" is chosen
- **THEN** the line shows an alert "Could not reach ShopperStop. Try again." and still shows "Out of stock" and "Remove Amul Butter"

### Requirement: Mobile checkout refusals
A refusal other than `out_of_stock` and `internal` SHALL keep the screen and the cart, end the busy state and show an alert: 409 `not_serviceable` with field `addressId`, "<store> does not deliver to this address. Choose another address or add one." and a `warning` badge "Not delivered here" on that address; without a field, "<store> is closed right now."; 400 with field `subtotal`, "Your cart is below the store's minimum order."; else "Could not place your order. Try again.".

#### Scenario: Address not served
- **WHEN** the cart is at Koramangala, "Work" is chosen, and placing answers 409 `not_serviceable` with field `addressId`
- **THEN** an alert reads "Koramangala does not deliver to this address. Choose another address or add one.", the card shows "Not delivered here", and the cart's lines are still shown

#### Scenario: Store closed at placement
- **WHEN** placing answers 409 `not_serviceable` without a field
- **THEN** an alert reads "Koramangala is closed right now." and no "Not delivered here" is shown

#### Scenario: Placement fails
- **WHEN** placing answers 400 `validation` with field `subtotal`; separately 400 `validation` with field `addressId`; separately 409 `conflict` twice
- **THEN** the alert reads "Your cart is below the store's minimum order." the first time and "Could not place your order. Try again." the other two, and each time "Place order" is not busy

### Requirement: Mobile checkout refusal cleared
Choosing another address after an address was refused SHALL remove that alert; the "Not delivered here" badge SHALL stay on the refused address until "Place order" is next pressed or the addresses are read again.

#### Scenario: Choosing another address clears the alert
- **WHEN** placing with "Work" chosen answered 409 `not_serviceable` with field `addressId`, and "Deliver to Home" is then chosen in "Choose address"
- **THEN** no alert is shown, the card shows "Delivering to Home" without "Not delivered here", and reopening "Choose address" shows "Not delivered here" on "Work" only

### Requirement: Mobile checkout unconfirmed placement
When placing answers `internal` (core not reached, a 5xx or a failure without the envelope, or a 2xx without an order), the screen SHALL keep the cart, end the busy state and show an alert "We could not confirm your order. It may have been placed, so check Your orders before you place it again." with a "Your orders" button to `/orders`. When the cart read again after that answer is empty, the app SHALL replace the screen with `/orders`.

#### Scenario: Core cannot be reached at placement
- **WHEN** a customer with Amul Taaza in the cart chooses "Place order" and core cannot be reached
- **THEN** the alert reads "We could not confirm your order. It may have been placed, so check Your orders before you place it again.", a "Your orders" button is shown, the Amul Taaza line is still shown, and "Place order" is not busy

#### Scenario: Unconfirmed placement that emptied the cart
- **WHEN** placing answers 502 with no body and core then answers `GET /me/cart` with the empty cart
- **THEN** the path is `/orders`

### Requirement: Mobile checkout end-to-end suite
`e2e/checkout.spec.ts` SHALL run checkout against core on the web export at 390×844, each test with a customer registered for the run and its own in-stock product, reaching `/checkout` in-app through the cart sheet's "Proceed to checkout", and SHALL run axe on every screen, sheet and alert state it visits, with no violation allowed.

#### Scenario: Address added at checkout against core
- **WHEN** a customer with no address and a cart above the minimum opens checkout from the cart sheet, sees "No addresses yet", chooses "Add address" and saves "Home" with pincode `560034`
- **THEN** the card shows "Delivering to Home", the "Place order" button is shown, and axe reports no violations with the address sheet open and closed

#### Scenario: Order placed against core
- **WHEN** a guest with `560034` chosen adds a product above the store's minimum, chooses "Proceed to checkout" in the cart sheet, signs in as a customer with one address, and chooses "Place order"
- **THEN** the tracking screen's level-1 heading is "Order SS-" and eight more characters, the status reads "Order placed. Waiting for the store to accept it.", the product is listed, `GET /me/cart` answers the empty cart, and axe reports no violations on checkout and tracking

#### Scenario: Out of stock at checkout against core
- **WHEN** a customer's cart holds a product above the minimum, the store's stock of it is set to 0, and the customer chooses "Place order" and then "Remove <name>"
- **THEN** after placing the alert and "Out of stock" on that line are shown and `GET /orders` lists no order; after the removal "Your cart is empty" is shown; axe reports no violations with the alert showing

#### Scenario: Address not served against core
- **WHEN** a customer whose only address has pincode `560038` and whose cart is at Koramangala above the minimum chooses "Place order"
- **THEN** the alert names Koramangala, the card shows "Not delivered here", `GET /me/cart` still answers the line, and axe reports no violations
