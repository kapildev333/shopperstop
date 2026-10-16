# admin-app Specification

## Purpose
The admin and store-staff web app (`apps/admin`): its shell, where it is served, how it reaches the core service, and the gates every admin page passes.

## Requirements

### Requirement: Admin shell
Every admin page SHALL render inside a shell made of a banner holding the brand band with the "ShopperStop Admin" wordmark and a main region holding the page; the page title SHALL be the only level-1 heading. The index route `/` SHALL be the Dashboard page.

#### Scenario: Dashboard renders in the shell
- **WHEN** an admin with a valid session opens `/`
- **THEN** the banner contains "ShopperStop Admin", the admin's name and a "Sign out" button, the navigation landmark "Admin" holds a "Dashboard" link with `aria-current="page"`, and "Dashboard" is the only level-1 heading

### Requirement: Signed-in banner and navigation
While a staff member is signed in and a protected page is shown, the banner SHALL also show the staff member's name, a "Sign out" button, and a navigation landmark named "Admin" on a `surface` strip holding the links the staff member's role can reach (see "Role-based navigation"), the link to the current section carrying `aria-current="page"`. The sign-in page and the not-found page shown to a signed-out visitor SHALL have no navigation landmark.

#### Scenario: Current section stays marked on a sub-page
- **WHEN** an admin with a valid session opens `/stores`
- **THEN** the "Stores" link carries `aria-current="page"` and the "Dashboard" link does not

### Requirement: Unknown paths show not found
A path no route matches SHALL render "Page not found" as the level-1 heading inside the shell, never a blank page or the router's default text.

#### Scenario: Unknown path
- **WHEN** the app renders the path `/nope`
- **THEN** the banner is present and the level-1 heading is "Page not found"

### Requirement: Served under /admin/
The built app SHALL be served under the `/admin/` path prefix, with its asset URLs and router paths under that prefix, so the same build works behind `vite preview` and behind Caddy's `/admin/*` route.

#### Scenario: Built app opens under the prefix
- **WHEN** a browser with no session opens `http://localhost:15174/admin/` on the `vite preview` server of the built app
- **THEN** it lands on `/admin/sign-in?redirect=%2F` with the page's styles applied, and after signing in the "Dashboard" link points to `/admin/`

### Requirement: Core reached through a same-origin proxy
The app SHALL call the core service only through one shared client whose base URL is the page's own origin followed by `/api/core/v1`, and the rider service only through a second client whose base URL is the page's own origin followed by `/api/rider/v1`, so every call is same-origin.

#### Scenario: Client calls the page's origin
- **WHEN** the shared client sends `GET /admin/me` from a page served at origin `O`
- **THEN** the request URL is `O/api/core/v1/admin/me`

#### Scenario: Rider client calls the page's origin
- **WHEN** an admin opens `/riders` on a page served at origin `O`
- **THEN** the riders list request URL is `O/api/rider/v1/admin/riders?pageSize=100`

### Requirement: Dev and preview servers proxy the services
The dev server SHALL proxy `/api/rider` to `http://localhost:8081` and every other `/api` path to `http://localhost:8080`; the preview server SHALL proxy `/api/rider` to `http://localhost:18081` and every other `/api` path to `http://localhost:18080`.

