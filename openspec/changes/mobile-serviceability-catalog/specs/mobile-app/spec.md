## MODIFIED Requirements

### Requirement: Mobile bottom tabs
The app SHALL open on a tab layout with the tabs Home, Categories and Orders in that order, each a Lucide icon over its label, the current tab in `accent`. Home SHALL show a `brand` header holding a level-1 heading that starts with "ShopperStop" and an icon button "Account" that opens `/account`. What each tab shows below its header is set by the requirement for that screen.

#### Scenario: Home in the tabs
- **WHEN** the app renders `/` with `560034` stored and resolving to an open store with `promisedMinutes` 10
- **THEN** the tabs Home, Categories and Orders are shown in that order with Home selected, the level-1 heading "ShopperStop in 10 minutes" is shown, and an "Account" button is shown

#### Scenario: Tab switch
- **WHEN** the customer on `/` chooses the Orders tab
- **THEN** the Orders tab is selected and the Home heading is no longer shown

#### Scenario: Account button opens the account
- **WHEN** a signed-in customer on `/` chooses "Account"
- **THEN** the "My account" screen is shown

### Requirement: Mobile end-to-end suite with axe
`npm run e2e` in `apps/mobile` SHALL export the web build against `http://localhost:18080`, serve it on port 15176, start core from `services/core` with the environment it is given, and run Playwright on Chromium at 390×844, running `@axe-core/playwright` on every screen it visits and failing on any violation.

#### Scenario: Demo customer signs in
- **WHEN** a browser opens `/account`, is sent to sign in, and signs in as `demo@shopperstop.local` with `demo12345`
- **THEN** "My account" is shown, `localStorage` holds `shopperstop.customer-token`, and axe reports no violations on the sign-in screen and the account screen

#### Scenario: Register with a field error
- **WHEN** a browser registers `demo@shopperstop.local` on `/register`, sees core's "email already registered" under Email, then registers a new email
- **THEN** axe reports no violations with the field error showing, and the browser ends on `/` with a level-1 heading starting "ShopperStop"

#### Scenario: Addresses against core
- **WHEN** a newly registered customer on `/account` sees "No saved addresses. Add one to check out faster.", adds "Home" and "Work" through the sheet, and chooses "Set as default" on "Work"
- **THEN** after a reload "Work" carries the only "Default" badge, and axe reports no violations on the account screen and on the open sheet

#### Scenario: Sign out against core
- **WHEN** a signed-in customer chooses "Sign out" on `/account`
- **THEN** the browser is on `/`, `localStorage` has no `shopperstop.customer-token`, and opening `/account` shows the sign-in screen

## ADDED Requirements

### Requirement: Mobile pincode choice
The app SHALL keep the chosen pincode in memory and in the device's async storage under `shopperstop:pincode` (the browser's `localStorage`, same key, on the web export), SHALL read it once when the app loads, and SHALL ignore a stored value that is not six digits with a first digit from 1 to 9. Until the read finishes the pincode SHALL count as not yet known, and a pincode chosen meanwhile SHALL win over the value read. When storage fails, the pincode SHALL still be held in memory.

#### Scenario: Pincode persisted
- **WHEN** the pincode store is given `560034`
- **THEN** async storage holds `shopperstop:pincode` = `560034` and the store holds `560034`

#### Scenario: Pincode restored on load
- **WHEN** async storage holds `shopperstop:pincode` = `560038` before the pincode store first reads it, and in a second load holds `abc`
- **THEN** the first store holds `560038` once read, and the second holds no pincode once read

#### Scenario: Chosen pincode wins over a late read
- **WHEN** async storage holds `560038`, the pincode store is given `560034` before its first read finishes
- **THEN** the store holds `560034` after the read finishes

#### Scenario: Blocked storage tolerated
- **WHEN** every async storage call rejects and the pincode store is given `560034`
- **THEN** nothing throws and the store holds `560034`

### Requirement: Mobile pincode sheet
The app SHALL offer one sheet "Where should we deliver?" with a "Pincode" field (digits only, at most six) prefilled with the stored pincode and a "Continue" button disabled until it holds a valid pincode; six digits that are not one SHALL show "That is not a valid pincode.". "Continue" SHALL resolve the pincode, then store it and close the sheet, unless the store change confirm applies. The sheet SHALL open on Home once no pincode is known to be stored, and when a pincode control is chosen.

#### Scenario: First visit opens the pincode sheet
- **WHEN** the app renders `/` with no pincode stored
- **THEN** the dialog "Where should we deliver?" is open with an empty "Pincode" field and a disabled "Continue" button

