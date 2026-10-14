# web-app Specification

## Purpose
The customer web app (`apps/web`): its shell, where it is served, how it reaches the core service, and the gates every customer page passes.

## Requirements

### Requirement: Customer site shell
Every customer page SHALL render inside a shell made of a banner that is the `brand` band holding the "ShopperStop" wordmark in `on-brand` text as a link to `/`, a product search form, the pincode control and the account control, and a main region holding the page, on the `canvas` background; the page title SHALL be the only level-1 heading. The pincode control SHALL read "Enter pincode" while no pincode is stored. The index route `/` SHALL be the Home page, which before a pincode is chosen shows a "Set your pincode" empty state on a `surface` card.

#### Scenario: Home renders in the shell
- **WHEN** the app renders the path `/` with no pincode stored
- **THEN** the banner contains a "ShopperStop" link to `/`, a "Search products" search box and an "Enter pincode" button, the level-1 heading is "Groceries in minutes", it is the only level-1 heading, and a "Set your pincode" heading is shown

### Requirement: Customer site not found
A path no route matches SHALL render "Page not found" as the level-1 heading inside the shell, with an empty state holding a link back to Home, never a blank page or the router's default text.

#### Scenario: Unknown customer path
- **WHEN** the app renders the path `/nope`
- **THEN** the banner is present, the level-1 heading is "Page not found", and a "Go to Home" link points to `/`

### Requirement: Customer site served at the root
The built app SHALL be served at the root path `/`, with its asset URLs and router paths unprefixed, so the same build works behind `vite preview` and behind Caddy's catch-all route.

#### Scenario: Built app opens at the root
- **WHEN** a browser opens `http://localhost:15173/` on the `vite preview` server of the built app
- **THEN** the Home page renders with the `canvas` page background and the `brand` banner background

#### Scenario: Not-found link returns home
- **WHEN** a browser on `http://localhost:15173/nope` follows the "Go to Home" link
- **THEN** the URL is `http://localhost:15173/` and the Home page renders

### Requirement: Customer site reaches core through a same-origin proxy
The app SHALL call the core service only by relative `/api/...` URLs; the dev server on port 5173 SHALL proxy `/api` to `http://localhost:8080` and the preview server on port 15173 SHALL proxy `/api` to `http://localhost:18080`.

#### Scenario: Web preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15173/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

### Requirement: Customer site end-to-end suite with axe
`npm run e2e` in `apps/web` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given and `vite preview` on port 15173, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Customer smoke pages pass axe
- **WHEN** `make e2e` runs the web suite
- **THEN** the Home page and the not-found page are each visited and axe reports no violations on either

### Requirement: Customer session token
The customer site SHALL keep the session token returned by `POST /auth/sign-in` (or register) in memory and in `localStorage` under `shopperstop:customer-token`, SHALL read it from `localStorage` when the app loads, and SHALL attach it as `Authorization: Bearer <token>` to every core request while it is held. The token SHALL be removed from memory and `localStorage` on sign-out and when core answers any request with status 401. No cookie SHALL be set or read.

#### Scenario: Token persisted and cleared
- **WHEN** the session store is given the token `t-1` and later cleared
- **THEN** `localStorage` `shopperstop:customer-token` is `t-1` in between, and afterwards the key is absent and the store holds no token

#### Scenario: Token restored on load
- **WHEN** `localStorage` holds `shopperstop:customer-token` = `t-2` before the session store module loads
- **THEN** the store holds `t-2`

#### Scenario: Bearer attached
- **WHEN** the store holds `t-3` and the client's request middleware handles a request to `/api/core/v1/me`
- **THEN** the request carries the header `Authorization: Bearer t-3`

#### Scenario: Expired session dropped
- **WHEN** the store holds a token and the client's response middleware sees a 401 response
- **THEN** the store holds no token and `localStorage` has no `shopperstop:customer-token`

### Requirement: Customer sign-in and register forms
`/sign-in` SHALL show email and password, a "Sign in" button and a link to `/register`; `/register` SHALL show name, email and password, a "Create account" button and a link to `/sign-in`; both links SHALL keep `returnTo`. Before calling core the forms SHALL flag empty required fields and, on register, a password outside 8 to 72 bytes. An envelope error with a shown `field` SHALL render under that field; any other failure in an `ErrorBanner`.

