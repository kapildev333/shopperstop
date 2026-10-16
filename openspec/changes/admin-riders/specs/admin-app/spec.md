## MODIFIED Requirements

### Requirement: Core reached through a same-origin proxy
The app SHALL call the core service only through one shared client whose base URL is the page's own origin followed by `/api/core/v1`, and the rider service only through a second client whose base URL is the page's own origin followed by `/api/rider/v1`, so every call is same-origin. The dev server SHALL proxy `/api/rider` to `http://localhost:8081` and every other `/api` path to `http://localhost:8080`; the preview server SHALL proxy `/api/rider` to `http://localhost:18081` and every other `/api` path to `http://localhost:18080`.

#### Scenario: Preview proxies to core
- **WHEN** core runs on port 18080 and a client requests `http://localhost:15174/api/core/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Preview proxies to the rider service
- **WHEN** the rider service runs on port 18081 and a client requests `http://localhost:15174/api/rider/v1/healthz`
- **THEN** the response is 200 with body `{"status":"ok"}`

#### Scenario: Client calls the page's origin
- **WHEN** the shared client sends `GET /admin/me` from a page served at origin `O`
- **THEN** the request URL is `O/api/core/v1/admin/me`

#### Scenario: Rider client calls the page's origin
- **WHEN** an admin opens `/riders` on a page served at origin `O`
- **THEN** the riders list request URL is `O/api/rider/v1/admin/riders?pageSize=100`

### Requirement: End-to-end suite with axe
`npm run e2e` in `apps/admin` SHALL run Playwright on Chromium only, starting core from `services/core` and the rider service from `services/rider` with the environment it is given and `vite preview` on port 15174, SHALL run `core-admin migrate` and `core-admin seed-demo --reset` from `services/core`, then `rider-admin migrate` and `rider-admin seed-demo --reset` from `services/rider`, with that environment before any test, and SHALL run `@axe-core/playwright` on every page it visits, failing on any violation.

#### Scenario: Smoke pages pass axe
- **WHEN** `make e2e` runs the admin suite
- **THEN** the sign-in page, the Dashboard, the not-found page and the sign-in page after sign-out are each visited and axe reports no violations on any of them

#### Scenario: Suite seeds its own data
- **WHEN** `npm run e2e --workspace apps/admin` runs against e2e databases that have never been seeded, with the `make e2e` environment exported
- **THEN** the seeded admin can sign in and the four seeded riders are listed during the suite

### Requirement: Role-based navigation
The "Admin" navigation SHALL show only the sections the signed-in role can reach, in this order: for `admin`, Dashboard, Orders, Stock, Riders, Stores, Categories, Products, Staff; for `store_staff`, Dashboard, Orders, Stock, Riders.

#### Scenario: Admin sees every section
- **WHEN** an admin with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Riders, Stores, Categories, Products, Staff in that order

#### Scenario: Store staff see their sections
- **WHEN** a store staff member with a valid session opens `/`
- **THEN** the "Admin" navigation links are Dashboard, Orders, Stock, Riders in that order

### Requirement: Orders board
`/orders` SHALL show one store's active orders as a column per status, in the order Placed, Accepted, Packing, Ready, Out for delivery, each headed by its name and its count. A card SHALL show the order's number, the time since it was placed, its item count (the quantities added up), its total, the pincode of its address and, once a rider took the order out (`riderName`), "Rider: <name>"; the longest waiting order is first in its column. Delivered and cancelled orders SHALL NOT be on the board. Core is asked once, with `active=true` and `pageSize=100`; when core's `total` is larger than the orders it answered, the status "Showing the newest <n> of <total> active orders." SHALL show above the columns.

#### Scenario: Board listed
- **WHEN** an admin opens `/orders` and the first store has two placed orders, one accepted, one out for delivery placed 125 minutes ago, one delivered and one cancelled
- **THEN** the columns read "Placed" 2, "Accepted" 1, "Packing" 0, "Ready" 0, "Out for delivery" 1, the placed column lists the older order first, a card reads "2 min ago", "1 item, pincode 560038" and "₹45.50", the oldest reads "2 h 5 min ago", the empty columns say "No orders", and neither finished order is shown
- **THEN** core was asked once, with `active=true` and `pageSize=100`, and no "Showing the newest" status shows

