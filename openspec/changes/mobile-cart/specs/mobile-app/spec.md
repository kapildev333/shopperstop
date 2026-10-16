## ADDED Requirements

### Requirement: Mobile guest cart lines
While no customer token is held, setting a line of the guest cart SHALL set it to exactly the given quantity, clamped to the product's maximum (its `quantity` while in stock, at most 20; 0 when out of stock); 0 SHALL remove the line, and a cart whose last line goes SHALL have no store. At another store, a quantity above 0 after the clamp SHALL replace the cart with that one line; 0 SHALL leave it unchanged.

#### Scenario: Guest line set and removed
- **WHEN** an empty guest cart sets product P to 1 at store A, then P to 3, then product Q to 1, then P to 0
- **THEN** the cart is at store A holding only Q with quantity 1, and after Q is set to 0 the cart has no store and no lines

#### Scenario: Guest line clamped
- **WHEN** product P has `quantity` 4 and `inStock` true and is set to 6, and product R has `inStock` false and `quantity` 0 and is set to 1
- **THEN** P's line has quantity 4 and there is no line of R

#### Scenario: Another store replaces the guest cart
- **WHEN** a guest cart at store A holds P and Q, then R is set to 0 at store B, then R is set to 1 at store B
- **THEN** after the first set the cart is still at A with P and Q, and after the second it is at B holding only R

#### Scenario: Out of stock at another store keeps the guest cart
- **WHEN** a guest cart at store A holds P and Q, and R, which has `inStock` false and `quantity` 0, is set to 1 at store B
- **THEN** the cart is still at A with P and Q

### Requirement: Mobile guest cart storage
The app SHALL keep the guest cart `{storeId, items: [{product, quantity}]}` in memory and in async storage under `shopperstop:cart`, read once and asynchronously after launch; a change made before that read settles SHALL win over it. A stored value that does not parse as that shape SHALL read as an empty cart, and failing storage SHALL leave the cart in memory without an error.

#### Scenario: Guest cart persisted and restored
- **WHEN** a guest cart sets P to 2 at store A, and the cart module is loaded again; and in a third load async storage `shopperstop:cart` holds `{"items":5}`
- **THEN** async storage `shopperstop:cart` holds store A and P with quantity 2, the second load reads the same cart, and the third load reads the empty cart

#### Scenario: Guest change wins over a late read
- **WHEN** the stored cart holds P at store A, the read is still pending, and Q is set to 1 at store A
- **THEN** after the read settles the cart holds only Q, and async storage holds only Q

#### Scenario: Guest cart with blocked storage
- **WHEN** every async storage call rejects, the cart module loads and P is set to 1 at store A
- **THEN** nothing throws and the cart holds P with quantity 1

### Requirement: Mobile cart totals
The guest cart SHALL show the totals core computes for a server cart, from the resolved store's fees: `subtotalCents` the sum of price times quantity, `deliveryFeeCents` the store's fee or 0 at or above its free-delivery threshold, `totalCents` subtotal plus fee, `minOrderCents` the store's minimum, and `shortfallCents` what is missing to free delivery, never below 0. An empty cart SHALL have every amount 0.

#### Scenario: Guest totals follow the store's fees
- **WHEN** the store's fee is 2500, free delivery starts at 19900 and the minimum order is 9900, and the guest cart holds 2 of a product priced 4500
- **THEN** the cart shows `subtotalCents` 9000, `deliveryFeeCents` 2500, `totalCents` 11500, `minOrderCents` 9900 and `shortfallCents` 10900; with 5 of it, `deliveryFeeCents` 0, `totalCents` 22500 and `shortfallCents` 0

### Requirement: Mobile cart behind every Stepper
Every product `Stepper` (card, product screen, cart sheet line) SHALL show the product's quantity in the cart while the cart is at the resolved store, and 0 while the cart is empty or at another store, and SHALL set that line at the resolved store through the cart: the guest cart while no token is held, the server cart while one is.

#### Scenario: Card adds to the guest cart
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza" is chosen on its card
- **THEN** the group "Quantity of Amul Taaza" shows 1 and async storage `shopperstop:cart` holds the store's id and the product with quantity 1

#### Scenario: Card shows the server cart
- **WHEN** a token is held and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza at the resolved store
- **THEN** its card's group "Quantity of Amul Taaza" shows 3

#### Scenario: Card ignores a cart at another store
- **WHEN** a token is held, Koramangala is the resolved store, and the cart from `GET /me/cart` holds 3 of Amul Taaza at Indiranagar
- **THEN** its card shows the "Add Amul Taaza" button and no group "Quantity of Amul Taaza"

