# rider-app Specification

## Purpose
The rider app (`apps/rider`, served under `/rider/`, phone-first): a rider signs in with the rider service, sees their store's ready orders, picks one up, follows the delivery page (customer, address, call link, items, cash to collect), reports their position while on the way, marks the delivery delivered and reads their history. It composes `@shopperstop/ui` only and talks to the rider service and core through same-origin proxies; its Playwright suite also drives the Phase 3 cross-app flow across the web, admin and rider previews.

## Requirements

### Requirement: Rider shell
Every rider page SHALL render inside a banner holding the brand band with the "ShopperStop Rider" wordmark and a main region holding the page, whose title SHALL be the only level-1 heading. While a rider is signed in, the banner SHALL also show the rider's name, a "Sign out" button and a navigation landmark "Rider" with the links "Pick up" (`/`) and "History" (`/history`), the current one carrying `aria-current="page"`.

#### Scenario: Pick up page in the shell
- **WHEN** a rider with a valid session opens `/`
- **THEN** the banner holds "ShopperStop Rider", the rider's name and "Sign out", the "Rider" navigation's "Pick up" link carries `aria-current="page"` and "History" does not, and "Ready to pick up" is the only level-1 heading

#### Scenario: History marked on its page
- **WHEN** a rider with a valid session opens `/history`
- **THEN** the "History" link carries `aria-current="page"` and the "Pick up" link does not

### Requirement: Store name in the banner
While a rider is signed in, the banner SHALL show the name of the rider's store, read from core's public `GET /api/core/v1/stores/{storeId}` with no token. While that read is pending or after it failed, the banner SHALL show no store name and every page SHALL work as usual.

#### Scenario: Store name shown
- **WHEN** a rider of store `...0401` signs in and core answers that store as "Koramangala"
- **THEN** the banner shows "Koramangala", and the store request carried no `Authorization` header

#### Scenario: Store read fails
- **WHEN** core answers the store read with 500
- **THEN** the banner shows no store name, the rider's name and "Sign out" are shown, and the page's level-1 heading renders

### Requirement: Rider unknown paths show not found
A path no route matches SHALL render "Page not found" as the level-1 heading inside the shell with a "Go to Pick up" link to `/`, never a blank page or the router's default text, signed in or not, and without a redirect.

#### Scenario: Unknown path signed out
- **WHEN** a visitor with no session opens `/nope`
- **THEN** the banner is present, "Page not found" is the level-1 heading, there is no "Rider" navigation and no request was sent

### Requirement: Served under /rider/
The built app SHALL be served under the `/rider/` path prefix, with its asset URLs and router paths under that prefix, so one build works behind `vite preview` on port 15175 and behind Caddy's `/rider/*` route; the dev server SHALL listen on port 5175.

#### Scenario: Built app opens under the prefix
- **WHEN** a browser with no session opens `http://localhost:15175/rider/` on the preview of the built app
- **THEN** it lands on `/rider/sign-in?redirect=%2F` with the page's styles applied, and after signing in the "Pick up" link points to `/rider/`

### Requirement: Rider and core reached through same-origin proxies
The app SHALL call the rider service through one client whose base URL is the page's origin followed by `/api/rider/v1`, and core through one client with base `/api/core/v1` on the same origin. The dev server SHALL proxy `/api/core` to `http://localhost:8080` and `/api/rider` to `http://localhost:8081`; the preview server SHALL proxy them to ports 18080 and 18081.

#### Scenario: Preview proxies both services
- **WHEN** core runs on 18080 and the rider service on 18081, and a client requests `http://localhost:15175/api/core/v1/healthz` and `http://localhost:15175/api/rider/v1/healthz`
- **THEN** both answers are 200 with body `{"status":"ok"}`

#### Scenario: Clients call the page's origin
- **WHEN** the rider client sends `GET /me` and the core client sends `GET /stores/{id}` from a page served at origin `O`
- **THEN** the request URLs are `O/api/rider/v1/me` and `O/api/core/v1/stores/{id}`

