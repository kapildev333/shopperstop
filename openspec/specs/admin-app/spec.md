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
The app SHALL call the core service only through one shared client whose base URL is the page's own origin followed by `/api/core/v1`, so every call is same-origin; the dev server SHALL proxy `/api` to `http://localhost:8080` and the preview server SHALL proxy `/api` to `http://localhost:18080`.

#### Scenario: Preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15174/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Client calls the page's origin
- **WHEN** the shared client sends `GET /admin/me` from a page served at origin `O`
- **THEN** the request URL is `O/api/core/v1/admin/me`

### Requirement: End-to-end suite with axe
`npm run e2e` in `apps/admin` SHALL run Playwright on Chromium only, starting core from `services/core` with the environment it is given and `vite preview` on port 15174, SHALL run `core-admin migrate` and `core-admin seed-demo --reset` from `services/core` with that environment before any test, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the admin suite
- **THEN** the sign-in page, the Dashboard, the not-found page and the sign-in page after sign-out are each visited and axe reports no violations on any of them

#### Scenario: Suite seeds its own data
- **WHEN** `npm run e2e --workspace apps/admin` runs against an e2e database that has never been seeded, with the `make e2e` environment exported
- **THEN** the seeded admin can sign in during the suite

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
The "Admin" navigation SHALL show only the sections the signed-in role can reach, in this order: for `admin`, Dashboard, Orders, Stock, Stores, Categories, Products, Staff; for `store_staff`, Dashboard, Orders, Stock.

#### Scenario: Admin sees every section
- **WHEN** an admin with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Stores, Categories, Products, Staff in that order

#### Scenario: Store staff see their sections
- **WHEN** a store staff member with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock in that order

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
`/stores` SHALL show "Stores" as the level-1 heading with a "New store" link to `/stores/new`, and a table named "Stores" built from `GET /admin/stores?pageSize=100`: one row per store in core's order (by name) with the name linking to `/stores/{id}`, the store's pincode, an "Open" or "Closed" badge, the delivery fee, free-delivery threshold and minimum order in rupees, and the promised minutes.

#### Scenario: Stores listed
- **WHEN** an admin opens `/stores` and core lists Indiranagar (closed) and Koramangala (open, pincode `560034`, fee 2500, free above 19900, minimum 9900, 10 minutes)
- **THEN** the "Stores" table's links are Indiranagar then Koramangala, Koramangala's link points to `/stores/<its id>`, its row shows `560034`, "Open", ₹25, ₹199, ₹99 and "10 min", Indiranagar's row shows "Closed", and the list was requested with `pageSize` 100

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
`/stores/new` SHALL show "New store" as the level-1 heading and the store form: "Name", "Address", "Pincode", "Delivery fee (₹)", "Free delivery above (₹)", "Minimum order (₹)", "Promised minutes" and "Status" (Open or Closed), amounts starting at 0 and status at Closed. Amounts SHALL be typed in rupees with at most two decimals and sent as integer paise. "Create store" SHALL send `POST /admin/stores` with every field and on success open the new store's page.

#### Scenario: Create a store
- **WHEN** an admin on `/stores/new` enters name "HSR Layout", address "27th Main, HSR Layout", pincode `560102`, delivery fee `25`, free delivery above `199.50`, promised minutes `12`, leaves the rest, and presses "Create store", and core answers 201 with the new store
- **THEN** the status started at Closed, the request body is `{"name":"HSR Layout","addressLine":"27th Main, HSR Layout","pincode":"560102","isOpen":false,"deliveryFeeCents":2500,"freeDeliveryAboveCents":19950,"minOrderCents":0,"promisedMinutes":12}` and the new store's page opens at `/stores/<new id>`

### Requirement: Store change
`/stores/{id}` SHALL show the store's name as the level-1 heading and the store form filled from `GET /admin/stores/{id}`, amounts in rupees. "Save changes" SHALL send `PATCH /admin/stores/{id}` with only the fields whose value differs from the loaded store, never `null`, and on success show "Store saved.", keep the saved values as the base of the next change, and show them in the stores table. An id core answers with 404 SHALL show the not-found page.

#### Scenario: Change sends only the changed fields
- **WHEN** an admin on Koramangala's page (fee 2500, free above 19900) sees "Delivery fee (₹)" `25` and "Free delivery above (₹)" `199`, sets "Promised minutes" to `11` and "Status" to Closed, and presses "Save changes"
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

### Requirement: Store form errors
An amount or a number of minutes the store form cannot convert SHALL be flagged on its field without a request. A core `validation` error naming a form field SHALL be shown on that field with the form's own message for it (core's messages speak in paise and JSON names); any other failure SHALL show the alert "Could not save the store. Try again.".

#### Scenario: Value the form cannot send
- **WHEN** an admin sets "Delivery fee (₹)" to `-1`, clears "Promised minutes" and presses "Save changes"
- **THEN** "Delivery fee (₹)" is described by "Enter 0 to 100000 rupees, at most two decimals.", "Promised minutes" by "Enter 1 to 240 minutes.", and no `PATCH` was sent

#### Scenario: Field error from core
- **WHEN** core answers the save with 400 `validation` and field `name`
- **THEN** the "Name" field is described by "Enter 1 to 100 characters." and there is no alert

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