#### Scenario: Guest taps each count
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza", "Add one Amul Taaza" and "Add one Amul Taaza" are chosen one straight after the other
- **THEN** the group "Quantity of Amul Taaza" shows 3 and async storage holds it with quantity 3

### Requirement: Mobile cart quick taps
While a token is held and a change to a line is still being written, that line's `Stepper` SHALL show the last quantity asked for, so every tap counts from the one before. The app SHALL send cart changes to core one at a time in the order made, MAY skip a change a later one for the same line has overtaken, and SHALL end showing core's latest answer. When a write fails, the `Stepper` SHALL return to the cart's count.

#### Scenario: Quick taps each count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, and "Add one Amul Taaza", "Add one Amul Taaza" and "Remove one Amul Taaza" are chosen before any answer arrives
- **THEN** the group "Quantity of Amul Taaza" shows 2, then 3, then 2, and the writes reach core one at a time

#### Scenario: Failed write returns to the cart's count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen
- **THEN** the group shows 2 at once and 1 again once the write has failed

### Requirement: Mobile server cart
While a token is held, the app SHALL read the cart from `GET /me/cart` and change a line with `PUT /me/cart/items` `{storeId, productId, quantity}`, showing the lines and store that answer holds, never the ones it sent. While the last answer says `clamped: true`, the cart sheet SHALL show "Some quantities were lowered to what the store has." until the cart is next changed or read again.

#### Scenario: Answer wins over what was sent
- **WHEN** a token is held, "Add one Amul Taaza" sends quantity 4, and core answers the line with quantity 2 and `clamped: true`
- **THEN** the group "Quantity of Amul Taaza" shows 2 and the open cart sheet shows "Some quantities were lowered to what the store has."

#### Scenario: Line clamped away
- **WHEN** a token is held, the last `PUT /me/cart/items` answered an empty cart with `clamped: true`, and the cart sheet opens
- **THEN** it shows "Some quantities were lowered to what the store has." and "Your cart is empty"

### Requirement: Mobile cart write failure
While a token is held, a failed change to a line SHALL show a one-line alert under the control it was made from (product card, product screen bar, cart sheet line) with the answer's error message, or "Could not reach ShopperStop. Try again." when core was not reached. The alert SHALL go when that control is used again or leaves the screen; an overtaken change SHALL show none.

#### Scenario: Failed write tells the customer
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "Could not reach ShopperStop. Try again." and its group shows 1

#### Scenario: Core's refusal is shown
- **WHEN** core answers `PUT /me/cart/items` with 400 `validation` "product not available" and "Add one Amul Taaza" is chosen on the product screen
- **THEN** the product screen's bar shows an alert "product not available"

#### Scenario: Next tap clears the failure
- **WHEN** the card shows a failed write's alert and "Add one Amul Taaza" is chosen again
- **THEN** the alert is gone at once, and shows again when that write fails too

#### Scenario: Overtaken change shows no failure
- **WHEN** core cannot be reached and "Add one Amul Taaza" is chosen twice on the card before any answer arrives
- **THEN** once the writes have settled the card shows exactly one alert

### Requirement: Mobile cart merge at sign-in
When sign-in or register succeeds and the guest cart has lines, the app SHALL send `PUT /me/cart/items` for each guest line in the guest cart's order, with its store and quantity, before leaving the form, and then SHALL empty the guest cart, also when a request fails, and show core's cart as answered. A merge still queued when the session changes SHALL send nothing and keep the guest cart.

#### Scenario: Merge bodies in guest order
- **WHEN** the guest cart at store A holds P with 2 and then Q with 1, and sign-in succeeds
- **THEN** the app sends `{storeId: A, productId: P, quantity: 2}` and then `{storeId: A, productId: Q, quantity: 1}`, and P shows 2 from core's answer

#### Scenario: Guest cart discarded after merge
- **WHEN** the guest cart holds a line and the merge runs while core cannot be reached
- **THEN** afterwards async storage has no `shopperstop:cart` and the guest cart is empty

#### Scenario: Merge dropped when the session changed
- **WHEN** the guest cart holds a line, the merge waits behind another cart write, and the token has changed before its turn
- **THEN** no merge request is sent and the guest cart still holds its line

### Requirement: Mobile cart sheet
The cart SHALL open as a sheet titled "My cart" with: the delivery promise "Delivery in <N> minutes" and "Shipment of <count> items"; each line's image, name, unit, line price and a `Stepper` labelled with its name (out of stock: "Out of stock" and "Remove <name>"); "Add ₹<shortfall> more for free delivery." while above 0; "Bill details" with "Items total" (MRP total struck when higher), "Delivery fee" ("FREE" at 0) and "Grand total".

