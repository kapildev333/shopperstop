## ADDED Requirements

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

## MODIFIED Requirements

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