#### Scenario: Preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15174/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Preview proxies to the rider service
- **WHEN** the rider service runs on port 18081 and a client requests `http://localhost:15174/api/rider/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

### Requirement: End-to-end suite with axe
`npm run e2e` in `apps/admin` SHALL run Playwright on Chromium only, starting core from `services/core` and the rider service from `services/rider` with the environment it is given and `vite preview` on port 15174, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the admin suite
- **THEN** the sign-in page, the Dashboard, the not-found page and the sign-in page after sign-out are each visited and axe reports no violations on any of them

### Requirement: End-to-end suite seeds its own data
Before any test, `npm run e2e` in `apps/admin` SHALL run `core-admin migrate` and `core-admin seed-demo --reset` from `services/core`, then `rider-admin migrate` and `rider-admin seed-demo --reset` from `services/rider`, with the environment it is given.

#### Scenario: Suite seeds its own data
- **WHEN** `npm run e2e --workspace apps/admin` runs against e2e databases that have never been seeded, with the `make e2e` environment exported
- **THEN** the seeded admin can sign in and the four seeded riders are listed during the suite

### Requirement: Staff sign-in
The app SHALL serve `/sign-in` without a session, with labelled "Email" and "Password" fields and a "Sign in" button. It SHALL send no request while a field is empty, keep the button disabled while `POST /admin/auth/sign-in` is pending, and on success store the token and open the `redirect` query path, or `/` without one. A `redirect` that is not an in-app path (`/` followed by neither `/` nor `\`) SHALL be ignored.

#### Scenario: Sign-in form is labelled
- **WHEN** a visitor opens `/sign-in`
- **THEN** "Sign in" is the only level-1 heading, the "Email" field has type `email`, the "Password" field has type `password`, and there is no "Admin" navigation landmark

#### Scenario: Empty fields are flagged
- **WHEN** the visitor submits the form with both fields empty
- **THEN** the "Email" field is described by "Enter your email.", the "Password" field by "Enter your password.", and no request is sent

#### Scenario: Submit disabled while pending
- **WHEN** the visitor submits valid fields and core has not answered yet
- **THEN** the "Sign in" button is disabled, and it is enabled again once core answers with an error

#### Scenario: Return to the page after sign-in
- **WHEN** the visitor signs in successfully at `/sign-in?redirect=%2Fstock`
- **THEN** the Stock page opens at `/stock`, the token is stored under `shopperstop:staff-token`, and no extra `GET /admin/me` is sent

#### Scenario: Outside redirect ignored
- **WHEN** the visitor signs in successfully at `/sign-in?redirect=%2F%2Fevil.example` or `/sign-in?redirect=%2F%5Cevil.example`
- **THEN** the Dashboard opens at `/`

### Requirement: Sign-in errors
A failed sign-in SHALL keep the user on `/sign-in` with no session and SHALL explain the failure: an alert naming the cause for `unauthorized` (wrong email or password, or an inactive account: core answers both alike), `rate_limited` and a request that got no answer; the message on the field for a `validation` error whose `field` is `email` or `password`; and the alert "Something went wrong. Try again." for any other error.

#### Scenario: Wrong credentials or inactive staff
- **WHEN** core answers the sign-in with 401 `unauthorized`
- **THEN** an alert shows "Email or password is wrong, or the account is inactive." and no token is stored

#### Scenario: Rate limited
- **WHEN** core answers the sign-in with 429 `rate_limited`
- **THEN** an alert shows "Too many sign-in attempts. Try again later." and no token is stored

#### Scenario: Core unreachable
- **WHEN** the sign-in request fails without an answer
- **THEN** an alert shows "Could not reach the server. Check your connection and try again." and no token is stored

#### Scenario: Any other error
- **WHEN** core answers the sign-in with 500 `internal`
- **THEN** an alert shows "Something went wrong. Try again." and no token is stored

#### Scenario: Field validation from core
- **WHEN** core answers 400 `validation` with `field` `email` and message "must be a valid email address"
- **THEN** the "Email" field is described by "must be a valid email address"

### Requirement: Staff session
The app SHALL keep the staff token in memory and in `localStorage` under `shopperstop:staff-token` (in memory only when storage is blocked), SHALL send it as `Authorization: Bearer <token>` on every core request while it exists, and on load with a stored token SHALL restore the staff member with `GET /admin/me` before showing a protected page.

#### Scenario: Token kept in memory and storage
- **WHEN** a session is stored with token `t1`
- **THEN** the app's token is `t1` and `localStorage` `shopperstop:staff-token` is `t1`

#### Scenario: Token survives a reload
- **WHEN** the app starts with `shopperstop:staff-token` set to `t2` in `localStorage`
- **THEN** the app's token is `t2`

#### Scenario: Blocked storage keeps the token in memory
- **WHEN** `localStorage` throws on every access and a session is stored with token `t4`
- **THEN** nothing throws and the app's token is `t4` until it is cleared

#### Scenario: Bearer token attached
- **WHEN** the app calls core with token `tok` stored
- **THEN** the request carries `Authorization: Bearer tok`

### Requirement: Lost session
When a core request that carried the current token is answered 401, the app SHALL remove the token from memory and storage and show `/sign-in?redirect=<current path>`. When `GET /admin/me` fails with anything other than 401 or 403 (see "Wrong-role deep link shows not found"), the app SHALL keep the token and show the alert "Could not reach the server." with a "Try again" button.

#### Scenario: 401 clears the session
- **WHEN** a request that carried a token is answered 401
- **THEN** the token is removed from memory and `localStorage`, and the session-lost handler runs

#### Scenario: 401 without a session changes nothing
- **WHEN** a request sent without a token is answered 401 after a session with token `fresh` was stored meanwhile
- **THEN** the token is still `fresh` and the session-lost handler does not run

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** a request sent with token `old` is answered 401 after token `new` was stored meanwhile
- **THEN** the token is still `new` in memory and `localStorage`, and the session-lost handler does not run

#### Scenario: Expired session on load
- **WHEN** the app opens `/orders` with a stored token and core answers `GET /admin/me` with 401
- **THEN** the sign-in page shows with `redirect` `/orders` and the token is gone

#### Scenario: Core unreachable on load
- **WHEN** the app opens `/` with a stored token and core answers `GET /admin/me` with 500
- **THEN** an alert shows "Could not reach the server." with a "Try again" button and the token is kept

### Requirement: Protected routes
Every route except `/sign-in` and the not-found page SHALL require a session. Without a stored token the app SHALL send no request and show `/sign-in?redirect=<path>`, where `<path>` is the requested path inside the app.

#### Scenario: Signed-out deep link
- **WHEN** a visitor with no session opens `/stock`
- **THEN** the sign-in page shows at `/sign-in` with `redirect` `/stock`, and no request reached core

#### Scenario: Unknown path signed out
- **WHEN** a visitor with no session opens `/nope`
- **THEN** "Page not found" is the level-1 heading inside the banner, with no redirect

### Requirement: Role-based navigation
The "Admin" navigation SHALL show only the sections the signed-in role can reach, in this order: for `admin`, Dashboard, Orders, Stock, Riders, Stores, Categories, Products, Staff; for `store_staff`, Dashboard, Orders, Stock, Riders.

#### Scenario: Admin sees every section
- **WHEN** an admin with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Riders, Stores, Categories, Products, Staff in that order

#### Scenario: Store staff see their sections
- **WHEN** a store staff member with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Riders in that order

### Requirement: Wrong-role deep link shows not found
When a store staff member opens an admin-only path (`/stores`, `/categories`, `/products`, `/staff` and the paths under them), the app SHALL stay on that path and show the not-found page inside the shell, never the admin page and never a redirect. A 403 `forbidden` from core on any request SHALL show the same not-found page and keep the session. The not-found page SHALL show "Page not found" as the level-1 heading and a card with a "Go to Dashboard" link.

#### Scenario: Store staff open an admin page
- **WHEN** a store staff member with a valid session opens `/stores`
- **THEN** "Page not found" is the level-1 heading, the "Admin" navigation is present, and the path is still `/stores`

#### Scenario: A 403 from core shows not found
- **WHEN** the app opens `/stock` with a stored token and core answers 403 `forbidden`
- **THEN** "Page not found" is the level-1 heading inside the banner, the path is still `/stock`, the sign-in page is not shown and the token is kept

#### Scenario: Admin opens an admin page
- **WHEN** an admin with a valid session opens `/stores`
- **THEN** "Stores" is the level-1 heading

### Requirement: Sign-out
The "Sign out" button SHALL send `POST /admin/auth/sign-out` with the token, then, whatever core answers, remove the token from memory and storage, drop every cached core answer and show `/sign-in` without navigation.

#### Scenario: Sign out ends the session
- **WHEN** a signed-in admin presses "Sign out"
- **THEN** `POST /admin/auth/sign-out` was sent with the bearer token, the sign-in page shows at `/sign-in`, `shopperstop:staff-token` is gone, no cached core answer remains, and there is no "Admin" navigation

#### Scenario: Sign in, dashboard, sign out against core
- **WHEN** the e2e suite opens `/admin/`, signs in as the seeded admin, reloads the Dashboard and presses "Sign out"
- **THEN** the Dashboard shows all seven sections before and after the reload, and after sign-out the sign-in page shows and `shopperstop:staff-token` is gone

### Requirement: Stores table
`/stores` SHALL show "Stores" as the level-1 heading with a "New store" link to `/stores/new`, and a table named "Stores" built from `GET /admin/stores?pageSize=100`: one row per store in core's order (by name) with the name linking to `/stores/{id}`, a "City" column with the store's city (empty when it has none), the store's pincode, an "Open" or "Closed" badge, the delivery fee, free-delivery threshold and minimum order in rupees, and the promised minutes.

#### Scenario: Stores listed
- **WHEN** an admin opens `/stores` and core lists Indiranagar (closed, no city) and Koramangala (open, city `Bengaluru`, pincode `560034`, fee 2500, free above 19900, minimum 9900, 10 minutes)
- **THEN** the "Stores" table's links are Indiranagar then Koramangala, Koramangala's link points to `/stores/<its id>`, the table has a "City" column header, Koramangala's row shows `Bengaluru`, `560034`, "Open", ₹25, ₹199, ₹99 and "10 min", Indiranagar's row shows "Closed" and no `Bengaluru`, and the list was requested with `pageSize` 100

### Requirement: Stores table states
While the stores list loads, `/stores` SHALL show a loading status under its heading; with no stores, "No stores yet" instead of the table; when the request fails, the alert "Could not load the stores." with a "Try again" button that requests the list again.

#### Scenario: No stores
- **WHEN** an admin opens `/stores` and core lists no store
- **THEN** "No stores yet" is shown, there is no table, and the "New store" link is present

#### Scenario: Stores loading
- **WHEN** an admin opens `/stores` and core has not answered the list yet
- **THEN** the "Stores" heading and a loading status are shown

#### Scenario: Stores load failure
- **WHEN** core answers the list with 500 and, after the admin presses "Try again", with one store
- **THEN** the alert "Could not load the stores." is shown first, then the store's link and no alert

### Requirement: Store create
`/stores/new` SHALL show "New store" as the level-1 heading and the store form: "Name", "Address", "City" (optional), "Pincode", "Delivery fee (₹)", "Free delivery above (₹)", "Minimum order (₹)", "Promised minutes" and "Status" (Open or Closed), amounts starting at 0 and status at Closed. "Create store" SHALL send `POST /admin/stores` with every field, the city as typed (empty meaning none), and on success open the new store's page.

#### Scenario: Create a store
- **WHEN** an admin on `/stores/new` enters name "HSR Layout", address "27th Main, HSR Layout", city "Bengaluru", pincode `560102`, delivery fee `25`, free delivery above `199.50`, promised minutes `12`, leaves the rest, and presses "Create store", and core answers 201 with the new store
- **THEN** the status started at Closed, the request body is `{"name":"HSR Layout","city":"Bengaluru","addressLine":"27th Main, HSR Layout","pincode":"560102","isOpen":false,"deliveryFeeCents":2500,"freeDeliveryAboveCents":19950,"minOrderCents":0,"promisedMinutes":12}` and the new store's page opens at `/stores/<new id>`

### Requirement: Store form amounts
Amounts on the store form SHALL be typed in rupees with at most two decimals and sent as integer paise.

#### Scenario: Rupees become paise
- **WHEN** an admin types "199.50" into "Free delivery above (₹)" and saves
- **THEN** the request carries `freeDeliveryAboveCents: 19950`

### Requirement: Store change
`/stores/{id}` SHALL show the store's name as the level-1 heading and the store form filled from `GET /admin/stores/{id}`, amounts in rupees and "City" empty when the store has none. "Save changes" SHALL send `PATCH /admin/stores/{id}` with only the fields whose value differs from the loaded store, never `null`, and on success show "Store saved.", keep the saved values as the base of the next change, and show them in the stores table. An id core answers with 404 SHALL show the not-found page.

#### Scenario: Change sends only the changed fields
- **WHEN** an admin on Koramangala's page (no city, fee 2500, free above 19900) sees "City" empty, "Delivery fee (₹)" `25` and "Free delivery above (₹)" `199`, sets "Promised minutes" to `11` and "Status" to Closed, and presses "Save changes"
- **THEN** the `PATCH` body is `{"promisedMinutes":11,"isOpen":false}`, "Store saved." is shown, and "Promised minutes" still reads `11`

#### Scenario: A second save sends only its own change
- **WHEN** an admin saves "Promised minutes" `11`, then changes only "Status" to Closed and saves again
- **THEN** the second `PATCH` body is exactly `{"isOpen":false}`

#### Scenario: Saved change shows in the table
- **WHEN** an admin opens Koramangala from `/stores`, saves "Promised minutes" `11` and returns to "Stores" through the navigation
- **THEN** the "Stores" table shows "11 min"

#### Scenario: Unknown store
- **WHEN** an admin opens `/stores/00000000-0000-4000-8000-000000000000` and core answers 404 `not_found`
- **THEN** "Page not found" is the level-1 heading, the path is unchanged and the "Stores" navigation link carries `aria-current="page"`

#### Scenario: Demo store city from core
- **WHEN** an admin opens the seeded Koramangala's page against a real core
- **THEN** "City" reads `Bengaluru`

### Requirement: Store change city
On the store change form an empty "City" SHALL equal no city, and emptying a city the store had SHALL send `"city":""`.

#### Scenario: Set and clear the city
- **WHEN** an admin on the page of Koramangala with city `Bengaluru` sees "City" `Bengaluru`, clears it and saves, then types `Bangalore` and saves again
- **THEN** the first `PATCH` body is exactly `{"city":""}` and the second exactly `{"city":"Bangalore"}`

### Requirement: Store form errors
An amount or a number of minutes the store form cannot convert SHALL be flagged on its field without a request. A core `validation` error naming a form field SHALL be shown on that field with the form's own message for it (core's messages speak in paise and JSON names; for `city` "Enter at most 100 characters."); any other failure SHALL show the alert "Could not save the store. Try again.".

#### Scenario: Value the form cannot send
- **WHEN** an admin sets "Delivery fee (₹)" to `-1`, clears "Promised minutes" and presses "Save changes"
- **THEN** "Delivery fee (₹)" is described by "Enter 0 to 100000 rupees, at most two decimals.", "Promised minutes" by "Enter 1 to 240 minutes.", and no `PATCH` was sent

#### Scenario: Field error from core
- **WHEN** core answers the save with 400 `validation` and field `name`
- **THEN** the "Name" field is described by "Enter 1 to 100 characters." and there is no alert

#### Scenario: City error from core
- **WHEN** an admin types a 101-character "City" and saves, and core answers 400 `validation` with field `city`
- **THEN** the "City" field is described by "Enter at most 100 characters." and there is no alert

#### Scenario: Other save failure
- **WHEN** core answers the save with 500
- **THEN** the alert "Could not save the store. Try again." is shown

### Requirement: Store delete
The store page SHALL have a "Delete store" button that opens a dialog "Delete <name>?" whose buttons are "Cancel" then "Delete". "Cancel" SHALL close the dialog without a request. "Delete" SHALL send `DELETE /admin/stores/{id}` and on success open `/stores`. A 409 `conflict` SHALL keep the dialog open with the alert "This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted."; any other failure with "Could not delete the store. Try again.".

#### Scenario: Delete after confirming
- **WHEN** an admin presses "Delete store", then "Cancel", then "Delete store" and "Delete", and core answers 204
- **THEN** the dialog's buttons were "Cancel" then "Delete", exactly one `DELETE` was sent, and `/stores` opens

#### Scenario: Store in use
- **WHEN** core answers the delete with 409 `conflict`
- **THEN** the dialog shows the alert "This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted." and the path is still the store's

### Requirement: Store pincode editor
The store page SHALL show a "Delivery pincodes" section: the pincodes from `GET /admin/stores/{id}/service-areas` in a table named "Pincodes", each with a "Remove <pincode>" button, an "Add pincode" field and "Add" button accepting only six digits with a first digit from 1 to 9 and keeping the list sorted without repeats, "Unsaved changes." while the list differs from the saved one, and "Save pincodes", enabled only then, sending one `PUT` with the whole list and showing "Pincodes saved.".

#### Scenario: Pincodes listed
- **WHEN** an admin opens Koramangala's page and core lists `560034` and `560095`
- **THEN** the "Pincodes" table shows `560034` then `560095`, "Save pincodes" is disabled and "Unsaved changes." is not shown

#### Scenario: Add, remove and save
- **WHEN** the admin adds `560047`, presses "Remove 560095" and presses "Save pincodes", and core answers 200
- **THEN** "Unsaved changes." was shown before the save, exactly one `PUT` was sent with `{"pincodes":["560034","560047"]}`, and "Pincodes saved." replaces "Unsaved changes."

#### Scenario: Pincode not six digits
- **WHEN** the admin adds `5600`
- **THEN** "Add pincode" is described by "Enter a 6-digit pincode." and the list is unchanged

### Requirement: Pincode conflict names the other store
A 409 `conflict` to "Save pincodes" carrying `pincode` and `storeId` SHALL show the alert "Pincode <pincode> is served by <name>.", where `<name>` comes from `GET /admin/stores/{storeId}`, or is the id when that request fails, and SHALL keep the edits unsaved. Any other failure, a 409 without those members included, and a request with no answer SHALL show "Could not save the pincodes. Try again." and keep the edits unsaved.

#### Scenario: Pincode served by another store
- **WHEN** the admin adds `560038` and saves, core answers 409 `conflict` with `pincode` `560038` and `storeId` Indiranagar's id, and `GET /admin/stores/<that id>` answers Indiranagar
- **THEN** the alert "Pincode 560038 is served by Indiranagar." is shown and "Unsaved changes." is still shown

#### Scenario: Other store's name unavailable
- **WHEN** the same conflict arrives and `GET /admin/stores/<that id>` answers 500
- **THEN** the alert names the store by its id: "Pincode 560038 is served by 00000000-0000-4000-8000-000000000402."

#### Scenario: Other pincode save failure
- **WHEN** the admin adds `560047` and saves, and core answers 500, or the request gets no answer
- **THEN** the alert "Could not save the pincodes. Try again." is shown and "Unsaved changes." is still shown

### Requirement: Stores against core
The e2e suite SHALL exercise the stores pages against the real core and the demo seed, leave the seeded stores as it found them, and run axe on every page it visits.

#### Scenario: Admin edits a store and meets the pincode conflict
- **WHEN** the seeded admin opens `/stores`, opens Koramangala, saves promised minutes `11`, reloads, saves `10` again, adds `560038` and presses "Save pincodes", removes it, then adds `560001`, saves, reloads, removes it and saves again
- **THEN** the table links are Indiranagar then Koramangala, "Store saved." follows each save and the reload shows `11`, the alert reads "Pincode 560038 is served by Indiranagar.", "Pincodes saved." follows each pincode save and the reload lists `560001`, and axe reports no violation on the table, the store page and the conflict

#### Scenario: Store staff open the stores page
- **WHEN** the seeded Koramangala store staff member signs in and opens `/stores`
- **THEN** the navigation links are Dashboard, Orders, Stock, "Page not found" is the level-1 heading, the URL is still `/admin/stores`, and axe reports no violation

### Requirement: Categories table
`/categories` SHALL show "Categories" as the level-1 heading with a "New category" button, and a table named "Categories" built from `GET /admin/categories`: one row per category in core's order, each parent followed by its children, with the category's image as a 1:1 tile (a placeholder when it has none), its name, its parent's name or "Top level", its sort order, and "Edit <name>" and "Delete <name>" buttons.

#### Scenario: Categories listed
- **WHEN** an admin opens `/categories` and core answers the tree Fruits & Vegetables (sort order 10, with an image, child Fresh Fruits) then Dairy, Bread & Eggs (sort order 20, no image, child Milk)
- **THEN** the "Categories" table's rows are Fruits & Vegetables, Fresh Fruits, Dairy, Bread & Eggs, Milk in that order, Fruits & Vegetables shows "Top level", `10` and its image, Dairy, Bread & Eggs shows no image, Milk's row names Dairy, Bread & Eggs and has "Edit Milk" and "Delete Milk" buttons

### Requirement: Categories table states
While the tree loads, `/categories` SHALL show a loading status under its heading; with no categories, "No categories yet" instead of the table; when the request fails, the alert "Could not load the categories." with a "Try again" button that requests the tree again.

#### Scenario: No categories
- **WHEN** an admin opens `/categories` and core answers an empty tree
- **THEN** "No categories yet" is shown, there is no table, and the "New category" button is present

#### Scenario: Categories load failure
- **WHEN** core answers the tree with 500 and, after the admin presses "Try again", with one category
- **THEN** the alert "Could not load the categories." is shown first, then the "Categories" table and no alert

### Requirement: Category create
"New category" SHALL open a dialog "New category" with "Name", "Parent" ("None (top level)" or one of the top-level categories) and "Sort order" (starting at `0`), and the buttons "Cancel" then "Create category". "Create category" SHALL send `POST /admin/categories` with `name`, `sortOrder` and, when a parent is chosen, `parentId`; on success the dialog SHALL close and the table SHALL show the tree as core now answers it.

#### Scenario: Create a child category
- **WHEN** an admin opens "New category", enters name "Curd", chooses parent Dairy, Bread & Eggs and sort order `20`, presses "Create category", and core answers 201
- **THEN** the dialog's buttons were "Cancel" then "Create category", the request body is `{"name":"Curd","sortOrder":20,"parentId":"<Dairy, Bread & Eggs id>"}`, the dialog closes, and the table lists Curd after Milk under Dairy, Bread & Eggs

#### Scenario: Create a top-level category
- **WHEN** an admin opens "New category", sees "Parent" at "None (top level)", enters name "Snacks" and presses "Create category", and core answers 201
- **THEN** the request body is `{"name":"Snacks","sortOrder":0}` with no `parentId`, and the dialog closes

### Requirement: Category change
"Edit <name>" SHALL open a dialog "Edit <name>" with "Name" and "Sort order" filled from the category and no "Parent" field. "Save changes" SHALL send `PATCH /admin/categories/{id}` with only the fields whose value differs from the category, never `null`; on success the dialog SHALL close and the table SHALL show the tree as core now answers it, in its new order.

#### Scenario: Change sends only the changed fields and reorders the tree
- **WHEN** an admin edits Dairy, Bread & Eggs (sort order 20, after Fruits & Vegetables at 10), sets "Sort order" to `5` and presses "Save changes", and core then answers the tree in its new order
- **THEN** the `PATCH` body is `{"sortOrder":5}`, the dialog closes, and the table's rows are Dairy, Bread & Eggs, Milk, Fruits & Vegetables, Fresh Fruits

### Requirement: Category form errors
A sort order that is not a whole number from 0 to 9999 SHALL be flagged on "Sort order" with "Enter a whole number from 0 to 9999." without a request. A core `validation` error naming `name`, `parentId` or `sortOrder` SHALL be shown on that field with the form's own message ("Enter 1 to 100 characters.", "Choose a top-level category.", "Enter a whole number from 0 to 9999."); any other failure SHALL show the alert "Could not save the category. Try again." in the dialog.

#### Scenario: Sort order the form cannot send
- **WHEN** an admin edits Milk, sets "Sort order" to `-1` and presses "Save changes"
- **THEN** "Sort order" is described by "Lower numbers come first. Enter a whole number from 0 to 9999." and no `PATCH` was sent

#### Scenario: Category field error from core
- **WHEN** core answers a category create with 400 `validation` and field `parentId`
- **THEN** "Parent" is described by "Choose a top-level category." and the dialog shows no alert

#### Scenario: Other category save failure
- **WHEN** core answers a category change with 500
- **THEN** the dialog shows the alert "Could not save the category. Try again."

### Requirement: Catalog field errors clear on edit
In the category dialog and the product form, an error the form itself raised on a field SHALL clear when that field is edited, and the form's own errors on other fields SHALL stay. An error from core's last answer, on a field or as the alert, SHALL clear on the next edit of any field of that form: core validates again on the next save.

#### Scenario: Sort order error clears on edit
- **WHEN** an admin edits Milk, saves sort order `-1`, sees "Sort order" described by "Lower numbers come first. Enter a whole number from 0 to 9999.", and then clears the field
- **THEN** "Sort order" is described by "Lower numbers come first." only

#### Scenario: Category field error from core clears on edit
- **WHEN** core answers a category create with 400 `validation` and field `sortOrder`, "Sort order" is described by "Lower numbers come first. Enter a whole number from 0 to 9999.", and the admin types in "Sort order"
- **THEN** "Sort order" is described by "Lower numbers come first." only and the dialog shows no alert

#### Scenario: Amount error clears on edit
- **WHEN** an admin saves MRP `30.555` with an empty price, sees both fields flagged, and then types `28` in "Price (₹)"
- **THEN** "Price (₹)" is described by "At most the MRP." only and "MRP (₹)" is still described by "Enter 0.01 to 1000000 rupees, at most two decimals."

### Requirement: Category delete
"Delete <name>" SHALL open a dialog "Delete <name>?" whose buttons are "Cancel" then "Delete". "Cancel" SHALL close it without a request. "Delete" SHALL send `DELETE /admin/categories/{id}` and on success close the dialog and show the tree as core now answers it. A 409 `conflict` SHALL keep the dialog open with the alert "This category still has subcategories or products. Move or delete them first."; any other failure with "Could not delete the category. Try again.".

#### Scenario: Delete a category after confirming
- **WHEN** an admin presses "Delete Milk", then "Cancel", then "Delete Milk" and "Delete", and core answers 204
- **THEN** the dialog's buttons were "Cancel" then "Delete", exactly one `DELETE` was sent, the dialog closes and Milk is no longer in the table

#### Scenario: Category in use
- **WHEN** core answers the delete of Dairy, Bread & Eggs with 409 `conflict`
- **THEN** the dialog "Delete Dairy, Bread & Eggs?" stays open with the alert "This category still has subcategories or products. Move or delete them first." and the buttons "Cancel" then "Delete", exactly one `DELETE` was sent, and Dairy, Bread & Eggs is still in the table

### Requirement: Products table
`/products` SHALL show "Products" as the level-1 heading with a "New product" link to `/products/new`, and a table named "Products" of `GET /admin/products` with `page` and `pageSize` 24: one row per product in core's order with its image as a 1:1 tile, its name linking to `/products/{id}` with its brand, its category ("Parent › Child" for a child), its unit, its price with the MRP when higher, and an "Active" or "Inactive" badge.

#### Scenario: Products listed
- **WHEN** an admin opens `/products` and core answers Banana Robusta (inactive, in Fresh Fruits) and Sunny Fields Toned Milk (active, brand Sunny Fields, in Milk, 500 ml, price 2799, MRP 3000), total 2
- **THEN** the table's links are Banana Robusta then Sunny Fields Toned Milk, the milk's link points to `/products/<its id>` and its row shows "Sunny Fields", "Dairy, Bread & Eggs › Milk", "500 ml", ₹27.99, "MRP ₹30" and "Active", Banana Robusta's row shows "Fruits & Vegetables › Fresh Fruits" and "Inactive", "Page 1 of 1, 2 products" is shown, and the list was requested with exactly `page` 1 and `pageSize` 24

### Requirement: Products search and filters
`/products` SHALL have a "Search" field with a "Search" button, a "Category" select ("All categories", then every category in tree order) and a "Status" select ("Active and inactive", "Active", "Inactive"). Submitting the search (trimmed) or changing a select SHALL request the list again from page 1 with `q`, `categoryId` and `isActive` (`true` or `false`) for the filters that are set and without the others.

#### Scenario: Search and filters from the first page
- **WHEN** an admin on page 2 of 30 products searches " milk ", then chooses category Milk and status Inactive
- **THEN** the search requests `q` `milk`, `page` 1 and `pageSize` 24 only, and the last request has `q` `milk`, `categoryId` Milk's id, `isActive` `false`, `page` 1 and `pageSize` 24

#### Scenario: Filter changed on a later page
- **WHEN** an admin on page 2 of 30 products chooses category Milk, presses "Next" again, and then chooses status Inactive
- **THEN** the request after the category change has `categoryId` Milk's id, `page` 1 and `pageSize` 24 only, and the request after the status change has `categoryId` Milk's id, `isActive` `false`, `page` 1 and `pageSize` 24

### Requirement: Products pager
Under the table `/products` SHALL show "Page <page> of <pages>, <total> products" between a "Previous" and a "Next" button, which request the page before and after and are disabled on the first and the last page.

#### Scenario: Pager
- **WHEN** core answers 30 products and the admin presses "Next", then "Previous"
- **THEN** "Page 1 of 2, 30 products" is shown with "Previous" disabled, then "Page 2 of 2, 30 products" with page 2's product and "Next" disabled after a request for `page` 2, then "Page 1 of 2, 30 products" with page 1's product after a request for `page` 1

### Requirement: Products table states
While the list loads, `/products` SHALL show a loading status under its heading; with no product matching, "No products found" instead of the table; when the request fails, the alert "Could not load the products." with a "Try again" button that requests the list again.

#### Scenario: No products
- **WHEN** an admin opens `/products` and core answers no product
- **THEN** "No products found" is shown, there is no table, and the "New product" link is present

#### Scenario: Products loading
- **WHEN** an admin opens `/products` and core has not answered the list yet
- **THEN** the "Products" heading and a loading status are shown

#### Scenario: Products load failure
- **WHEN** core answers the list with 500 and, after the admin presses "Try again", with one product
- **THEN** the alert "Could not load the products." is shown first, then the product's link and no alert

### Requirement: Product create
`/products/new` SHALL show "New product" as the level-1 heading and the product form: "Name", "Brand", "Category" ("Choose a category", then every category in tree order, a child as "Parent › Child"), "Unit", "MRP (₹)", "Price (₹)", "Description" and "Status" (Active or Inactive, starting at Active). Amounts SHALL be typed in rupees with at most two decimals and sent as integer paise. "Create product" SHALL send `POST /admin/products` with every field and on success open the new product's page.

#### Scenario: Create a product
- **WHEN** an admin on `/products/new` enters name "Curd Cup", category Milk, unit "400 g", MRP `40` and price `35.50`, leaves the rest, and presses "Create product", and core answers 201 with the new product
- **THEN** "Status" started at Active, the request body is `{"name":"Curd Cup","brand":"","categoryId":"<Milk's id>","unitLabel":"400 g","mrpCents":4000,"priceCents":3550,"description":"","isActive":true}` and the new product's page opens at `/products/<new id>` with "Curd Cup" as the level-1 heading

### Requirement: Product change
`/products/{id}` SHALL show the product's name as the level-1 heading and the product form filled from `GET /admin/products/{id}`, amounts in rupees. "Save changes" SHALL send `PATCH /admin/products/{id}` with only the fields whose value differs from what the form shows for the loaded product (an emptied brand or description is sent as `""`, nothing is ever `null`), and on success show "Product saved.", keep the saved product as the base of the next change, and show it in the products table.

#### Scenario: Change sends only the changed fields
- **WHEN** an admin on Sunny Fields Toned Milk's page (no description) sees "MRP (₹)" `30`, "Price (₹)" `27.99` and category Milk, sets the price to `28`, empties "Brand" and presses "Save changes"
- **THEN** the `PATCH` body is `{"brand":"","priceCents":2800}`, "Product saved." is shown and "Price (₹)" still reads `28`

#### Scenario: A second product save sends only its own change
- **WHEN** an admin saves price `28`, then changes only "Status" to Inactive and saves again
- **THEN** the second `PATCH` body is exactly `{"isActive":false}`

#### Scenario: Saved product shows in the table
- **WHEN** an admin opens Sunny Fields Toned Milk from `/products`, saves price `28` and returns to "Products" through the navigation
- **THEN** the "Products" table shows ₹28

### Requirement: Product form shows the saved product
After a successful "Save changes" the product form SHALL show the product as core answered it (core trims text), so that the next save sends only what the admin changed since.

#### Scenario: Saved product shown as core stored it
- **WHEN** an admin sets "Name" to "  Toned Milk  " and saves, core answers the product named "Toned Milk", and the admin then changes only "Status" to Inactive and saves again
- **THEN** the first `PATCH` body is `{"name":"  Toned Milk  "}`, "Name" reads "Toned Milk" after the first save, and the second `PATCH` body is exactly `{"isActive":false}`

### Requirement: Unknown product shows not found
A product id that core answers with 404 `not_found` SHALL show the not-found page at that path, with the "Products" section still marked in the navigation.

#### Scenario: Unknown product
- **WHEN** an admin opens `/products/00000000-0000-4000-8000-000000000000` and core answers 404 `not_found`
- **THEN** "Page not found" is the level-1 heading, the path is unchanged and the "Products" navigation link carries `aria-current="page"`

### Requirement: Product form errors
An MRP or price the form cannot convert SHALL be flagged on its field without a request. A core `validation` error naming a form field SHALL be shown on that field with the form's own message (core's messages speak in paise and JSON names; a price above the MRP is core's 400 on `priceCents`); any other failure, of a change or a create, SHALL show the alert "Could not save the product. Try again." and stay on the page.

#### Scenario: Amount the form cannot send
- **WHEN** an admin sets "MRP (₹)" to `30.555`, clears "Price (₹)" and presses "Save changes"
- **THEN** "MRP (₹)" is described by "Enter 0.01 to 1000000 rupees, at most two decimals.", "Price (₹)" by "At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.", and no `PATCH` was sent

#### Scenario: Product field error from core
- **WHEN** an admin sets the price to `31` and core answers the save with 400 `validation` and field `priceCents`
- **THEN** "Price (₹)" is described by "At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals." and there is no alert

#### Scenario: Other product save failure
- **WHEN** core answers the save with 500
- **THEN** the alert "Could not save the product. Try again." is shown

#### Scenario: Product create failure
- **WHEN** an admin on `/products/new` fills the form and presses "Create product", and core answers 500
- **THEN** the alert "Could not save the product. Try again." is shown, the path is still `/products/new` and "New product" is still the level-1 heading

### Requirement: Product delete
The product page SHALL have a "Delete product" button that opens a dialog "Delete <name>?" whose buttons are "Cancel" then "Delete". "Cancel" SHALL close it without a request. "Delete" SHALL send `DELETE /admin/products/{id}` and on success open `/products`; a failure other than 409 SHALL show "Could not delete the product. Try again." in the dialog, which stays open on the product's page.

#### Scenario: Delete a product after confirming
- **WHEN** an admin presses "Delete product", then "Cancel", then "Delete product" and "Delete", and core answers 204
- **THEN** the dialog's buttons were "Cancel" then "Delete", exactly one `DELETE` was sent, and `/products` opens

#### Scenario: Other delete failure
- **WHEN** core answers the delete with 500
- **THEN** the dialog shows the alert "Could not delete the product. Try again." with the buttons "Cancel" then "Delete", and the path is still the product's

### Requirement: Ordered product is deactivated instead
A 409 `conflict` to the delete SHALL keep the dialog open with the alert "This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it." and the buttons "Cancel" then "Deactivate instead", which SHALL send `PATCH /admin/products/{id}` with `{"isActive":false}` and on success open `/products`; a failure SHALL show "Could not deactivate the product. Try again.".

#### Scenario: Ordered product is deactivated instead
- **WHEN** core answers the delete with 409 `conflict` and the admin presses "Deactivate instead", and core answers the `PATCH` with the inactive product
- **THEN** the alert and the buttons "Cancel" then "Deactivate instead" were shown, the `PATCH` body is `{"isActive":false}`, and `/products` opens with the product marked "Inactive"

### Requirement: Products reload after a delete or a deactivate
After a product delete or "Deactivate instead", `/products` SHALL load the list from core again and show no list kept from before meanwhile. After "Deactivate instead" the product's page SHALL next open with "Status" Inactive.

#### Scenario: Products table after a delete
- **WHEN** an admin opens Sunny Fields Toned Milk from the `/products` table (Banana Robusta and Sunny Fields Toned Milk), deletes it, and core has not yet answered the list again
- **THEN** `/products` shows its heading and no table, and once core answers Banana Robusta alone the table lists Banana Robusta and not Sunny Fields Toned Milk

#### Scenario: Deactivated product after returning
- **WHEN** an admin opens Sunny Fields Toned Milk from the `/products` table, presses "Delete product", "Delete" (409) and "Deactivate instead", and core has not yet answered the list again
- **THEN** `/products` shows its heading and no table, once core answers the table marks the product "Inactive", and opening the product from the table shows "Status" Inactive

### Requirement: Catalog image upload
The product page and the category edit dialog SHALL have an "Image" file field accepting `image/png,image/jpeg,image/webp` and a 1:1 tile "Image of <name>". Picking a file SHALL upload it at once with one `PUT` to the product's or category's `/image` route, the file as `multipart/form-data` part `file`, then show "Image saved." and the image core answers, loaded afresh even when its URL is unchanged; a category upload SHALL also refresh the categories table.

#### Scenario: Product image uploaded
- **WHEN** an admin on a product page without an image picks a PNG, core answers 200 with `imageUrl` `/api/core/v1/files/products/<id>.png`, and the admin picks a second PNG
- **THEN** exactly one `PUT` carried the first file as part `file` with type `image/png`, "Image saved." is shown, the tile "Image of <name>" shows `/api/core/v1/files/products/<id>.png?v=1`, and after the second upload `?v=2`

#### Scenario: Category image uploaded from its dialog
- **WHEN** an admin opens "Edit Milk", picks a PNG and core answers 200 with the category's `imageUrl`, then closes the dialog
- **THEN** exactly one `PUT /admin/categories/<Milk's id>/image` was sent, the dialog showed "Image saved." and the tile "Image of Milk", and Milk's row in the table shows the new image

