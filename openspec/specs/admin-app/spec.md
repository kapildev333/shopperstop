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