#### Scenario: Sheet lines and bill
- **WHEN** the sheet opens on a cart holding 2 of "Amul Taaza" (`500 ml`, 2700, MRP 2900) and 1 of "Amul Butter" (`100 g`, 5600) with fee 2500, free delivery from 19900, minimum 9900 and a 10-minute store
- **THEN** it shows "Delivery in 10 minutes", "Shipment of 3 items", both lines with their unit, "₹54" and "₹56" and a quantity group each, "Add ₹89 more for free delivery.", "Items total" ₹110 with the struck MRP total ₹114, "Delivery fee" ₹25 and "Grand total" ₹135

#### Scenario: Free delivery
- **WHEN** the cart's `deliveryFeeCents` and `shortfallCents` are 0
- **THEN** "Delivery fee" reads "FREE" and no "more for free delivery" text is shown

#### Scenario: Out-of-stock line
- **WHEN** the server cart holds a line of "Amul Butter" whose product has `inStock` false, and "Remove Amul Butter" is chosen
- **THEN** the line shows a disabled "Out of stock" button, and the choice sends quantity 0 for Amul Butter

### Requirement: Mobile cart checkout and minimum order
Below the sheet's scrolling content, at or above `minOrderCents` the sheet SHALL show a "Proceed to checkout" link with the grand total, to `/checkout`, or to `/sign-in?returnTo=%2Fcheckout` with no token, closing the sheet; below it, the block "Minimum order is ₹<min>. Add ₹<missing> more to check out." and no link. The sheet SHALL end its content with "Orders cannot be cancelled once packing starts."

#### Scenario: Below the minimum order
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900
- **THEN** "Minimum order is ₹99. Add ₹45 more to check out." is shown and there is no "Proceed to checkout" link

#### Scenario: Proceed signed out
- **WHEN** the sheet is open on a guest cart above the minimum and "Proceed to checkout" is chosen
- **THEN** the sheet closes and the app is at `/sign-in` with `returnTo` `/checkout`

#### Scenario: Proceed signed in
- **WHEN** a token is held, the sheet is open on a cart above the minimum, and "Proceed to checkout" is chosen
- **THEN** the sheet closes and the app is at `/checkout`

### Requirement: Mobile cart sheet states
The sheet SHALL show, for an empty cart, the empty state "Your cart is empty" with "Milk, bread, snacks and more, delivered from the store near you in minutes." and a "Start shopping" button that closes the sheet; a loading state while the server cart loads; and the error state with "Try again" when it fails to load and nothing is held.

#### Scenario: Empty cart
- **WHEN** the sheet opens on an empty guest cart and "Start shopping" is chosen
- **THEN** "Your cart is empty" is shown, and the choice closes the sheet

#### Scenario: Loading and failed cart
- **WHEN** the sheet opens signed in before `GET /me/cart` answers; and separately signed in with core unreachable
- **THEN** the label "Loading" is shown; then "You're offline" with a "Try again" button that reads the cart again

### Requirement: Mobile cart bar
While the cart has lines, Home, the Categories tab, the category screen and search SHALL show at their foot a bar with the item count ("1 item", "N items", the sum of quantities) and the total as `Price`, the whole bar one button named "View cart, <count>, <total>" that opens the cart sheet. The bar SHALL be absent while the cart is empty, and on every other screen.

#### Scenario: Bar follows the cart
- **WHEN** Home renders with an empty cart, and then with a cart of 2 of a product priced 2700 (fee 2500)
- **THEN** first no "View cart" button is shown; then the bar shows "2 items" and ₹79, and choosing it opens the sheet "My cart"

#### Scenario: Bar on the browsing screens
- **WHEN** the cart holds a line and the Categories tab, a category screen, search and a product screen render
- **THEN** the first three show the "View cart" button and the product screen does not

### Requirement: Mobile store change empties the server cart
While a token is held, "Switch store" in the store change dialog SHALL send `DELETE /me/cart` and show the empty cart once it answers; when the request fails the dialog SHALL stay open with "Could not empty your cart." and the pincode SHALL not change.

#### Scenario: Server cart emptied on a store change
- **WHEN** a signed-in customer's cart at Koramangala holds a line, `560038` is continued in the pincode sheet, and "Switch store" is chosen
- **THEN** `DELETE /me/cart` is sent, the stored pincode is `560038`, and the cart counts nothing

#### Scenario: Emptying the server cart fails
- **WHEN** the same switch is chosen while core cannot be reached
- **THEN** the dialog stays open with an alert "Could not empty your cart." and the stored pincode is still `560034`

