## ADDED Requirements

### Requirement: Staff users table
`/staff` SHALL show "Staff" as the level-1 heading and a table named "Staff users" built from `GET /admin/staff-users?pageSize=100`: one row per staff user in core's order (by email) with the name, a "You" badge on the signed-in admin's own row, the email, "Admin" or "Store staff", the store's name from `GET /admin/stores` ("All stores" for an admin, "Unknown store" when the store is not among the stores read), and an "Active" or "Inactive" badge.

#### Scenario: Staff users listed
- **WHEN** an admin opens `/staff` and core lists the admin, an inactive Indiranagar store-staff user and an active Koramangala store-staff user
- **THEN** the "Staff users" table has three rows in that order; the first shows the admin's name, "You", the email, "Admin", "All stores" and "Active"; the second "Store staff", "Indiranagar" and "Inactive"; the third "Koramangala" and "Active"; only the first row shows "You"; and the list was requested with `pageSize` 100

#### Scenario: Store not among the stores read
- **WHEN** core lists a store-staff user whose `storeId` is not in the stores core listed
- **THEN** that row shows "Unknown store" and no store's name

### Requirement: Staff users table states
`/staff` SHALL follow the panel's rule for reads. While it holds no answer to its two reads (the staff users and the stores) it SHALL show a loading status, or, when a read that holds no answer failed, the alert "Could not load the staff users." with "Try again", which makes both reads again. Once it shows the table, a later read that fails SHALL leave the table in place with no alert; the one notice is the root layout's.

#### Scenario: Staff users loading
- **WHEN** an admin opens `/staff` and core has not answered the staff users yet
- **THEN** a loading status is shown and no table; when core answers, the table is shown and the loading status is gone

#### Scenario: First load failure
- **WHEN** an admin opens `/staff` and core fails the staff users, or the stores, with 500, then answers after the admin presses "Try again"
- **THEN** the alert "Could not load the staff users." is shown with no table, then the table and no alert

#### Scenario: Failed refetch keeps the table
- **WHEN** an admin has `/staff` open with its table shown, both reads are made again and core answers 502 without a body, and then both are made once more and answered
- **THEN** the table still shows its rows and store names with no alert and exactly one status message "Could not refresh. Showing what was loaded last."; after the answers the table is shown and the message is gone

#### Scenario: Failed refetch while the stores load
- **WHEN** an admin opens `/staff`, core answers the staff users but not yet the stores, and a second read of the staff users fails
- **THEN** the loading status is still shown and no alert

### Requirement: Staff users list beyond one page
`/staff` SHALL read at most 100 staff users, the most core gives in one page, and SHALL NOT page or filter them. When core reports a `total` above the rows it sent, the page SHALL say so in a status message above the table: "Showing the first 100 of <total> staff users, by email."

#### Scenario: More than 100 staff users
- **WHEN** core answers the staff users with `total` 101
- **THEN** the status message "Showing the first 100 of 101 staff users, by email." is shown above the table

#### Scenario: Whole list shown
- **WHEN** core answers three staff users with `total` 3
- **THEN** no such message is shown

### Requirement: Staff users only for admins
`/staff` SHALL be a page for admins. A store-staff user who opens it SHALL get the app's "Page not found" inside the shell with the URL unchanged, and the page SHALL NOT ask core for the staff users.

#### Scenario: Store staff open /staff
- **WHEN** a signed-in store-staff user opens `/staff`
- **THEN** "Page not found" is the level-1 heading, the path is still `/staff`, and the only request made was `GET /admin/me`

### Requirement: Staff user create
The "New staff user" button SHALL open a dialog titled "New staff user" with "Name", "Email", "Password", "Role" ("Store staff" first, or "Admin") and, for store staff only, "Store", and the buttons "Cancel" then "Create staff user". Saving SHALL send one `POST /admin/staff-users` with the values as typed, `storeId` only for store staff with a store chosen, then close the dialog and show core's answer as a row in email order, letter case ignored as in core, without reading the list again.

#### Scenario: Create a store-staff user
- **WHEN** an admin opens the dialog, types a name, `Jaya@example.test` and a password, chooses Indiranagar and presses "Create staff user"
- **THEN** focus started in "Name" and "Role" on "Store staff"; core got `{name, email, password, role: "store_staff", storeId}`; the dialog closed; the row stands between `indiranagar@…` and `koramangala@…` with "Store staff", "Indiranagar" and "Active"; and the list was read once in all

#### Scenario: Create an admin
- **WHEN** an admin chooses the role "Admin" and presses "Create staff user"
- **THEN** the dialog showed no "Store" field, core got no `storeId`, and the new row shows "All stores"

#### Scenario: Created user changed at once
- **WHEN** an admin creates a staff user, opens its "Edit" dialog straight away and saves a changed name
- **THEN** the `PATCH` went to the id core gave on the create, and the table still has one row for that email, now with the new name