### Requirement: Rider sign-in
The app SHALL serve `/sign-in` without a session, with "Sign in" as the level-1 heading, labelled "Email" (type `email`) and "Password" (type `password`) fields and a "Sign in" button. It SHALL send no request while a field is empty ("Enter your email.", "Enter your password."), keep the button disabled while `POST /auth/sign-in` is pending, and on success store the token and open the `redirect` path if it is an in-app path, else `/`.

#### Scenario: Empty fields are flagged
- **WHEN** the visitor submits the form with both fields empty
- **THEN** "Email" is described by "Enter your email.", "Password" by "Enter your password.", and no request is sent

#### Scenario: Submit disabled while pending
- **WHEN** the visitor submits valid fields and the rider service has not answered yet
- **THEN** the "Sign in" button is disabled, and it is enabled again once the service answers with an error

#### Scenario: Return to the page after sign-in
- **WHEN** the visitor signs in at `/sign-in?redirect=%2Fhistory`
- **THEN** History opens at `/history`, the token is stored under `shopperstop:rider-token`, and no extra `GET /me` is sent

#### Scenario: Outside redirect ignored
- **WHEN** the visitor signs in at `/sign-in?redirect=%2F%2Fevil.example` or `/sign-in?redirect=%2F%5Cevil.example`
- **THEN** the Pick up page opens at `/`

### Requirement: Rider sign-in errors
A failed sign-in SHALL keep the visitor on `/sign-in` with no token stored and show an alert: "Email or password is wrong, or the account is inactive." for `unauthorized`, "Too many sign-in attempts. Try again later." for `rate_limited`, "Could not reach the server. Check your connection and try again." for a request with no answer, and "Something went wrong. Try again." otherwise; a `validation` error on `email` or `password` SHALL show on that field instead.

#### Scenario: Wrong credentials or inactive rider
- **WHEN** the rider service answers the sign-in with 401 `unauthorized`
- **THEN** the alert "Email or password is wrong, or the account is inactive." shows and no token is stored

#### Scenario: Rate limited
- **WHEN** the rider service answers 429 `rate_limited`
- **THEN** the alert "Too many sign-in attempts. Try again later." shows

#### Scenario: Service unreachable or failing
- **WHEN** the sign-in request gets no answer, and then a second one is answered 502 with an empty body
- **THEN** the first shows "Could not reach the server. Check your connection and try again." and the second "Something went wrong. Try again."

#### Scenario: Field validation from the service
- **WHEN** the service answers 400 `validation` with field `email` and message "must be a valid email address"
- **THEN** the "Email" field is described by "must be a valid email address"

### Requirement: Rider session
The app SHALL keep the rider token in memory and in `localStorage` under `shopperstop:rider-token` (memory only when storage is blocked), SHALL send it as `Authorization: Bearer <token>` on every rider service request and never on a core request, and on load with a stored token SHALL restore the rider with `GET /me` before showing a protected page.

#### Scenario: Token survives a reload
- **WHEN** the app starts with `shopperstop:rider-token` set to `t2`
- **THEN** the app's token is `t2` and the next rider service request carries `Authorization: Bearer t2`

#### Scenario: Blocked storage keeps the token in memory
- **WHEN** `localStorage` throws on every access and a session is stored with token `t4`
- **THEN** nothing throws and the app's token is `t4` until it is cleared

#### Scenario: Core never gets the rider token
- **WHEN** the core client sends a request while token `tok` is stored
- **THEN** the request has no `Authorization` header

### Requirement: Rider lost session
When a rider service request that carried the current token is answered 401, the app SHALL remove the token from memory and storage and show `/sign-in?redirect=<current path>`; a 401 to a request without a token or with a token since replaced SHALL change nothing. When `GET /me` fails otherwise, the app SHALL keep the token and show the alert "Could not reach the server." with a "Try again" button.