### Requirement: Image upload in progress
While an upload is pending the "Image" field SHALL stay enabled, so it keeps keyboard focus, "Uploading the image…" SHALL be shown as a status, and another pick SHALL be ignored.

#### Scenario: Pick while an upload is pending
- **WHEN** an admin picks a PNG, core has not answered the upload yet, the admin picks a second PNG, and core then answers the first with 200
- **THEN** "Uploading the image…" was shown with the "Image" field enabled, exactly one `PUT` was sent, and "Image saved." and the tile at `?v=1` are shown without "Uploading the image…"

### Requirement: Image upload errors
A file that is not PNG, JPEG or WebP, or is over 5 MiB, SHALL be flagged on "Image" with "Choose a PNG, JPEG or WebP image of at most 5 MB." without a request; core's 400 `validation` on `file` SHALL show the same message on the field; any other failure SHALL show the alert "Could not upload the image. Try again.".

#### Scenario: File refused before upload
- **WHEN** an admin picks a GIF, or a PNG of 5 MiB plus one byte
- **THEN** "Image" is described by "PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it. Choose a PNG, JPEG or WebP image of at most 5 MB." and no `PUT` was sent

#### Scenario: File refused by core
- **WHEN** core answers the upload with 400 `validation` and field `file`
- **THEN** "Image" is described by the same message and there is no alert