### Requirement: Staff user change
"Edit" on a row SHALL open a dialog titled "Edit <name>" that shows the email and the role as text with the note that email, role and store cannot be changed, and the fields "Name", "New password" (empty) and "Status" ("Active" or "Inactive"), with "Cancel" then "Save changes". Saving SHALL send one `PATCH /admin/staff-users/{id}` with only what differs from the row, show core's answer in the row without another read, and close; with nothing changed it SHALL close and send nothing.

#### Scenario: Change the name
- **WHEN** an admin opens "Edit" on Kiran Rao, replaces the name with ` Kiran R ` and presses "Save changes"
- **THEN** the dialog showed `koramangala@example.test, Store staff.` and the note, no "Email", "Role" or "Store" field, "Status" on "Active" and an empty "New password"; core got `{"name":" Kiran R "}` at that user's id; the row shows the name core answered, `Kiran R`; and the list was read once in all

#### Scenario: Deactivate and activate
- **WHEN** an admin sets "Status" to "Inactive" on an active user and saves, then to "Active" on an inactive user and saves
- **THEN** core got `{"isActive":false}`, then `{"isActive":true}`, and each row's badge follows core's answer

#### Scenario: Nothing changed
- **WHEN** an admin opens "Edit", moves "Status" to "Inactive" and back, and presses "Save changes"
- **THEN** the dialog closes and no `PATCH` was sent

### Requirement: Staff user changed while its dialog is open
The "Edit" dialog SHALL compare what it shows with the row as the list holds it when "Save changes" is pressed, so a background read that changed the user while the dialog was open counts, and the form SHALL keep what it shows. When the list no longer holds the row, the dialog SHALL stay on the row as it was opened and save it by its id.

#### Scenario: Row changed while the dialog is open
- **WHEN** an admin opens "Edit" on the active Kiran Rao, a background read then says Kiran Rao is inactive, and the admin presses "Save changes" with "Status" still on "Active"
- **THEN** the row showed "Inactive" while "Status" stayed on "Active"; core got `{"isActive":true}`; and the row shows "Active" from core's answer

#### Scenario: Row gone from the list while the dialog is open
- **WHEN** an admin opens "Edit" on Kiran Rao, a background read no longer holds Kiran Rao, and the admin adds ` Jr` to the name and saves
- **THEN** the dialog stayed "Edit Kiran Rao" with no "Email" field; core got `{"name":"Kiran Rao Jr"}` at Kiran Rao's id; and the row is back with `Kiran Rao Jr`

### Requirement: Staff user own account
In the dialog of the signed-in admin's own row the panel SHALL NOT offer "Status" and SHALL show "You cannot deactivate your own account."; every other row's dialog SHALL offer "Status" and not show that line. When the admin saves their own name, the banner SHALL show the saved name without another `GET /admin/me`.

#### Scenario: Own dialog
- **WHEN** the signed-in admin opens "Edit" on their own row, changes the name to `Asha A` and saves
- **THEN** the dialog had no "Status" field and showed the line; core got `{"name":"Asha A"}`; the row shows `Asha A` and "You"; the banner shows `Asha A`; and `GET /admin/me` was requested once in all

#### Scenario: Another user's dialog
- **WHEN** the admin opens "Edit" on another staff user's row
- **THEN** the dialog has the "Status" field and not the line

### Requirement: Staff user form errors
A 400 `validation` from core naming `name`, `email`, `password`, `role` or `storeId` SHALL show the page's message for that field on the field and no alert; a 409 `conflict` on `email` SHALL show "A staff user with this email already exists." on "Email". Any other failure SHALL show the alert "Could not save the staff user. Try again." in the dialog. In every case the dialog SHALL stay open with what was typed, the table SHALL stay as it was, and the next edit SHALL clear the error.

#### Scenario: Validation error on a field
- **WHEN** core answers a create with 400 `validation` on `name`, `email`, `password` or `role`
- **THEN** the field reads, in turn, "Enter 1 to 100 characters.", "Enter a valid email address.", "Enter 8 to 72 characters." or "Choose a role.", is marked invalid, and neither an alert nor core's own message is shown

#### Scenario: Store staff without a store
- **WHEN** an admin presses "Create staff user" for store staff with no store chosen and core answers 400 `validation` on `storeId`
- **THEN** core was sent no `storeId`, and "Store" reads "Choose a store." with no alert

#### Scenario: Taken email
- **WHEN** core answers a create with 409 `conflict` on `email`, and the admin then types in "Name"
- **THEN** "Email" read "A staff user with this email already exists." with no alert and the password still in its field; after the edit the message is gone

#### Scenario: Other failure
- **WHEN** core answers a create with 500, with 502 without a body, with 400 `validation` naming no field, or with 409 on another field, and the admin then types in "Name"
- **THEN** the dialog showed the alert "Could not save the staff user. Try again." with the typed name kept and three rows in the table; after the edit the alert is gone

#### Scenario: Unknown staff user on save
- **WHEN** core answers a change with 404 `not_found`
- **THEN** the dialog shows the alert and the row shows the name it had

