## ADDED Requirements

### Requirement: Customer guest cart lines
While no customer token is held, setting a line of the guest cart SHALL set it to exactly the given quantity, clamped to the product's maximum (its `quantity` while in stock, at most 20; 0 when out of stock); 0 SHALL remove the line, and a cart whose last line goes SHALL have no `storeId`. At a store other than the cart's, a quantity still above 0 after the clamp SHALL replace the cart with that one line; 0, asked for or clamped, SHALL leave it unchanged.

#### Scenario: Guest line set and removed
- **WHEN** an empty guest cart sets product P to 1 at store A, then P to 3, then product Q to 1, then P to 0
- **THEN** the cart is at store A holding only Q with quantity 1, and after Q is set to 0 the cart has no `storeId` and no lines

#### Scenario: Guest line clamped
- **WHEN** product P has `quantity` 4 and `inStock` true and is set to 6, and product R has `inStock` false and `quantity` 0 and is set to 1
- **THEN** P's line has quantity 4 and there is no line of R

#### Scenario: Another store replaces the guest cart
- **WHEN** a guest cart at store A holds P and Q, then R is set to 0 at store B, then R is set to 1 at store B
- **THEN** after the first set the cart is still at A with P and Q, and after the second it is at B holding only R

#### Scenario: Out of stock at another store keeps the guest cart
- **WHEN** a guest cart at store A holds P and Q, and R, which has `inStock` false and `quantity` 0, is set to 1 at store B
- **THEN** the cart is still at A with P and Q

### Requirement: Customer guest cart storage
The site SHALL keep the guest cart `{storeId, items: [{product, quantity}]}` in memory and in `localStorage` under `shopperstop:cart`, SHALL read it when the app loads, and SHALL treat a stored value that does not parse as that shape as an empty cart. When storage throws (blocked or full), the cart SHALL still be held in memory for the page.

#### Scenario: Guest cart persisted and restored
- **WHEN** a guest cart sets P to 2 at store A, and the cart module is loaded again; and in a third load `localStorage` `shopperstop:cart` holds `{"items":5}`
- **THEN** `localStorage` `shopperstop:cart` holds store A and P with quantity 2, the second load holds the same cart, and the third load holds the empty cart

#### Scenario: Guest cart with blocked storage
- **WHEN** every `localStorage` call throws, the cart module loads and P is set to 1 at store A
- **THEN** loading does not throw and the cart holds P with quantity 1

### Requirement: Customer cart totals
The guest cart SHALL show the same totals core computes for a server cart, from the resolved store's fees: `subtotalCents` the sum of price times quantity, `deliveryFeeCents` the store's fee or 0 when the subtotal is at or above its free-delivery threshold, `totalCents` subtotal plus fee, `minOrderCents` the store's minimum order, and `shortfallCents` what is missing to free delivery, never below 0. An empty cart SHALL have every amount 0.

#### Scenario: Guest totals follow the store's fees
- **WHEN** the store's fee is 2500, free delivery starts at 19900 and the minimum order is 9900, and the guest cart holds 2 of a product priced 4500
- **THEN** the cart shows `subtotalCents` 9000, `deliveryFeeCents` 2500, `totalCents` 11500, `minOrderCents` 9900 and `shortfallCents` 10900; with 5 of it, `deliveryFeeCents` 0, `totalCents` 22500 and `shortfallCents` 0

### Requirement: Customer cart behind every Stepper
Every product `Stepper` SHALL show the product's quantity in the cart while the cart's `storeId` is the resolved store's, and 0 while the cart is empty or at another store, and SHALL set that line at the resolved store through the cart: the guest cart while no token is held, the server cart while one is.

#### Scenario: Card adds to the guest cart
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza" is chosen on its card
- **THEN** the group "Quantity of Amul Taaza" shows 1 and `localStorage` `shopperstop:cart` holds the store's id and the product with quantity 1

#### Scenario: Card shows the server cart
- **WHEN** a token is held and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza
- **THEN** its card's group "Quantity of Amul Taaza" shows 3