#### Scenario: More active orders than one page
- **WHEN** core answers the board with one order and a `total` of 130
- **THEN** the status "Showing the newest 1 of 130 active orders." shows and the order's card is on the board

#### Scenario: Rider on the card
- **WHEN** the board holds a ready order, an order out for delivery with `riderName` "Arjun Rao" and one out for delivery without a rider
- **THEN** the card of the second reads "Rider: Arjun Rao" and the other two cards name no rider

#### Scenario: Orders placed in the same second
- **WHEN** three placed orders carry the times `09:20:00Z`, `09:20:00.5Z` and `09:20:00.501Z`
- **THEN** their cards are in that order

#### Scenario: Column name
- **WHEN** the board holds two placed orders and one accepted
- **THEN** the column headings are named "Placed, 2 orders", "Accepted, 1 order", "Packing, 0 orders", "Ready, 0 orders" and "Out for delivery, 0 orders", and each column is a region of that name

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

### Requirement: Order detail sheet
A card's number, and a History row's, SHALL be a button that opens a `Sheet` titled "Order <number>" with the status badge, when it was placed, "Rider: <name>" once a rider took the order out, the items with quantity, unit and line total, subtotal, delivery fee and total, the customer's name and phone as a `tel:` link (or "No phone number"), the address, and the events oldest first with who made them (the rider's name for an event a rider made, otherwise the customer, staff or the system), when, and their note. Closing it SHALL return focus to the button.

#### Scenario: Order opened from its card
- **WHEN** staff press "SS-TEST0001" on its card
- **THEN** the sheet shows "Placed 13 Oct 2026, 2:50 pm", "1 × Banana Robusta, 1 kg" ₹70, "3 × Pomegranate Bhagwa, 1 kg" ₹960, subtotal ₹1,030, delivery fee ₹0, "Total, cash on delivery" ₹1,030, "Demo Customer", the link "+919800000000" to `tel:+919800000000`, "Home: 12 80 Feet Rd, Koramangala, 560034" and "Placed by the customer, 13 Oct 2026, 2:50 pm"

#### Scenario: Rider and rider events
- **WHEN** staff open from History a delivered order with `riderName` "Arjun Rao" whose out-for-delivery and delivered events carry `actorType` `rider` and `actorName` "Arjun Rao"
- **THEN** the sheet shows "Rider: Arjun Rao" and the events read "Placed by the customer, …", "Accepted by staff, …", "Out for delivery by Arjun Rao, 13 Oct 2026, 2:55 pm" and "Delivered by Arjun Rao, 13 Oct 2026, 3:01 pm"

#### Scenario: Sheet closed
- **WHEN** staff press "Close" on the sheet
- **THEN** no dialog is open and the card's "SS-TEST0001" button has focus

### Requirement: Order cancel with a reason
The sheet SHALL offer "Cancel order" only while the order is placed or accepted. It SHALL open a `Dialog` "Cancel order <number>?" over the sheet, which stays open under it, with a "Reason" field of at most 500 characters and the buttons "Keep order" then "Cancel order". A reason is required. "Keep order" and Escape SHALL close only the dialog and put the keyboard back on the sheet's "Cancel order". Confirming SHALL send one `POST` with `{"status":"cancelled","note":"<reason, trimmed>"}`; the dialog closes, the sheet shows "Order cancelled.", the order cancelled with its reason, the keyboard is on the result (a group "Cancel result" in the sheet), and the order leaves the board.

#### Scenario: Cancel offered
- **WHEN** staff open a placed, an accepted and a packing order in turn
- **THEN** the first two sheets have a "Cancel order" button and the third has none

#### Scenario: Order cancelled
- **WHEN** staff open SS-TEST0001, press "Cancel order", type " Out of stock " and confirm
- **THEN** one `POST` with `{"status":"cancelled","note":"Out of stock"}` was sent, the sheet is the only dialog, the group "Cancel result" has focus, the sheet shows "Order cancelled." as a status, "Cancelled", "Reason for cancelling: Out of stock" and the event with its note, and has no "Cancel order" button; after closing, the order is off the board and the other order is still on it

