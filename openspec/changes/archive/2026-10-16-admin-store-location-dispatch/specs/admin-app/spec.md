## ADDED Requirements

### Requirement: Store location fields
The store form SHALL have "Latitude" and "Longitude" after "City", both optional, filled on a store's page from its `location` (empty when it has none). With both filled, "Create store" SHALL send `location` `{lat, lng}` as numbers, and with both empty no `location`. "Save changes" SHALL send `location` only when either number differs from the loaded store's, and then both halves.

#### Scenario: Create a store with a location
- **WHEN** an admin on `/stores/new` fills the required fields, "Latitude" `12.9116` and "Longitude" `77.6389`, presses "Create store", and core answers 201 with that location
- **THEN** the `POST` body carries `"location":{"lat":12.9116,"lng":77.6389}`, the new store's page opens and its "Latitude" reads `12.9116` and "Longitude" `77.6389`

#### Scenario: Location sent only when it moved
- **WHEN** an admin on the page of Koramangala at lat 12.9352, lng 77.6245 sees "Latitude" `12.9352` and "Longitude" `77.6245`, types `12.93520` into "Latitude", sets "Promised minutes" to `11` and saves, then sets "Longitude" to `77.625` and saves
- **THEN** the first `PATCH` body is exactly `{"promisedMinutes":11}` and the second exactly `{"location":{"lat":12.9352,"lng":77.625}}`

### Requirement: Store location the form cannot send
The store form SHALL flag, without a request: a half typed alone ("Enter both latitude and longitude, or neither." on the empty one), a latitude not a number from -90 to 90 ("Enter a latitude from -90 to 90."), a longitude not a number from -180 to 180 ("Enter a longitude from -180 to 180."), and both emptied on a store that has a location ("A location can be changed but not removed." on "Latitude"; core cannot clear one).

#### Scenario: Half a location, or out of range
- **WHEN** an admin on a store without a location types "Latitude" `12.9352` and saves, then types "Latitude" `north` and "Longitude" `180.5` and saves
- **THEN** "Longitude" was described by "Enter both latitude and longitude, or neither.", then "Latitude" by "Enter a latitude from -90 to 90." and "Longitude" by "Enter a longitude from -180 to 180.", and no `PATCH` was sent

#### Scenario: Location emptied
- **WHEN** an admin on the page of a store at lat 12.9352, lng 77.6245 empties "Latitude" and "Longitude" and saves
- **THEN** "Latitude" is described by "A location can be changed but not removed." and no `PATCH` was sent

### Requirement: Store location errors from core
A core 400 `validation` naming `location.lat` or `location.lng` SHALL be shown on "Latitude" or "Longitude" with the form's message for it, and one naming `location` on "Latitude" with "Enter both latitude and longitude, or neither.", with no alert.

#### Scenario: Location refused by core
- **WHEN** an admin saves a location and core answers 400 `validation` with field `location.lng`, and on the next save with field `location`
- **THEN** "Longitude" is described by "Enter a longitude from -180 to 180." and then "Latitude" by "Enter both latitude and longitude, or neither." (and "Longitude" no longer by its range message), with no alert either time

### Requirement: Store location against core
The stores e2e test SHALL round-trip the seeded Koramangala's location against the real core, put it back as the seed has it, and run axe on the refused half.

#### Scenario: Admin moves a store's location and puts it back
- **WHEN** the seeded admin on Koramangala's page empties "Longitude" and saves, then saves "Latitude" `12.9353` with "Longitude" `77.6245` and reloads, then saves `12.9352` and reloads
- **THEN** the fields first read `12.9352` and `77.6245`, "Longitude" is described by "Enter both latitude and longitude, or neither.", each save shows "Store saved.", each reload shows the saved latitude, and axe reports no violation

### Requirement: Order dispatch line
While an order is `ready`, its board card and its sheet SHALL show one line from the rider service's `GET /admin/orders/{orderId}/dispatch`: "Offered to <riderName>, <n> min away" for an `offered` offer (n is `etaSeconds` / 60 rounded up); else when `dispatch` is `off` "Dispatch off", plus ": store has no location" when `GET /stores/{id}` answers no `location`; else "No rider online" when `online` is 0; else "Waiting for a rider".

#### Scenario: Offered to a rider
- **WHEN** the board holds a ready SS-TEST0001 and a placed SS-TEST0002, the rider service answers SS-TEST0001's dispatch with `online` 2 and an `offered` offer to "Meera Iyer" at `etaSeconds` 90 before an `expired` one, and staff open SS-TEST0001's sheet
- **THEN** the card and the sheet read "Offered to Meera Iyer, 2 min away", SS-TEST0002's card names no offer, and the dispatch of SS-TEST0001 alone was read

#### Scenario: No open offer
- **WHEN** three ready orders' dispatch reads answer `dispatch` `off` at a store core answers without a `location`, `online` 0, and `online` 2 with only a `declined` offer
- **THEN** their cards read "Dispatch off: store has no location", "No rider online" and "Waiting for a rider"

#### Scenario: Dispatch off at a located store
- **WHEN** a ready order's dispatch answers `dispatch` `off` and `GET /stores/{id}` answers a `location`, and another ready order's answers `dispatch` `on` with `online` 1 and no offer
- **THEN** the first card reads "Dispatch off" with no reason, the second "Waiting for a rider", and the store was read once

### Requirement: Order dispatch line follows the board
The card and the sheet SHALL share one dispatch read per order, asked again with the board's 10-second poll and not asked for an order in any other status. A read that fails before any answer SHALL show no line and no alert.

#### Scenario: Failed read, then the poll
- **WHEN** a ready order's first dispatch read answers 500 and, after 10 seconds, the next answers an `offered` offer to "Arjun Rao" at `etaSeconds` 0
- **THEN** the card shows no dispatch line and there is no alert, and after the poll it reads "Offered to Arjun Rao, 0 min away"

### Requirement: Dispatch against core
The orders e2e test SHALL check the dispatch line against the real core and rider service with the demo seeds, where no rider is online, with axe.

#### Scenario: No rider online for a ready order
- **WHEN** the Koramangala store staff take the seeded SS-DEMOAAAD to Ready on the board
- **THEN** its card reads "No rider online" and axe reports no violation