#### Scenario: Required fields checked
- **WHEN** the sign-in form is submitted empty
- **THEN** "Enter your email" and "Enter your password" show under their fields and nothing is sent

#### Scenario: Short password on register
- **WHEN** the register form is submitted with a 7-character password
- **THEN** "Use 8 to 72 characters" shows under the password field and nothing is sent

#### Scenario: Field error from the envelope
- **WHEN** submitting the register form answers `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** "Email already registered" shows under the email field and the email input is `aria-invalid`

#### Scenario: Non-field error in a banner
- **WHEN** submitting the sign-in form answers `{"error":{"code":"unauthorized","message":"Wrong email or password"}}`
- **THEN** an alert shows "Wrong email or password"

### Requirement: Customer return after sign-in
On a successful sign-in or register the site SHALL store the session token and navigate to `returnTo` when it is a same-origin path (starts with one `/`, not `//`), otherwise to `/`.

#### Scenario: Unsafe returnTo ignored
- **WHEN** `returnTo` is `https://evil.example/`, `//evil.example/` or absent
- **THEN** the destination after sign-in is `/`; for `/account?tab=1` it is `/account?tab=1`

#### Scenario: Register signs in
- **WHEN** a browser registers a new email on `/register`
- **THEN** it lands on `/`, `localStorage` holds `shopperstop:customer-token`, and axe reports no violations on `/register`, including with a field error showing

#### Scenario: Demo customer signs in
- **WHEN** a browser signs in on `/sign-in` as the demo customer `demo@shopperstop.local`
- **THEN** it lands on `/`, `localStorage` holds `shopperstop:customer-token`, and axe reports no violations on `/sign-in`

#### Scenario: Wrong password against core
- **WHEN** a browser signs in on `/sign-in` with an unregistered email
- **THEN** an alert shows core's message, the URL stays on `/sign-in`, and no token is stored

#### Scenario: Sign in returns to where the customer was
- **WHEN** a signed-out browser opens `/account`, is sent to `/sign-in`, and signs in
- **THEN** it lands on `/account` with the level-1 heading "Your account"

### Requirement: Customer header account control
The banner SHALL hold, after the pincode control, a "Sign in" link to `/sign-in?returnTo=<current path and search>` when no token is held, and a link to `/account` named with the customer's name from `GET /me` when signed in ("Account" while it loads).

#### Scenario: Signed-out header
- **WHEN** the app renders `/` with no token
- **THEN** the banner holds a "Sign in" link whose `href` is `/sign-in?returnTo=%2F`

#### Scenario: Signed-in header
- **WHEN** a customer named "E2E Shopper" is signed in and opens `/`
- **THEN** the banner holds a link named "E2E Shopper" pointing to `/account`

### Requirement: Customer account page requires sign-in
`/account` SHALL, whenever no token is held (on first render or after the token is dropped), replace itself with `/sign-in?returnTo=%2Faccount`.

#### Scenario: Signed-out account redirect
- **WHEN** the app renders `/account` with no token
- **THEN** the location becomes `/sign-in?returnTo=%2Faccount` and the level-1 heading is "Sign in"

### Requirement: Customer address dialog
Adding and editing an address SHALL use one dialog titled "Add address" or "Edit address" with label, line 1, line 2 (optional) and pincode, Cancel first in the footer, a field error for an empty required field and for a pincode that is not exactly six digits, and envelope field errors under their fields as on the sign-in forms; the dialog SHALL close only on success.

#### Scenario: Address dialog checks fields
- **WHEN** the add-address dialog is saved with line 1 empty and pincode `5600`
- **THEN** "Enter the first address line" and "Enter a 6-digit pincode" show under their fields and nothing is sent

#### Scenario: Address dialog shows envelope field error
- **WHEN** saving the dialog answers `{"error":{"code":"validation","message":"Pincode is not valid","field":"pincode"}}`
- **THEN** "Pincode is not valid" shows under the pincode field and the dialog stays open

#### Scenario: Edit dialog prefilled
- **WHEN** the dialog opens for an existing address labelled "Home" with pincode `560001`
- **THEN** its title is "Edit address", the label input holds "Home" and the pincode input holds `560001`, and the first footer button is "Cancel"