#### Scenario: Other upload failure
- **WHEN** core answers the upload with 500
- **THEN** the alert "Could not upload the image. Try again." is shown

### Requirement: Catalog against core
The e2e suite SHALL exercise the catalog pages against the real core and the demo seed, leave the seeded catalog as it found it (images included: it uploads only to a product it creates and then deletes), and run axe on every page and dialog it visits.

#### Scenario: Admin runs the catalog
- **WHEN** the seeded admin opens `/categories` and the "Edit Milk" dialog, opens `/products`, searches "sunny fields toned", opens Sunny Fields Toned Milk, saves price `28`, reloads, saves `27.99` again, creates "E2E Curd Cup" in Paneer & Curd (400 g, MRP 40, price 35.50), uploads a 1×1 PNG built in the test, and deletes the product
- **THEN** the first rows are Fruits & Vegetables then Fresh Fruits, the dialog's sort order is `10`, the list shows "Page 1 of 7, 148 products", the search lists only Sunny Fields Toned Milk, the reload shows `28`, the tile's source is `/api/core/v1/files/products/<id>.png?v=1` and the image loads with width 1, a search for the deleted product shows "No products found", and axe reports no violation on the tree, the dialog, the list, the product page, the new-product form and the uploaded image

#### Scenario: Store staff open the catalog pages
- **WHEN** the seeded Koramangala store staff member signs in and opens `/categories`, then `/products`
- **THEN** each shows "Page not found" as the level-1 heading with the URL unchanged, and axe reports no violation

### Requirement: Stock table
`/stock` SHALL show "Stock" as the level-1 heading and a table named "Stock" built from `GET /admin/stores/{id}/stock` with `pageSize` 24: one row per product in core's order with its name, its brand when it has one, its unit, its price, its quantity in a text field labelled "Quantity of <name>", and a "Low stock" badge when the quantity core holds is below 5, zero included.

#### Scenario: Stock listed
- **WHEN** an admin opens `/stock`, the stores are Indiranagar then Koramangala, and core answers Indiranagar's stock: Banana Robusta 0, Brown Bread 5, Fresh Curd 4, Sunny Fields Toned Milk (brand Sunny Fields, 500 ml, ₹27.99) 17
- **THEN** the "Stock" table lists the four in that order, the milk's row shows "Sunny Fields", "500 ml", "₹27.99" and "Quantity of Sunny Fields Toned Milk" holds `17`, Banana Robusta and Fresh Curd carry "Low stock", Brown Bread and the milk do not, "Page 1 of 1, 4 products" is shown, the request went to Indiranagar's stock with `page=1&pageSize=24`, and the only requests are `GET /admin/me`, `GET /admin/stores` and that one

### Requirement: Stock store for admins
For an admin, `/stock` SHALL show a "Store" selector of the stores from `GET /admin/stores`. The page SHALL show the store the URL names in `store`, or the first store when the URL names none or one that is not listed. Choosing a store SHALL put it in the URL as `store` and keep keyboard focus on the selector. While the chosen store's stock loads, another store's rows SHALL NOT be shown.

#### Scenario: Choose a store
- **WHEN** an admin on Indiranagar's stock chooses Koramangala in "Store" and core has not answered yet
- **THEN** a loading status is shown and no Indiranagar row, then Koramangala's rows, the selector shows Koramangala and has focus, and the URL's search is `store=<Koramangala id>`

#### Scenario: Store in the URL
- **WHEN** an admin opens `/stock?store=<Koramangala id>`
- **THEN** Koramangala's stock is shown and the selector shows Koramangala

#### Scenario: Unknown store in the URL
- **WHEN** an admin opens `/stock?store=<an id that is no store>`
- **THEN** the first store's stock is shown and the selector shows the first store

### Requirement: Stock store for store staff
For store staff, `/stock` SHALL show the stock of their own store, whatever `store` the URL holds, with no "Store" selector and without requesting `GET /admin/stores`. Where admins have the selector it SHALL show "Store: <name>", the name read from the public `GET /stores/{id}`; when that request fails, the page SHALL show the stock without the name and without an error.

#### Scenario: Store staff see their own store
- **WHEN** a store staff member of the store Whitefield opens `/stock?store=<another store's id>`
- **THEN** the table shows Whitefield's stock, "Whitefield" is shown, there is no "Store" selector, and the only requests are `GET /admin/me`, `GET /admin/stores/<Whitefield id>/stock` and `GET /stores/<Whitefield id>`

#### Scenario: Store name unavailable
- **WHEN** a store staff member opens `/stock` and core answers `GET /stores/<their store id>` with 500
- **THEN** their store's stock is shown with its quantity fields and "No unsaved changes", there is no "Store:" text and no alert

### Requirement: Stock search and low-stock filter
`/stock` SHALL have a search form named "Search stock" (a "Search" field and button) that asks core with `q` set to the trimmed text, and a "Low stock only" toggle button (`aria-pressed`) that asks with `lowStock=true` while on. Both SHALL be held in the URL, an empty one left out of the URL and the request. The field SHALL show the URL's `q` whenever it changes, also through Back and Forward. Changing the search or the filter SHALL ask for page 1.

#### Scenario: Search and filter from the first page
- **WHEN** an admin on page 2 searches " product ", moves to page 2 again and switches "Low stock only" on, then off
- **THEN** core is asked with `q=product&page=1`, then with `q=product&lowStock=true&page=1`, the toggle is pressed and keeps focus, the URL's search is `q=product&lowStock=true`, and switching it off asks with `q=product&page=1` and no `lowStock`

#### Scenario: Back and Forward
- **WHEN** an admin with one unsaved edit searches " milk ", goes Back, then Forward
- **THEN** after the search the field holds `milk`; after Back the field is empty, the URL holds no `q` and the whole list is shown; after Forward the field holds `milk` and the milk is listed; the edit and "1 unsaved change" are there throughout

### Requirement: Stock pager
Under the table `/stock` SHALL show "Previous", "Page x of y, n products" and "Next", with the page in the URL (`page`, left out for page 1). The button that cannot move SHALL be `aria-disabled`, not `disabled`, and do nothing. The table SHALL stay while the next page loads, so the pressed button keeps keyboard focus. A page beyond the last SHALL be replaced by the last page that has rows.

#### Scenario: Pager
- **WHEN** core holds 30 products and an admin presses "Next", presses it again, then presses "Previous"
- **THEN** "Page 1 of 2, 30 products" shows "Previous" `aria-disabled`; after "Next" the page is "Page 2 of 2, 30 products" with the 25th product, "Next" is `aria-disabled`, not `disabled`, and has focus; the second press sends no request; "Previous" shows page 1 again, keeps focus, and the URL holds no `page`

#### Scenario: Page past the end
- **WHEN** core holds 30 products and an admin opens `/stock?page=9`
- **THEN** "Page 2 of 2, 30 products" is shown with the 25th product and the URL's search is `page=2`

### Requirement: Stock rows while the next list loads
While the next page, search or filter of the same store loads, the rows on screen SHALL stay in a region marked `aria-busy` and dimmed, the pager text SHALL name the page core answered for those rows, not the page asked for, and their quantity fields SHALL be read-only, not disabled, so an edit can never land on a row of the list before. When the answer arrives the region SHALL no longer be busy and the fields SHALL be editable.

#### Scenario: Rows kept while the next page loads
- **WHEN** core holds 30 products, an admin presses "Next", and core has not answered page 2 yet; the admin then focuses the 1st product's field and types `9`
- **THEN** the table's region is `aria-busy` and dimmed, "Page 1 of 2, 30 products" is still shown, the field is read-only, not disabled, keeps focus and its value, and "No unsaved changes" stays; when core answers, "Page 2 of 2, 30 products" is shown, the region is not busy and the 25th product's field is editable

### Requirement: Stock URL values
`/stock` SHALL read a `page` in the URL that is not a whole number above 1 as page 1 and one above 100000 as 100000, and a `lowStock` other than `true` as off. A `q` SHALL lose NUL characters and halves of surrogate pairs and be cut to 100 characters, counted by code point so no character is cut through; the "Search" field SHALL take at most 100 UTF-16 units. No value of the URL SHALL leave the page on a failed load that "Try again" cannot fix.

#### Scenario: Unreadable page or filter
- **WHEN** an admin opens `/stock?page=banana`, `/stock?page=1.5` or `/stock?lowStock=banana`
- **THEN** core is asked with `page=1&pageSize=24` and no `lowStock`, "Page 1 of 2, 30 products" is shown and "Low stock only" is not pressed

#### Scenario: Over-large page
- **WHEN** core holds 30 products and refuses pages above 89478486 with 400, and an admin opens `/stock?page=2147483648`
- **THEN** core is asked for page 100000, then page 2; "Page 2 of 2, 30 products" is shown and there is no alert

#### Scenario: Over-long search
- **WHEN** an admin opens `/stock?q=` followed by 60 `m`, a NUL character and 60 `k`
- **THEN** core is asked with a `q` of the 60 `m` and 40 `k`, the "Search" field inside the form named "Search stock" holds that text and takes at most 100 characters

#### Scenario: Search ending in an emoji
- **WHEN** an admin opens `/stock?q=` followed by 99 `a`, the emoji 😀 and `b`
- **THEN** core is asked with a `q` of the 99 `a` and the whole emoji, the "Search" field holds that text, and there is no alert

#### Scenario: Search cleaned
- **WHEN** a search holds a NUL character, 101 characters, an emoji as its 100th character, or half of a surrogate pair
- **THEN** it becomes the text without the NUL, its first 100 characters, the text up to and with the whole emoji, and the text without the half pair, and each can be written into a request URL

### Requirement: Stock table states
While the stock loads for the first time, `/stock` SHALL show a loading status under its heading; with no matching product, "No products found" instead of the table; when the request fails, the alert "Could not load the stock." with "Try again". An admin with no stores SHALL see "No stores yet" and no selector; when the stores request fails, the alert "Could not load the stores." with "Try again".

#### Scenario: Search without a match
- **WHEN** an admin opens `/stock?q=ghee` and core answers no product
- **THEN** "No products found" is shown, there is no table, and the "Search" field holds `ghee`

#### Scenario: Stock loading
- **WHEN** an admin opens `/stock` and core has not answered the stock yet
- **THEN** the heading "Stock", the "Store" selector and a loading status are shown

#### Scenario: Stock load failure
- **WHEN** core answers the stock with 500 and, after the admin presses "Try again", with one product
- **THEN** the alert "Could not load the stock." is shown first, then the product's quantity field and no alert

#### Scenario: No stores
- **WHEN** an admin opens `/stock` and core answers an empty list of stores
- **THEN** "No stores yet" is shown and there is no "Store" selector

#### Scenario: Stores load failure
- **WHEN** core answers the stores with 500 and, after the admin presses "Try again", with one store
- **THEN** the alert "Could not load the stores." is shown first, then that store's stock

### Requirement: Stock edits
A quantity typed into a row SHALL be kept as an unsaved edit of that product for the store shown, across pages, searches, the filter and Back or Forward. A status region SHALL show "No unsaved changes", "1 unsaved change" or "<n> unsaved changes", and each edited row an "Unsaved" badge. A value that reads as the quantity core holds SHALL NOT be an edit. "Discard changes" SHALL drop every edit and keep keyboard focus; with no edit it SHALL do nothing.

#### Scenario: Edit typed back
- **WHEN** an admin changes a quantity from `17` to `18`, then back to `17`, and presses "Save changes"
- **THEN** "1 unsaved change" shows after the first change with "Save changes" not `aria-disabled`; after the second, "No unsaved changes" shows, no row is marked "Unsaved", "Save changes" is `aria-disabled` but not `disabled`, and no `PUT` is sent

#### Scenario: Discard
- **WHEN** an admin changes two quantities, one to `30` and one to nothing, and presses "Discard changes"
- **THEN** "2 unsaved changes" showed before; afterwards both fields hold what core holds, "No unsaved changes" is shown, "Discard changes" has focus, and no `PUT` was sent

#### Scenario: Value read as the stored quantity
- **WHEN** an admin types `017` for a product core holds 17 of, then saves an edit of another product and presses "Discard changes"
- **THEN** after `017` the count, a `status` region, reads "No unsaved changes", the field shows `17` and no row is marked "Unsaved"; after the save "Stock saved." is shown, and it is still shown after "Discard changes"

### Requirement: Stock save
"Save changes" SHALL send every unsaved edit of the store in one `PUT /admin/stores/{id}/stock` with `{"rows":[{"productId","quantity"}]}`, at most 500 rows in the order the edits were made. On 204 the page SHALL show the status "Stock saved.", SHALL no longer count the rows it sent as edits, and SHALL show the stock as core now holds it, also on pages loaded before the save. An edit not sent, or typed while the save ran, SHALL stay unsaved.

