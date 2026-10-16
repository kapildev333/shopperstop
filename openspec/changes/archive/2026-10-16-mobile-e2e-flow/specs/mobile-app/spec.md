## ADDED Requirements

### Requirement: Mobile customer flow end-to-end
The mobile Playwright suite SHALL hold the Spec 2 §13 customer flow as one test in `e2e/flow.spec.ts` on the web export at 390×844 against core with the demo seed: a customer registered in the app goes from the pincode to a placed order by taps alone, the seeded Koramangala store staff move the order to `delivered` through core's HTTP API, and axe runs on every screen and open sheet with no violation allowed.

#### Scenario: Customer order to delivered against core
- **WHEN** a new customer registers in the app, chooses `560034` in the pincode sheet, opens "Dairy, Bread & Eggs" from Home, goes back, adds a first product from search, raises its quantity in the "My cart" sheet, and signs out on "My account"
- **AND** as a guest adds a second product from search, signs in through Home's "Account" button, returns to Home, opens the cart sheet and chooses "Proceed to checkout"
- **AND** at checkout sees "No addresses yet", adds the address "Home" with pincode `560034`, and chooses "Place order"
- **AND** the Koramangala store staff move the order through core's API to `accepted`, `packing`, `ready`, `out_for_delivery` and `delivered`
- **THEN** after sign-in the cart bar counts both products, and the sheet and checkout list the first product with the raised quantity and the second with 1
- **AND** the tracking screen's level-1 heading is "Order SS-" and eight more characters with "Order placed. Waiting for the store to accept it.", and, left open and not reloaded, it reads "Your order was delivered." within 15 seconds of the last move
- **AND** axe reports no violations on every screen and open sheet visited