### Requirement: Customer profile and sign out
`/account` SHALL show the level-1 heading "Your account", a profile card with name and phone prefilled from `GET /me` and a "Save" button that sends `PATCH /me` and then shows "Saved", and a "Sign out" button that calls `POST /auth/sign-out`, drops the token and cached data, and navigates to `/`.

#### Scenario: Profile saved
- **WHEN** a newly registered customer on `/account` enters phone `9876543210` and chooses "Save"
- **THEN** "Saved" shows and after a reload the phone input holds `9876543210`

#### Scenario: Sign out
- **WHEN** a signed-in customer chooses "Sign out" on `/account`
- **THEN** the browser is on `/`, the banner holds "Sign in", `localStorage` has no `shopperstop:customer-token`, and opening `/account` lands on `/sign-in`

### Requirement: Customer address list
The account page SHALL list `GET /me/addresses` with label, lines and pincode, a "Default" badge on the default address, per address "Edit", "Set as default" (not on the default) and "Delete", an "Add address" button, and the empty state "No addresses yet" when there are none.

#### Scenario: Addresses and default
- **WHEN** a newly registered customer on `/account` sees "No addresses yet", adds addresses "Home" and "Work" through the dialog, and chooses "Set as default" on "Home" and then on "Work"
- **THEN** both addresses are listed, "Work" carries the only "Default" badge after a reload, and axe reports no violations on `/account` and on the open dialog

#### Scenario: Address edited and deleted
- **WHEN** the customer edits "Home" to line 1 "2 New Road" and then deletes "Work"
- **THEN** only "Home" is listed, showing "2 New Road"

### Requirement: Customer pincode choice
The site SHALL keep the chosen pincode in memory and in `localStorage` under `shopperstop:pincode`, SHALL read it when the app loads, and SHALL ignore a stored value that is not six digits with a first digit from 1 to 9. When storage throws (blocked or full), the pincode SHALL still be held in memory for the page.

#### Scenario: Pincode persisted
- **WHEN** the pincode store is given `560034`
- **THEN** `localStorage` `shopperstop:pincode` is `560034` and the store holds `560034`

#### Scenario: Pincode restored on load
- **WHEN** `localStorage` holds `shopperstop:pincode` = `560038` before the pincode store module loads, and in a second load holds `abc`
- **THEN** the first store holds `560038` and the second holds no pincode

#### Scenario: Blocked storage tolerated
- **WHEN** every `localStorage` call throws and the pincode store is given `560034`
- **THEN** loading the module does not throw and the store holds `560034`

### Requirement: Customer pincode sheet
The site SHALL offer one sheet titled "Your delivery pincode" with a "Pincode" field prefilled with the stored pincode and a "Save pincode" button. It SHALL open when Home renders with no pincode stored and when the banner's pincode control or a notice's pincode button is chosen. Saving an invalid pincode SHALL show "Enter a 6-digit pincode" under the field and store nothing; saving a valid one SHALL store it and close the sheet.

#### Scenario: First visit opens the pincode sheet
- **WHEN** the app renders `/` with no pincode stored
- **THEN** the dialog "Your delivery pincode" is open with an empty "Pincode" field

#### Scenario: Invalid pincode refused
- **WHEN** `5600` is saved in the sheet
- **THEN** "Enter a 6-digit pincode" shows under the field, the dialog stays open and `localStorage` has no `shopperstop:pincode`

#### Scenario: Pincode saved from the sheet
- **WHEN** `560034` is saved in the sheet opened on first visit
- **THEN** the dialog closes and `localStorage` `shopperstop:pincode` is `560034`

#### Scenario: Banner control opens the sheet
- **WHEN** `560034` is stored, the app renders `/`, and the banner's pincode control is chosen
- **THEN** the dialog "Your delivery pincode" opens with `560034` in the "Pincode" field

### Requirement: Customer store resolution
While a pincode is stored the site SHALL resolve it to a store with `GET /api/core/v1/serviceability?pincode=<pincode>` when the app loads and whenever the pincode changes. While an open store is resolved the banner's pincode control SHALL read "Delivery in N minutes" with N the store's `promisedMinutes`, followed by the pincode; otherwise it SHALL read the stored pincode alone.

