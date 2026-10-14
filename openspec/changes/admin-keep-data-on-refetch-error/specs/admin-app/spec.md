## ADDED Requirements

### Requirement: Admin pages keep data when a refetch fails
Every page of the panel that shows data it loaded from core SHALL keep showing it, with any text typed into its form and any unsaved edit, when a later read of the same data fails. The alert with "Try again" SHALL show only while the page holds no data for what it asks, and SHALL replace only the part that has none.

#### Scenario: Table kept
- **WHEN** an admin has `/stores`, `/products` or `/categories` open with its table shown, the page reads its list again and core answers 502 without a body
- **THEN** the table still shows its rows and no alert is shown

#### Scenario: Store page and its form kept
- **WHEN** an admin on a store's page has typed `Koramangala West` into "Name" and added the pincode `560001` without saving, and the reads of the store and of its pincodes both fail when made again
- **THEN** "Name" still holds `Koramangala West`, the pincode table still lists `560001` with "Unsaved changes.", and no alert is shown

#### Scenario: Product page and its form kept
- **WHEN** an admin on a product's page has typed `Toned Milk 500` into "Name", and the reads of the product and of the categories both fail when made again
- **THEN** "Name" still holds `Toned Milk 500`, "Category" still holds the product's category, and no alert is shown

#### Scenario: New product form kept
- **WHEN** an admin on `/products/new` has typed `Curd Cup` into "Name" and the read of the categories fails when made again
- **THEN** "Name" still holds `Curd Cup` and no alert is shown

#### Scenario: Stock and its unsaved quantity kept
- **WHEN** an admin on `/stock` has typed `40` into a product's quantity, and the reads of the stores and of the stock both fail when made again
- **THEN** the field still holds `40`, "1 unsaved change" and the "Store" selector with its store are still shown, and no alert is shown

#### Scenario: Store staff stock kept
- **WHEN** store staff have `/stock` open with their store's name and stock shown, and the reads of the stock and of the store's name both fail when made again
- **THEN** the store's name and the product's quantity field are still shown and no alert is shown

#### Scenario: Category save whose reload fails
- **WHEN** an admin saves a change to a category, core answers 200, and the read of the categories that follows fails
- **THEN** the dialog closes, the "Categories" table is still shown and no alert is shown

#### Scenario: First load failure still alerts
- **WHEN** an admin opens a store's page, a product's page or `/products/new` and core answers every read with 502, then answers after the admin presses "Try again"
- **THEN** the alert ("Could not load the store.", "Could not load the product.", "Could not load the categories.") is shown with "Try again" and no form, then the form and no alert

#### Scenario: Pincodes fail on the first load
- **WHEN** an admin opens a store's page, core answers the store and fails its pincodes
- **THEN** the alert "Could not load the pincodes." is shown with "Try again" and the store's form is shown with its values

#### Scenario: Next stock page fails on its first load
- **WHEN** an admin on `/stock` has typed `40` into a quantity on page 1 and presses "Next", and core fails page 2
- **THEN** the alert "Could not load the stock." is shown and "1 unsaved change" is still shown

### Requirement: Refetch failure notice
While a page shows data whose latest read failed, the panel SHALL show the status message "Could not refresh. Showing what was loaded last." above the page, once however many reads failed, and no alert. The message SHALL go when those reads are next answered and when the page is left, and SHALL NOT show while the failed read holds no data.

#### Scenario: Notice shown once and cleared
- **WHEN** an admin has a store's page open, the reads of the store and of its pincodes both fail when made again, and then both are answered when made once more
- **THEN** exactly one status message "Could not refresh. Showing what was loaded last." is shown after the failures, and none after the answers

#### Scenario: Notice leaves with the page
- **WHEN** the notice shows on `/stores`, core answers again and the admin opens "Categories" from the navigation
- **THEN** the "Categories" table is shown and the notice is not

#### Scenario: No notice on a first load failure
- **WHEN** an admin opens a store's page and core answers every read with 502
- **THEN** the alert "Could not load the store." is shown and the notice is not

### Requirement: Deleted or forbidden on a refetch
When a later read of a store's or a product's page is answered 404, the page SHALL show "Page not found" in place of the data it held. When a later read of any page is answered 403, the page SHALL show "Page not found" likewise. Neither SHALL show the refetch failure notice.

#### Scenario: Store deleted elsewhere
- **WHEN** an admin has a store's page open and core answers the next read of the store with 404 `not_found`
- **THEN** "Page not found" is shown, the form and the notice are not

#### Scenario: Product deleted elsewhere
- **WHEN** an admin has a product's page open and core answers the next read of the product with 404 `not_found`
- **THEN** "Page not found" is shown, the form and the notice are not

#### Scenario: Forbidden on a refetch
- **WHEN** an admin has `/stores` open with its table shown and core answers the next read of the list with 403 `forbidden`
- **THEN** "Page not found" is shown and the notice is not

### Requirement: Saved stock shown when its reload fails
After a stock save is answered 204, when the read of the page on screen that follows fails, `/stock` SHALL show the saved quantities in the rows it sent, the status "Stock saved.", "No unsaved changes" and the refetch failure notice, with no alert, and SHALL NOT send the rows again.

#### Scenario: Save, then the reload fails
- **WHEN** an admin types `40` over a product's quantity `17` and presses "Save changes", core answers the `PUT` with 204 and fails the read of the stock that follows
- **THEN** the field holds `40`, "Stock saved.", "No unsaved changes" and one notice are shown, no alert is shown, and exactly one `PUT` was sent