#### Scenario: Only digits, six at most
- **WHEN** `56a00349` is typed into the Pincode field
- **THEN** the field holds `560034` and "Continue" is enabled

#### Scenario: Invalid pincode refused
- **WHEN** `012345` is typed into the Pincode field
- **THEN** "That is not a valid pincode." shows under the field, "Continue" is disabled and nothing is stored

#### Scenario: Pincode saved from the sheet
- **WHEN** `560034` is typed in the sheet opened on first visit and "Continue" is chosen while core resolves it to an open store
- **THEN** the dialog closes and async storage `shopperstop:pincode` is `560034`

#### Scenario: Header control opens the sheet
- **WHEN** `560034` is stored and resolves to an open store, the app renders `/`, and "Delivering to 560034" is chosen
- **THEN** the dialog "Where should we deliver?" opens with `560034` in the "Pincode" field

### Requirement: Mobile pincode sheet saved addresses
Signed in, the pincode sheet SHALL show one choice per saved address, named "<label> · <pincode>", that puts that pincode in the field. Signed out, it SHALL show instead a link "Have an account? Sign in to use a saved address" to `/sign-in?returnTo=%2F`.

#### Scenario: Saved address fills the pincode
- **WHEN** a signed-in customer with the saved address "Work" at `560038` opens the sheet and chooses "Work · 560038"
- **THEN** the Pincode field holds `560038`, and no "Have an account?" link is shown

#### Scenario: Sign-in link when signed out
- **WHEN** a signed-out customer's sheet is open and "Have an account? Sign in to use a saved address" is chosen
- **THEN** the sign-in screen is shown with `returnTo` `/`

### Requirement: Mobile store resolution
While a pincode is stored the app SHALL resolve it with `GET /api/core/v1/serviceability?pincode=<pincode>` when it is first known and whenever it changes. While an open store is resolved Home's header SHALL show the level-1 heading "ShopperStop in <N> minutes" with N its `promisedMinutes`, and a search field; otherwise the heading SHALL read "ShopperStop". The header SHALL hold a button "Delivering to <pincode>", or "Choose pincode" with no pincode stored, that opens the pincode sheet.

#### Scenario: Header shows the delivery promise
- **WHEN** `560034` is stored and resolves to an open store with `promisedMinutes` 10
- **THEN** Home's level-1 heading is "ShopperStop in 10 minutes", a "Delivering to 560034" button is shown, and a "Search products" button is shown

#### Scenario: Pincode resolves against core
- **WHEN** a browser on `/` continues with `560034` in the pincode sheet against core with the demo seed, then reloads
- **THEN** the heading "ShopperStop in 10 minutes" and the button "Delivering to 560034" are shown before and after the reload, the sheet is not open after the reload, and axe reports no violations on `/` with the sheet open and with it closed

### Requirement: Mobile store notices
Home, Categories, Category, Product and Search SHALL show, instead of their content, while no open store is resolved: with no pincode, "Set your pincode" and a "Choose pincode" button; until the lookup answers, a skeleton labelled "Loading"; on 404 `not_serviceable`, "We don't deliver here yet" and a "Change pincode" button; on any other failure, the error state with "Try again". Notice titles SHALL be level-2 headings and the pincode buttons SHALL open the pincode sheet.

#### Scenario: Not serviceable notice
- **WHEN** `110001` is stored, core answers 404 `not_serviceable` for it, and the app renders `/`
- **THEN** the heading "We don't deliver here yet" is shown and choosing "Change pincode" opens the pincode sheet

#### Scenario: Store lookup fails
- **WHEN** `560034` is stored, core cannot be reached, and the app renders `/`
- **THEN** the alert "You're offline" with a "Try again" button is shown, and choosing it after core answers an open store shows "Picked for you"

#### Scenario: No pincode notice
- **WHEN** no pincode is stored, the customer closes the first-visit sheet, and then chooses "Choose pincode"
- **THEN** the heading "Set your pincode" is shown, and the dialog "Where should we deliver?" opens again

#### Scenario: Notices against core
- **WHEN** a browser continues with `110001` in the pincode sheet, and then with a pincode served only by a closed store
- **THEN** the not-serviceable notice and then the closed notice are shown, and axe reports no violations on either

### Requirement: Mobile closed store notice
For a store with `isOpen` false the same screens SHALL show instead of their content the level-2 heading "<store name> store is closed", a "Change pincode" button opening the pincode sheet and a "See your orders" link to `/orders`.

#### Scenario: Closed store notice
- **WHEN** `560034` is stored and resolves to a store named "Koramangala" with `isOpen` false, and the app renders `/`
- **THEN** the heading "Koramangala store is closed", a "Change pincode" button and a "See your orders" link are shown, and no "Picked for you" section

