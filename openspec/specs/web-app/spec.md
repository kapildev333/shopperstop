# web-app Specification

## Purpose
The customer web app (`apps/web`): its shell, where it is served, how it reaches the core service, and the gates every customer page passes.

## Requirements

### Requirement: Customer site shell
Every customer page SHALL render inside a shell: a `brand` banner holding the "ShopperStop" wordmark in `on-brand` text as a link to `/`, a product search form, the pincode control and the account control, then a main region holding the page on the `canvas` background; the page title SHALL be the only level-1 heading. The pincode control SHALL read "Enter pincode" while no pincode is stored. `/` SHALL be Home, showing a "Set your pincode" empty state on a `surface` card until one is chosen.

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
The app SHALL call the core and rider services only by relative `/api/...` URLs. The dev server on port 5173 SHALL proxy `/api/rider` to `http://localhost:8081` and every other `/api` path to `http://localhost:8080`; the preview server on port 15173 SHALL proxy `/api/rider` to `http://localhost:18081` and every other `/api` path to `http://localhost:18080`.

#### Scenario: Web preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15173/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Web preview proxies to rider
- **WHEN** the rider service runs on port 18081 and a client requests `http://localhost:15173/api/rider/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

### Requirement: Customer site end-to-end suite with axe
`npm run e2e` in `apps/web` SHALL run Playwright on Chromium only, first resetting the core and rider demo seeds (only in `_e2e` databases), then starting core from `services/core` and the rider service from `services/rider` with the environment it is given, `vite preview` on port 15173, and `vite preview` of the built admin app on port 15174 under `/admin/`, and SHALL run `@axe-core/playwright` on every page it visits in either app, failing on any violation.

#### Scenario: Customer smoke pages pass axe
- **WHEN** `make e2e` runs the web suite
- **THEN** the Home page and the not-found page are each visited and axe reports no violations on either

#### Scenario: Admin preview served for the cross-app flows
- **WHEN** `make e2e` runs the web suite after the admin suite has stopped its own servers
- **THEN** the web suite's Playwright starts the admin preview, and `http://localhost:15174/admin/sign-in` opens the admin sign-in page

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

### Requirement: Customer guest cart lines
While no customer token is held, setting a line of the guest cart SHALL set it to exactly the given quantity, clamped to the product's maximum (its `quantity` while in stock, at most 20; 0 when out of stock); 0 SHALL remove the line, and a cart whose last line goes SHALL have no `storeId`. At a store other than the cart's, a quantity still above 0 after the clamp SHALL replace the cart with that one line; 0, asked for or clamped, SHALL leave it unchanged.

#### Scenario: Guest line set and removed
- **WHEN** an empty guest cart sets product P to 1 at store A, then P to 3, then product Q to 1, then P to 0
- **THEN** the cart is at store A holding only Q with quantity 1, and after Q is set to 0 the cart has no `storeId` and no lines

#### Scenario: Guest line clamped
- **WHEN** product P has `quantity` 4 and `inStock` true and is set to 6, and product R has `inStock` false and `quantity` 0 and is set to 1
- **THEN** P's line has quantity 4 and there is no line of R

#### Scenario: Another store replaces the guest cart
- **WHEN** a guest cart at store A holds P and Q, then R is set to 0 at store B, then R is set to 1 at store B
- **THEN** after the first set the cart is still at A with P and Q, and after the second it is at B holding only R

#### Scenario: Out of stock at another store keeps the guest cart
- **WHEN** a guest cart at store A holds P and Q, and R, which has `inStock` false and `quantity` 0, is set to 1 at store B
- **THEN** the cart is still at A with P and Q

### Requirement: Customer guest cart storage
The site SHALL keep the guest cart `{storeId, items: [{product, quantity}]}` in memory and in `localStorage` under `shopperstop:cart`, SHALL read it when the app loads, and SHALL treat a stored value that does not parse as that shape as an empty cart. When storage throws (blocked or full), the cart SHALL still be held in memory for the page.

#### Scenario: Guest cart persisted and restored
- **WHEN** a guest cart sets P to 2 at store A, and the cart module is loaded again; and in a third load `localStorage` `shopperstop:cart` holds `{"items":5}`
- **THEN** `localStorage` `shopperstop:cart` holds store A and P with quantity 2, the second load holds the same cart, and the third load holds the empty cart

#### Scenario: Guest cart with blocked storage
- **WHEN** every `localStorage` call throws, the cart module loads and P is set to 1 at store A
- **THEN** loading does not throw and the cart holds P with quantity 1

### Requirement: Customer cart totals
The guest cart SHALL show the same totals core computes for a server cart, from the resolved store's fees: `subtotalCents` the sum of price times quantity, `deliveryFeeCents` the store's fee or 0 when the subtotal is at or above its free-delivery threshold, `totalCents` subtotal plus fee, `minOrderCents` the store's minimum order, and `shortfallCents` what is missing to free delivery, never below 0. An empty cart SHALL have every amount 0.

#### Scenario: Guest totals follow the store's fees
- **WHEN** the store's fee is 2500, free delivery starts at 19900 and the minimum order is 9900, and the guest cart holds 2 of a product priced 4500
- **THEN** the cart shows `subtotalCents` 9000, `deliveryFeeCents` 2500, `totalCents` 11500, `minOrderCents` 9900 and `shortfallCents` 10900; with 5 of it, `deliveryFeeCents` 0, `totalCents` 22500 and `shortfallCents` 0

### Requirement: Customer cart behind every Stepper
Every product `Stepper` SHALL show the product's quantity in the cart while the cart's `storeId` is the resolved store's, and 0 while the cart is empty or at another store, and SHALL set that line at the resolved store through the cart: the guest cart while no token is held, the server cart while one is.

#### Scenario: Card adds to the guest cart
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza" is chosen on its card
- **THEN** the group "Quantity of Amul Taaza" shows 1 and `localStorage` `shopperstop:cart` holds the store's id and the product with quantity 1

#### Scenario: Card shows the server cart
- **WHEN** a token is held and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza
- **THEN** its card's group "Quantity of Amul Taaza" shows 3

