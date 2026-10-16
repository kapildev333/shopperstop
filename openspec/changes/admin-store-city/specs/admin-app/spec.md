## MODIFIED Requirements

### Requirement: Stores table
`/stores` SHALL show "Stores" as the level-1 heading with a "New store" link to `/stores/new`, and a table named "Stores" built from `GET /admin/stores?pageSize=100`: one row per store in core's order (by name) with the name linking to `/stores/{id}`, a "City" column with the store's city (empty when it has none), the store's pincode, an "Open" or "Closed" badge, the delivery fee, free-delivery threshold and minimum order in rupees, and the promised minutes.

#### Scenario: Stores listed
- **WHEN** an admin opens `/stores` and core lists Indiranagar (closed, no city) and Koramangala (open, city `Bengaluru`, pincode `560034`, fee 2500, free above 19900, minimum 9900, 10 minutes)
- **THEN** the "Stores" table's links are Indiranagar then Koramangala, Koramangala's link points to `/stores/<its id>`, the table has a "City" column header, Koramangala's row shows `Bengaluru`, `560034`, "Open", ₹25, ₹199, ₹99 and "10 min", Indiranagar's row shows "Closed" and no `Bengaluru`, and the list was requested with `pageSize` 100

### Requirement: Store create
`/stores/new` SHALL show "New store" as the level-1 heading and the store form: "Name", "Address", "City" (optional), "Pincode", "Delivery fee (₹)", "Free delivery above (₹)", "Minimum order (₹)", "Promised minutes" and "Status" (Open or Closed), amounts starting at 0 and status at Closed. Amounts SHALL be typed in rupees with at most two decimals and sent as integer paise. "Create store" SHALL send `POST /admin/stores` with every field, the city as typed (empty meaning none), and on success open the new store's page.

#### Scenario: Create a store
- **WHEN** an admin on `/stores/new` enters name "HSR Layout", address "27th Main, HSR Layout", city "Bengaluru", pincode `560102`, delivery fee `25`, free delivery above `199.50`, promised minutes `12`, leaves the rest, and presses "Create store", and core answers 201 with the new store
- **THEN** the status started at Closed, the request body is `{"name":"HSR Layout","city":"Bengaluru","addressLine":"27th Main, HSR Layout","pincode":"560102","isOpen":false,"deliveryFeeCents":2500,"freeDeliveryAboveCents":19950,"minOrderCents":0,"promisedMinutes":12}` and the new store's page opens at `/stores/<new id>`

### Requirement: Store change
`/stores/{id}` SHALL show the store's name as the level-1 heading and the store form filled from `GET /admin/stores/{id}`, amounts in rupees and "City" empty when the store has none. "Save changes" SHALL send `PATCH /admin/stores/{id}` with only the fields whose value differs from the loaded store (an empty "City" equals no city; emptying a set city sends `"city":""`), never `null`, and on success show "Store saved.", keep the saved values as the base of the next change, and show them in the stores table. An id core answers with 404 SHALL show the not-found page.

#### Scenario: Change sends only the changed fields
- **WHEN** an admin on Koramangala's page (no city, fee 2500, free above 19900) sees "City" empty, "Delivery fee (₹)" `25` and "Free delivery above (₹)" `199`, sets "Promised minutes" to `11` and "Status" to Closed, and presses "Save changes"
- **THEN** the `PATCH` body is `{"promisedMinutes":11,"isOpen":false}`, "Store saved." is shown, and "Promised minutes" still reads `11`

#### Scenario: Set and clear the city
- **WHEN** an admin on the page of Koramangala with city `Bengaluru` sees "City" `Bengaluru`, clears it and saves, then types `Bangalore` and saves again
- **THEN** the first `PATCH` body is exactly `{"city":""}` and the second exactly `{"city":"Bangalore"}`

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