### Requirement: Staff user save in progress
While a staff user save runs, the dialog's submit button SHALL read "Saving…" and stay focusable (`aria-disabled`, never `disabled`); a second press, Enter in a field, "Cancel" and Escape SHALL do nothing; an edit typed meanwhile SHALL NOT detach the save, whose answer still closes the dialog. With no save running, "Cancel" and Escape SHALL close the dialog without a request and return focus to the button that opened it.

#### Scenario: Second press during a save
- **WHEN** an admin presses "Create staff user" while core holds its answer, presses the button again and presses Enter in "Name", and core then answers
- **THEN** the button read "Saving…", had focus, was enabled with `aria-disabled="true"`; exactly one `POST` was sent; the dialog closed and the table has four rows

#### Scenario: Edit typed during a save
- **WHEN** an admin types in "Name" while a create is held, and core then answers
- **THEN** the button still read "Saving…", the dialog closed on the answer, one `POST` was sent, and the row shows the name that was sent

#### Scenario: Cancel and Escape
- **WHEN** an admin opens the dialog and presses "Cancel", opens it and presses Escape, then opens it, fills it, presses "Create staff user" while core holds its answer, presses Escape and "Cancel", and core then answers
- **THEN** the first two closed the dialog with no request, focus returned to "New staff user", the reopened dialog was empty; during the save the dialog stayed; after the answer it closed with one `POST` sent and the new row shown

### Requirement: Staff user passwords
The dialog's password field SHALL have `type="password"` and `autocomplete="new-password"`. A password SHALL be sent only in the `POST` or `PATCH` body, a "New password" left empty SHALL NOT be sent, and after a save no password SHALL remain in the page, in the query cache or in the mutation cache; a dialog opened again SHALL start with an empty password field.

#### Scenario: Password field on create
- **WHEN** an admin opens the "New staff user" dialog
- **THEN** "Password" has `type` `password` and `autocomplete` `new-password`

#### Scenario: New password sent alone and not kept
- **WHEN** an admin opens "Edit" on a staff user, types `newpass123` into "New password" and saves
- **THEN** the field had `type` `password` and `autocomplete` `new-password`; core got `{"password":"newpass123"}`; afterwards the mutation cache is empty, no query holds the text, the page does not show it, and the dialog opened again has an empty "New password"

### Requirement: Stock product image
The "Stock" table's first column SHALL be "Image": the product's image from the row's `imageUrl` as a 1:1 tile with an empty alternative text (the name stands next to it), and the tile's placeholder when the row has no `imageUrl`. The columns SHALL read Image, Product, Unit, Price, Quantity, Status.

#### Scenario: Product image tile
- **WHEN** an admin opens `/stock` and core lists one product with an `imageUrl` and one without
- **THEN** the column headers are Image, Product, Unit, Price, Quantity, Status; the first row's first cell holds an image with that source and an empty `alt`; the second row has no image and its first cell holds the placeholder

### Requirement: Staff users against core
The admin e2e suite SHALL run the staff page against the real core and the demo seed with one admin sign-in, and axe SHALL find no violation on the table, in the create dialog, in the edit dialog and on the not-found page. It SHALL leave the seeded staff users as they were and the one it creates inactive.

#### Scenario: Admin creates store staff who see their store only until deactivated
- **WHEN** the seeded admin opens Staff, creates a store-staff user for Indiranagar (`00000000-0000-4000-8000-000000000402`) and reloads; that user signs in in a second browser context, opens Stock and then `/staff`; the admin sets them "Inactive"; and they open `/stock`
- **THEN** the table had three "Edit" buttons, "You" and "All stores" on the admin's row and "Koramangala" on its staff's; the new row shows "Store staff", "Indiranagar", "Active" and, after the reload, the name; the new user's banner shows their name, their navigation is Dashboard, Orders, Stock, `/stock` shows "Store: Indiranagar" with no selector and `/staff` "Page not found"; after the save the row shows "Inactive" and their browser is on `/admin/sign-in?redirect=%2Fstock`

### Requirement: Product and stock against core
The admin e2e suite SHALL run Spec 2 §13's "admin creates a product and sets stock" against the real core and the demo seed as one flow across the product and stock pages, with one admin sign-in shared with the catalog flow, and SHALL delete the product afterwards so no stock row of it stays.

#### Scenario: Admin creates a product and sets its stock
- **WHEN** the seeded admin creates "E2E Curd Cup", uploads its image, opens `/stock?store=00000000-0000-4000-8000-000000000401`, searches "e2e curd cup", types 12 into its quantity, presses "Save changes", reloads, and then deletes the product
- **THEN** the selector stood on Koramangala; the search listed one row with quantity 0, "Low stock" and an image whose source is `/api/core/v1/files/products/<id>.png`, with no axe violation; "Stock saved." was shown; after the reload the field holds 12 and "Low stock" is gone; and after the delete a search for the product shows "No products found"
