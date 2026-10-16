# admin-riders Specification

## Purpose
The riders page of the admin app (`/riders`): admins and store staff list, create and change the riders of their stores against the rider service (`/api/rider/v1/admin/riders`) through a second client that carries the staff session.

## Requirements

### Requirement: Riders table
`/riders` SHALL be open to admins and store staff, headed "Riders", with a table "Riders" of the first 100 riders the rider service answers to `GET /api/rider/v1/admin/riders?pageSize=100`, in its order (by email). Columns: Name, Email, Phone ("None" when absent), Store (admins only; "Unknown store" when not among the stores), Status (badge "Active" `success` or "Inactive" `neutral`) and Actions (a button "Edit <email>").

#### Scenario: Admin sees every store's riders
- **WHEN** an admin opens `/riders` and the service holds Arjun Rao (Koramangala, phone +919000000001, active) and Kabir Shah (Indiranagar, no phone, inactive)
- **THEN** the columns are Name, Email, Phone, Store, Status, Actions; the first row reads Arjun Rao, arjun@example.test, +919000000001, Koramangala, Active and the second Kabir Shah, kabir@example.test, None, Indiranagar, Inactive; the service was asked once, with `pageSize=100` and the staff token as `Authorization: Bearer <token>`

### Requirement: Riders store for admins
An admin SHALL get a "Store" selector of "All stores" followed by every store by name. The chosen store SHALL be in the URL as `store` and sent to the service as `store`; "All stores" removes it from the URL. A `store` in the URL that is not a store SHALL be read as "All stores" and never sent.

#### Scenario: Choose a store
- **WHEN** an admin on `/riders` chooses Koramangala, then "All stores", then the URL changes to `store=nope`
- **THEN** only Koramangala's riders show with `store=<Koramangala>` in the URL and in the last request; then every rider shows with no `store` in the URL; then every rider shows with the selector on "All stores" and no request carried `store=nope`

### Requirement: Riders for store staff
Store staff SHALL see their own store's riders whatever the URL says: no store selector, no Store column, no request for the stores list and no `store` sent (the service answers with their store's riders). The page SHALL show "Store: <name>", read from the public `GET /stores/{id}`, and SHALL work without the name when that request fails.

#### Scenario: Store staff see their store
- **WHEN** store staff of Whitefield open `/riders?store=<Indiranagar>`
- **THEN** "Store: Whitefield" shows, there is no "Store" selector, the columns are Name, Email, Phone, Status, Actions, the stores list was not requested and the service was asked once with `pageSize=100` only

### Requirement: Riders table states
The page SHALL show a skeleton while its first answers load; the alert "Could not load the riders." with "Try again" when the riders list, or an admin's stores list, fails with nothing to show; and "No riders yet" when the service answers no rider, with "New rider" still offered.

#### Scenario: Riders loading
- **WHEN** the service has not answered the list yet
- **THEN** a skeleton named "Loading" shows, and the table once the service answers

#### Scenario: Riders load failure
- **WHEN** the service answers the list with 502, or core the stores list, and the admin presses "Try again" after it recovers
- **THEN** the alert "Could not load the riders." shows first, then the table and no alert

#### Scenario: No riders
- **WHEN** the service answers an empty list
- **THEN** "No riders yet" shows with no table and a "New rider" button

### Requirement: Riders list beyond one page
When the service's `total` is larger than the riders it answered, the page SHALL say "Showing the first 100 of <total> riders, by email." above the table.

#### Scenario: More than 100 riders
- **WHEN** the service answers two riders with a `total` of 130
- **THEN** "Showing the first 100 of 130 riders, by email." shows