#### Scenario: Card ignores a cart at another store
- **WHEN** a token is held, Koramangala is the resolved store, and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza at Indiranagar
- **THEN** its card shows the "Add Amul Taaza" button and no group "Quantity of Amul Taaza"

#### Scenario: Guest taps each count
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza", "Add one Amul Taaza" and "Add one Amul Taaza" are chosen one straight after the other
- **THEN** the group "Quantity of Amul Taaza" shows 3 and `localStorage` `shopperstop:cart` holds it with quantity 3

### Requirement: Customer cart quick taps
While a customer token is held and a change to a line is still being written, that line's `Stepper` SHALL show the last quantity asked for, so every tap counts from the one before. The site SHALL send cart changes to core one at a time in the order they were made, MAY skip a change that a later one for the same line has overtaken, and SHALL end showing core's latest answer. When a write fails, the `Stepper` SHALL return to the cart's count.

#### Scenario: Quick taps each count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, and "Add one Amul Taaza", "Add one Amul Taaza" and "Remove one Amul Taaza" are chosen before any answer arrives
- **THEN** the group "Quantity of Amul Taaza" shows 2, then 3, then 2

#### Scenario: Failed write returns to the cart's count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen
- **THEN** the group shows 2 at once and 1 again once the write has failed

#### Scenario: Quick taps against core
- **WHEN** a signed-in customer with an empty cart chooses "Add" on a product card on Home and then "Add one", "Add one" and "Remove one" on it while core's first answer is held back longer than the later ones
- **THEN** the card shows 2, `GET /me/cart` answers that product with quantity 2, and after a reload the card still shows 2

#### Scenario: Quick taps in the drawer
- **WHEN** a token is held, the drawer is open on a cart holding 1 of Amul Taaza, and "Add one Amul Taaza" is chosen twice in the drawer before any answer arrives
- **THEN** the drawer's group "Quantity of Amul Taaza" shows 3

### Requirement: Customer server cart
While a customer token is held, the site SHALL read the cart from `GET /me/cart` and SHALL change a line with `PUT /me/cart/items` `{storeId, productId, quantity}`, showing the lines and `storeId` that response answers, never the ones it sent. When the response says `clamped: true`, the drawer SHALL show "Some quantities were lowered to what the store has." until the next change or reload, also when the cart is then empty.

#### Scenario: Server cart clamps above stock
- **WHEN** a signed-in customer has 2 of a product in the cart, the store's stock of it drops to 1, and "Add one" is chosen on its page; then the stock drops to 0, the page is reloaded, and "Remove <name>" is chosen in the cart drawer
- **THEN** its quantity shows 1 and the open cart drawer shows "Some quantities were lowered to what the store has."; after the removal the drawer shows "Your cart is empty"

#### Scenario: Line clamped away
- **WHEN** a token is held and the last `PUT /me/cart/items` answered an empty cart with `clamped: true`, and the drawer opens
- **THEN** it shows "Some quantities were lowered to what the store has." and "Your cart is empty"

### Requirement: Customer cart merge at sign-in
When sign-in or register succeeds and the guest cart has lines, the site SHALL send `PUT /me/cart/items` for each guest line in the guest cart's order, with the guest cart's `storeId` and the line's quantity, and then SHALL empty the guest cart, also when a line's request fails, and show core's cart as answered. Lines the server already holds at that store and the guest cart does not name SHALL stay.

#### Scenario: Merge bodies in guest order
- **WHEN** the guest cart at store A holds P with 2 and then Q with 1
- **THEN** the merge sends `{storeId: A, productId: P, quantity: 2}` and then `{storeId: A, productId: Q, quantity: 1}`

#### Scenario: Guest cart discarded after merge
- **WHEN** the guest cart holds a line and the merge runs while core cannot be reached
- **THEN** afterwards `localStorage` has no `shopperstop:cart` and the guest cart is empty

