## ADDED Requirements

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
`/stores/{id}` SHALL show the store's name as the level-1 heading and the store form filled from `GET /admin/stores/{id}`, amounts in rupees. "Save changes" SHALL send `PATCH /admin/stores/{id}` with only the fields whose value differs from the loaded store, never `null`, and on success show "Store saved." and keep the saved values. An id core answers with 404 SHALL show the not-found page.

#### Scenario: Change sends only the changed fields
- **WHEN** an admin on Koramangala's page (fee 2500, free above 19900) sees "Delivery fee (₹)" `25` and "Free delivery above (₹)" `199`, sets "Promised minutes" to `11` and "Status" to Closed, and presses "Save changes"
- **THEN** the `PATCH` body is `{"promisedMinutes":11,"isOpen":false}`, "Store saved." is shown, and "Promised minutes" still reads `11`

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
