## MODIFIED Requirements

### Requirement: Customer cart write failure
While a customer token is held, when a change to a cart line fails (core cannot be reached, or `PUT /me/cart/items` answers an error), the site SHALL show an `ErrorBanner` under the control the change was made from: the `Stepper` on a product card, on the product page or on a cart drawer line, that line's Remove button, or a checkout line's Remove button. Its message SHALL be the answer's error message, or "Could not reach ShopperStop. Try again." when core was not reached.

#### Scenario: Failed write tells the customer
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "Could not reach ShopperStop. Try again." and its group "Quantity of Amul Taaza" shows 1

#### Scenario: Core's refusal is shown
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core answers `PUT /me/cart/items` with 400 `validation` "product not available", and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "product not available" and its group shows 1

#### Scenario: Failed removal at checkout
- **WHEN** a customer on `/checkout` with Amul Butter not in stock in the cart chooses "Place order (COD)", placing answers 409 `out_of_stock` naming Amul Butter, core cannot be reached, and "Remove Amul Butter" is chosen
- **THEN** the Amul Butter line shows an alert "Could not reach ShopperStop. Try again." and still shows "Out of stock" and "Remove Amul Butter"

### Requirement: Customer checkout refusals
A refusal other than `out_of_stock` and `internal` SHALL keep `/checkout` and the cart, with an alert: 409 `not_serviceable` with field `addressId`, "<store> does not deliver to this address. Choose another address or add one." and a `warning` `Badge` "Not delivered here" on that address; without a field, "<store> is closed right now."; 400 with field `subtotal`, "Your cart is below the store's minimum order."; else "Could not place your order. Try again.".

#### Scenario: Address not served
- **WHEN** the cart is at Koramangala, "Work" is chosen and placing answers 409 `not_serviceable` with field `addressId`
- **THEN** an alert reads "Koramangala does not deliver to this address. Choose another address or add one.", the "Work" address shows "Not delivered here", and the cart lines are still shown

#### Scenario: Store closed at placement
- **WHEN** placing answers 409 `not_serviceable` without a field
- **THEN** an alert reads "Koramangala is closed right now." and no address shows "Not delivered here"

#### Scenario: Placement fails
- **WHEN** placing answers 400 with field `subtotal`; and separately 400 `validation` with field `addressId` "unknown address"
- **THEN** the alert reads "Your cart is below the store's minimum order." the first time and "Could not place your order. Try again." the second, and each time "Place order (COD)" is no longer busy

#### Scenario: Address not served against core
- **WHEN** a customer whose only address has pincode `560038` and whose cart is at Koramangala above the minimum chooses "Place order (COD)" on `/checkout`
- **THEN** the alert names Koramangala, the address shows "Not delivered here", `GET /me/cart` still answers the line, and axe reports no violations

## ADDED Requirements

### Requirement: Customer checkout unconfirmed placement
When placing answers `internal` (core not reached, a 5xx or a failed answer without the error envelope, or a 2xx without an order), the site SHALL keep `/checkout` and the cart and show an alert "We could not confirm your order. It may have been placed, so check Your orders before you place it again." with a "Your orders" link to `/orders`, and "Place order (COD)" SHALL no longer be busy. When the cart read again after that answer is empty, the site SHALL navigate to `/orders`.

#### Scenario: Core cannot be reached at placement
- **WHEN** a customer on `/checkout` with Amul Taaza in the cart chooses "Place order (COD)" and core cannot be reached
- **THEN** an alert reads "We could not confirm your order. It may have been placed, so check Your orders before you place it again.", a "Your orders" link points to `/orders`, the Amul Taaza line is still shown, the location has not changed, and "Place order (COD)" is enabled and not busy

#### Scenario: Unconfirmed placement that emptied the cart
- **WHEN** placing answers `internal` and core then answers `GET /me/cart` with an empty cart
- **THEN** the location is `/orders`