#### Scenario: Card ignores a cart at another store
- **WHEN** a token is held, Koramangala is the resolved store, and the customer's cart from `GET /me/cart` holds 3 of Amul Taaza at Indiranagar
- **THEN** its card shows the "Add Amul Taaza" button and no group "Quantity of Amul Taaza"

#### Scenario: Guest taps each count
- **WHEN** no token is held, an open store is resolved, and "Add Amul Taaza", "Add one Amul Taaza" and "Add one Amul Taaza" are chosen one straight after the other
- **THEN** the group "Quantity of Amul Taaza" shows 3 and `localStorage` `shopperstop:cart` holds it with quantity 3

### Requirement: Customer cart quick taps
While a customer token is held and a change to a line is still being written, that line's `Stepper` SHALL show the last quantity asked for, so every tap counts from the one before. The site SHALL send cart changes to core one at a time in the order they were made, MAY skip a change that a later one for the same line has overtaken, and SHALL end showing core's latest answer. When a write fails, the `Stepper` SHALL return to the cart's count.

#### Scenario: Quick taps each count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, and "Add one Amul Taaza", "Add one Amul Taaza" and "Remove one Amul Taaza" are chosen before any answer arrives
- **THEN** the group "Quantity of Amul Taaza" shows 2, then 3, then 2

#### Scenario: Failed write returns to the cart's count
- **WHEN** a token is held, the cart holds 1 of Amul Taaza at the resolved store, core cannot be reached, and "Add one Amul Taaza" is chosen
- **THEN** the group shows 2 at once and 1 again once the write has failed

#### Scenario: Quick taps against core
- **WHEN** a signed-in customer with an empty cart chooses "Add" on a product card on Home and then "Add one", "Add one" and "Remove one" on it while core's first answer is held back longer than the later ones
- **THEN** the card shows 2, `GET /me/cart` answers that product with quantity 2, and after a reload the card still shows 2

#### Scenario: Quick taps in the drawer
- **WHEN** a token is held, the drawer is open on a cart holding 1 of Amul Taaza, and "Add one Amul Taaza" is chosen twice in the drawer before any answer arrives
- **THEN** the drawer's group "Quantity of Amul Taaza" shows 3

### Requirement: Customer server cart
While a customer token is held, the site SHALL read the cart from `GET /me/cart` and SHALL change a line with `PUT /me/cart/items` `{storeId, productId, quantity}`, showing the lines and `storeId` that response answers, never the ones it sent. When the response says `clamped: true`, the drawer SHALL show "Some quantities were lowered to what the store has." until the cart is next changed or read from core again, also when the cart is then empty.

#### Scenario: Server cart clamps above stock
- **WHEN** a signed-in customer has 2 of a product in the cart, the store's stock of it drops to 1, and "Add one" is chosen on its page; then the stock drops to 0, the page is reloaded, and "Remove <name>" is chosen in the cart drawer
- **THEN** its quantity shows 1 and the open cart drawer shows "Some quantities were lowered to what the store has."; after the removal the drawer shows "Your cart is empty"

#### Scenario: Line clamped away
- **WHEN** a token is held and the last `PUT /me/cart/items` answered an empty cart with `clamped: true`, and the drawer opens
- **THEN** it shows "Some quantities were lowered to what the store has." and "Your cart is empty"

### Requirement: Customer cart merge at sign-in
When sign-in or register succeeds and the guest cart has lines, the site SHALL send `PUT /me/cart/items` for each guest line in the guest cart's order, with the guest cart's `storeId` and the line's quantity, and then SHALL empty the guest cart, also when a line's request fails, and show core's cart as answered. Lines the server already holds at that store and the guest cart does not name SHALL stay. A merge still waiting when the session changes SHALL send nothing and keep the guest cart.

#### Scenario: Merge bodies in guest order
- **WHEN** the guest cart at store A holds P with 2 and then Q with 1
- **THEN** the merge sends `{storeId: A, productId: P, quantity: 2}` and then `{storeId: A, productId: Q, quantity: 1}`

#### Scenario: Guest cart discarded after merge
- **WHEN** the guest cart holds a line and the merge runs while core cannot be reached
- **THEN** afterwards `localStorage` has no `shopperstop:cart` and the guest cart is empty

#### Scenario: Merge dropped when the session changed
- **WHEN** the guest cart holds a line, the merge waits behind another cart write, and the customer token has changed before its turn
- **THEN** the guest cart still holds its line

#### Scenario: Guest cart merges against core
- **WHEN** a guest with `560034` chosen adds two products on Home, sets the first to 2, and signs in on `/sign-in` as a customer with an empty cart
- **THEN** on Home the first product shows 2 and the second 1, `localStorage` has no `shopperstop:cart`, and after a reload both quantities are unchanged

### Requirement: Customer cart drawer
The cart SHALL open in a `Sheet` titled "Your cart" listing each line with its image tile, name, unit, `Price` and a `Stepper` labelled with its name (an out-of-stock line adds a "Remove <name>" button), then "Subtotal", "Delivery fee" (or "Free" at 0) and "Total", "Add ₹<shortfall> more for free delivery" while `shortfallCents` is above 0, and a "Proceed to checkout" link to `/checkout`, or to `/sign-in?returnTo=%2Fcheckout` with no token.

#### Scenario: Drawer lines and totals
- **WHEN** the drawer opens on a cart holding 2 of "Amul Taaza" (`500 ml`, 2700) and 1 of "Amul Butter" (`100 g`, 5600) with fee 2500, free delivery from 19900 and minimum 9900
- **THEN** both lines show their name, unit and price with a quantity group, "Subtotal" ₹110, "Delivery fee" ₹25, "Total" ₹135, "Add ₹89 more for free delivery", and a "Proceed to checkout" link

#### Scenario: Free delivery
- **WHEN** the cart's `deliveryFeeCents` and `shortfallCents` are 0 and its subtotal is above the minimum
- **THEN** "Delivery fee" reads "Free" and no "more for free delivery" text is shown