#### Scenario: Expired session on load
- **WHEN** the app opens `/history` with a stored token and the service answers `GET /me` with 401
- **THEN** the sign-in page shows with `redirect` `/history` and the token is gone

#### Scenario: 401 mid-session returns to sign-in
- **WHEN** a signed-in rider opens `/history`, `GET /me` succeeds and the service answers the history read with 401
- **THEN** the sign-in page shows with `redirect` `/history` and the token is gone from memory and storage

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** a request sent with token `old` is answered 401 after token `new` was stored meanwhile
- **THEN** the token is still `new` in memory and storage

#### Scenario: Service unreachable on load
- **WHEN** the app opens `/` with a stored token and the service answers `GET /me` with 502
- **THEN** the alert "Could not reach the server." shows with a "Try again" button and the token is kept

### Requirement: Rider protected routes
Every route except `/sign-in` and the not-found page SHALL require a session. Without a stored token the app SHALL send no request and show `/sign-in?redirect=<path>`, where `<path>` is the requested path inside the app.

#### Scenario: Signed-out deep link
- **WHEN** a visitor with no session opens `/deliveries/00000000-0000-4000-8000-000000000901`
- **THEN** the sign-in page shows with `redirect` `/deliveries/00000000-0000-4000-8000-000000000901` and no request was sent

### Requirement: Rider sign-out
The "Sign out" button SHALL send `POST /auth/sign-out` with the token, then, whatever the service answers, remove the token from memory and storage, drop every cached answer and show `/sign-in` without navigation.

#### Scenario: Sign out ends the session
- **WHEN** a signed-in rider presses "Sign out"
- **THEN** `POST /auth/sign-out` was sent with the bearer token, the sign-in page shows, `shopperstop:rider-token` is gone, no cached answer remains and there is no "Rider" navigation

### Requirement: Ready orders list
`/` SHALL show "Ready to pick up" as the level-1 heading and a list named "Ready orders" with `aria-live="polite"`, one card per order from `GET /me/ready-orders` in the service's order, each showing the number in `tabular-nums`, the time since it was placed ("12 min ago"), the item count ("3 items"), the total in rupees and the pincode. The list SHALL be read again every 10 seconds while the page is open.

#### Scenario: Ready orders listed
- **WHEN** the service answers two ready orders, `SS-AAAA0001` placed 12 minutes ago with 3 items, ₹339 and pincode `560034`, then `SS-AAAA0002`
- **THEN** the "Ready orders" list has `aria-live="polite"` and two cards in that order, the first showing `SS-AAAA0001`, "12 min ago", "3 items", ₹339 and `560034`

#### Scenario: New order appears without a reload
- **WHEN** the page shows one ready order and the service lists a second one at the next read
- **THEN** 10 seconds later the second card is in the list without any user action

### Requirement: Cash orders marked on the ready list
A ready card whose `paymentMethod` is `cod` SHALL show a neutral badge "Cash" beside the total, and no other card SHALL.

#### Scenario: Cash orders marked
- **WHEN** the service answers a `cod` ready order and then an `online` ready order whose `paymentStatus` is `paid`
- **THEN** the first card shows "Cash" and the second does not

### Requirement: Ready orders states
While the first read is pending `/` SHALL show a skeleton; with no ready orders it SHALL show "No orders ready" with "New orders show here as the store packs them."; when the read fails with no cards shown it SHALL show "Could not load ready orders." with "Try again"; when a later read fails it SHALL keep the cards shown.

#### Scenario: No ready orders
- **WHEN** the service answers `{"items": []}`
- **THEN** "No orders ready" and "New orders show here as the store packs them." show

#### Scenario: Read fails
- **WHEN** the service answers 502 to the first read
- **THEN** "Could not load ready orders." shows with a "Try again" button, and pressing it reads the list again

### Requirement: The rider's assigned deliveries
`/` SHALL show, above the ready orders, a section "Your deliveries" with one link per delivery from `GET /me/deliveries?status=assigned`, named by the order number and customer name and leading to `/deliveries/{id}`. With no assigned delivery the section SHALL not be shown.