#### Scenario: Edits on two pages saved with one PUT
- **WHEN** core holds 30 products, an admin sets the 1st (quantity 0) to `40`, moves to page 2, sets the 25th to `7`, switches "Low stock only" on and presses "Save changes"
- **THEN** "2 unsaved changes" and the 1st product's `40` are still shown under the filter; exactly one `PUT` goes to the store with the two rows `40` and `7` in that order; then "Stock saved." and "No unsaved changes" are shown, the low-stock list no longer holds the 1st product, and with the filter off its field holds `40` with no "Unsaved" badge

#### Scenario: Kept page read again
- **WHEN** an admin edits a product on page 1, moves to page 2, saves, and presses "Previous" while core has not answered page 1 again
- **THEN** the URL holds no `page`, and the product's field is not shown with its old quantity; when core answers, it holds the saved quantity

#### Scenario: Edit typed during a save
- **WHEN** an admin saves one edit and, before core answers the `PUT`, changes another product's quantity
- **THEN** after the answer "1 unsaved change" is shown, the second product keeps its typed value and its "Unsaved" badge, and the first shows its saved quantity

#### Scenario: More than 500 edits
- **WHEN** 501 edits are turned into the rows of a save
- **THEN** there are 500 rows, the first 500 edits in the order they were made

### Requirement: Stock save in progress
While a save runs, "Save changes" SHALL read "Saving…" and be `aria-disabled`, never `disabled`, so it keeps keyboard focus, and a press SHALL send nothing. An edit typed meanwhile SHALL NOT hide the save's result: when core answers, "Stock saved." SHALL be shown for the rows that were saved.

#### Scenario: Focus through a save
- **WHEN** an admin presses "Save changes" and core has not answered the `PUT` yet, then core answers
- **THEN** while the save runs the button reads "Saving…", is `aria-disabled`, not `disabled`, and has focus; after the answer it reads "Save changes", is not `disabled` and still has focus, and "Stock saved." is shown

#### Scenario: Second press during a save
- **WHEN** an admin saves one edit and, before core answers, changes another product's quantity and presses the button again
- **THEN** the button reads "Saving…" and is `aria-disabled`, exactly one `PUT` was sent, with the first edit only, and after the answer "Stock saved." is shown and the button reads "Save changes"

### Requirement: Stock quantity the page cannot send
A typed quantity that is not a whole number from 0 to 100000 (spaces around it ignored) SHALL be marked invalid on its field as it is typed. While one is unsaved, "Save changes" SHALL send nothing and show the alert "Enter a whole number from 0 to 100000 for: <product names>.". The alert SHALL go when any quantity is edited; the mark SHALL go when the value is a quantity.

#### Scenario: Unsendable quantity
- **WHEN** an admin types `12.5` for Sunny Fields Toned Milk and `9` for Banana Robusta, presses "Save changes", types `100001`, then `12`, and presses "Save changes" again
- **THEN** the milk's field is marked invalid and the banana's is not; the first press sends no `PUT` and shows the alert naming Sunny Fields Toned Milk; typing `100001` removes the alert and keeps the mark; `12` removes the mark; the second press sends one `PUT` with `12` and `9` and "Stock saved." is shown

#### Scenario: Quantity as typed
- **WHEN** the typed values are `0`, `100000`, ` 7 `, `007`, `100001`, `-1`, `1.5`, `1e3` and nothing
- **THEN** the first four are the quantities 0, 100000, 7 and 7 and the others are not quantities, and a value that is not a quantity is left out of a save's rows, never sent as a number

### Requirement: Stock save failures
When core answers the save with 400 `validation`, the page SHALL show the alert "These changes were refused: a changed product may have been deleted. Discard the changes and try again."; on any other failure, "Could not save the stock. Try again.". In both cases every edit SHALL stay unsaved and "Stock saved." SHALL NOT be shown. The alert SHALL go when a quantity is edited.

#### Scenario: Save refused for a deleted product
- **WHEN** an admin saves an edit, core answers 400 `validation` on `rows`, and the admin then edits another quantity
- **THEN** the "These changes were refused" alert is shown with the edit still in its field and "1 unsaved change", there is no "Stock saved.", and the alert goes with the next edit

#### Scenario: Other save failure
- **WHEN** core answers the save with 500 and, on the next "Save changes", with 204
- **THEN** "Could not save the stock. Try again." is shown with the edit kept, then "Stock saved." with no alert, and the one successful `PUT` carries the edit

#### Scenario: Save answered without core's error body
- **WHEN** an admin saves an edit and the answer is a 502 with no body
- **THEN** "Could not save the stock. Try again." is shown, the edit is still in its field with "1 unsaved change", "Stock saved." is not shown, and "Save changes" can be pressed again

### Requirement: Stock save result stays with its visit
The alert of a failed save SHALL be shown only while edits are unsaved. Neither that alert nor "Stock saved." SHALL be shown again once the store on screen has changed: returning to the store shows neither.

#### Scenario: Failed save, then another store and back
- **WHEN** an admin's save at Indiranagar is refused with 400 `validation`, the admin chooses Koramangala, presses "Discard and switch", then chooses Indiranagar again
- **THEN** no alert is shown at Koramangala, and back at Indiranagar the field holds what core holds, "No unsaved changes" is shown and there is no alert

#### Scenario: Saved, then another store and back
- **WHEN** an admin saves an edit at Indiranagar, chooses Koramangala, then Indiranagar again
- **THEN** "Stock saved." is shown after the save, not at Koramangala, and not again at Indiranagar, where the field holds the saved quantity

#### Scenario: Save fails after its edits were discarded
- **WHEN** an admin presses "Save changes", presses "Discard changes" before core answers, and core then answers 500
- **THEN** "No unsaved changes" is shown and there is no alert

### Requirement: Stock store switch with unsaved edits
Choosing another store while edits are unsaved SHALL open the dialog "Discard unsaved changes?" with "Cancel" then "Discard and switch", leaving the store as it is. "Cancel" SHALL keep the store and the edits; "Discard and switch" SHALL show the chosen store. With no edits the store SHALL change at once. Any change of store, also through the URL, Back or Forward, SHALL drop the edits for good: they SHALL never be shown for or sent to another store, nor come back.

#### Scenario: Switch asks first
- **WHEN** an admin with one unsaved edit at Indiranagar chooses Koramangala, presses "Cancel", chooses Koramangala again, presses "Discard and switch", and later chooses Indiranagar
- **THEN** the dialog's buttons are "Cancel" then "Discard and switch"; after "Cancel" the edit and "1 unsaved change" remain and core was not asked for Koramangala; after "Discard and switch" Koramangala's stock and "No unsaved changes" are shown; back at Indiranagar, with no dialog, the field holds what core holds

#### Scenario: Escape on the dialog
- **WHEN** an admin with one unsaved edit at Indiranagar chooses Koramangala and presses Escape
- **THEN** the dialog closes, the selector shows Indiranagar, and the edit and "1 unsaved change" remain

#### Scenario: Store changed in the URL
- **WHEN** an admin with one unsaved edit at Indiranagar reaches `/stock?store=<Koramangala id>` through the URL and presses "Save changes"
- **THEN** Koramangala's stock shows what core holds, "No unsaved changes" is shown, and no `PUT` goes to Koramangala

#### Scenario: Return after a store change in the URL
- **WHEN** an admin with one unsaved edit at Indiranagar reaches Koramangala through the URL and goes Back
- **THEN** Indiranagar's field holds what core holds and "No unsaved changes" is shown

#### Scenario: Save answered after a store change
- **WHEN** an admin saves an edit of a product at Indiranagar, reaches Koramangala through the URL before core answers, types the same quantity for the same product there, and core then answers the first save
- **THEN** Koramangala's edit is still there with "1 unsaved change", and "Stock saved." is not shown

### Requirement: Failure answers without core's error body
The app's client SHALL give every caller an error for any answer with a failure status, also when the body is empty or is not core's error envelope: the caller SHALL then get code `internal` with the answer's status. A failure carrying core's envelope and every success, with or without a body, SHALL reach the caller unchanged. A 401 to the current token SHALL end the session whatever its body.

#### Scenario: Failure without core's error body
- **WHEN** a request is answered 502 with no body, with an empty body and `Content-Length: 0`, with the plain text "Bad Gateway", or with JSON that is not core's envelope
- **THEN** the caller gets no data, an error with code `internal`, and the status 502, and the session is kept

#### Scenario: Core's error passes through
- **WHEN** a request is answered 400 with core's envelope `validation` naming `lowStock`
- **THEN** the caller gets exactly that error, code, message and field, with status 400

#### Scenario: Success without a body
- **WHEN** a request is answered 204
- **THEN** the caller gets no error and the status 204

#### Scenario: 401 without core's error body
- **WHEN** a request carrying the current token is answered 401 with no body
- **THEN** the session is cleared, its loss is reported once, and the caller gets an error with code `internal` and status 401

### Requirement: Stock against core
The admin e2e suite SHALL run the stock page against the real core and the demo seed, with axe finding no violation in every state it visits: the list, the low-stock filter, an unsaved edit and the discard dialog.

#### Scenario: Admin sets stock at a store
- **WHEN** the seeded admin opens Stock, chooses Koramangala, switches "Low stock only" on and off, searches "sunny fields toned", raises Sunny Fields Toned Milk's quantity by one, chooses Indiranagar and cancels the dialog, saves and reloads
- **THEN** Indiranagar was shown first, the URL ends in `stock?store=<Koramangala id>`, every row under the filter carries "Low stock", the edited row is marked "Unsaved", "Stock saved." is shown, after the reload the field holds the new quantity at Koramangala, and the old quantity is saved back

#### Scenario: Store staff set stock at their own store only
- **WHEN** the seeded Koramangala store staff member opens Stock, then `/stock?store=<Indiranagar id>`
- **THEN** the "Stock" table is shown with "Store: Koramangala" and no "Store" selector, and after the second URL core is asked for Koramangala's stock and there is still no selector

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

#### Scenario: Product opened while cached categories fail to refresh
- **WHEN** an admin with `/products` shown opens a product from the table, the read of the categories made again fails, and core has not answered the product yet; then core answers the product
- **THEN** a loading status and no alert are shown first; then "Name" holds the product's name, "Category" its category, one refetch failure notice is shown and no alert

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

### Requirement: Staff users table
`/staff` SHALL show "Staff" as the level-1 heading and a table named "Staff users" built from `GET /admin/staff-users?pageSize=100`: one row per staff user in core's order (by email) with the name, a "You" badge on the signed-in admin's own row, the email, "Admin" or "Store staff", the store's name from `GET /admin/stores` ("All stores" for an admin, "Unknown store" when the store is not among the stores read), and an "Active" or "Inactive" badge.

#### Scenario: Staff users listed
- **WHEN** an admin opens `/staff` and core lists the admin, an inactive Indiranagar store-staff user and an active Koramangala store-staff user
- **THEN** the "Staff users" table has three rows in that order; the first shows the admin's name, "You", the email, "Admin", "All stores" and "Active"; the second "Store staff", "Indiranagar" and "Inactive"; the third "Koramangala" and "Active"; only the first row shows "You"; and the list was requested with `pageSize` 100

#### Scenario: Store not among the stores read
- **WHEN** core lists a store-staff user whose `storeId` is not in the stores core listed
- **THEN** that row shows "Unknown store" and no store's name

### Requirement: Staff users table states
`/staff` SHALL follow the panel's rule for reads. While it holds no answer to its two reads (the staff users and the stores) it SHALL show a loading status, or, when a read that holds no answer failed, the alert "Could not load the staff users." with "Try again", which makes both reads again. Once it shows the table, a later read that fails SHALL leave the table in place with no alert; the one notice is the root layout's.

#### Scenario: Staff users loading
- **WHEN** an admin opens `/staff` and core has not answered the staff users yet
- **THEN** a loading status is shown and no table; when core answers, the table is shown and the loading status is gone

#### Scenario: First load failure
- **WHEN** an admin opens `/staff` and core fails the staff users, or the stores, with 500, then answers after the admin presses "Try again"
- **THEN** the alert "Could not load the staff users." is shown with no table, then the table and no alert

#### Scenario: Failed refetch keeps the table
- **WHEN** an admin has `/staff` open with its table shown, both reads are made again and core answers 502 without a body, and then both are made once more and answered
- **THEN** the table still shows its rows and store names with no alert and exactly one status message "Could not refresh. Showing what was loaded last."; after the answers the table is shown and the message is gone

#### Scenario: Failed refetch while the stores load
- **WHEN** an admin opens `/staff`, core answers the staff users but not yet the stores, and a second read of the staff users fails
- **THEN** the loading status is still shown and no alert

### Requirement: Staff users list beyond one page
`/staff` SHALL read at most 100 staff users, the most core gives in one page, and SHALL NOT page or filter them. When core reports a `total` above the rows it sent, the page SHALL say so in a status message above the table: "Showing the first 100 of <total> staff users, by email."

#### Scenario: More than 100 staff users
- **WHEN** core answers the staff users with `total` 101
- **THEN** the status message "Showing the first 100 of 101 staff users, by email." is shown above the table

#### Scenario: Whole list shown
- **WHEN** core answers three staff users with `total` 3
- **THEN** no such message is shown

### Requirement: Staff users only for admins
`/staff` SHALL be a page for admins. A store-staff user who opens it SHALL get the app's "Page not found" inside the shell with the URL unchanged, and the page SHALL NOT ask core for the staff users.

#### Scenario: Store staff open /staff
- **WHEN** a signed-in store-staff user opens `/staff`
- **THEN** "Page not found" is the level-1 heading, the path is still `/staff`, and the only request made was `GET /admin/me`

### Requirement: Staff user create
The "New staff user" button SHALL open a dialog titled "New staff user" with "Name", "Email", "Password", "Role" ("Store staff" first, or "Admin") and, for store staff only, "Store", and the buttons "Cancel" then "Create staff user". Saving SHALL send one `POST /admin/staff-users` with the values as typed, `storeId` only for store staff with a store chosen, then close the dialog and show core's answer as a row in email order, letter case ignored as in core, without reading the list again.

#### Scenario: Create a store-staff user
- **WHEN** an admin opens the dialog, types a name, `Jaya@example.test` and a password, chooses Indiranagar and presses "Create staff user"
- **THEN** focus started in "Name" and "Role" on "Store staff"; core got `{name, email, password, role: "store_staff", storeId}`; the dialog closed; the row stands between `indiranagar@…` and `koramangala@…` with "Store staff", "Indiranagar" and "Active"; and the list was read once in all