#### Scenario: Checkout link signed in and out
- **WHEN** the drawer opens on a cart above the minimum with no token held, and again with a token held
- **THEN** "Proceed to checkout" points to `/sign-in?returnTo=%2Fcheckout` the first time and to `/checkout` the second

#### Scenario: Out-of-stock line
- **WHEN** the server cart holds a line of "Amul Butter" whose product has `inStock` false and `quantity` 0
- **THEN** the line shows a disabled "Out of stock" button and a "Remove Amul Butter" button

### Requirement: Customer cart drawer states
The drawer SHALL show "Your cart is empty" for an empty cart, a skeleton list while the server cart loads, and an alert "Could not load your cart." with "Try again" when it fails to load.

#### Scenario: Empty, loading and failed cart
- **WHEN** the drawer opens on an empty guest cart; then signed in before `GET /me/cart` answers; then signed in with core unreachable
- **THEN** "Your cart is empty" is shown; then a "Loading" status; then an alert "Could not load your cart." with a "Try again" button

### Requirement: Customer cart minimum order
While the cart's subtotal is below `minOrderCents`, the drawer SHALL show "Minimum order is ₹<min>. Add ₹<missing> more to check out." and a disabled "Proceed to checkout" button in place of the link.

#### Scenario: Below the minimum order
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900
- **THEN** "Minimum order is ₹99. Add ₹45 more to check out." is shown and "Proceed to checkout" is a disabled button, not a link

### Requirement: Customer cart bar and header button
While the cart has lines, every page except `/checkout` SHALL show on phone a bar fixed to the bottom with `shadow-sheet` holding the item count ("1 item", "N items", the sum of quantities), the total as `Price` and a "View cart" button opening the drawer; the bar SHALL be absent while the cart is empty, and on `/checkout`. The banner SHALL hold on desktop a cart button opening the drawer, named "Cart" while the cart is empty and "<count> <total>" otherwise.

#### Scenario: Bar and header follow the cart
- **WHEN** the app renders `/` with an empty cart, and then with a cart of 2 of a product priced 2700 (fee 2500)
- **THEN** first no "View cart" button is shown and the banner's cart button is named "Cart"; then the bar shows "2 items" and ₹79, the banner's cart button is named "2 items ₹79", and choosing "View cart" opens the dialog "Your cart"

#### Scenario: Cart drawer against core
- **WHEN** a guest on a 390 px wide screen with `560034` chosen adds two products on Home, chooses "View cart", and adds one more of the first in the drawer
- **THEN** the drawer lists two lines, the bar reads "3 items", "Proceed to checkout" points to `/sign-in?returnTo=%2Fcheckout`, and axe reports no violations on `/` with the bar shown and with the drawer open

#### Scenario: No bar on checkout
- **WHEN** a token is held, the cart has lines, and the app renders `/checkout`
- **THEN** no "Cart summary" bar and no "View cart" button are shown, and the banner's cart button is still there

### Requirement: Customer store change confirm
Saving a pincode in the pincode sheet SHALL first resolve it; when it resolves to a store other than the cart's and the cart has lines, the sheet SHALL close and a `Dialog` "Change store?" naming the new store SHALL open with "Cancel" first and "Empty cart and change". Any other save SHALL store the pincode without asking.

#### Scenario: Same store or empty cart
- **WHEN** the cart is at Koramangala with `560034` stored and `560095`, which Koramangala also serves, is saved; and separately `560038` is saved with an empty cart
- **THEN** no dialog opens and the pincode is stored

#### Scenario: Store change against core
- **WHEN** a signed-in customer with `560034` chosen adds a product, saves `560038` in the pincode sheet, cancels, saves `560038` again, and confirms
- **THEN** after the cancel the banner still reads `560034` and the cart button "1 item"; after the confirm the banner reads "Delivery in 12 minutes 560038", the cart button reads "Cart", `GET /me/cart` answers the empty cart, and axe reports no violations with the dialog open

### Requirement: Customer store change outcome
Confirming the store change SHALL empty the guest cart, or send `DELETE /me/cart` while a token is held, and then store the pincode; if the `DELETE` fails the dialog SHALL stay open showing "Could not empty your cart." and the pincode SHALL not change. Cancel SHALL keep the pincode and the cart.

#### Scenario: Store change confirmed
- **WHEN** the guest cart at Koramangala holds a line and `560038`, which resolves to Indiranagar, is saved in the sheet, and "Empty cart and change" is chosen
- **THEN** the dialog "Change store?" names Indiranagar with "Cancel" as its first button, and after the choice the guest cart is empty and the stored pincode is `560038`

#### Scenario: Store change cancelled
- **WHEN** the same save is followed by "Cancel"
- **THEN** the stored pincode is still `560034` and the cart still holds its line

#### Scenario: Emptying the server cart fails
- **WHEN** a signed-in customer's cart at Koramangala holds a line, `560038` is saved, and "Empty cart and change" is chosen while core cannot be reached
- **THEN** the dialog stays open with an alert "Could not empty your cart." and the stored pincode is still `560034`

### Requirement: Customer cart replaced notice
When a `PUT /me/cart/items` answer says `replaced: true`, from a Stepper or the sign-in merge, the site SHALL open the cart drawer once, at every width, and the drawer and the cart bar SHALL show, until the cart is next changed or read from core again, a `StatusMessage` (role `status`) reading "Your cart from <store> was replaced. A cart holds products from one store.", where <store> is the name `GET /stores/{id}` gives for the store the cart was at, or "another store" while that is not known.

#### Scenario: Replaced notice names the old store
- **WHEN** a token is held, Indiranagar is resolved, the last `PUT /me/cart/items` answered a cart of one line at Indiranagar with `replaced: true`, the cart was at Koramangala before, and `/` renders
- **THEN** the cart drawer has opened, and it and the cart bar each show a status "Your cart from Koramangala was replaced. A cart holds products from one store."

#### Scenario: Replace opens the drawer once
- **WHEN** a token is held, `/` is shown with the drawer closed, and an answer with `replaced: true` arrives; then the customer closes the drawer; then an answer with `replaced: false` arrives
- **THEN** the dialog "Your cart" opens on the first answer, stays closed after it is closed, and does not open on the second answer