#### Scenario: Assigned delivery linked
- **WHEN** the rider has one assigned delivery for `SS-AAAA0003` to "Ravi Kumar"
- **THEN** the "Your deliveries" section holds a link "SS-AAAA0003 Ravi Kumar" to `/deliveries/<its id>`

#### Scenario: None assigned
- **WHEN** the rider has no assigned delivery
- **THEN** there is no "Your deliveries" section

### Requirement: Pick up with confirmation
Each ready card SHALL have a "Pick up" button named "Pick up <number>" that opens a dialog "Pick up <number>?" with "Cancel" first and "Pick up". Confirming SHALL send `POST /me/deliveries {orderId}` once, with the confirm button disabled while pending, and on 201 open `/deliveries/{id}` of the new delivery. "Cancel" and Escape SHALL close the dialog with no request, and SHALL do nothing while the claim is pending.

#### Scenario: Pick up succeeds
- **WHEN** the rider presses "Pick up SS-AAAA0001" and then "Pick up" in the dialog, and the service answers 201 with delivery `d1`
- **THEN** one `POST /me/deliveries` with `{"orderId": "<its id>"}` was sent and the delivery page `/deliveries/d1` shows "Order SS-AAAA0001"

#### Scenario: Cancel sends nothing
- **WHEN** the rider opens the dialog and presses "Cancel"
- **THEN** the dialog closes and no `POST /me/deliveries` was sent

#### Scenario: Cancel waits for a pending pick up
- **WHEN** the rider confirms, presses "Cancel" before the service answers, and the service then answers 409 `conflict`
- **THEN** the dialog stayed open until the answer, then closed with the status message "SS-AAAA0001 was taken by another rider or is no longer ready."

### Requirement: Pick up refused
When the service answers the claim 409 `conflict` or 404 `not_found`, the app SHALL close the dialog, show the status message "<number> was taken by another rider or is no longer ready." and read the ready list again. Any other failure SHALL keep the dialog open with the alert "Could not pick up the order. Try again.".

#### Scenario: Claimed by someone else
- **WHEN** the service answers the claim of `SS-AAAA0001` with 409 `conflict` "order already claimed"
- **THEN** the dialog is closed, the status message "SS-AAAA0001 was taken by another rider or is no longer ready." shows, and `GET /me/ready-orders` was sent again

#### Scenario: Service fails
- **WHEN** the service answers the claim with 502 `internal`
- **THEN** the dialog stays open with the alert "Could not pick up the order. Try again." and the rider stays on `/`

### Requirement: Delivery page
`/deliveries/{id}` SHALL show "Order <number>" as the level-1 heading from `GET /me/deliveries/{id}`, a status badge ("On the way" or "Delivered"), the customer's name, the address lines and pincode, a "Call <name>" `tel:` link when the delivery has a phone, the items as a stacked table (Product, Unit, Quantity) and the total. A 404 SHALL show the not-found page.

#### Scenario: Assigned delivery shown
- **WHEN** the rider opens an assigned delivery of `SS-AAAA0001` for "Ravi Kumar", phone `+919800000001`, "12 80 Feet Rd", "Flat 4", `560034`, Banana Robusta 1 kg x2, total 33900
- **THEN** "Order SS-AAAA0001" and "On the way" show, the address lines and pincode show, "Call Ravi Kumar" links to `tel:+919800000001`, the table has the Banana Robusta row, and ₹339 shows

#### Scenario: Unknown delivery
- **WHEN** the service answers `GET /me/deliveries/{id}` with 404
- **THEN** "Page not found" is the level-1 heading

### Requirement: Cash to collect
While a delivery is `assigned`, the delivery page SHALL show one amount line in a status message: "Collect ₹<total> in cash" when its payment method is `cod`, "Paid online" when its `paymentStatus` is `paid`, and "Awaiting payment" with the warning tone when its `paymentStatus` is `pending`. A delivered delivery SHALL show none of them.