### Requirement: Mobile product card
Every listed product SHALL be a card with one link to `/product/<slug>` named "<name> <unit>" holding a square image tile (its `imageUrl` on core's origin, else a placeholder icon), the stock badge, its name and its unit; below the link its `Price` with the MRP struck through when higher, and a `Stepper` labelled with its name whose maximum is its `quantity` (0 when out of stock). Choosing "ADD" SHALL set its count to 1.

#### Scenario: Card links and prices
- **WHEN** a card renders a product "Amul Taaza" with slug `amul-taaza`, unit `500 ml`, `priceCents` 2700, `mrpCents` 2900, `quantity` 3 and no `imageUrl`
- **THEN** a link named "Amul Taaza 500 ml" opens `/product/amul-taaza`, "Only 3 left", "₹27" and the struck-through "₹29" are shown, the image tile shows the placeholder, and an "Add Amul Taaza" button is shown

#### Scenario: Add shows the count
- **WHEN** "Add Amul Taaza" is chosen on an in-stock card
- **THEN** the group "Quantity of Amul Taaza" shows 1

#### Scenario: Out-of-stock card
- **WHEN** a card renders a product with `inStock` false and `quantity` 0
- **THEN** a disabled "Out of stock" button is shown, with no "Add" button and no stock badge

### Requirement: Mobile stock badge
Product cards and the product screen SHALL show, while the product is in stock, a stock badge reading "10+ left" when `quantity` is 10 (core's display cap) and "Only N left" below 10, and no badge when it is out of stock.

#### Scenario: Plenty in stock
- **WHEN** the product screen shows a product with `quantity` 10 and `inStock` true
- **THEN** "10+ left" is shown

### Requirement: Mobile Stepper
A `Stepper` with a count of 0 SHALL be an outlined "ADD" button named "Add <name>" ("Add to cart" with the same name in its large size); above 0 it SHALL be a group "Quantity of <name>" holding "Remove one <name>", the count in tabular numbers, and "Add one <name>", which SHALL be disabled at the maximum. A maximum of 0 SHALL show a disabled "Out of stock" button instead. Every control SHALL offer at least a 44 by 44 point touch area.

#### Scenario: Stepper counts within the maximum
- **WHEN** a Stepper for "Toned milk" with maximum 2 is at 0, and "Add Toned milk", then "Add one Toned milk" are chosen
- **THEN** the group "Quantity of Toned milk" shows 2 and "Add one Toned milk" is disabled; choosing "Remove one Toned milk" twice shows "Add Toned milk" again

### Requirement: Mobile cart counts before the cart
Until the cart change replaces it, the count a `Stepper` shows SHALL be held in memory for the session, per product, so the same product shows the same count on every screen; the counts SHALL belong to one store, and a count set at another store SHALL first drop the counts of the previous store. The cart's clear SHALL empty the counts.

#### Scenario: Count follows the product across screens
- **WHEN** "Add Banana Robusta" is chosen on Home and the product screen of `banana-robusta` is opened
- **THEN** the product screen's group "Quantity of Banana Robusta" shows 1

#### Scenario: Counts belong to one store
- **WHEN** product A is set to 2 at store S1 and then product B to 1 at store S2
- **THEN** A shows 0, B shows 1, and the cart counts 1 product at S2

### Requirement: Mobile home
For an open store Home SHALL show, below its header, a "Shop by category" section of parent tiles from `GET /stores/{id}/categories` (square image and name, four to a row) each opening `/category/<slug>`, and a "Picked for you" row of product cards: in core's order, the first 12 in-stock products of page one of `GET /stores/{id}/products`. Each section SHALL follow the loading and error pattern on its own. The header's search field SHALL be a button "Search products" that opens `/search`.

#### Scenario: Home lists categories and picks
- **WHEN** an open store is resolved whose categories are three parents and whose first product page holds 14 products, the 2nd and 5th out of stock
- **THEN** "Shop by category" holds three tiles linking to `/category/<slug>`, and "Picked for you" lists 12 products, none out of stock, in the order core answered them

#### Scenario: Home sections fail apart
- **WHEN** an open store is resolved, its categories answer 500 and its products answer normally
- **THEN** "Shop by category" shows the alert "Something went wrong on our side" with "Try again", and "Picked for you" lists the products

#### Scenario: Search field opens search
- **WHEN** "Search products" is chosen on Home
- **THEN** the location is `/search` and the "Search products" box is shown

#### Scenario: Home against core
- **WHEN** a browser with `560034` chosen opens `/` against core with the demo seed
- **THEN** "Picked for you" lists 12 products, "Shop by category" holds a "Fruits & Vegetables" tile, and axe reports no violations

### Requirement: Mobile categories tab
The Categories tab SHALL show a white header with the level-1 heading "Categories" and, for an open store, every parent category as a tile opening `/category/<slug>`.

#### Scenario: Categories tab lists parents
- **WHEN** an open store's categories are the parents "Fruits & Vegetables" and "Dairy, Bread & Eggs" and the Categories tab is chosen
- **THEN** the heading "Categories" and a link for each parent are shown, and choosing "Dairy, Bread & Eggs" shows the location `/category/dairy-bread-eggs`

### Requirement: Mobile category screen
`/category/<slug>` SHALL find the slug among the store's categories (a parent selects itself, a child selects itself under its parent) and show a header with "Back", the parent's name as the level-1 heading and a "Search" button opening `/search`, then the paged products of the selected category from `GET /stores/{id}/products?categoryId=`. An unknown slug SHALL show "Category not found" with a "Go to Home" link.

#### Scenario: Unknown category
- **WHEN** the app renders `/category/nope` with an open store whose categories hold no `nope`
- **THEN** "Category not found" is shown with a "Go to Home" link

### Requirement: Mobile category tabs
The category screen SHALL show down its left a tab list "Subcategories" with "All" (the parent) and one tab per child, the selected one marked selected. Choosing a tab SHALL change the location to `/category/<its slug>` and keep the heading.

#### Scenario: Category tabs
- **WHEN** an open store's categories hold the parent "Dairy, Bread & Eggs" (`dairy-bread-eggs`) with children "Milk" (`milk`) and "Eggs" (`eggs`), the app renders `/category/dairy-bread-eggs`, and the "Milk" tab is chosen
- **THEN** the level-1 heading is "Dairy, Bread & Eggs" with the "All" tab selected first, and after the choice the location is `/category/milk`, the "Milk" tab is selected, the heading is unchanged and the products are read with Milk's `categoryId`

#### Scenario: Browse a category against core
- **WHEN** a browser with `560034` chosen opens the "Dairy, Bread & Eggs" tile on Home and then a child tab
- **THEN** the location is `/category/<the child's slug>`, products are listed, and axe reports no violations on both

### Requirement: Mobile paged product lists
The category and search screens SHALL load products in pages of 24; while `page × pageSize` is below `total` a "Load more" button SHALL end the list and load the next page, and reaching the end of the list SHALL also load it.

#### Scenario: Load more while pages remain
- **WHEN** the first page of the selected category's products answers `total` 30 with 24 items
- **THEN** 24 products and a "Load more" button are shown, and choosing it requests `page=2` and shows 30 products without the button; with `total` 24 no "Load more" button is shown

#### Scenario: End of the list loads the next page
- **WHEN** the first page answers `total` 30 with 24 items and the list reports that its end was reached
- **THEN** `page=2` is requested once

### Requirement: Mobile search
`/search` SHALL show a header with "Back" and a search box "Search products" that has focus when the screen opens and a "Clear search" button while it holds text. Submitting the box SHALL set the location to `/search?q=<trimmed text>`. For a `q`, the screen SHALL show the level-1 heading "<total> products for “<q>”" ("1 product" for one) and the paged products of `GET /stores/{id}/products?q=`.

#### Scenario: Search submits
- **WHEN** " milk " is typed into "Search products" and submitted
- **THEN** the location is `/search?q=milk` and the heading "2 products for “milk”" is shown when core answers `total` 2

### Requirement: Mobile search empty states
Without `q` the search screen SHALL show the level-1 heading "Search for products"; when the search answers no products, "No results for “<q>”" with "Check the spelling, or browse a category instead."; both SHALL offer a link to `/category/<slug>` for each parent category.

#### Scenario: No results suggests categories
- **WHEN** an open store's search for `zzz` answers no products and its categories hold two parents
- **THEN** "No results for “zzz”" is shown with a link to `/category/<slug>` for each of the two parents

#### Scenario: Clear search
- **WHEN** the box holds "milk" and "Clear search" is chosen
- **THEN** the box is empty and has focus

#### Scenario: Search and load more against core
- **WHEN** a browser with `560034` chosen searches "banana", then searches "a" and loads more
- **THEN** "Banana Robusta" is listed for "banana", more than 24 products are listed for "a" after loading more, and axe reports no violations on `/search`

### Requirement: Mobile product screen
`/product/<slug>` SHALL show the product from `GET /stores/{id}/products/{slug}`: the square image tile with a "Back" button over it, the name as the level-1 heading, the unit, the stock badge, and "<N>% off" when the MRP is higher (N rounded down). A bar fixed to the bottom SHALL hold the large `Price` with the MRP struck through, "Inclusive of all taxes", and the large `Stepper`. A 404 SHALL show "Product not found" with a "Go to Home" link.

#### Scenario: Product with a discount
- **WHEN** the product `amul-curd` named "Amul Curd" has `priceCents` 4800, `mrpCents` 6000, `quantity` 3 and `inStock` true
- **THEN** the level-1 heading is "Amul Curd", "₹48", the struck-through "₹60", "20% off" and "Only 3 left" are shown, and an enabled "Add Amul Curd" button reading "Add to cart" is shown

#### Scenario: Out of stock product
- **WHEN** the product has `inStock` false and `quantity` 0
- **THEN** a disabled "Out of stock" button is shown, with no "Add" button and no stock badge

#### Scenario: Unknown product
- **WHEN** core answers 404 for the slug
- **THEN** "Product not found" is shown with a "Go to Home" link

### Requirement: Mobile product details
The product screen SHALL show the breadcrumb "Home / <parent> / <child>" with the names it finds among the store's categories, "Product details" with the unit, the category, and the brand and description when present, and "More in <category>": up to 10 other products of its category, each opening its own screen.

#### Scenario: More in the category
- **WHEN** the product's category "Milk" holds three other products
- **THEN** "More in Milk" lists those three and not the product itself, and the breadcrumb reads "Home / Dairy, Bread & Eggs / Milk"

#### Scenario: Product pages against core
- **WHEN** a browser with `560034` chosen opens Banana Robusta from a search and then the screen of a product the demo store holds none of
- **THEN** the first shows "Banana Robusta" with an enabled "Add Banana Robusta" button, the second a disabled "Out of stock" button, and axe reports no violations on either

### Requirement: Mobile store change confirm
When "Continue" in the pincode sheet resolves to a store other than the one the cart counts belong to and the cart counts at least one product, the sheet SHALL close and a dialog "Switch to the <new store> store?" SHALL open, saying "Your cart has <N> item(s) from <old store>; switching will empty it.", with "Keep cart" first and "Switch store". Any other "Continue" SHALL store the pincode without asking.

#### Scenario: Same store or empty cart
- **WHEN** the cart counts a product at Koramangala with `560034` stored and `560095`, which Koramangala also serves, is continued; and separately `560038` is continued with no counts
- **THEN** no dialog opens and the pincode is stored

### Requirement: Mobile store change outcome
"Switch store" SHALL clear the cart and then store the pincode; if the clear fails the dialog SHALL stay open showing "Could not empty your cart." and the pincode SHALL not change. "Keep cart", the Android back gesture and Escape SHALL keep the pincode and the cart.

#### Scenario: Store change confirmed
- **WHEN** the cart counts 2 of a product at Koramangala with `560034` stored, `560038`, which resolves to Indiranagar, is continued, and "Switch store" is chosen
- **THEN** the dialog "Switch to the Indiranagar store?" with "Your cart has 2 items from Koramangala" opens with "Keep cart" as its first button, and after the choice the cart counts nothing and the stored pincode is `560038`

#### Scenario: Store change kept
- **WHEN** the same continue is followed by "Keep cart"
- **THEN** the stored pincode is still `560034` and the product still shows 2

#### Scenario: Store change against core
- **WHEN** a browser with `560034` chosen adds a product on Home, continues with `560038` in the sheet, keeps the cart, continues with `560038` again, and switches
- **THEN** after "Keep cart" the header still reads "Delivering to 560034" and the product's count is 1; after "Switch store" the heading reads "ShopperStop in 12 minutes" and the header "Delivering to 560038", and axe reports no violations with the dialog open

### Requirement: Mobile dialogs
A dialog SHALL open as a modal centred on a dimmed backdrop that does not close it, named by its title, which SHALL be a level-2 heading. The Android back gesture and Escape on the web export SHALL call its close action. Its footer SHALL lay its buttons in one row of equal widths, the cancel button first by convention.

#### Scenario: Dialog named and closed by the platform
- **WHEN** a dialog titled "Switch to the Indiranagar store?" is open and the platform asks the modal to close
- **THEN** its modal carries the name "Switch to the Indiranagar store?", its title is a level-2 heading, and the close action is called once

#### Scenario: Footer keeps the order
- **WHEN** a dialog footer holds "Keep cart" and then "Switch store"
- **THEN** both buttons have the same width and "Keep cart" comes first