#### Scenario: Replaced notice without the old store
- **WHEN** the same answer is shown while the store the cart was at is not known; and separately an answer with `replaced: false` is shown
- **THEN** the bar and the drawer show "Your cart from another store was replaced. A cart holds products from one store." the first time, and no "was replaced" text the second

#### Scenario: Replaced notice against core
- **WHEN** a signed-in customer whose cart holds a product at Koramangala opens `/` on a 390 px wide screen with `560038` chosen, and chooses "Add" on a product card
- **THEN** the drawer opens showing "Your cart from Koramangala was replaced. A cart holds products from one store.", `GET /me/cart` answers one line at Indiranagar, after "Close" the bar reads "1 item" and shows the same notice, and axe reports no violations with the drawer open and with it closed

#### Scenario: Merge replaces another store's cart
- **WHEN** a customer whose cart holds a product at Koramangala adds a product as a guest with `560038` chosen and signs in on `/sign-in`
- **THEN** on Home the cart drawer is open, holds only the guest's product and shows "Your cart from Koramangala was replaced. A cart holds products from one store."

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

### Requirement: Customer failed answers without the error envelope
The customer site's client SHALL treat every answer from core with a status outside 200 to 299 as a failure. When the body of such an answer is not core's error envelope (`error.code` and `error.message`, both strings), the response middleware SHALL hand it on with the same status and the body `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`. A failed answer with the envelope, and every answer with a status in 200 to 299, SHALL be handed on unchanged.

#### Scenario: Empty failed answer becomes internal
- **WHEN** the client's response middleware sees a 502 response with an empty body
- **THEN** it hands on a response with status 502 whose JSON body is `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`

#### Scenario: HTML failed answer becomes internal
- **WHEN** the response middleware sees a 502 response with the body `<html><body>Bad Gateway</body></html>`
- **THEN** it hands on a response with status 502 whose JSON body is the `internal` envelope

#### Scenario: Other JSON failed answer becomes internal
- **WHEN** the response middleware sees a 500 response with the body `{"message":"x"}`
- **THEN** it hands on a response with status 500 whose JSON body is the `internal` envelope

#### Scenario: Enveloped failure passes through
- **WHEN** the response middleware sees a 409 response with the body `{"error":{"code":"conflict","message":"Email already registered","field":"email"}}`
- **THEN** it hands on that same response, and its body can still be read and equals what core sent

#### Scenario: Bare 401 drops the session and becomes internal
- **WHEN** the store holds a token and the response middleware sees a 401 response with no body
- **THEN** the store holds no token, and the response handed on has status 401 and the `internal` envelope

#### Scenario: No content answer untouched
- **WHEN** the response middleware sees a 204 response
- **THEN** it hands on that same response, with status 204 and an empty body

#### Scenario: Ok JSON answer untouched
- **WHEN** the response middleware sees a 200 response with the body `{"items":[]}`
- **THEN** it hands on that same response, and its body can still be read and equals `{"items":[]}`

#### Scenario: Failed write reports an error
- **WHEN** an `openapi-fetch` client that uses the site's middleware sends `PATCH /me`, the network answers 502 with an empty body, and the request runs through `call()`
- **THEN** `call()` resolves to `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }`, not to `undefined`

### Requirement: Customer checkout and order pages require sign-in
`/checkout`, `/orders` and `/orders/<id>` SHALL, whenever no token is held (on first render or after the token is dropped), replace themselves with `/sign-in?returnTo=<their own path>`.

#### Scenario: Signed-out checkout redirect
- **WHEN** the app renders `/checkout` with no token
- **THEN** the location becomes `/sign-in?returnTo=%2Fcheckout` and the level-1 heading is "Sign in"

#### Scenario: Signed-out order pages redirect
- **WHEN** the app renders `/orders`, and separately `/orders/00000000-0000-4000-8000-000000000703`, with no token
- **THEN** the locations become `/sign-in?returnTo=%2Forders` and `/sign-in?returnTo=%2Forders%2F00000000-0000-4000-8000-000000000703`

### Requirement: Customer checkout page
`/checkout` SHALL show the level-1 heading "Checkout", a "Delivery address" card and an "Order summary" card for the server cart: "From <store>" and "Delivery in N minutes" as `GET /stores/{id}` answers for the cart's `storeId` (never the pincode's store), each line with name, unit, "Qty <n>" and its line total as `Price`, "Subtotal", "Delivery fee" (or "Free"), "Total", "Cash on delivery", a "Place order (COD)" button and an "Edit cart" button opening the cart drawer.

#### Scenario: Checkout summary from the cart
- **WHEN** a token is held, the cart holds 2 of "Amul Taaza" (`500 ml`, 2700) and 1 of "Amul Butter" (`100 g`, 5600) at Koramangala with fee 2500 and free delivery from 19900, and the app renders `/checkout`
- **THEN** the "Order summary" card lists "Amul Taaza" with "Qty 2" and ₹54 and "Amul Butter" with "Qty 1" and ₹56, "Subtotal" ₹110, "Delivery fee" ₹25, "Total" ₹135, "Cash on delivery" and a "Place order (COD)" button, and choosing "Edit cart" opens the dialog "Your cart"

#### Scenario: Summary names the cart's store
- **WHEN** `560038` is stored and resolved to Indiranagar, the cart is at Koramangala whose `promisedMinutes` is 10, and the app renders `/checkout`
- **THEN** the summary shows "From Koramangala" and "Delivery in 10 minutes" and does not name Indiranagar

### Requirement: Customer checkout states
`/checkout` SHALL show, in place of the two cards: for an empty cart, "Your cart is empty" with a "Continue shopping" link to `/` and a "Your orders" link to `/orders`; while the cart loads, a skeleton; when the cart fails to load and none is held, an alert "Could not load your cart." with "Try again".

#### Scenario: Empty, loading and failed checkout
- **WHEN** the app renders `/checkout` with a token and an empty cart held; then before `GET /me/cart` answers; then with core unreachable and no cart held
- **THEN** "Your cart is empty" is shown with links to `/` and `/orders` and no "Place order (COD)" button; then a "Loading" status; then an alert "Could not load your cart." with a "Try again" button