#### Scenario: Create an admin
- **WHEN** an admin chooses the role "Admin" and presses "Create staff user"
- **THEN** the dialog showed no "Store" field, core got no `storeId`, and the new row shows "All stores"

#### Scenario: Created user changed at once
- **WHEN** an admin creates a staff user, opens its "Edit" dialog straight away and saves a changed name
- **THEN** the `PATCH` went to the id core gave on the create, and the table still has one row for that email, now with the new name

### Requirement: Staff user change
"Edit" on a row SHALL open a dialog titled "Edit <name>" that shows the email and the role as text with the note that email, role and store cannot be changed, and the fields "Name", "New password" (empty) and "Status" ("Active" or "Inactive"), with "Cancel" then "Save changes". Saving SHALL send one `PATCH /admin/staff-users/{id}` with only what differs from the row, show core's answer in the row without another read, and close; with nothing changed it SHALL close and send nothing.

#### Scenario: Change the name
- **WHEN** an admin opens "Edit" on Kiran Rao, replaces the name with ` Kiran R ` and presses "Save changes"
- **THEN** the dialog showed `koramangala@example.test, Store staff.` and the note, no "Email", "Role" or "Store" field, "Status" on "Active" and an empty "New password"; core got `{"name":" Kiran R "}` at that user's id; the row shows the name core answered, `Kiran R`; and the list was read once in all

#### Scenario: Deactivate and activate
- **WHEN** an admin sets "Status" to "Inactive" on an active user and saves, then to "Active" on an inactive user and saves
- **THEN** core got `{"isActive":false}`, then `{"isActive":true}`, and each row's badge follows core's answer

#### Scenario: Nothing changed
- **WHEN** an admin opens "Edit", moves "Status" to "Inactive" and back, and presses "Save changes"
- **THEN** the dialog closes and no `PATCH` was sent

### Requirement: Staff user changed while its dialog is open
The "Edit" dialog SHALL compare what it shows with the row as the list holds it when "Save changes" is pressed, so a background read that changed the user while the dialog was open counts, and the form SHALL keep what it shows. When the list no longer holds the row, the dialog SHALL stay on the row as it was opened and save it by its id.

#### Scenario: Row changed while the dialog is open
- **WHEN** an admin opens "Edit" on the active Kiran Rao, a background read then says Kiran Rao is inactive, and the admin presses "Save changes" with "Status" still on "Active"
- **THEN** the row showed "Inactive" while "Status" stayed on "Active"; core got `{"isActive":true}`; and the row shows "Active" from core's answer

#### Scenario: Row gone from the list while the dialog is open
- **WHEN** an admin opens "Edit" on Kiran Rao, a background read no longer holds Kiran Rao, and the admin adds ` Jr` to the name and saves
- **THEN** the dialog stayed "Edit Kiran Rao" with no "Email" field; core got `{"name":"Kiran Rao Jr"}` at Kiran Rao's id; and the row is back with `Kiran Rao Jr`

### Requirement: Staff user own account
In the dialog of the signed-in admin's own row the panel SHALL NOT offer "Status" and SHALL show "You cannot deactivate your own account."; every other row's dialog SHALL offer "Status" and not show that line. When the admin saves their own name, the banner SHALL show the saved name without another `GET /admin/me`.

#### Scenario: Own dialog
- **WHEN** the signed-in admin opens "Edit" on their own row, changes the name to `Asha A` and saves
- **THEN** the dialog had no "Status" field and showed the line; core got `{"name":"Asha A"}`; the row shows `Asha A` and "You"; the banner shows `Asha A`; and `GET /admin/me` was requested once in all

#### Scenario: Another user's dialog
- **WHEN** the admin opens "Edit" on another staff user's row
- **THEN** the dialog has the "Status" field and not the line

### Requirement: Staff user form errors
A 400 `validation` from core naming `name`, `email`, `password`, `role` or `storeId` SHALL show the page's message for that field on the field and no alert; a 409 `conflict` on `email` SHALL show "A staff user with this email already exists." on "Email". Any other failure SHALL show the alert "Could not save the staff user. Try again." in the dialog. In every case the dialog SHALL stay open with what was typed, the table SHALL stay as it was, and the next edit SHALL clear the error.

#### Scenario: Validation error on a field
- **WHEN** core answers a create with 400 `validation` on `name`, `email`, `password` or `role`
- **THEN** the field reads, in turn, "Enter 1 to 100 characters.", "Enter a valid email address.", "Enter 8 to 72 characters." or "Choose a role.", is marked invalid, and neither an alert nor core's own message is shown

#### Scenario: Store staff without a store
- **WHEN** an admin presses "Create staff user" for store staff with no store chosen and core answers 400 `validation` on `storeId`
- **THEN** core was sent no `storeId`, and "Store" reads "Choose a store." with no alert

#### Scenario: Taken email
- **WHEN** core answers a create with 409 `conflict` on `email`, and the admin then types in "Name"
- **THEN** "Email" read "A staff user with this email already exists." with no alert and the password still in its field; after the edit the message is gone

#### Scenario: Other failure
- **WHEN** core answers a create with 500, with 502 without a body, with 400 `validation` naming no field, or with 409 on another field, and the admin then types in "Name"
- **THEN** the dialog showed the alert "Could not save the staff user. Try again." with the typed name kept and three rows in the table; after the edit the alert is gone

#### Scenario: Unknown staff user on save
- **WHEN** core answers a change with 404 `not_found`
- **THEN** the dialog shows the alert and the row shows the name it had

### Requirement: Staff user save in progress
While a staff user save runs, the dialog's submit button SHALL read "Saving…" and stay focusable (`aria-disabled`, never `disabled`); a second press, Enter in a field, "Cancel" and Escape SHALL do nothing; an edit typed meanwhile SHALL NOT detach the save, whose answer still closes the dialog. With no save running, "Cancel" and Escape SHALL close the dialog without a request and return focus to the button that opened it.

#### Scenario: Second press during a save
- **WHEN** an admin presses "Create staff user" while core holds its answer, presses the button again and presses Enter in "Name", and core then answers
- **THEN** the button read "Saving…", had focus, was enabled with `aria-disabled="true"`; exactly one `POST` was sent; the dialog closed and the table has four rows

#### Scenario: Edit typed during a save
- **WHEN** an admin types in "Name" while a create is held, and core then answers
- **THEN** the button still read "Saving…", the dialog closed on the answer, one `POST` was sent, and the row shows the name that was sent

#### Scenario: Cancel and Escape
- **WHEN** an admin opens the dialog and presses "Cancel", opens it and presses Escape, then opens it, fills it, presses "Create staff user" while core holds its answer, presses Escape and "Cancel", and core then answers
- **THEN** the first two closed the dialog with no request, focus returned to "New staff user", the reopened dialog was empty; during the save the dialog stayed; after the answer it closed with one `POST` sent and the new row shown

### Requirement: Staff user passwords
The dialog's password field SHALL have `type="password"` and `autocomplete="new-password"`. A password SHALL be sent only in the `POST` or `PATCH` body, a "New password" left empty SHALL NOT be sent, and after a save no password SHALL remain in the page, in the query cache or in the mutation cache; a dialog opened again SHALL start with an empty password field.

#### Scenario: Password field on create
- **WHEN** an admin opens the "New staff user" dialog
- **THEN** "Password" has `type` `password` and `autocomplete` `new-password`

#### Scenario: New password sent alone and not kept
- **WHEN** an admin opens "Edit" on a staff user, types `newpass123` into "New password" and saves
- **THEN** the field had `type` `password` and `autocomplete` `new-password`; core got `{"password":"newpass123"}`; afterwards the mutation cache is empty, no query holds the text, the page does not show it, and the dialog opened again has an empty "New password"

### Requirement: Stock product image
The "Stock" table's first column SHALL be "Image": the product's image from the row's `imageUrl` as a 1:1 tile with an empty alternative text (the name stands next to it), and the tile's placeholder when the row has no `imageUrl`. The columns SHALL read Image, Product, Unit, Price, Quantity, Status.

#### Scenario: Product image tile
- **WHEN** an admin opens `/stock` and core lists one product with an `imageUrl` and one without
- **THEN** the column headers are Image, Product, Unit, Price, Quantity, Status; the first row's first cell holds an image with that source and an empty `alt`; the second row has no image and its first cell holds the placeholder

### Requirement: Staff users against core
The admin e2e suite SHALL run the staff page against the real core and the demo seed with one admin sign-in, and axe SHALL find no violation on the table, in the create dialog, in the edit dialog and on the not-found page. It SHALL leave the seeded staff users as they were and the one it creates inactive.

#### Scenario: Admin creates store staff who see their store only until deactivated
- **WHEN** the seeded admin opens Staff, creates a store-staff user for Indiranagar (`00000000-0000-4000-8000-000000000402`) and reloads; that user signs in in a second browser context, opens Stock and then `/staff`; the admin sets them "Inactive"; and they open `/stock`
- **THEN** the table had three "Edit" buttons, "You" and "All stores" on the admin's row and "Koramangala" on its staff's; the new row shows "Store staff", "Indiranagar", "Active" and, after the reload, the name; the new user's banner shows their name, their navigation is Dashboard, Orders, Stock, `/stock` shows "Store: Indiranagar" with no selector and `/staff` "Page not found"; after the save the row shows "Inactive" and their browser is on `/admin/sign-in?redirect=%2Fstock`

### Requirement: Product and stock against core
The admin e2e suite SHALL run Spec 2 §13's "admin creates a product and sets stock" against the real core and the demo seed as one flow across the product and stock pages, with one admin sign-in shared with the catalog flow, and SHALL delete the product afterwards so no stock row of it stays.

#### Scenario: Admin creates a product and sets its stock
- **WHEN** the seeded admin creates "E2E Curd Cup", uploads its image, opens `/stock?store=00000000-0000-4000-8000-000000000401`, searches "e2e curd cup", types 12 into its quantity, presses "Save changes", reloads, and then deletes the product
- **THEN** the selector stood on Koramangala; the search listed one row with quantity 0, "Low stock" and an image whose source is `/api/core/v1/files/products/<id>.png`, with no axe violation; "Stock saved." was shown; after the reload the field holds 12 and "Low stock" is gone; and after the delete a search for the product shows "No products found"

### Requirement: Orders board
`/orders` SHALL show one store's active orders as a column per status, in the order Placed, Accepted, Packing, Ready, Out for delivery, each headed by its name and its count. Delivered and cancelled orders SHALL NOT be on the board. Core is asked once, with `active=true` and `pageSize=100`.

#### Scenario: Board listed
- **WHEN** an admin opens `/orders` and the first store has two placed orders, one accepted, one out for delivery placed 125 minutes ago, one delivered and one cancelled
- **THEN** the columns read "Placed" 2, "Accepted" 1, "Packing" 0, "Ready" 0, "Out for delivery" 1, the placed column lists the older order first, a card reads "2 min ago", "1 item, pincode 560038" and "₹45.50", the oldest reads "2 h 5 min ago", the empty columns say "No orders", and neither finished order is shown
- **THEN** core was asked once, with `active=true` and `pageSize=100`, and no "Showing the newest" status shows

#### Scenario: Column name
- **WHEN** the board holds two placed orders and one accepted
- **THEN** the column headings are named "Placed, 2 orders", "Accepted, 1 order", "Packing, 0 orders", "Ready, 0 orders" and "Out for delivery, 0 orders", and each column is a region of that name

### Requirement: Orders board cards
A card SHALL show the order's number, the time since it was placed, its item count (the quantities added up), its total, the pincode of its address and, once a rider took the order out (`riderName`), "Rider: <name>"; the longest waiting order is first in its column.

#### Scenario: Rider on the card
- **WHEN** the board holds a ready order, an order out for delivery with `riderName` "Arjun Rao" and one out for delivery without a rider
- **THEN** the card of the second reads "Rider: Arjun Rao" and the other two cards name no rider

#### Scenario: Orders placed in the same second
- **WHEN** three placed orders carry the times `09:20:00Z`, `09:20:00.5Z` and `09:20:00.501Z`
- **THEN** their cards are in that order

### Requirement: Orders board beyond one page
When core's `total` is larger than the orders it answered, the status "Showing the newest <n> of <total> active orders." SHALL show above the columns.

#### Scenario: More active orders than one page
- **WHEN** core answers the board with one order and a `total` of 130
- **THEN** the status "Showing the newest 1 of 130 active orders." shows and the order's card is on the board

### Requirement: Orders store for admins
An admin SHALL choose the store with a "Store" selector of every store by name. The chosen store SHALL be in the URL as `store`; without it, or with a value that is no store, the first store is shown. Choosing a store SHALL keep the selector focused and SHALL never show, or announce as new, another store's orders: everything the page kept for the store before is dropped.

#### Scenario: Choose a store
- **WHEN** an admin on the board of Indiranagar chooses Koramangala and core has not answered yet
- **THEN** the URL holds `store=<Koramangala>`, a skeleton shows and no order of Indiranagar is on screen; once core answers, Koramangala's orders show, the announcement region is empty and the selector still has focus

#### Scenario: Store in the URL
- **WHEN** an admin opens `/orders?store=<Koramangala>`, then the URL changes to `store=nope`
- **THEN** Koramangala's board shows first with the selector on Koramangala, then the first store's board with the selector on it

### Requirement: Orders store for store staff
Store staff SHALL see the orders of their own store whatever the URL says, with no store selector and no request for the stores list. The page SHALL show "Store: <name>", read from the public `GET /stores/{id}`, and SHALL work without the name when that request fails.

#### Scenario: Store staff see their own store
- **WHEN** store staff of Whitefield open `/orders?store=<Koramangala>`
- **THEN** the board of Whitefield shows with "Store: Whitefield" and no "Store" selector, and core was asked only for `/admin/me`, `/stores/<Whitefield>` and `/admin/stores/<Whitefield>/orders`

#### Scenario: Store name unavailable
- **WHEN** store staff open `/orders` and `GET /stores/{id}` fails
- **THEN** the board shows without a "Store:" line and without an alert