### Requirement: Mobile store change needs an answer
"Continue" in the pincode sheet SHALL compare stores against the cart as known after its read settles (the stored guest cart, or `GET /me/cart` while a token is held). When the cart has lines, or cannot be read, and the pincode lookup fails or the cart read fails, the sheet SHALL stay open, store nothing and show the alert "Could not check this pincode. Try again."; with an empty cart a failed lookup SHALL store the pincode as before.

#### Scenario: Failed lookup keeps the cart's pincode
- **WHEN** the cart holds a line at Koramangala with `560034` stored, and `560038` is continued while `GET /serviceability` cannot be reached
- **THEN** no dialog opens, the sheet stays open with the alert "Could not check this pincode. Try again.", and the stored pincode is still `560034`

#### Scenario: Unread server cart is fetched before comparing
- **WHEN** a token is held, the cart is not yet read, `GET /me/cart` answers a line at Koramangala, and `560038` (Indiranagar) is continued
- **THEN** the dialog "Switch to the Indiranagar store?" opens

#### Scenario: Failed lookup with an empty cart
- **WHEN** the cart is empty and `560038` is continued while `GET /serviceability` cannot be reached
- **THEN** the pincode `560038` is stored and the sheet closes

### Requirement: Mobile cart replaced notice
When a `PUT /me/cart/items` answer says `replaced: true`, from a Stepper or the merge, the app SHALL open the cart sheet once, and the sheet and the cart bar SHALL show, until the cart is next changed or read again, a status "Your cart from <store> was replaced. A cart holds products from one store.", <store> being the name `GET /stores/{id}` gives for the cart's previous store, or "another store" while it is not known.

#### Scenario: Replaced notice names the old store
- **WHEN** a token is held, the cart was at Koramangala, and the last `PUT /me/cart/items` answered one line at Indiranagar with `replaced: true`
- **THEN** the cart sheet has opened, and it and the cart bar each show a status "Your cart from Koramangala was replaced. A cart holds products from one store."

#### Scenario: Replace opens the sheet once
- **WHEN** an answer with `replaced: true` arrives; then the customer closes the sheet; then an answer with `replaced: false` arrives
- **THEN** the sheet "My cart" opens on the first answer, stays closed after it is closed, and does not open on the second

#### Scenario: Replaced notice without the old store
- **WHEN** the same answer arrives while the previous store is not known
- **THEN** the status reads "Your cart from another store was replaced. A cart holds products from one store."

### Requirement: Mobile cart end-to-end suite
`e2e/cart.spec.ts` SHALL run the cart against core on the web export at 390×844 with axe on every screen and open sheet or dialog it visits.

#### Scenario: Guest cart against core
- **WHEN** a guest with `560034` chosen adds two products on Home, adds one more of the first, opens "View cart", removes both lines in the sheet and closes it, after a reload in between
- **THEN** the bar reads "3 items" before and after the reload, the sheet lists two lines with a "Proceed to checkout" link, then shows "Your cart is empty", and axe reports no violations with the bar, the sheet and the empty sheet

#### Scenario: Quick taps against core
- **WHEN** a signed-in customer with an empty cart chooses "Add" on a Home card and then "Add one", "Add one" and "Remove one" while core's first answer is held back
- **THEN** the card shows 2 and `GET /me/cart` answers that product with quantity 2

#### Scenario: Merge at sign-in against core
- **WHEN** a guest with `560034` chosen adds two products on Home, sets the first to 2, and signs in through the sheet's "Have an account?" link as a customer with an empty cart
- **THEN** on Home the first shows 2 and the second 1, and local storage has no `shopperstop:cart`

#### Scenario: Clamp against core
- **WHEN** a signed-in customer has 2 of a product, the store's stock of it drops to 1, and "Add one" is chosen on its product screen
- **THEN** its quantity shows 1 and the opened cart sheet shows "Some quantities were lowered to what the store has."

#### Scenario: Server store change against core
- **WHEN** a signed-in customer with `560034` chosen adds a product, continues with `560038` in the pincode sheet and chooses "Switch store"
- **THEN** no "View cart" button is shown, `GET /me/cart` answers the empty cart, and axe reports no violations with the dialog open

#### Scenario: Replaced notice against core
- **WHEN** a signed-in customer whose cart holds a product at Koramangala opens Home with `560038` chosen and chooses "Add" on a card
- **THEN** the sheet opens with "Your cart from Koramangala was replaced. A cart holds products from one store.", after closing it the bar reads "1 item" with the same status, and axe reports no violations with the sheet open and closed