### Requirement: Customer checkout address choice
The "Delivery address" card SHALL list `GET /me/addresses`, each with label, lines, pincode and a choice "Deliver to <label>" in one radio group "Deliver to", checked on the chosen address: the default at first, else the first listed. "Add address" SHALL open the address dialog; an address saved there SHALL be listed and chosen. With no address the card SHALL show "No addresses yet" and "Place order (COD)" SHALL be disabled.

#### Scenario: Default address chosen
- **WHEN** the customer's addresses are "Work" and "Home", "Home" the default, and the app renders `/checkout` with a cart above the minimum
- **THEN** the radio group "Deliver to" holds the radios "Deliver to Work" and "Deliver to Home", "Deliver to Home" is checked, "Deliver to Work" is not, and "Place order (COD)" is enabled

#### Scenario: Another address chosen
- **WHEN** "Deliver to Work" is chosen on that page
- **THEN** "Deliver to Work" is checked and "Deliver to Home" is not

#### Scenario: No address yet
- **WHEN** the customer has no address and the app renders `/checkout` with a cart above the minimum
- **THEN** "No addresses yet" and an "Add address" button are shown and "Place order (COD)" is disabled

#### Scenario: Address added at checkout
- **WHEN** a customer with no address and a cart above the minimum opens `/checkout` against core, chooses "Add address" and saves "Home" with pincode `560034`
- **THEN** the dialog closes, "Deliver to Home" is checked, "Place order (COD)" is enabled, and axe reports no violations on `/checkout` with the dialog open and with it closed

### Requirement: Customer checkout minimum order
While the cart's subtotal is below `minOrderCents`, `/checkout` SHALL show "Minimum order is ₹<min>. Add ₹<missing> more to place the order." and "Place order (COD)" SHALL be disabled.

#### Scenario: Checkout below the minimum
- **WHEN** the cart's subtotal is 5400 and `minOrderCents` 9900 and the app renders `/checkout` with a default address
- **THEN** "Minimum order is ₹99. Add ₹45 more to place the order." is shown and "Place order (COD)" is disabled

### Requirement: Customer places an order
"Place order (COD)" SHALL send `POST /orders` with the chosen `addressId`, after any cart change still being written, and be busy meanwhile. On 201 the site SHALL hold the answered order, show the cart as empty and navigate to `/orders/<id>`. A 409 `conflict` SHALL be sent once more before it counts as a failure. A 400 `validation` without a `field` (the cart was already empty: the order was placed from elsewhere) SHALL navigate to `/orders`.