#### Scenario: Cash on delivery
- **WHEN** the rider opens an assigned `cod` delivery with total 33900
- **THEN** the status message "Collect ₹339 in cash" shows

#### Scenario: Paid online
- **WHEN** the rider opens an assigned `online` delivery whose `paymentStatus` is `paid`
- **THEN** "Paid online" shows and no "Collect" text shows

#### Scenario: Awaiting payment
- **WHEN** the rider opens an assigned `online` delivery whose `paymentStatus` is `pending`
- **THEN** "Awaiting payment" shows, and neither "Collect" nor "Paid online" shows

#### Scenario: Delivered shows no collection
- **WHEN** the rider opens a delivered `cod` delivery, or a delivered `online` delivery whose `paymentStatus` is `paid`
- **THEN** neither "Collect" nor "Paid online" shows and there is no "Mark delivered" button

### Requirement: Mark delivered with confirmation
While the delivery is `assigned` the page SHALL show "Mark delivered", which opens a dialog "Mark <number> delivered?" with "Cancel" first and "Mark delivered". Confirming SHALL send `POST /me/deliveries/{id}/delivered` once; on 200 the page SHALL show "Delivered", the status message "<number> delivered." and no "Mark delivered" button.

#### Scenario: Delivered
- **WHEN** the rider confirms "Mark delivered" and the service answers 200 with status `delivered`
- **THEN** the badge reads "Delivered", the status message "SS-AAAA0001 delivered." shows, and no "Mark delivered" button remains

### Requirement: Mark delivered refused
When the service answers the delivered request with 409 the page SHALL close the dialog and read the delivery again; any other failure SHALL keep the dialog open with the alert "Could not mark the order delivered. Try again." and the delivery shown as "On the way".

#### Scenario: Core fails
- **WHEN** the service answers the delivered request with 502 `internal`
- **THEN** the dialog shows the alert "Could not mark the order delivered. Try again." and the badge still reads "On the way"

### Requirement: Location reported while on the way
While an assigned delivery's page is open, the app SHALL watch the device position with `navigator.geolocation.watchPosition`, send the first position with `PUT /me/location {lat, lng}` at once and then the latest one every 15 seconds counted from that first fix. It SHALL stop watching and sending when the delivery is delivered or the page is left, and SHALL not watch for a delivered delivery.

#### Scenario: First fix sent, then every 15 seconds
- **WHEN** the page of an assigned delivery is open and the device reports 12.9352, 77.6245
- **THEN** `PUT /me/location` with `{"lat": 12.9352, "lng": 77.6245}` is sent at once and again 15 seconds later

#### Scenario: A late first fix starts the count
- **WHEN** the device reports its first position 14 seconds after the page opened
- **THEN** one `PUT /me/location` is sent at 14 seconds, none at 15, and the next at 29

#### Scenario: Stops after delivered
- **WHEN** the rider marks the delivery delivered
- **THEN** the position watch is cleared and no `PUT /me/location` is sent afterwards

### Requirement: Location problems never block
When the device has no Geolocation API or reports an error, the delivery page SHALL show once the status message "Location is off. The customer cannot see where you are." and keep working; a failed `PUT /me/location` SHALL show nothing and the next one SHALL be tried as scheduled.

#### Scenario: Permission denied
- **WHEN** the device reports a permission error twice
- **THEN** one status message "Location is off. The customer cannot see where you are." shows and "Mark delivered" still works

### Requirement: Delivery history
`/history` SHALL show "History" as the level-1 heading and a stacked table "Delivered deliveries" from `GET /me/deliveries?status=delivered&pageSize=50`, newest first: the order number linking to `/deliveries/{id}`, the customer, the pincode, the total and when it was delivered. With none it SHALL show "No deliveries yet"; when `total` exceeds the rows it SHALL say "Showing the latest 50 of <total>.".