#### Scenario: Guest cart merges against core
- **WHEN** a guest with `560034` chosen adds two products on Home, sets the first to 2, and signs in on `/sign-in` as a customer with an empty cart
- **THEN** on Home the first product shows 2 and the second 1, `localStorage` has no `shopperstop:cart`, and after a reload both quantities are unchanged

### Requirement: Customer cart drawer
The cart SHALL open in a `Sheet` titled "Your cart" listing each line with its image tile, name, unit, `Price` and a `Stepper` labelled with its name (an out-of-stock line adds a "Remove <name>" button), then "Subtotal", "Delivery fee" (or "Free" at 0) and "Total", "Add ₹<shortfall> more for free delivery" while `shortfallCents` is above 0, and a "Proceed to checkout" link to `/checkout`, or to `/sign-in?returnTo=%2Fcheckout` with no token.

#### Scenario: Drawer lines and totals
- **WHEN** the drawer opens on a cart holding 2 of "Amul Taaza" (`500 ml`, 2700) and 1 of "Amul Butter" (`100 g`, 5600) with fee 2500, free delivery from 19900 and minimum 9900
- **THEN** both lines show their name, unit and price with a quantity group, "Subtotal" ₹110, "Delivery fee" ₹25, "Total" ₹135, "Add ₹89 more for free delivery", and a "Proceed to checkout" link

#### Scenario: Free delivery
- **WHEN** the cart's `deliveryFeeCents` and `shortfallCents` are 0 and its subtotal is above the minimum
- **THEN** "Delivery fee" reads "Free" and no "more for free delivery" text is shown

#### Scenario: Checkout link signed in and out
- **WHEN** the drawer opens on a cart above the minimum with no token held, and again with a token held
- **THEN** "Proceed to checkout" points to `/sign-in?returnTo=%2Fcheckout` the first time and to `/checkout` the second

#### Scenario: Out-of-stock line
- **WHEN** the server cart holds a line of "Amul Butter" whose product has `inStock` false and `quantity` 0
- **THEN** the line shows a disabled "Out of stock" button and a "Remove Amul Butter" button

### Requirement: Customer cart drawer states
The drawer SHALL show "Your cart is empty" for an empty cart, a skeleton list while the server cart loads, and an alert "Could not load your cart." with "Try again" when it fails to load.

#### Scenario: Empty, loading and failed cart
- **WHEN** the drawer opens on an empty guest cart; then signed in before `GET /me/cart` answers; then signed in with core unreachable
- **THEN** "Your cart is empty" is shown; then a "Loading" status; then an alert "Could not load your cart." with a "Try again" button

### Requirement: Customer cart minimum order
While the cart's subtotal is below `minOrderCents`, the drawer SHALL show "Minimum order is ₹<min>. Add ₹<missing> more to check out." and a disabled "Proceed to checkout" button in place of the link.

#### Scenario: Below the minimum order
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900
- **THEN** "Minimum order is ₹99. Add ₹45 more to check out." is shown and "Proceed to checkout" is a disabled button, not a link

### Requirement: Customer cart bar and header button
While the cart has lines, every page SHALL show on phone a bar fixed to the bottom with `shadow-sheet` holding the item count ("1 item", "N items", the sum of quantities), the total as `Price` and a "View cart" button opening the drawer; the bar SHALL be absent while the cart is empty. The banner SHALL hold on desktop a cart button opening the drawer, named "Cart" while the cart is empty and "<count> <total>" otherwise.

#### Scenario: Bar and header follow the cart
- **WHEN** the app renders `/` with an empty cart, and then with a cart of 2 of a product priced 2700 (fee 2500)
- **THEN** first no "View cart" button is shown and the banner's cart button is named "Cart"; then the bar shows "2 items" and ₹79, the banner's cart button is named "2 items ₹79", and choosing "View cart" opens the dialog "Your cart"

#### Scenario: Cart drawer against core
- **WHEN** a guest on a 390 px wide screen with `560034` chosen adds two products on Home, chooses "View cart", and adds one more of the first in the drawer
- **THEN** the drawer lists two lines, the bar reads "3 items", "Proceed to checkout" points to `/sign-in?returnTo=%2Fcheckout`, and axe reports no violations on `/` with the bar shown and with the drawer open