#### Scenario: Reason missing
- **WHEN** staff confirm with a reason of spaces only, then type a letter
- **THEN** the sheet "Order SS-TEST0001" is still open under the dialog, nothing was sent and the field is invalid with "Enter a reason."; after the letter the message is gone and the field is valid

#### Scenario: Keep order
- **WHEN** staff open the cancel dialog and press "Keep order", then open it again and press Escape
- **THEN** both times the sheet "Order SS-TEST0001" is the only dialog, its "Cancel order" button has focus, and nothing was sent

### Requirement: Dashboard
`/` SHALL show a card per store that `GET /admin/dashboard` answers, in core's order (every store by name for an admin, their own for store staff), named by the store, with the badge "Open" (`success`) or "Closed" (`neutral`) from the store's `isOpen`: "Orders today" with their sum and a line per status, "Revenue today" and "Low stock" as a count of products. Each card SHALL link "Orders" to `/orders?store=<id>` and "Low stock" to `/stock?store=<id>&lowStock=true`, each link named with the store.

#### Scenario: Dashboard cards
- **WHEN** an admin opens `/` and core answers Indiranagar (no orders, 1 product low) and Koramangala (1, 2, 3, 4, 5, 6, 7 by status, 20 low, revenue 618050)
- **THEN** the cards are headed "Indiranagar" then "Koramangala"; Koramangala reads "Orders today" 28, the seven statuses with their counts, "Revenue today" ₹6,180.50 and "Low stock" "20 products"; Indiranagar reads ₹0 and "1 product"; core was asked for `/admin/me` and `/admin/dashboard` only

#### Scenario: Open or closed
- **WHEN** core answers Indiranagar with `isOpen` false and Koramangala with `isOpen` true
- **THEN** the Indiranagar card shows "Closed" on the neutral surface and the Koramangala card shows "Open" on the success surface and no "Closed"

#### Scenario: Dashboard links
- **WHEN** an admin presses "Low stock at Koramangala"
- **THEN** the link pointed to `/stock?store=<Koramangala>&lowStock=true`, "Orders at Koramangala" to `/orders?store=<Koramangala>`, and `/stock` opens with `store` and `lowStock` true in the URL

#### Scenario: Store staff dashboard
- **WHEN** store staff open `/` and core answers their one store
- **THEN** one card shows, and its "Low stock" link holds their store

### Requirement: Orders against core
The admin e2e suite SHALL cover the orders pages and the dashboard against the real core and the demo seed, reset before every run, with axe on every page, sheet and dialog it visits.

#### Scenario: Store staff take the placed order to delivered
- **WHEN** the seeded Koramangala store staff sign in, open Orders, open SS-DEMOAAAD and its cancel dialog without cancelling, press "Accept", "Start packing", "Mark ready", "Send out" and "Mark delivered" with its confirmation, and open History
- **THEN** "Store: Koramangala" shows with no selector; the card read "4 items, pincode 560034" and ₹1,030; the sheet showed the customer, phone, address and items; after each press the status message named the new status and the card stood in that column; after the last the card is gone; History lists SS-DEMOAAAD and SS-DEMOAAAB, the sheet of SS-DEMOAAAD shows "Delivered by staff" and no cancel, "Cancelled" lists SS-DEMOAAAC alone, also after a reload; axe finds no violation anywhere

#### Scenario: Admin sees the dashboard and a store's orders
- **WHEN** the seeded admin signs in, presses "Orders at Koramangala", opens History and opens SS-DEMOAAAB
- **THEN** the dashboard headed its cards "Indiranagar" and "Koramangala", the Koramangala card showed "Open", its "Low stock" link pointed to `/admin/stock?store=<Koramangala>&lowStock=true`, the orders page opened with the selector on Koramangala and "Board" current, History lists SS-DEMOAAAB, its sheet shows "Rider: Arjun Rao" and "Delivered by Arjun Rao", and axe finds no violation
