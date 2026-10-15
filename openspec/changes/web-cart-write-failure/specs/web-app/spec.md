## ADDED Requirements

### Requirement: Customer cart write failure
While a customer token is held, when a change to a cart line fails (core cannot be reached, or `PUT /me/cart/items` answers an error), the site SHALL show an `ErrorBanner` under the control the change was made from: the `Stepper` on a product card, on the product page or on a cart drawer line, or that line's Remove button. Its message SHALL be the answer's error message, or "Could not reach ShopperStop. Try again." when core was not reached.

#### Scenario: Failed write tells the customer
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "Could not reach ShopperStop. Try again." and its group "Quantity of Amul Taaza" shows 1

#### Scenario: Core's refusal is shown
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core answers `PUT /me/cart/items` with 400 `validation` "product not available", and "Add one Amul Taaza" is chosen on its card
- **THEN** the card shows an alert "product not available" and its group shows 1

### Requirement: Customer cart write failure cleared
A change skipped because a later one for the same line overtook it, or that failed while a later one for the line was waiting, SHALL show no message. A failure message SHALL go when its control is used again and when the control leaves the page.

#### Scenario: Next tap clears the failure
- **WHEN** the card shows a failed write's alert and "Add one Amul Taaza" is chosen again
- **THEN** the alert is gone at once, and shows again when that write fails too

#### Scenario: Overtaken change shows no failure
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen twice before any answer arrives
- **THEN** once the writes have settled the card shows exactly one alert

#### Scenario: Failed write in the drawer
- **WHEN** a token is held, the drawer is open on a cart holding 1 of Amul Taaza, core cannot be reached, and "Add one Amul Taaza" is chosen in the drawer
- **THEN** the drawer shows an alert "Could not reach ShopperStop. Try again." and its group shows 1; after the drawer is closed and opened again it shows no alert