#### Scenario: Delivered deliveries listed
- **WHEN** the service lists one delivered delivery of `SS-DEMOAAAB` to "Demo Customer", `560034`, ₹339, delivered 13 Oct 2026 2:50 pm IST
- **THEN** the table row links `SS-DEMOAAAB` to `/deliveries/<its id>` and shows "Demo Customer", `560034`, ₹339 and "13 Oct 2026, 2:50 pm"

#### Scenario: No history
- **WHEN** the service lists no delivered delivery
- **THEN** "No deliveries yet" shows

### Requirement: Rider end-to-end suite with axe
`npm run e2e` in `apps/rider` SHALL run Playwright on Chromium only with the `geolocation` permission and a fixed position, start core, the rider service and the previews of rider (15175), web (15173) and admin (15174) with the environment it is given, run both services' `migrate` and `seed-demo --reset` before any test, and run axe on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the rider suite
- **THEN** the sign-in page, the Pick up page, History, the not-found page and the sign-in page after sign-out are each visited and axe reports no violation

#### Scenario: Suite seeds its own data
- **WHEN** `npm run e2e --workspace apps/rider` runs against e2e databases never seeded, with the `make e2e` environment
- **THEN** `rider1-koramangala@shopperstop.local` signs in and History lists `SS-DEMOAAAB`

### Requirement: Rider flow against core and rider
The e2e suite SHALL prove one delivery against the real services: a ready order made through core's API appears on the Pick up page, the rider picks it up, the delivery page reports the browser's fixed position, the rider marks it delivered and History lists it.

#### Scenario: Ready order to delivered
- **WHEN** the suite makes a ready order at store `...0401`, the rider picks it up on `/` and marks it delivered on its page
- **THEN** before delivered the customer's `GET /api/rider/v1/orders/{orderId}/delivery` answers status `assigned` with the fixed position, after it core holds the order `delivered`, and History lists its number

### Requirement: Cross-app delivery flow
The e2e suite SHALL drive the web, admin and rider previews together: a customer places an order at checkout on web, store staff move it to Ready on the admin Orders board, a rider picks it up and marks it delivered on the rider app, and the customer's tracking page shows it out for delivery and then delivered without a reload.

#### Scenario: Customer to rider to delivered
- **WHEN** a new customer places a cash on delivery order at store `...0401`, Koramangala staff press Accept, Start packing and Mark ready, and `rider2-koramangala@shopperstop.local` picks it up and marks it delivered
- **THEN** the order's ready card shows "Cash", its delivery page shows the status message "Collect ₹<total> in cash" before delivered, the tracking page shows "Your order is out for delivery." after the pick up and "Your order was delivered." after delivered, and core's order read names the rider "Meera Iyer"

### Requirement: Phone width layout
At a 390 by 844 viewport every rider page SHALL fit the width with no horizontal scroll, and its buttons and links SHALL be at least 44 px tall.

#### Scenario: Pages fit a phone
- **WHEN** the e2e suite opens the sign-in page, the Pick up page with a ready order, a delivery page and History at 390 by 844
- **THEN** on each page the document's scroll width is at most 390 and every visible button and button-styled link is at least 44 px tall

### Requirement: Rider failure answers without an error envelope
A not-ok answer to a rider service or core request whose JSON body lacks a string `error.code` and a string `error.message` (an empty or plain-text proxy 502, for example) SHALL reach the page as the error `{ code: "internal", message: "The server did not answer as expected." }` with the answer's status kept, and SHALL leave the token unchanged unless it is a 401 to the current token.

#### Scenario: A failure answer without an envelope reaches the caller as internal
- **WHEN** the rider service answers `GET /me` with 502 and no body, a plain-text body, or a JSON body `{"error":{"code":"bad_gateway"}}` while token `tok` is stored
- **THEN** the caller gets no data, the error `{ error: { code: "internal", message: "The server did not answer as expected." } }` and status 502, and the token is still `tok`