### Requirement: Customer store change confirm
Saving a pincode in the pincode sheet SHALL first resolve it; when it resolves to a store other than the cart's and the cart has lines, the sheet SHALL close and a `Dialog` "Change store?" naming the new store SHALL open with "Cancel" first and "Empty cart and change". Any other save SHALL store the pincode at once.

#### Scenario: Same store or empty cart
- **WHEN** a pincode resolving to the cart's store is saved, and separately any pincode is saved with an empty cart
- **THEN** no dialog opens and the pincode is stored

#### Scenario: Store change against core
- **WHEN** a signed-in customer with `560034` chosen adds a product, saves `560038` in the pincode sheet, cancels, saves `560038` again, and confirms
- **THEN** after the cancel the banner still reads `560034` and the cart button "1 item"; after the confirm the banner reads "Delivery in 12 minutes 560038", the cart button reads "Cart", `GET /me/cart` answers the empty cart, and axe reports no violations with the dialog open

### Requirement: Customer store change outcome
Confirming the store change SHALL empty the guest cart, or send `DELETE /me/cart` while a token is held, and then store the pincode; if the `DELETE` fails the dialog SHALL stay open showing "Could not empty your cart." and the pincode SHALL not change. Cancel SHALL keep the pincode and the cart.

#### Scenario: Store change confirmed
- **WHEN** the guest cart at Koramangala holds a line and `560038`, which resolves to Indiranagar, is saved in the sheet, and "Empty cart and change" is chosen
- **THEN** the dialog "Change store?" names Indiranagar with "Cancel" as its first button, and after the choice the guest cart is empty and the stored pincode is `560038`

#### Scenario: Store change cancelled
- **WHEN** the same save is followed by "Cancel"
- **THEN** the stored pincode is still `560034` and the cart still holds its line

#### Scenario: Emptying the server cart fails
- **WHEN** a signed-in customer's cart at Koramangala holds a line, `560038` is saved, and "Empty cart and change" is chosen while core cannot be reached
- **THEN** the dialog stays open with an alert "Could not empty your cart." and the stored pincode is still `560034`

### Requirement: Customer cart replaced notice
When a `PUT /me/cart/items` answer says `replaced: true`, from a Stepper or in the merge at sign-in, the cart drawer and the cart bar SHALL show, until the next cart change or reload, a `StatusMessage` (role `status`) reading "Your cart from <store> was replaced. A cart holds products from one store.", where <store> is the name `GET /stores/{id}` answers for the store the cart was at, or "another store" while that store or its name is not known.

#### Scenario: Replaced notice names the old store
- **WHEN** a token is held, Indiranagar is resolved, the last `PUT /me/cart/items` answered a cart of one line at Indiranagar with `replaced: true`, the cart was at Koramangala before, and `/` renders with the drawer open
- **THEN** the cart bar and the drawer each show a status "Your cart from Koramangala was replaced. A cart holds products from one store."

#### Scenario: Replaced notice without the old store
- **WHEN** the same answer is shown while the store the cart was at is not known; and separately an answer with `replaced: false` is shown
- **THEN** the bar and the drawer show "Your cart from another store was replaced. A cart holds products from one store." the first time, and no "was replaced" text the second

#### Scenario: Replaced notice against core
- **WHEN** a signed-in customer whose cart holds a product at Koramangala opens `/` on a 390 px wide screen with `560038` chosen, and chooses "Add" on a product card
- **THEN** the bar reads "1 item" and shows "Your cart from Koramangala was replaced. A cart holds products from one store.", the drawer shows it too after "View cart", `GET /me/cart` answers one line at Indiranagar, and axe reports no violations with the notice shown

#### Scenario: Merge replaces another store's cart
- **WHEN** a customer whose cart holds a product at Koramangala adds a product as a guest with `560038` chosen and signs in on `/sign-in`
- **THEN** the cart drawer holds only the guest's product and shows "Your cart from Koramangala was replaced. A cart holds products from one store."
