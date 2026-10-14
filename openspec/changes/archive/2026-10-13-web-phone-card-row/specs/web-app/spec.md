## ADDED Requirements

### Requirement: Customer product card layout
A product card SHALL show its `Price` on one line and its `Stepper` on the next, at every width, so that the price, the struck MRP and every button lie inside the card's content area (inside its padding) in each state: "ADD", the quantity group, and "Out of stock".

#### Scenario: Card controls stay inside the card on a phone
- **WHEN** a 390 px wide browser with `560034` chosen searches, against core with the demo seed, for an in-stock product whose MRP is above its price, and then chooses its "Add" button
- **THEN** before the choice the price, the struck MRP and the "Add" button, and after it the quantity group and its two buttons, lie inside the card's content area, and axe reports no violations

#### Scenario: Out-of-stock card on a phone
- **WHEN** a 390 px wide browser with `560034` chosen searches for a product that is out of stock at the store
- **THEN** the price and the disabled "Out of stock" button lie inside the card's content area

#### Scenario: Card controls stay inside the card in the six-column grid
- **WHEN** a 1024 px wide browser with `560034` chosen searches for an in-stock product whose MRP is above its price
- **THEN** the price, the struck MRP and the "Add" button lie inside the card's content area

### Requirement: Customer banner tap targets
The banner's "ShopperStop" link SHALL have a hit area at least 44 px tall that overlaps no other control of the banner.

#### Scenario: Wordmark tap target on a phone
- **WHEN** a 390 px wide browser opens `/`
- **THEN** the "ShopperStop" link's box is at least 44 px tall and intersects the box of no other link, button or search box in the banner
