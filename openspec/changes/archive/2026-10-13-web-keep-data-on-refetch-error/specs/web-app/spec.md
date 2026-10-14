## ADDED Requirements

### Requirement: Customer pages keep data when a refetch fails
Every view of the customer site that shows the answer of a read from core SHALL keep showing the last answer it holds when a later read of the same thing fails, with no alert in its place and without unmounting what is shown beneath it. An answer of "nothing" (no store delivers to the pincode, no such product, an empty list) is an answer and SHALL be kept the same way. The alert with "Try again" SHALL show only while the view holds no answer.

#### Scenario: Failed refetch keeps the store
- **WHEN** `560034` is stored and resolved to an open store more than 60 seconds ago, the store's categories and picks are held, the app renders `/`, and the store lookup it repeats fails because core cannot be reached
- **THEN** the "Picked for you" section is still shown and no alert is shown

#### Scenario: Failed refetch keeps the not serviceable notice
- **WHEN** `110001` is stored and was answered 404 `not_serviceable` more than 60 seconds ago, the app renders `/`, and the lookup it repeats fails because core cannot be reached
- **THEN** the heading "We do not deliver to 110001 yet" is still shown and no alert is shown

#### Scenario: Failed refetch keeps home
- **WHEN** an open store is resolved, its categories and its picks were read more than 60 seconds ago, the app renders `/`, and both reads it repeats fail because core cannot be reached
- **THEN** the "Categories" navigation and the "Picked for you" products are still shown and no alert is shown

#### Scenario: Failed refetch keeps the category page
- **WHEN** an open store is resolved, its categories were read more than 60 seconds ago, the products of "Dairy, Bread & Eggs" are held, the app renders `/c/dairy-bread-eggs`, and the categories read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Dairy, Bread & Eggs" and its subcategory chips are still shown and no alert is shown

#### Scenario: Failed refetch keeps the product list
- **WHEN** an open store and its categories are resolved, the first page of the products of "Dairy, Bread & Eggs" was read more than 60 seconds ago, the app renders `/c/dairy-bread-eggs`, and the products read it repeats fails because core cannot be reached
- **THEN** the product cards are still shown and no alert is shown

#### Scenario: Failed refetch keeps the product page
- **WHEN** an open store is resolved, the product "Amul Taaza" was read more than 60 seconds ago, the app renders `/p/amul-taaza`, and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Amul Taaza" is still shown and no alert is shown

#### Scenario: Failed refetch keeps product not found
- **WHEN** an open store is resolved, core answered 404 for the slug `no-such-thing` more than 60 seconds ago, the app renders `/p/no-such-thing`, and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Product not found" is still shown and no alert is shown

#### Scenario: Nothing held still alerts
- **WHEN** an open store is resolved, nothing else is held, core cannot be reached, and the app renders `/`, then `/c/dairy-bread-eggs`, then `/p/amul-taaza`
- **THEN** `/` shows the alerts "Could not load categories." and "Could not load products.", `/c/dairy-bread-eggs` shows the alert "Could not load categories.", and `/p/amul-taaza` shows the alert "Could not load this product.", each with a "Try again" button