### Requirement: Orders board polling
The board SHALL ask core again every 10 seconds and show each order where it then stands. It SHALL NOT ask while the browser tab is hidden, and SHALL ask at once when the tab is shown again.

#### Scenario: Poll
- **WHEN** the board shows a placed order, another staff member accepts it, and 10 seconds pass
- **THEN** after 9 seconds core had not been asked again, after 10 it was asked for the active orders a second time, and the card is in "Accepted" with "Placed" saying "No orders"

#### Scenario: Hidden tab
- **WHEN** the tab is hidden for 30 seconds and then shown
- **THEN** core was not asked while it was hidden and was asked once it showed

#### Scenario: Board left
- **WHEN** an admin leaves `/orders` for another page and 30 seconds pass
- **THEN** core is not asked for the active orders again

### Requirement: Orders board announcements
The board SHALL carry one visually hidden `role="status"` region named "New orders". An answer from core that holds placed orders the answer before did not SHALL set it to "New order <number>", or "<n> new orders: <numbers>". The first answer since the board was opened, an equal answer and an order first seen in another status SHALL announce nothing; an equal answer SHALL NOT write the region again; a changed answer with no new placed order SHALL empty it.

#### Scenario: New placed order announced once
- **WHEN** the board has loaded with one placed order, and the next poll brings a second placed order and an accepted one
- **THEN** the region was empty after the first load and reads exactly "New order SS-TEST0002" after the poll
- **THEN** two more polls with the same answer do not write the region again, a poll in which only a status changed empties it, and a poll with two more placed orders sets it to "2 new orders: SS-TEST0004, SS-TEST0005"

### Requirement: Orders announced only while the board is open
Orders the page kept from an earlier visit SHALL NOT be a baseline: coming back to a store, or to `/orders` from another page, SHALL announce nothing for an order placed meanwhile, also when the first refresh after coming back fails. An order placed while the browser tab was hidden SHALL be announced when the tab shows again, because the board stayed open.

#### Scenario: Back to a store
- **WHEN** an admin looks at Indiranagar, chooses Koramangala, an order is placed at Indiranagar, and the admin chooses Indiranagar again
- **THEN** the new order shows and the region is empty; an order placed after that is announced at the next poll

#### Scenario: Back to the orders page
- **WHEN** an admin leaves `/orders` for the dashboard, an order is placed, and the admin opens `/orders` again
- **THEN** the new order shows and the region is empty

#### Scenario: First refresh after coming back fails
- **WHEN** the admin comes back to `/orders` after an order was placed, core fails the first refresh and answers the next poll
- **THEN** the new order shows after the good poll and the region is empty

#### Scenario: Placed while the tab was hidden
- **WHEN** an order is placed while the tab is hidden for 30 seconds, and the tab is shown
- **THEN** the region was empty while hidden and reads "New order SS-TEST0002" once the tab shows

### Requirement: Orders time since placed
A card's time since placed SHALL move on by itself, without core being asked and without the rest of the board rendering again: "just now" under a minute, "<m> min ago" under an hour, "<h> h <m> min ago" from there.

#### Scenario: A minute passes
- **WHEN** a card reads "3 min ago" and 65 seconds pass, 9 of them before the next poll
- **THEN** core was not asked during the first 9 seconds and the card reads "4 min ago"

#### Scenario: Wording
- **WHEN** an order was placed 59, 60, 599, 3599, 3600 and 7500 seconds ago
- **THEN** its card reads "just now", "1 min ago", "9 min ago", "59 min ago", "1 h 0 min ago" and "2 h 5 min ago"

### Requirement: Orders board states
The board SHALL show a skeleton while its first answer loads; the alert "Could not load the orders." with "Try again" when it fails with nothing to show; and "No active orders" when the store has none. An admin with no stores SHALL see "No stores yet"; a stores list that fails with nothing to show SHALL show "Could not load the stores." with "Try again".

#### Scenario: Board loading
- **WHEN** core has not answered the active orders yet
- **THEN** a skeleton named "Loading" shows under the heading and the store selector, and the orders once core answers

#### Scenario: Board load failure
- **WHEN** core answers the first request for the active orders with 500 and the admin presses "Try again" after core recovers
- **THEN** the alert "Could not load the orders." shows first, then the orders and no alert

#### Scenario: One list fails on the first load
- **WHEN** core answers the one request for the active orders with 500 on the first load
- **THEN** the alert "Could not load the orders." shows and no column

#### Scenario: No active orders
- **WHEN** the store has only a delivered order
- **THEN** "No active orders" shows, with no column, and the announcement region is empty

#### Scenario: No stores
- **WHEN** an admin opens `/orders` and there is no store
- **THEN** "No stores yet" shows and core was not asked for orders

#### Scenario: Stores load failure
- **WHEN** core answers the stores list with 500 and the admin presses "Try again" after core recovers
- **THEN** the alert "Could not load the stores." shows first, then the board

### Requirement: Orders kept on a failed refresh
When core fails to answer a refresh of something the orders pages already show, the page SHALL keep showing it, never an alert in its place; the alert is for a view with nothing to show. The app's one notice "Could not refresh. Showing what was loaded last." (`role="status"`, at the root of the app) SHALL show meanwhile and go with the next good answer. The order sheet, a modal over that notice, SHALL show the same words itself. A failed refresh SHALL announce no new order.

#### Scenario: Failed poll keeps the board
- **WHEN** the board shows an order, a second order is placed, the next poll fails and the one after succeeds
- **THEN** after the failed poll the first order and its column are still shown with the notice, there is no alert, the second order is not shown and the announcement region is empty; after the good poll the second order shows, the notice is gone and the region reads "New order SS-TEST0002"

#### Scenario: One list fails on a later poll
- **WHEN** an order is accepted elsewhere and core fails the one request for the active orders at the next poll
- **THEN** every column is as it was before the poll, with the notice and no alert

#### Scenario: Failed refresh keeps the history
- **WHEN** History shows one delivered order, a second is delivered, the tab is shown again and core fails, then shown again and core answers
- **THEN** the one row and "Page 1 of 1, 1 orders" stay with the notice and no alert; then both orders are listed and the notice is gone

#### Scenario: Failed refresh keeps the sheet
- **WHEN** an order is opened from its card and core fails to answer the read of the order
- **THEN** the sheet shows the order as the card held it, with "Could not refresh. Showing what was loaded last." as a status inside the sheet, the "Cancel order" button and no alert

### Requirement: Order next status
Each card SHALL carry exactly one button for its order's next status, named with the order's number: "Accept", "Start packing", "Mark ready", "Send out", "Mark delivered". A press SHALL send one `POST /admin/orders/{id}/status` with `{"status":"<next>"}`, show the card where core's answer puts it without listing the orders again, and say "<number> is now <Status>." in a `role="status"` region.

#### Scenario: One button per card
- **WHEN** the board holds one order in each active status
- **THEN** each column's card has one next-status button, named "Accept SS-TEST0001", "Start packing SS-TEST0002", "Mark ready SS-TEST0003", "Send out SS-TEST0004" and "Mark delivered SS-TEST0005"

#### Scenario: Accept
- **WHEN** staff press "Accept SS-TEST0001" on a board with two placed orders
- **THEN** one `POST` with body `{"status":"accepted"}` was sent, "SS-TEST0001 is now Accepted." shows as a status, the card is in "Accepted" with the button "Start packing SS-TEST0001", one card is left in "Placed", and core was not asked for the lists again

### Requirement: Order status change in progress
While a status change runs, the pressed button SHALL read "Saving…", keep keyboard focus and be `aria-disabled`, never `disabled`; every other card's button SHALL be `aria-disabled` too. A second press, on that button or another card's, SHALL send nothing. After the move, a keyboard left nowhere SHALL be put on the card's new button, or on the result when the order left the board; the result SHALL be a group named "Status change".

#### Scenario: Second press during a change
- **WHEN** staff press "Accept SS-TEST0001", core has not answered, and they press it again and then "Start packing SS-TEST0002"
- **THEN** the button reads "Saving… SS-TEST0001", has focus, is not disabled and is `aria-disabled`, as is the other card's button, and one `POST` was sent in all; after core answers the other button is no longer `aria-disabled`

#### Scenario: Focus after a move
- **WHEN** staff press "Accept SS-TEST0001" and core answers
- **THEN** the button "Start packing SS-TEST0001" has focus

#### Scenario: Result named
- **WHEN** staff confirm "Mark delivered" for SS-TEST0001 and core answers
- **THEN** the keyboard is on a group named "Status change" that holds "SS-TEST0001 is now Delivered."

### Requirement: Order delivered asks first
"Mark delivered" SHALL open a `Dialog` titled "Mark <number> delivered?" with the buttons "Cancel" then "Mark delivered", because a delivered order cannot be taken back. "Cancel" SHALL send nothing and return focus to the card's button. Confirming SHALL send `{"status":"delivered"}` once; the order then leaves the board.

#### Scenario: Mark delivered
- **WHEN** staff press "Mark delivered SS-TEST0001", press "Cancel", press the card's button again and confirm
- **THEN** after "Cancel" nothing was sent and the card's button has focus; after confirming, one `POST` with `{"status":"delivered"}` was sent, "SS-TEST0001 is now Delivered." shows and has focus, the dialog is closed and the order is not on the board

### Requirement: Order status conflict
When core answers a status change with 409 `conflict`, the page SHALL read the order again with `GET /admin/orders/{id}`, show it where it now stands (off the board when it is finished) and say "<number> was changed by someone else first: it is now <Status>." in a `role="status"` region, with no alert. Nothing SHALL be sent again.

#### Scenario: Accepted by someone else
- **WHEN** another staff member accepted SS-TEST0001 since the last poll and staff press "Accept SS-TEST0001"
- **THEN** one `POST` and one `GET` of the order were sent, the message names "Accepted", and the card is in "Accepted" with "Start packing SS-TEST0001"

#### Scenario: Cancelled by the customer
- **WHEN** the customer cancelled SS-TEST0002 since the last poll and staff press "Accept SS-TEST0002"
- **THEN** the message reads "SS-TEST0002 was changed by someone else first: it is now Cancelled.", the order is off the board and there is no alert

### Requirement: Order status failure
Any other failure of a status change, and a 409 whose order cannot be read again, SHALL show the alert "Could not change the status of <number>. Try again." and leave the card where it is, with focus on its button. The next successful change SHALL remove the alert.

#### Scenario: Status change fails
- **WHEN** core answers "Accept SS-TEST0001" with 500, then with 200 when pressed again
- **THEN** the alert shows with the card still in "Placed" and its button focused; after the second press "SS-TEST0001 is now Accepted." shows with no alert, and two `POST`s were sent in all

#### Scenario: Conflict that cannot be read
- **WHEN** core answers the change with 409 and the read of the order with 500
- **THEN** the alert shows and no "is now" message

### Requirement: Order status change and a poll in the air
A poll that core read before a status change and answers after it SHALL NOT move the card back: the page shows core's answer to the change, drops the poll still in the air, and polls again 10 seconds later.

#### Scenario: Late poll answer
- **WHEN** a poll is in the air holding the order as placed, staff press "Accept", core answers the change, and then the poll's answer arrives
- **THEN** the card is in "Accepted" and stays there, "Placed" says "No orders", and core is asked the lists again at the next interval

### Requirement: Order detail sheet
A card's number, and a History row's, SHALL be a button that opens a `Sheet` titled "Order <number>" with the status badge, when it was placed, the items with quantity, unit and line total, subtotal, delivery fee and total, the customer's name and phone as a `tel:` link (or "No phone number"), and the address. Closing it SHALL return focus to the button.

#### Scenario: Order opened from its card
- **WHEN** staff press "SS-TEST0001" on its card
- **THEN** the sheet shows "Placed 13 Oct 2026, 2:50 pm", "1 × Banana Robusta, 1 kg" ₹70, "3 × Pomegranate Bhagwa, 1 kg" ₹960, subtotal ₹1,030, delivery fee ₹0, "Total, cash on delivery" ₹1,030, "Demo Customer", the link "+919800000000" to `tel:+919800000000`, "Home: 12 80 Feet Rd, Koramangala, 560034" and "Placed by the customer, 13 Oct 2026, 2:50 pm"

#### Scenario: Sheet closed
- **WHEN** staff press "Close" on the sheet
- **THEN** no dialog is open and the card's "SS-TEST0001" button has focus

