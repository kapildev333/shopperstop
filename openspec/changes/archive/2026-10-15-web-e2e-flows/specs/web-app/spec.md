## MODIFIED Requirements

### Requirement: Customer site end-to-end suite with axe
`npm run e2e` in `apps/web` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given, `vite preview` on port 15173, and `vite preview` of the built admin app on port 15174 under `/admin/`, and SHALL run `@axe-core/playwright` on every page it visits in either app, failing on any violation.

#### Scenario: Customer smoke pages pass axe
- **WHEN** `make e2e` runs the web suite
- **THEN** the Home page and the not-found page are each visited and axe reports no violations on either

#### Scenario: Admin preview served for the cross-app flows
- **WHEN** `make e2e` runs the web suite after the admin suite has stopped its own servers
- **THEN** the web suite's Playwright starts the admin preview, and `http://localhost:15174/admin/sign-in` opens the admin sign-in page

## ADDED Requirements

### Requirement: Customer cross-app end-to-end flows
The web suite SHALL hold the two Spec 2 §13 flows, each one Playwright test driving the customer site on port 15173 and the admin app on port 15174 against the same core, with axe run on every page visited and no violation allowed. The order flow SHALL be done through the pages only, as a new customer and as the seeded Koramangala store staff; the catalog flow SHALL be done through the pages only, as the seeded admin and a guest customer, with a product name unique to the run.

#### Scenario: Customer order taken to delivered by store staff
- **WHEN** a new customer registers on the customer site, chooses pincode 560034, opens a category from Home, adds two products from search, raises the first product's quantity in the cart drawer, signs out and signs back in, sees the same two lines and quantities in the cart drawer, goes to checkout, adds a new address there and presses "Place order (COD)"
- **AND** the Koramangala store staff sign in on the admin app, find the order's card in the Placed column of `/admin/orders`, and move it one step at a time to Out for delivery and then, confirmed in the dialog, to Delivered
- **THEN** the customer's tracking page, left open and not reloaded, shows "Your order was delivered." within 15 seconds and its status history ends with Delivered

#### Scenario: Admin product found by customer search
- **WHEN** the seeded admin signs in on the admin app, creates a product with a name unique to the run, and sets its stock at Koramangala to 5 on `/admin/stock`
- **AND** a guest customer with pincode 560034 searches the customer site for that name
- **THEN** the search results show the product's card with its "Add" button, so the product is in stock at the customer's store
