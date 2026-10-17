## ADDED Requirements

### Requirement: Availability in the banner
While a rider is signed in, the banner SHALL show a badge "Online" (success) or "Offline" (neutral) from the rider's `isOnline`, and a button "Go online" or "Go offline" with `aria-pressed` true while online. Pressing it SHALL send `PUT /me/availability {online}` once, disabled while pending, and show the answered rider's state; a failure SHALL keep the shown state and show the status message "Could not change your status. Try again.".

#### Scenario: Offline rider
- **WHEN** a signed-in rider whose `isOnline` is false opens `/`
- **THEN** the banner shows "Offline" and a "Go online" button with `aria-pressed` false

#### Scenario: Go online, then offline
- **WHEN** the rider presses "Go online", the service answers the rider online, then the rider presses "Go offline" and the service answers the rider offline
- **THEN** `PUT /me/availability` was sent with `{"online": true}` then `{"online": false}`, the banner showed "Online" with "Go offline" pressed in between, and shows "Offline" with "Go online" at the end

#### Scenario: Change fails
- **WHEN** the rider presses "Go online" and the service answers 502
- **THEN** the banner still shows "Offline" and the status message "Could not change your status. Try again." shows

### Requirement: Location needed to stay online
While the rider is online, a device with no Geolocation API, or a position watch that reports a permission error, SHALL take the rider offline with `PUT /me/availability {"online": false}` and show the status message "Allow location to go online". Other position errors SHALL change nothing.

#### Scenario: Permission refused
- **WHEN** the rider goes online and the device reports a permission error
- **THEN** `PUT /me/availability` with `{"online": false}` is sent, the banner shows "Offline" and the status message "Allow location to go online" shows

#### Scenario: No Geolocation API
- **WHEN** a rider whose `isOnline` is true opens `/` on a device without `navigator.geolocation`
- **THEN** `PUT /me/availability` with `{"online": false}` is sent and "Allow location to go online" shows

### Requirement: Position reported while online
While the rider is online on any page, the app SHALL watch the device position (high accuracy off, maximum age 10 s), send the first fix with `PUT /me/location {lat, lng}` at once and the latest one every 10 seconds from that fix, and SHALL stop watching and sending when the rider goes offline or signs out. A rider who loads the app online SHALL be watched at once. A failed send SHALL show nothing.

#### Scenario: First fix, then every 10 seconds
- **WHEN** the rider goes online and the device reports 12.9719, 77.6412
- **THEN** `PUT /me/location` with `{"lat": 12.9719, "lng": 77.6412}` is sent at once and again 10 seconds later

#### Scenario: Online on load
- **WHEN** a rider whose `isOnline` is true opens `/history`
- **THEN** a position watch is started without any user action

#### Scenario: Offline stops the watch
- **WHEN** an online rider goes offline, or signs out
- **THEN** the position watch is cleared and no `PUT /me/location` is sent afterwards

### Requirement: Offers read while online
While the rider is online the app SHALL read `GET /me/offer` at once and every 3 seconds, on any page; a 204 or a failed read SHALL show nothing. An offline rider SHALL send no `GET /me/offer`, and the ready list and "Pick up" SHALL work as before.

#### Scenario: Offline sends no offer read
- **WHEN** a rider whose `isOnline` is false stays on `/` for 10 seconds
- **THEN** no `GET /me/offer` was sent and the ready list is shown

#### Scenario: Polled every 3 seconds
- **WHEN** a rider whose `isOnline` is true stays on `/` and the service answers 204
- **THEN** a `GET /me/offer` is sent at once and another 3 seconds later, and no dialog is open

### Requirement: Offer sheet
A 200 offer SHALL open a sheet "New order <number>" showing the item count, the pincode, the total in rupees, a neutral "Cash" badge for `cod`, the seconds left until `expiresAt` in `tabular-nums` outside any live region, and the buttons "Accept" and "Decline". When the seconds reach zero with no accept pending, the sheet SHALL close and the status message "Offer expired" SHALL show; that offer SHALL not open again.

#### Scenario: Offer shown
- **WHEN** the service answers a `cod` offer of `SS-AAAA0001` with 3 items, ₹339 and pincode `560034`, expiring in 30 seconds
- **THEN** the dialog "New order SS-AAAA0001" shows "3 items", `560034`, ₹339, "Cash", "30 s left", "Accept" and "Decline"

#### Scenario: Offer expires
- **WHEN** the offer is shown and 30 seconds pass with no answer while the service still answers it
- **THEN** the dialog closes, the status message "Offer expired" shows and the dialog does not open again

### Requirement: Decline an offer
"Decline", the sheet's "Close" and Escape SHALL close the sheet at once and send `POST /me/offers/{id}/decline` once, whatever it answers; that offer SHALL not open again. They SHALL do nothing while an accept is pending.

#### Scenario: Decline closes the sheet
- **WHEN** the rider presses "Decline" on offer `o1`, and on a later offer `o2` presses Escape
- **THEN** each dialog closes, `POST /me/offers/o1/decline` and `POST /me/offers/o2/decline` were each sent once, and neither offer opens again

### Requirement: Accept an offer
"Accept" SHALL send `POST /me/offers/{id}/accept` once, loading while pending, and on 201 open `/deliveries/{id}` of the answered delivery. A 409 or 404 SHALL close the sheet with the status message "Someone else took <number>."; any other failure SHALL keep the sheet open with the alert "Could not accept the order. Try again.".

#### Scenario: Accepted
- **WHEN** the rider presses "Accept" on the offer of `SS-AAAA0001` and the service answers 201 with delivery `d1`
- **THEN** one `POST /me/offers/<id>/accept` was sent and `/deliveries/d1` shows "Order SS-AAAA0001"

#### Scenario: Someone else took it
- **WHEN** the service answers the accept with 409 `conflict`
- **THEN** the dialog closes and the status message "Someone else took SS-AAAA0001." shows

#### Scenario: Accept fails
- **WHEN** the service answers the accept with 502 `internal`
- **THEN** the dialog stays open with the alert "Could not accept the order. Try again."

### Requirement: Online dispatch flow end to end
The rider e2e suite SHALL prove dispatch against the real services at store `...0402` (Indiranagar), which no other rider spec uses: a rider online at the store's location is offered an order the staff ready, accepts it, delivers it and goes offline. Every rider spec SHALL end with its riders offline.

#### Scenario: Online rider offered a readied order
- **WHEN** `rider1-indiranagar@shopperstop.local` at 12.9719, 77.6412 goes online and Indiranagar staff move a new order to ready
- **THEN** the dialog "New order <number>" opens within 10 seconds and passes axe, "Accept" opens "Order <number>", "Mark delivered" makes it delivered, and after "Go offline" the rider service answers `GET /me` with `isOnline` false
