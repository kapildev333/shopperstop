# cart Specification

## Purpose
The signed-in customer's one open cart at one store, its live totals, and the set-a-line semantics the web app's cart drawer and sign-in merge rely on.

## Requirements

### Requirement: The cart is read with live totals
`GET /api/core/v1/me/cart` SHALL answer the customer's cart as `{storeId, items: [{product, quantity}], subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents}` computed at request time from the products' current prices, with `subtotalCents` the sum of price times quantity and each `product` carrying its stock at the cart's store as the catalog does. A customer without a cart SHALL get an empty cart: no `storeId`, `items` empty and every amount 0.

#### Scenario: No cart yet
- **WHEN** a customer who never added anything requests the cart
- **THEN** the response is 200 with no `storeId`, `items` `[]` and `subtotalCents`, `deliveryFeeCents`, `totalCents`, `minOrderCents`, `shortfallCents` all 0

#### Scenario: Price changed after adding
- **WHEN** a product in the cart is repriced from 4500 to 5000
- **THEN** the next cart read uses 5000 in `subtotalCents`

#### Scenario: Product deactivated after adding
- **WHEN** a product in the cart is deactivated
- **THEN** the cart still lists its line, with `product.inStock` false and `product.quantity` 0

### Requirement: Cart totals follow the store's fees
For a cart with lines, `deliveryFeeCents` SHALL be the store's delivery fee, or 0 when the subtotal is at or above the store's free-delivery threshold; `totalCents` SHALL be subtotal plus fee; `minOrderCents` SHALL be the store's minimum order; `shortfallCents` SHALL be what is missing to free delivery, never below 0.

#### Scenario: Below the free-delivery threshold
- **WHEN** the store's fee is 2500, free delivery starts at 19900, the minimum order is 9900, and the cart holds 2 of a product priced 4500
- **THEN** the cart has `subtotalCents` 9000, `deliveryFeeCents` 2500, `totalCents` 11500, `minOrderCents` 9900 and `shortfallCents` 10900

#### Scenario: At the threshold
- **WHEN** the same store's cart has a subtotal of exactly 19900
- **THEN** `deliveryFeeCents` is 0, `totalCents` is 19900 and `shortfallCents` is 0

### Requirement: Customers set one cart line at a time
`PUT /api/core/v1/me/cart/items` SHALL accept `{storeId, productId, quantity}`, set that product's line to exactly `quantity` (creating the cart and the line when absent), remove the line when `quantity` is 0, delete the cart when its last line is removed, and answer 200 with the cart as `GET /me/cart` returns it plus `replaced` and `clamped` booleans.

#### Scenario: Add then change
- **WHEN** a customer sets product P to 2 and then to 5
- **THEN** both responses are 200 with `replaced` and `clamped` false, and the cart holds one line of P with `quantity` 5

#### Scenario: Zero removes the last line
- **WHEN** a customer whose cart holds only P sets P to 0
- **THEN** the response is 200 with `items` `[]` and no `storeId`, and `GET /me/cart` answers the empty cart

### Requirement: Cart line input is validated
`quantity` SHALL be from 0 to 20, `storeId` SHALL name an existing store, and `productId` SHALL name an active product when `quantity` is above 0; anything else SHALL be 400 `validation` naming that field, with the cart unchanged.

#### Scenario: More than twenty
- **WHEN** a customer sets a line to 21
- **THEN** the response is 400 with code `validation` and field `quantity`

#### Scenario: Inactive or unknown product
- **WHEN** a customer sets an inactive product, or an id with no product, to 1
- **THEN** the response is 400 with code `validation` and field `productId`

#### Scenario: Unknown store
- **WHEN** a customer sends a `storeId` with no store
- **THEN** the response is 400 with code `validation` and field `storeId`

### Requirement: Cart lines are clamped to stock
When the requested quantity is above the product's stock at the store, the line SHALL be set to the stock instead and the response SHALL say `clamped: true`; with no stock the line SHALL be absent.

#### Scenario: Above stock
- **WHEN** a customer sets P to 5 and the store holds 3 of P
- **THEN** the response is 200 with `clamped` true and the line of P has `quantity` 3

#### Scenario: Out of stock
- **WHEN** a customer sets P to 1 and the store holds none of P
- **THEN** the response is 200 with `clamped` true and no line of P

### Requirement: A different store replaces the cart
A customer SHALL have at most one cart, at one store. Setting a line with a quantity above 0 for a store other than the cart's SHALL empty the cart, move it to that store and set the line, answering `replaced: true`; when that store holds none of the product, the cart SHALL instead stay as it is, answering `clamped: true` and `replaced: false`. Setting a quantity of 0 for another store SHALL leave the cart as it is.

#### Scenario: Switching store
- **WHEN** a customer's cart at store A holds P and Q, and the customer sets R to 1 at store B
- **THEN** the response is 200 with `replaced` true, `storeId` B and R as the only line

#### Scenario: Zero for another store
- **WHEN** a customer's cart at store A holds P, and the customer sets R to 0 at store B
- **THEN** the response is 200 with `replaced` false and the cart is still at store A holding P

#### Scenario: Out of stock at the other store
- **WHEN** a customer's cart at store A holds 2 of P and 1 of Q, and the customer sets R to 1 at store B, which holds none of R
- **THEN** the response is 200 with `clamped` true, `replaced` false, `storeId` A and the lines of P with `quantity` 2 and Q with `quantity` 1, and `GET /me/cart` answers the same cart

#### Scenario: Short of stock at the other store
- **WHEN** a customer's cart at store A holds P, and the customer sets R to 5 at store B, which holds 3 of R
- **THEN** the response is 200 with `replaced` true, `clamped` true, `storeId` B and R as the only line, with `quantity` 3

### Requirement: Customers clear their cart
`DELETE /api/core/v1/me/cart` SHALL delete the customer's cart and its lines and answer 204, also when there is no cart.

#### Scenario: Clear
- **WHEN** a customer with two lines clears the cart
- **THEN** the response is 204 and `GET /me/cart` answers the empty cart

### Requirement: The cart belongs to the signed-in customer
Every cart route SHALL require a customer session: without a token, or with a staff token, it SHALL answer 401 `unauthorized`; a customer SHALL only ever see and change their own cart.

#### Scenario: Staff token
- **WHEN** a staff token is sent to `GET /me/cart`
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Two customers
- **WHEN** customer A sets P to 2 and customer B reads the cart
- **THEN** customer B gets the empty cart