### Requirement: Order sheet rider and events
The sheet SHALL show "Rider: <name>" once a rider took the order out, and the events oldest first with who made them (the rider's name for an event a rider made, otherwise the customer, staff or the system), when, and their note.

#### Scenario: Rider and rider events
- **WHEN** staff open from History a delivered order with `riderName` "Arjun Rao" whose out-for-delivery and delivered events carry `actorType` `rider` and `actorName` "Arjun Rao"
- **THEN** the sheet shows "Rider: Arjun Rao" and the events read "Placed by the customer, …", "Accepted by staff, …", "Out for delivery by Arjun Rao, 13 Oct 2026, 2:55 pm" and "Delivered by Arjun Rao, 13 Oct 2026, 3:01 pm"

### Requirement: Order sheet follows core
The sheet SHALL show the opened order at once as the card or row held it, read it from `GET /admin/orders/{id}`, and show what core answers. While the order is active the sheet SHALL read it again every 10 seconds; a delivered or cancelled order is read once and not again.

#### Scenario: Order changed since the last poll
- **WHEN** another staff member accepted the order with the note "Packing now" since the board's last poll, the customer has no phone and the address has a second line, and staff open the order
- **THEN** the sheet shows "Accepted by staff, 13 Oct 2026, 2:51 pm: Packing now", "Home: 12 80 Feet Rd, Koramangala, Flat 4, 560034" and "No phone number", with no link

#### Scenario: Open sheet polled
- **WHEN** a sheet is open on a placed order and the order moves to packing at the store
- **THEN** after 10 seconds the order was read a second time, the sheet shows "Packing" and no "Cancel order" button

#### Scenario: Finished order not polled
- **WHEN** staff open a cancelled order from History and 30 seconds pass
- **THEN** the order was read once and the list was not asked again

### Requirement: Order cancel with a reason
The sheet SHALL offer "Cancel order" only while the order is placed or accepted. It SHALL open a `Dialog` "Cancel order <number>?" with a "Reason" field of at most 500 characters and the buttons "Keep order" then "Cancel order". A reason is required. Confirming SHALL send one `POST` with `{"status":"cancelled","note":"<reason, trimmed>"}`; the dialog closes, the sheet shows "Order cancelled." and the order cancelled with its reason, and the order leaves the board.

#### Scenario: Cancel offered
- **WHEN** staff open a placed, an accepted and a packing order in turn
- **THEN** the first two sheets have a "Cancel order" button and the third has none

#### Scenario: Order cancelled
- **WHEN** staff open SS-TEST0001, press "Cancel order", type " Out of stock " and confirm
- **THEN** one `POST` with `{"status":"cancelled","note":"Out of stock"}` was sent, the sheet is the only dialog, the group "Cancel result" has focus, the sheet shows "Order cancelled." as a status, "Cancelled", "Reason for cancelling: Out of stock" and the event with its note, and has no "Cancel order" button; after closing, the order is off the board and the other order is still on it

#### Scenario: Reason missing
- **WHEN** staff confirm with a reason of spaces only, then type a letter
- **THEN** the sheet "Order SS-TEST0001" is still open under the dialog, nothing was sent and the field is invalid with "Enter a reason."; after the letter the message is gone and the field is valid

### Requirement: Order cancel dialog over the sheet
The cancel dialog SHALL open over the sheet, which stays open under it. "Keep order" and Escape SHALL close only the dialog and put the keyboard back on the sheet's "Cancel order". After a confirmed cancel the keyboard SHALL be on the result, a group "Cancel result" in the sheet.

#### Scenario: Keep order
- **WHEN** staff open the cancel dialog and press "Keep order", then open it again and press Escape
- **THEN** both times the sheet "Order SS-TEST0001" is the only dialog, its "Cancel order" button has focus, and nothing was sent

### Requirement: Order cancel in progress and refused
While a cancel runs its button SHALL read "Cancelling…", keep focus and be `aria-disabled`, never `disabled`; a second press sends nothing and the dialog cannot be closed. A failure SHALL show "Could not cancel the order. Try again." in the dialog and keep the reason. A 409 SHALL close the dialog and show on the sheet "Someone else changed this order first: it is now <Status>.", with the order where it stands on the sheet and on the board.

#### Scenario: Second press during a cancel
- **WHEN** staff confirm a cancel, core has not answered, and they press the button again, then "Keep order", then Escape
- **THEN** the button reads "Cancelling…", has focus, is not disabled and is `aria-disabled`, the cancel dialog is still open and one `POST` was sent; once core answers "Order cancelled." shows

#### Scenario: Cancel fails
- **WHEN** core answers the cancel with 500, then with 200 when confirmed again
- **THEN** the alert shows in the dialog with the reason still in the field; after the second press "Order cancelled." shows with no alert, and two `POST`s were sent

#### Scenario: Cancel refused once packing
- **WHEN** packing started on an accepted order while its cancel dialog was open, and staff confirm
- **THEN** the sheet shows "Someone else changed this order first: it is now Packing." as a status, no "Cancel order" button and no "Order cancelled."; after closing, the card has the button "Mark ready SS-TEST0001"

### Requirement: Order cancel and a poll in the air
A poll that core read before a cancel and answers after it SHALL NOT put the order back on the board.

#### Scenario: Late poll answer after a cancel
- **WHEN** a poll is in the air holding the order as placed, staff cancel it, core answers the cancel, and then the poll's answer arrives
- **THEN** the sheet shows "Order cancelled." and, after closing it, the order is not on the board while the other order is

### Requirement: Order status badges
A status badge SHALL carry the status as text, with the names Placed, Accepted, Packing, Ready, Out for delivery, Delivered and Cancelled, and SHALL be the `accent` badge while the order is under way, `success` when delivered and `neutral` when cancelled; never `danger` or `warning` (D28).

#### Scenario: Badge of an order under way and of a cancelled one
- **WHEN** staff open a placed order, and cancel it
- **THEN** the badge reads "Placed" on the accent surface, then "Cancelled" on the neutral surface

### Requirement: Orders history
`/orders` SHALL have the tabs "Board" and "History", the current one marked `aria-current="page"` and held in the URL (`tab=history`), with the store kept. History SHALL list one page of 24 finished orders of the store, newest first, in a table "Order history": number, placed, customer, items, total, and when it was delivered or cancelled. "Delivered" and "Cancelled" SHALL choose which, in the URL (`status=cancelled`), from page 1.

#### Scenario: Delivered orders listed
- **WHEN** an admin opens `/orders?tab=history` and the store has two delivered orders, a cancelled and a placed one
- **THEN** the table lists the two delivered orders, newest first, a row reading "SS-TEST0001", "13 Oct 2026, 2:31 pm", "Demo Customer", "4 items", "₹1,030", "13 Oct 2026, 3:31 pm" under the last heading "Delivered", with "Page 1 of 1, 2 orders", "Delivered" pressed and "History" the current tab; core was asked once, with `status=delivered`, `page=1`, `pageSize=24`

#### Scenario: Tabs
- **WHEN** an admin on `/orders?store=<Koramangala>` presses "History", then "Board", then goes Back
- **THEN** the URL holds `store` and `tab=history` and the history shows with no board column; then the board with `store` alone; then the history again with "History" current

#### Scenario: Cancelled orders
- **WHEN** an admin on page 2 of the delivered orders presses "Cancelled" and core has not answered yet
- **THEN** a skeleton shows with no table and the pressed button keeps focus; once core answers the one cancelled order shows under the heading "Cancelled" with when it was cancelled, the URL holds `tab=history&status=cancelled` and core was asked once more, for page 1; "Delivered" brings back page 1 of the delivered orders and removes `status` from the URL

#### Scenario: No finished orders
- **WHEN** the store has no cancelled order and the admin opens the cancelled list
- **THEN** "No cancelled orders" shows with no table and no pager

#### Scenario: History loading and load failure
- **WHEN** core has not answered the list, then answers 500, and the admin presses "Try again" after core recovers
- **THEN** a skeleton shows under the status buttons, then the alert "Could not load the orders.", then the table and no alert

### Requirement: Orders history pager
History SHALL have a pager: "Previous", "Page <x> of <y>, <n> orders" and "Next", the page in the URL. The button at an end SHALL be `aria-disabled`, never `disabled`, and do nothing. While the next page loads, the rows on screen SHALL stay in an `aria-busy` container under the page number core answered for them, and the pressed button keeps focus.

#### Scenario: Pager
- **WHEN** an admin on page 1 of 30 delivered orders presses "Previous", then "Next" while core holds its answer
- **THEN** "Previous" was `aria-disabled` and asked core nothing; while page 2 loads the table is `aria-busy` and still reads "Page 1 of 2, 30 orders" with its own rows; then page 2 shows six orders, not busy, "Next" has focus, is `aria-disabled` and not disabled, the URL holds `page=2`, "History" is still the current tab, and another press of "Next" asks core nothing

### Requirement: Orders URL values
The page SHALL read only what it can use from the URL and never ask core for what core would refuse: a `tab` other than `history` is the board; a `status` other than `cancelled` is the delivered list; a `page` that is not a whole number above 1 is page 1; a `page` above 100000 is cut to 100000. A page past the end SHALL move to the last page that has rows, and SHALL show a skeleton, never the empty state, until that page answers.

#### Scenario: Unreadable values
- **WHEN** the URL holds `tab=archive`; `tab=history&status=placed`; `tab=history&page=banana`, `page=0` or `page=1.5`
- **THEN** the board shows with "Board" current; in every other case the delivered orders show and core was asked for `status=delivered`, `page=1`

#### Scenario: Over-large page
- **WHEN** an admin opens `/orders?tab=history&page=2147483648` at a store with 30 delivered orders
- **THEN** core was asked for page 100000 and then page 2, "Page 2 of 2, 30 orders" shows and the URL holds `page=2`

#### Scenario: Page past the end
- **WHEN** an admin opens `/orders?tab=history&page=9` at a store with 30 delivered orders, core answers page 9 with no rows and has not answered page 2 yet
- **THEN** a skeleton shows with no table and no "No delivered orders"; once core answers, "Page 2 of 2, 30 orders" shows and the URL holds `page=2`

### Requirement: Orders history and the store
Choosing a store on History SHALL keep the tab, start at page 1 with one request, and never show the other store's rows. A history list kept from before a status change SHALL be read again on the next visit and SHALL NOT be shown meanwhile as it was.

#### Scenario: Store chosen on History
- **WHEN** an admin on page 2 of Indiranagar's history chooses Koramangala and core has not answered yet
- **THEN** a skeleton shows with no table; once core answers Koramangala's one order shows with "Page 1 of 1, 1 orders", the URL holds `store` and `tab=history` only, and Koramangala was asked once, for page 1

#### Scenario: History after a delivery
- **WHEN** an admin sees "No delivered orders" on History, marks an order delivered on the board and opens History again before core answers
- **THEN** a skeleton shows and "No delivered orders" does not; once core answers the delivered order is listed

### Requirement: Dashboard
`/` SHALL show a card per store that `GET /admin/dashboard` answers, in core's order (every store by name for an admin, their own for store staff), named by the store: "Orders today" with their sum and a line per status, "Revenue today" and "Low stock" as a count of products. Each card SHALL link "Orders" to `/orders?store=<id>` and "Low stock" to `/stock?store=<id>&lowStock=true`, each link named with the store.

#### Scenario: Dashboard cards
- **WHEN** an admin opens `/` and core answers Indiranagar (no orders, 1 product low) and Koramangala (1, 2, 3, 4, 5, 6, 7 by status, 20 low, revenue 618050)
- **THEN** the cards are headed "Indiranagar" then "Koramangala"; Koramangala reads "Orders today" 28, the seven statuses with their counts, "Revenue today" ₹6,180.50 and "Low stock" "20 products"; Indiranagar reads ₹0 and "1 product"; core was asked for `/admin/me` and `/admin/dashboard` only

#### Scenario: Dashboard links
- **WHEN** an admin presses "Low stock at Koramangala"
- **THEN** the link pointed to `/stock?store=<Koramangala>&lowStock=true`, "Orders at Koramangala" to `/orders?store=<Koramangala>`, and `/stock` opens with `store` and `lowStock` true in the URL

#### Scenario: Store staff dashboard
- **WHEN** store staff open `/` and core answers their one store
- **THEN** one card shows, and its "Low stock" link holds their store

### Requirement: Dashboard store open or closed
Each dashboard card SHALL show the badge "Open" (`success`) or "Closed" (`neutral`) from the store's `isOpen`.

#### Scenario: Open or closed
- **WHEN** core answers Indiranagar with `isOpen` false and Koramangala with `isOpen` true
- **THEN** the Indiranagar card shows "Closed" on the neutral surface and the Koramangala card shows "Open" on the success surface and no "Closed"

### Requirement: Dashboard states
The dashboard SHALL show a skeleton while its first answer loads; the alert "Could not load the dashboard." with "Try again" when it fails with nothing to show; "No stores yet" when core answers no store. A refresh that fails SHALL keep the cards, with the app's notice "Could not refresh. Showing what was loaded last." and no alert, until the next good answer.

#### Scenario: Dashboard loading
- **WHEN** core has not answered yet
- **THEN** the heading "Dashboard" and a skeleton named "Loading" show, and the card once core answers

#### Scenario: Dashboard load failure
- **WHEN** core answers 500 and the admin presses "Try again" after core recovers
- **THEN** the alert shows first, then the card and no alert

#### Scenario: Failed refresh keeps the dashboard
- **WHEN** the dashboard shows a card, the tab is shown again and core fails, then shown again and core answers one more placed order
- **THEN** the card stays with "Orders today" 28, the notice and no alert; then the card reads 29 and the notice is gone

#### Scenario: No stores on the dashboard
- **WHEN** core answers an empty list
- **THEN** "No stores yet" shows and no card

### Requirement: Orders against core
The admin e2e suite SHALL cover the orders pages and the dashboard against the real core and the demo seed, reset before every run, with axe on every page, sheet and dialog it visits.

#### Scenario: Store staff take the placed order to delivered
- **WHEN** the seeded Koramangala store staff sign in, open Orders, open SS-DEMOAAAD and its cancel dialog without cancelling, press "Accept", "Start packing", "Mark ready", "Send out" and "Mark delivered" with its confirmation, and open History
- **THEN** "Store: Koramangala" shows with no selector; the card read "4 items, pincode 560034" and ₹1,030; the sheet showed the customer, phone, address and items; after each press the status message named the new status and the card stood in that column; after the last the card is gone; History lists SS-DEMOAAAD and SS-DEMOAAAB, the sheet of SS-DEMOAAAD shows "Delivered by staff" and no cancel, "Cancelled" lists SS-DEMOAAAC alone, also after a reload; axe finds no violation anywhere

#### Scenario: Admin sees the dashboard and a store's orders
- **WHEN** the seeded admin signs in, presses "Orders at Koramangala", opens History and opens SS-DEMOAAAB
- **THEN** the dashboard headed its cards "Indiranagar" and "Koramangala", the Koramangala card showed "Open", its "Low stock" link pointed to `/admin/stock?store=<Koramangala>&lowStock=true`, the orders page opened with the selector on Koramangala and "Board" current, History lists SS-DEMOAAAB, its sheet shows "Rider: Arjun Rao" and "Delivered by Arjun Rao", and axe finds no violation

### Requirement: Ordered product against core
The admin e2e suite SHALL cover, against the real core and the demo seed, that deleting a product that was ordered offers to deactivate it instead. The offer is not taken, so the product stays active for the other suites.

#### Scenario: Ordered product offers Deactivate instead
- **WHEN** the seeded admin opens Banana Robusta (`…0601`, on the seeded orders), presses "Delete product" and "Delete", then "Cancel", and reloads
- **THEN** the dialog showed the alert "This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it." with the buttons "Cancel" then "Deactivate instead" and no axe violation, and the product's page still opens