#### Scenario: Order placed
- **WHEN** a customer on `/checkout` with "Home" chosen chooses "Place order (COD)" and the answer is 201 with order `SS-ABCDEFGH`
- **THEN** one request was sent with Home's id, the location is `/orders/<that order's id>`, the held cart is empty and the held order is the answered one

#### Scenario: Order number collision retried once
- **WHEN** the first answer is 409 `conflict` and the second is 201; and separately both answers are 409 `conflict`
- **THEN** the first time two requests were sent and the location is `/orders/<id>`; the second time exactly two requests were sent, the location is still `/checkout` and an alert "Could not place your order. Try again." is shown

#### Scenario: Cart already empty goes to orders
- **WHEN** the answer is 400 `validation` with message "cart is empty" and no `field`
- **THEN** the location is `/orders` and the held cart is empty

#### Scenario: Order placed against core
- **WHEN** a guest with `560034` chosen adds a product above the store's minimum, chooses "Proceed to checkout" in the cart drawer, signs in as a customer with one address, and chooses "Place order (COD)" on `/checkout`
- **THEN** the browser is on `/orders/<id>` with the level-1 heading "Order SS-" and eight more characters, the status reads "Order placed. Waiting for the store to accept it.", the product is listed, the banner's cart button reads "Cart", `GET /me/cart` answers the empty cart, and axe reports no violations on `/checkout` and on the order page

### Requirement: Customer checkout out of stock
On 409 `out_of_stock` the cart SHALL be kept and read again, an alert SHALL read "Some products are not available in the quantity you chose.", and each line named in `productIds` SHALL show, until its quantity changes, a `danger` `Badge` ("Out of stock" when its product is not in stock, "Only N left" when its stock is below the line's quantity, else "Not enough stock") and a "Remove <name>" button that sets the line to 0 through the cart.

#### Scenario: Out-of-stock lines marked
- **WHEN** the cart holds 3 of "Amul Taaza" whose product shows `quantity` 2, and 1 of "Amul Butter" whose product is not in stock, and 1 of "Amul Curd", and placing answers 409 `out_of_stock` with the ids of Amul Taaza and Amul Butter
- **THEN** the alert is shown, the Amul Taaza line shows "Only 2 left" and a "Remove Amul Taaza" button, the Amul Butter line shows "Out of stock" and a "Remove Amul Butter" button, the Amul Curd line shows neither, and the location is still `/checkout`

#### Scenario: Out of stock at checkout against core
- **WHEN** a customer's cart holds a product above the minimum, the store's stock of it is set to 0, and the customer chooses "Place order (COD)" and then "Remove <name>"
- **THEN** after placing the alert and "Out of stock" on that line are shown and no order exists for the customer; after the removal `/checkout` shows "Your cart is empty"; and axe reports no violations with the alert showing

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

### Requirement: Customer checkout refusal cleared
Choosing another address after an address was refused SHALL remove that alert; the "Not delivered here" badge SHALL stay on the refused address until "Place order (COD)" is next pressed or the addresses are read again.

#### Scenario: Choosing another address clears the alert
- **WHEN** placing with "Work" chosen answered 409 `not_serviceable` with field `addressId`, and "Deliver to Home" is then chosen
- **THEN** no alert is shown, "Work" still shows "Not delivered here" and "Home" does not

### Requirement: Customer order tracking page
`/orders/<id>` SHALL show the order `GET /orders/{id}` answers: "Order <number>" as the level-1 heading, its status message, a list "Status history" of its events oldest first (status name and time), its items (name, unit, "Qty <n>", line total as `Price`), "Subtotal", "Delivery fee" (or "Free"), "Total", "Cash on delivery", the delivery address, and an "All orders" link to `/orders`. A 404 SHALL show "Order not found" with a link to `/orders`.

#### Scenario: Tracking shows the order
- **WHEN** the customer's order `SS-DEMOAAAD` is `placed` then `accepted` in its events, holds 1 of "Banana Robusta" (`1 kg`, 7000) with subtotal 7000, fee 2500 and total 9500, to "Home", "12 80 Feet Rd, Koramangala", `560034`, and the app renders its page
- **THEN** the level-1 heading is "Order SS-DEMOAAAD", "Status history" lists "Placed" then "Accepted", each with a time, the item shows "Qty 1" and ₹70, "Total" is ₹95, "Cash on delivery" and the three address lines are shown, and an "All orders" link points to `/orders`

#### Scenario: Unknown order
- **WHEN** core answered 404 for the id and the app renders its page
- **THEN** the level-1 heading is "Order not found" and a link points to `/orders`

#### Scenario: Tracking against core
- **WHEN** the demo customer signs in and opens `/orders/00000000-0000-4000-8000-000000000701` against core with the demo seed
- **THEN** the level-1 heading is "Order SS-DEMOAAAB", the status reads "Your order was delivered.", "Status history" holds six entries ending in "Delivered", and axe reports no violations

### Requirement: Customer order status names
The site SHALL name an order's status "Placed", "Accepted", "Packing", "Ready", "Out for delivery", "Delivered" or "Cancelled", and SHALL show it in lists as a `Badge`: `accent` while the order is under way (the first five), `success` when delivered, `neutral` when cancelled.

#### Scenario: Status names and badges
- **WHEN** the name and badge variant are asked for each of core's seven statuses
- **THEN** they are "Placed", "Accepted", "Packing", "Ready" and "Out for delivery" with `accent`, "Delivered" with `success` and "Cancelled" with `neutral`

### Requirement: Customer order status message
The tracking page SHALL show the status in one `StatusMessage` (role `status`) that stays in place when the status changes, so the change is announced: "Order placed. Waiting for the store to accept it.", "The store accepted your order.", "Your order is being packed.", "Your order is packed and ready to leave the store.", "Your order is out for delivery.", "Your order was delivered." or "This order was cancelled.", the last followed by "Reason: <cancelReason>" when there is one.

#### Scenario: Status change announced
- **WHEN** the tracking page shows a `placed` order and the next read answers it `accepted`
- **THEN** the element with role `status` that read "Order placed. Waiting for the store to accept it." is the same element and reads "The store accepted your order."

#### Scenario: Cancelled order shows the reason
- **WHEN** the order is `cancelled` with `cancelReason` "Ordered by mistake"; and separately `cancelled` with none
- **THEN** the status reads "This order was cancelled. Reason: Ordered by mistake" the first time and "This order was cancelled." the second

### Requirement: Customer order tracking poll
While the order held is not `delivered` or `cancelled`, the tracking page SHALL read `GET /orders/{id}` again every 10 seconds, not while the tab is hidden, and SHALL stop once it is `delivered` or `cancelled`. A repeat that fails SHALL leave the page as it is, with no alert, and the repeats SHALL go on.

#### Scenario: Poll interval follows the status
- **WHEN** the tracking read's repeat interval is asked for an order in each status, for an unknown order and for no answer yet
- **THEN** it is 10 seconds for `placed`, `accepted`, `packing`, `ready` and `out_for_delivery`, none for `delivered`, `cancelled`, the unknown order and no answer, and the read does not repeat in the background

#### Scenario: Failed poll keeps the order
- **WHEN** a `placed` order is held, the app renders its page, and the read it repeats fails because core cannot be reached
- **THEN** the level-1 heading "Order SS-DEMOAAAD" and the status message are still shown and no alert is shown

#### Scenario: Tracking follows the order against core
- **WHEN** a customer has their own `placed` order open on its page and store staff move it step by step to `delivered`
- **THEN** without a reload the status comes to read "Your order was delivered.", "Status history" ends in "Delivered", and in the following 11 seconds the page sends no `GET /orders/{id}`

### Requirement: Customer order countdown
While the order is under way, the tracking page SHALL show "Arriving in N minutes" ("1 minute" at 1), N the whole minutes, rounded up, from now to `placedAt` plus the order's own `promisedMinutes`, kept current as time passes; once that moment has passed, "Running late. We are getting your order to you.". It SHALL show neither once the order is `delivered` or `cancelled`. The store's current `promisedMinutes` SHALL not be read for it.

#### Scenario: Countdown counts down
- **WHEN** the order was placed 3 minutes ago, it promises 10 minutes, and then 60 seconds pass; and separately it was placed 9 minutes and 30 seconds ago
- **THEN** "Arriving in 7 minutes" is shown and then "Arriving in 6 minutes"; and separately "Arriving in 1 minute"

#### Scenario: Countdown after the promise
- **WHEN** the order was placed 10 minutes ago, and separately 3 hours ago, and it promises 10 minutes
- **THEN** "Running late. We are getting your order to you." is shown both times and no "Arriving in" text

#### Scenario: Countdown uses the order's promise
- **WHEN** a `placed` order placed 3 minutes ago has `promisedMinutes` 20, its store's current read answers `promisedMinutes` 10, and the app renders its page
- **THEN** "Arriving in 17 minutes" is shown

#### Scenario: No countdown once finished
- **WHEN** the tracking page shows a `delivered` order, and separately a `cancelled` order
- **THEN** neither "Arriving in" nor "Running late" is shown

### Requirement: Customer order cancel
The tracking page SHALL show "Cancel order" only while the order is `placed` or `accepted`. It SHALL open a `Dialog` "Cancel this order?" with "Keep order" first and "Cancel order"; confirming SHALL send `POST /orders/{id}/cancel` with the body `{}` and show the answered order. A refusal SHALL keep the dialog open with an alert: on 409, "This order can no longer be cancelled.", with the order read again; otherwise "Could not cancel the order. Try again.".

#### Scenario: Cancel offered while placed or accepted
- **WHEN** the tracking page shows a `placed` order, an `accepted` order and a `packing` order
- **THEN** a "Cancel order" button is shown for the first two and not for the third

#### Scenario: Order cancelled
- **WHEN** "Cancel order" is chosen on a `placed` order, then "Cancel order" in the dialog, and the answer is the order `cancelled`
- **THEN** the dialog "Cancel this order?" opened with "Keep order" as its first button, and afterwards it is closed, the status reads "This order was cancelled." and no "Cancel order" button is shown

#### Scenario: Cancel refused
- **WHEN** confirming answers 409 `conflict`; and separately core cannot be reached
- **THEN** the dialog stays open with an alert "This order can no longer be cancelled." the first time and "Could not cancel the order. Try again." the second

#### Scenario: Cancel against core
- **WHEN** a customer opens their own `placed` order's page against core, chooses "Cancel order" and confirms
- **THEN** the status reads "This order was cancelled.", `GET /orders/{id}` answers `cancelled`, no "Cancel order" button is shown, and axe reports no violations with the dialog open and after it closes

### Requirement: Customer order history
`/orders` SHALL show the level-1 heading "Your orders" and the first page of `GET /orders`, newest first, one card per order with its number, placed date, status `Badge`, item count ("1 item", "N items", the sum of quantities), total as `Price` and a "View order <number>" link to `/orders/<id>`, and "Showing your latest N orders." when `total` is above the N listed.

#### Scenario: History lists orders
- **WHEN** `GET /orders` answered `SS-DEMOAAAD` (`placed`, 4 units, 103000) and then `SS-DEMOAAAC` (`cancelled`, 1 unit, 39900) with `total` 2, and the app renders `/orders`
- **THEN** two cards are listed in that order, the first with "Placed", "4 items", ₹1,030 and a "View order SS-DEMOAAAD" link to its page, the second with "Cancelled" and "1 item", and no "Showing your latest" text; with `total` 30 the page shows "Showing your latest 2 orders."

### Requirement: Customer order history states
`/orders` SHALL show "No orders yet" with a "Start shopping" link to `/` when the customer has no orders, a skeleton while the list loads, and an alert "Could not load your orders." with "Try again" when it fails to load and none is held.

#### Scenario: No orders yet
- **WHEN** `GET /orders` answered no orders; and separately core cannot be reached and nothing is held
- **THEN** "No orders yet" is shown with a "Start shopping" link to `/`; and separately an alert "Could not load your orders." with a "Try again" button

#### Scenario: History against core
- **WHEN** the demo customer signs in and opens `/orders` against core with the demo seed, then follows "View order SS-DEMOAAAB"
- **THEN** three cards are listed, `SS-DEMOAAAD`, `SS-DEMOAAAC` showing "Cancelled" and `SS-DEMOAAAB` showing "Delivered", the browser lands on `/orders/00000000-0000-4000-8000-000000000701`, and axe reports no violations on `/orders`

### Requirement: Customer order links
The account page's header SHALL hold a "Your orders" link to `/orders`.

#### Scenario: Account links to orders
- **WHEN** a signed-in customer's `/account` renders
- **THEN** a "Your orders" link points to `/orders`

### Requirement: Customer checkout and order page layout
At 390 px wide, `/checkout`, `/orders` and `/orders/<id>` SHALL not scroll sideways, every button, chip and button link in a card SHALL lie inside that card and be at least 44 px tall, and the order number and every amount SHALL be set in tabular numerals.

#### Scenario: Checkout and orders on a phone
- **WHEN** a 390 px wide browser opens, against core, `/checkout` with a cart and an address, then `/orders`, then a `placed` order's page
- **THEN** on each page the document is no wider than the viewport; "Deliver to <label>", "Add address", "Edit cart", "Place order (COD)", "View order <number>" and "Cancel order" each lie inside their card and are at least 44 px tall; and the order heading and the "Total" amount compute `font-variant-numeric` `tabular-nums`

### Requirement: Customer banner on a phone
On a viewport narrower than 640 px the banner's account link SHALL show its icon without visible text, and its accessible name SHALL stay the customer's name ("Account" while it loads). The pincode control's "Delivery in N minutes" line SHALL stay on one line, with the pincode on the line below starting at the same left edge. No banner control SHALL extend past the viewport. At 640 px and wider the account link SHALL show the customer's name.

#### Scenario: Signed-in banner on a phone
- **WHEN** a customer named "Walk Customer" is signed in, `560034` is stored, and `/` is shown at 390 by 844 px
- **THEN** the banner holds a link named "Walk Customer" pointing to `/account` whose box is at least 44 px tall and at most 56 px wide, the name's text box is at most 1 px wide, "Delivery in 10 minutes" is one line (its box at most 24 px tall), "560034" starts within 0.5 px of the promise's left edge, no banner link, button or search box ends past 390 px, the page does not scroll horizontally, and axe reports no violations

#### Scenario: Signed-in banner on desktop
- **WHEN** the same customer is signed in and `/` is shown at 1024 by 768 px
- **THEN** the banner's "Walk Customer" link shows the name: the name's text box is at least 20 px wide

### Requirement: Customer pincode sheet focus
When the pincode sheet opens, focus SHALL move to its Pincode field. When it closes, focus SHALL return to the control that had it before the sheet opened.

#### Scenario: First visit focuses the pincode field
- **WHEN** the app renders `/` with no pincode stored
- **THEN** the "Your delivery pincode" dialog is open and its Pincode field has focus

#### Scenario: Banner control focuses the pincode field
- **WHEN** `560034` is stored, the app renders `/`, the banner's pincode control is chosen, and then Escape is pressed
- **THEN** while the dialog is open its Pincode field has focus, and after Escape the dialog is closed and the banner's "Delivery in 10 minutes 560034" button has focus

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

### Requirement: Customer checkout unconfirmed placement
When placing answers `internal` (core not reached, a 5xx or a failed answer without the error envelope, or a 2xx without an order), the site SHALL keep `/checkout` and the cart and show an alert "We could not confirm your order. It may have been placed, so check Your orders before you place it again." with a "Your orders" link to `/orders`, and "Place order (COD)" SHALL no longer be busy. When the cart read again after that answer is empty, the site SHALL navigate to `/orders`.

#### Scenario: Core cannot be reached at placement
- **WHEN** a customer on `/checkout` with Amul Taaza in the cart chooses "Place order (COD)" and core cannot be reached
- **THEN** an alert reads "We could not confirm your order. It may have been placed, so check Your orders before you place it again.", a "Your orders" link points to `/orders`, the Amul Taaza line is still shown, the location has not changed, and "Place order (COD)" is enabled and not busy

#### Scenario: Unconfirmed placement that emptied the cart
- **WHEN** placing answers `internal` and core then answers `GET /me/cart` with an empty cart
- **THEN** the location is `/orders`

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

### Requirement: Customer order rider card
While the order is `out_for_delivery` or `delivered` and a rider name is known (`Order.riderName`, else the rider read's `riderName`), the tracking page SHALL show a "Rider" card with the name and the order's status `Badge`. When the rider read carries a `location`, the card SHALL also show "Last seen <relative time>" and an "Open in Maps" link to `https://www.google.com/maps?q=<lat>,<lng>` opening in a new tab with `rel="noopener"`.