#### Scenario: Banner shows the delivery promise
- **WHEN** `560034` is stored and resolves to an open store with `promisedMinutes` 10
- **THEN** the banner's pincode control is a button named "Delivery in 10 minutes 560034"

#### Scenario: Pincode resolves against core
- **WHEN** a browser on `/` saves `560034` in the pincode sheet against core with the demo seed, then reloads
- **THEN** the banner reads "Delivery in 10 minutes" and "560034" before and after the reload, the sheet is not open after the reload, and axe reports no violations on `/` with the sheet open and with it closed

### Requirement: Customer store notices
Home, Category, Product and Search SHALL show, under their own level-1 heading and instead of their content, a full-page state while no open store is resolved: no pincode, "Set your pincode"; resolving, a skeleton grid; 404 `not_serviceable`, "We do not deliver to <pincode> yet"; `isOpen` false, "<store name> is closed right now"; any other failure, an alert "Could not check your pincode." with "Try again". The first, third and fourth carry a button opening the pincode sheet.

#### Scenario: Not serviceable notice
- **WHEN** `110001` is stored, core answers 404 `not_serviceable` for it, and the app renders `/`
- **THEN** the heading "We do not deliver to 110001 yet" is shown and choosing "Change pincode" opens the pincode sheet

#### Scenario: Closed store notice
- **WHEN** `560034` is stored and resolves to a store named "Koramangala" with `isOpen` false, and the app renders `/`
- **THEN** the heading "Koramangala is closed right now" and a "Change pincode" button are shown, and no "Picked for you" section

#### Scenario: Store lookup fails
- **WHEN** `560034` is stored, core cannot be reached, and the app renders `/`
- **THEN** an alert shows "Could not check your pincode." with a "Try again" button

#### Scenario: Notices against core
- **WHEN** a browser saves `110001` in the pincode sheet, and then saves a pincode served only by a store that is closed
- **THEN** the not-serviceable notice and then the closed notice are shown, and axe reports no violations on either

### Requirement: Customer product card
Every listed product SHALL be a card with a square image tile (its `imageUrl` scaled to fit, else a placeholder icon), its name and unit inside one link to `/p/<slug>`, its `Price` with the MRP struck through when higher, and a `Stepper` labelled with its name whose maximum is its `quantity` (so out of stock shows a disabled "Out of stock" button). Choosing "ADD" SHALL set its quantity to 1 through the cart hook.

#### Scenario: Card links and prices
- **WHEN** a card renders a product "Amul Taaza" with slug `amul-taaza`, unit `500 ml`, `priceCents` 2700, `mrpCents` 2900 and no `imageUrl`
- **THEN** a link named "Amul Taaza 500 ml" points to `/p/amul-taaza`, "₹27" and the struck-through "₹29" are shown, the image tile shows the placeholder, and an "Add Amul Taaza" button is shown

#### Scenario: Add shows the count
- **WHEN** "Add Amul Taaza" is chosen on an in-stock card
- **THEN** the group "Quantity of Amul Taaza" shows 1

### Requirement: Customer home page
For an open store Home SHALL show a navigation "Categories" linking each parent of `GET /stores/{id}/categories` to `/c/<slug>`, a "Shop by category" section of parent tiles (square image, name, same link), and "Picked for you": in core's order, the first 12 in-stock products of page one of `GET /stores/{id}/products`. A failed load SHALL show an alert with "Try again" in place of what failed: one for the category navigation and "Shop by category" together, one inside "Picked for you".

#### Scenario: Home lists categories and picks
- **WHEN** an open store is resolved whose categories are three parents and whose first product page holds 14 products, the 2nd and 5th out of stock
- **THEN** the "Categories" navigation and the "Shop by category" section each link the three parents to `/c/<slug>`, and "Picked for you" lists 12 products, none out of stock, in the order core answered them

#### Scenario: Home against core
- **WHEN** a browser with `560034` chosen opens `/` against core with the demo seed
- **THEN** "Picked for you" lists 12 products, "Shop by category" holds a "Fruits & Vegetables" tile linking to `/c/fruits-vegetables`, and axe reports no violations