### Requirement: Rider create
"New rider" SHALL open a `Dialog` "New rider" with the fields Name, Email, Phone (optional), Password and, for admins only, Store ("Choose a store" then every store; the store chosen on the page by default). "Create rider" SHALL send one `POST /api/rider/v1/admin/riders` with `storeId` (the store staff's own store for store staff), `email`, `name`, `password` and `phone` only when one was typed; on success the dialog closes and the list is read again, showing the new rider.

#### Scenario: Admin creates a rider
- **WHEN** an admin opens "New rider", types Meera Iyer, meera@example.test, +919000000002 and rider12345, chooses Koramangala and presses "Create rider"
- **THEN** the Name field had focus on opening; one `POST` to `O/api/rider/v1/admin/riders` was sent with `{"storeId": <Koramangala>, "email": "meera@example.test", "name": "Meera Iyer", "password": "rider12345", "phone": "+919000000002"}`; the dialog is closed and the row of meera@example.test reads Koramangala

#### Scenario: Store chosen on the page
- **WHEN** an admin on `/riders?store=<Indiranagar>` opens "New rider"
- **THEN** the dialog's Store is Indiranagar

#### Scenario: Store staff create at their store
- **WHEN** store staff open "New rider", type a name, an email and a password and press "Create rider"
- **THEN** the dialog has no Store field, the `POST` carried their store as `storeId` and no `phone`, and the new rider is listed

### Requirement: Rider change
"Edit <email>" SHALL open a `Dialog` "Edit <name>" with Name, Phone, New password (empty keeps it) and Status, and the line "<email>. The email and the store cannot be changed: create a new rider instead." "Save changes" SHALL send one `PATCH /api/rider/v1/admin/riders/{id}` with only what differs from the row (`phone` `""` removes it); nothing changed closes without a request. On success the dialog closes and the list is read again.

#### Scenario: Only what changed is sent
- **WHEN** an admin edits Arjun Rao: name "Arjun R", phone emptied, new password new-pass-1, status Inactive, and saves
- **THEN** the dialog had no Email or Store field and showed the phone and an empty New password; one `PATCH` to `O/api/rider/v1/admin/riders/<Arjun>` was sent with `{"name": "Arjun R", "phone": "", "password": "new-pass-1", "isActive": false}`; the row reads Arjun R, None, Inactive

#### Scenario: Nothing changed
- **WHEN** an admin opens "Edit kabir@example.test" and presses "Save changes"
- **THEN** the dialog closes and no request was sent

### Requirement: Rider form errors
A 400 `validation` naming `name`, `email`, `phone`, `password` or `storeId`, and a 409 `conflict` on `email`, SHALL show its message under that field, which is invalid, with no banner; the message SHALL go with the next edit of any field. Any other failure, one without the error envelope included, SHALL show the banner "Could not save the rider. Try again." in the dialog, which stays with what was typed.

#### Scenario: Refusal on a field
- **WHEN** the service refuses a create with 409 on `email`, or 400 on `password`, `phone`, `storeId` or `name`
- **THEN** the field is invalid and described by, in that order, "A rider with this email already exists.", "Enter 8 to 72 characters.", "Enter 10 to 15 digits, with an optional + in front.", "Choose a store." or "Enter 1 to 100 characters.", there is no alert, and after typing in Name the message is gone

#### Scenario: Other failures
- **WHEN** the service answers a create with 403 `forbidden`, with 502 `internal`, or with a 502 without a body
- **THEN** the dialog shows the alert "Could not save the rider. Try again.", the Name field keeps "Meera Iyer" and the page is still "Riders"

### Requirement: Rider save in progress
While a save runs its button SHALL read "Saving…", keep focus and be `aria-disabled`, never `disabled`; a second press SHALL send nothing, and "Cancel" and Escape SHALL NOT close the dialog. The answer closes it.

#### Scenario: Second press during a save
- **WHEN** an admin presses "Create rider", the service has not answered, and the admin presses the button again, then Escape, then "Cancel"
- **THEN** the button reads "Saving…", has focus, is enabled and `aria-disabled`, the dialog is still open and one `POST` was sent; once the service answers the dialog closes and still one `POST` was sent

### Requirement: Rider service session
The rider client SHALL send the staff token as the core client does, and a 401 from the rider service to the current token SHALL end the session as one from core does: the token is cleared and the sign-in page shows.

#### Scenario: 401 from the rider service
- **WHEN** a signed-in admin opens `/riders` and the service answers the list with 401 `unauthorized`
- **THEN** the app shows `/sign-in` and `localStorage` holds no `shopperstop:staff-token`

### Requirement: Riders against the rider service
The admin e2e suite SHALL cover `/riders` against the real core, the real rider service and both demo seeds, reset before every run, with axe on every page and dialog it visits.

#### Scenario: Admin manages riders and store staff see their store's
- **WHEN** the seeded admin opens Riders, chooses Indiranagar, creates "E2E Rider" (e2e-rider@shopperstop.local, +919000000099, password e2e-rider-12345) at the preselected Indiranagar, reloads, and sets the rider Inactive; then the seeded Koramangala store staff sign in in a second browser and open Riders
- **THEN** the admin first saw the four seeded riders with Arjun Rao at Koramangala and Active; Indiranagar listed rider1-indiranagar and rider2-indiranagar only; the new rider row read E2E Rider, Indiranagar, Active, also after the reload, then Inactive; the store staff's nav read Dashboard, Orders, Stock, Riders, their page showed "Store: Koramangala", no "Store" selector and only rider1-koramangala and rider2-koramangala; axe found no violation