#### Scenario: Rider on the way with a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha", the rider read answers `assigned` with location 12.9352, 77.6245 recorded 3 minutes ago, and the app renders its page
- **THEN** a region "Rider" shows "Asha", the badge "Out for delivery" and "Last seen 3 minutes ago", and a link named "Open in Maps (opens in a new tab)" points to `https://www.google.com/maps?q=12.9352,77.6245` with `target` `_blank` and `rel` `noopener`

#### Scenario: Rider without a position
- **WHEN** the order is `out_for_delivery` with `riderName` "Asha" and the rider read answers `assigned` with no location
- **THEN** the "Rider" region shows "Asha" and neither "Last seen" nor an "Open in Maps" link

#### Scenario: No rider card before a rider
- **WHEN** the order is `ready`; and separately `out_for_delivery` with no `riderName` and the rider read answering 404
- **THEN** no "Rider" region is shown either time, and for the `ready` order no request to `/api/rider/` was sent

#### Scenario: Delivered order names the rider from the rider read
- **WHEN** the order is `delivered` with no `riderName` and the rider read answers "Arjun Rao" `delivered` with no location
- **THEN** the "Rider" region shows "Arjun Rao" and the badge "Delivered", and no "Open in Maps" link

#### Scenario: Seeded delivered order against core and rider
- **WHEN** the demo customer signs in and opens `/orders/00000000-0000-4000-8000-000000000701` against core and rider with both demo seeds
- **THEN** the "Rider" region shows "Arjun Rao" and "Delivered", no "Open in Maps" link is shown, and axe reports no violations