### Requirement: Customer category page
`/c/<slug>` SHALL find the slug among the store's categories (a parent selects itself, a child selects itself under its parent) and show the parent's name as the level-1 heading, a group "Subcategories" of `Chip`s "All" (the parent) and one per child, the selected one pressed, each navigating to `/c/<its slug>`, and the paged products of the selected category from `GET /stores/{id}/products?categoryId=`. An unknown slug SHALL show "Category not found" with a link to Home.

#### Scenario: Category tabs
- **WHEN** an open store's categories hold the parent "Dairy, Bread & Eggs" (`dairy-bread-eggs`) with children "Milk" (`milk`) and "Eggs" (`eggs`), the app renders `/c/dairy-bread-eggs`, and "Milk" is chosen
- **THEN** the level-1 heading is "Dairy, Bread & Eggs" with "All" pressed first, and after the choice the location is `/c/milk`, "Milk" is pressed and the heading is unchanged

#### Scenario: Unknown category
- **WHEN** the app renders `/c/nope` with an open store whose categories hold no `nope`
- **THEN** "Category not found" is shown with a link to `/`

#### Scenario: Browse a category against core
- **WHEN** a browser with `560034` chosen opens the "Dairy, Bread & Eggs" tile on Home and then the "Milk" chip
- **THEN** the location is `/c/milk`, products are listed, and axe reports no violations on both pages

### Requirement: Customer paged product lists
The category and search pages SHALL load products in pages of 24 with `useInfiniteQuery`; while `page × pageSize` is below `total`, a "Load more" button SHALL load the next page, and the next page SHALL also load when the end of the grid scrolls into view.

#### Scenario: Load more while pages remain
- **WHEN** the first page of the selected category's products answers `total` 30 with 24 items
- **THEN** 24 products and a "Load more" button are shown; with `total` 24 no "Load more" button is shown

### Requirement: Customer search
The banner's search form SHALL navigate to `/search?q=<trimmed text>` (to `/search` when empty). `/search` SHALL show "Results for “<q>”" as the level-1 heading (or "Search" without `q`) and the paged products of `GET /stores/{id}/products?q=`. Without `q`, or when the search answers no products, the page SHALL show an empty state ("Search for products", or "No results for “<q>”") suggesting a link to each parent category.

#### Scenario: Search from the banner
- **WHEN** "milk" is typed in the banner's "Search products" box and submitted
- **THEN** the location is `/search?q=milk`

#### Scenario: No results suggests categories
- **WHEN** an open store's search for `zzz` answers no products and its categories hold two parents
- **THEN** "No results for “zzz”" is shown with a link to `/c/<slug>` for each of the two parents

#### Scenario: Search and load more against core
- **WHEN** a browser with `560034` chosen searches "banana", then searches "a" and loads more
- **THEN** "Banana Robusta" is listed for "banana", more than 24 products are listed for "a" after loading more, and axe reports no violations on `/search`

### Requirement: Customer product page
`/p/<slug>` SHALL show the product from `GET /stores/{id}/products/{slug}`: the square image tile, the name as the level-1 heading, the unit, `Price` with the MRP struck through and "Save ₹<MRP minus price>" when the MRP is higher, a stock note while in stock ("10+ left" when `quantity` is 10, "Only N left" below 10), the description, and the `Stepper` of the product card. A 404 SHALL show "Product not found" with a link to Home.

#### Scenario: Product with savings
- **WHEN** the product `amul-curd` has `priceCents` 4800, `mrpCents` 6000, `quantity` 3 and `inStock` true
- **THEN** the level-1 heading is its name, "₹48", the struck-through "₹60", "Save ₹12" and "Only 3 left" are shown, and its "Add <name>" button is enabled

#### Scenario: Plenty in stock
- **WHEN** the product has `quantity` 10 and `inStock` true
- **THEN** "10+ left" is shown

#### Scenario: Out of stock product
- **WHEN** the product has `inStock` false and `quantity` 0
- **THEN** a disabled "Out of stock" button is shown, with no "Add" button and no stock note

#### Scenario: Unknown product
- **WHEN** core answers 404 for the slug
- **THEN** "Product not found" is shown with a link to `/`

#### Scenario: Product pages against core
- **WHEN** a browser with `560034` chosen opens `/p/banana-robusta` and the page of a product the demo store holds none of
- **THEN** the first shows "Banana Robusta" with an enabled "Add Banana Robusta" button, the second a disabled "Out of stock" button, and axe reports no violations on either