#### Scenario: Rider picked up and located against core and rider
- **WHEN** a customer's order is moved to `ready` by staff, the seeded rider "Meera Iyer" claims it through the rider service and puts the position 12.9352, 77.6245, and the customer opens its page
- **THEN** the "Rider" region shows "Meera Iyer", "Out for delivery" and "Last seen just now", the "Open in Maps" link points to `https://www.google.com/maps?q=12.9352,77.6245`, "Status history" ends in "Picked up by Meera Iyer", and axe reports no violations

### Requirement: Customer rider last seen
"Last seen" SHALL count whole minutes, rounded down, from the location's `recordedAt` to now: "just now" under one minute (or when `recordedAt` is ahead of the browser's clock), "1 minute ago", "N minutes ago" under an hour, then "1 hour ago" or "N hours ago" in whole hours; it SHALL be kept current as time passes.

#### Scenario: Last seen wording
- **WHEN** the wording is asked for a position recorded 30 seconds, 1 minute, 59 minutes, 60 minutes and 150 minutes before now, and 2 minutes after now
- **THEN** it is "Last seen just now", "Last seen 1 minute ago", "Last seen 59 minutes ago", "Last seen 1 hour ago", "Last seen 2 hours ago" and "Last seen just now"

#### Scenario: Last seen kept current
- **WHEN** the "Rider" card shows "Last seen 3 minutes ago" and 60 seconds pass with no new read
- **THEN** it shows "Last seen 4 minutes ago"

### Requirement: Customer order rider read
The site SHALL read `GET /api/rider/v1/orders/{orderId}/delivery` by a relative URL with the customer's token and the same failed-answer handling as core reads, only while the order is `out_for_delivery` or `delivered`: once on `delivered`, every 10 seconds (not while the tab is hidden) on `out_for_delivery`. A 404 SHALL mean no rider; a failed read SHALL show no alert and keep what is shown.

#### Scenario: Rider read follows the status
- **WHEN** the rider read's options are asked for an order in each of the seven statuses
- **THEN** the read is enabled only for `out_for_delivery` (repeating every 10 seconds, not in the background) and `delivered` (not repeating)

#### Scenario: Failed rider read keeps the card
- **WHEN** the "Rider" card shows "Asha" with "Last seen 3 minutes ago" and the next rider read fails because the rider service cannot be reached
- **THEN** the card still shows "Asha" and "Last seen 3 minutes ago", and no alert is shown

### Requirement: Customer status history names the rider
In "Status history", an event made by a rider (`actorType` `rider`) with an `actorName` SHALL show, under its status name, "Picked up by <actorName>" when it moved the order to `out_for_delivery` and "Delivered by <actorName>" when it moved it to `delivered`. Other events SHALL show no actor line.

#### Scenario: Rider events name the rider
- **WHEN** the order's events are placed by the customer, accepted, packing and ready by staff, then `out_for_delivery` and `delivered` by the rider "Asha", and the app renders its page
- **THEN** the "Out for delivery" entry shows "Picked up by Asha", the "Delivered" entry shows "Delivered by Asha", and no other entry shows "by"
