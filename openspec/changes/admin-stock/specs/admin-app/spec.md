## ADDED Requirements

### Requirement: Stock table
`/stock` SHALL show "Stock" as the level-1 heading and a table named "Stock" built from `GET /admin/stores/{id}/stock` with `pageSize` 24: one row per product in core's order with its name, its brand when it has one, its unit, its price, its quantity in a text field labelled "Quantity of <name>", and a "Low stock" badge when the quantity core holds is below 5, zero included.

#### Scenario: Stock listed
- **WHEN** an admin opens `/stock`, the stores are Indiranagar then Koramangala, and core answers Indiranagar's stock: Banana Robusta 0, Brown Bread 5, Fresh Curd 4, Sunny Fields Toned Milk (brand Sunny Fields, 500 ml, ₹27.99) 17
- **THEN** the "Stock" table lists the four in that order, the milk's row shows "Sunny Fields", "500 ml", "₹27.99" and "Quantity of Sunny Fields Toned Milk" holds `17`, Banana Robusta and Fresh Curd carry "Low stock", Brown Bread and the milk do not, "Page 1 of 1, 4 products" is shown, the request went to Indiranagar's stock with `page=1&pageSize=24`, and the only requests are `GET /admin/me`, `GET /admin/stores` and that one

### Requirement: Stock store for admins
For an admin, `/stock` SHALL show a "Store" selector of the stores from `GET /admin/stores`. The page SHALL show the store the URL names in `store`, or the first store when the URL names none or one that is not listed. Choosing a store SHALL put it in the URL as `store` and keep keyboard focus on the selector. While the chosen store's stock loads, another store's rows SHALL NOT be shown.

#### Scenario: Choose a store
- **WHEN** an admin on Indiranagar's stock chooses Koramangala in "Store" and core has not answered yet
- **THEN** a loading status is shown and no Indiranagar row, then Koramangala's rows, the selector shows Koramangala and has focus, and the URL's search is `store=<Koramangala id>`

#### Scenario: Store in the URL
- **WHEN** an admin opens `/stock?store=<Koramangala id>`
- **THEN** Koramangala's stock is shown and the selector shows Koramangala

#### Scenario: Unknown store in the URL
- **WHEN** an admin opens `/stock?store=<an id that is no store>`
- **THEN** the first store's stock is shown and the selector shows the first store

### Requirement: Stock store for store staff
For store staff, `/stock` SHALL show the stock of their own store, whatever `store` the URL holds, with no "Store" selector and without requesting `GET /admin/stores`. Where admins have the selector it SHALL show "Store: <name>", the name read from the public `GET /stores/{id}`; when that request fails, the page SHALL show the stock without the name and without an error.

#### Scenario: Store staff see their own store
- **WHEN** a store staff member of the store Whitefield opens `/stock?store=<another store's id>`
- **THEN** the table shows Whitefield's stock, "Whitefield" is shown, there is no "Store" selector, and the only requests are `GET /admin/me`, `GET /admin/stores/<Whitefield id>/stock` and `GET /stores/<Whitefield id>`

#### Scenario: Store name unavailable
- **WHEN** a store staff member opens `/stock` and core answers `GET /stores/<their store id>` with 500
- **THEN** their store's stock is shown with its quantity fields and "No unsaved changes", there is no "Store:" text and no alert

### Requirement: Stock search and low-stock filter
`/stock` SHALL have a search form named "Search stock" (a "Search" field and button) that asks core with `q` set to the trimmed text, and a "Low stock only" toggle button (`aria-pressed`) that asks with `lowStock=true` while on. Both SHALL be held in the URL, an empty one left out of the URL and the request. The field SHALL show the URL's `q` whenever it changes, also through Back and Forward. Changing the search or the filter SHALL ask for page 1.

#### Scenario: Search and filter from the first page
- **WHEN** an admin on page 2 searches " product ", moves to page 2 again and switches "Low stock only" on, then off
- **THEN** core is asked with `q=product&page=1`, then with `q=product&lowStock=true&page=1`, the toggle is pressed and keeps focus, the URL's search is `q=product&lowStock=true`, and switching it off asks with `q=product&page=1` and no `lowStock`

#### Scenario: Back and Forward
- **WHEN** an admin with one unsaved edit searches " milk ", goes Back, then Forward
- **THEN** after the search the field holds `milk`; after Back the field is empty, the URL holds no `q` and the whole list is shown; after Forward the field holds `milk` and the milk is listed; the edit and "1 unsaved change" are there throughout

### Requirement: Stock pager
Under the table `/stock` SHALL show "Previous", "Page x of y, n products" and "Next", with the page in the URL (`page`, left out for page 1). The button that cannot move SHALL be `aria-disabled`, not `disabled`, and do nothing. The table SHALL stay while the next page loads, so the pressed button keeps keyboard focus. A page beyond the last SHALL be replaced by the last page that has rows.

#### Scenario: Pager
- **WHEN** core holds 30 products and an admin presses "Next", presses it again, then presses "Previous"
- **THEN** "Page 1 of 2, 30 products" shows "Previous" `aria-disabled`; after "Next" the page is "Page 2 of 2, 30 products" with the 25th product, "Next" is `aria-disabled`, not `disabled`, and has focus; the second press sends no request; "Previous" shows page 1 again, keeps focus, and the URL holds no `page`

#### Scenario: Page past the end
- **WHEN** core holds 30 products and an admin opens `/stock?page=9`
- **THEN** "Page 2 of 2, 30 products" is shown with the 25th product and the URL's search is `page=2`

### Requirement: Stock rows while the next list loads
While the next page, search or filter of the same store loads, the rows on screen SHALL stay in a region marked `aria-busy` and dimmed, the pager text SHALL name the page core answered for those rows, not the page asked for, and their quantity fields SHALL be read-only, not disabled, so an edit can never land on a row of the list before. When the answer arrives the region SHALL no longer be busy and the fields SHALL be editable.

#### Scenario: Rows kept while the next page loads
- **WHEN** core holds 30 products, an admin presses "Next", and core has not answered page 2 yet; the admin then focuses the 1st product's field and types `9`
- **THEN** the table's region is `aria-busy` and dimmed, "Page 1 of 2, 30 products" is still shown, the field is read-only, not disabled, keeps focus and its value, and "No unsaved changes" stays; when core answers, "Page 2 of 2, 30 products" is shown, the region is not busy and the 25th product's field is editable

### Requirement: Stock URL values
`/stock` SHALL read a `page` in the URL that is not a whole number above 1 as page 1 and one above 100000 as 100000, and a `lowStock` other than `true` as off. A `q` SHALL lose NUL characters and halves of surrogate pairs and be cut to 100 characters, counted by code point so no character is cut through; the "Search" field SHALL take at most 100 UTF-16 units. No value of the URL SHALL leave the page on a failed load that "Try again" cannot fix.

#### Scenario: Unreadable page or filter
- **WHEN** an admin opens `/stock?page=banana`, `/stock?page=1.5` or `/stock?lowStock=banana`
- **THEN** core is asked with `page=1&pageSize=24` and no `lowStock`, "Page 1 of 2, 30 products" is shown and "Low stock only" is not pressed

#### Scenario: Over-large page
- **WHEN** core holds 30 products and refuses pages above 89478486 with 400, and an admin opens `/stock?page=2147483648`
- **THEN** core is asked for page 100000, then page 2; "Page 2 of 2, 30 products" is shown and there is no alert

#### Scenario: Over-long search
- **WHEN** an admin opens `/stock?q=` followed by 60 `m`, a NUL character and 60 `k`
- **THEN** core is asked with a `q` of the 60 `m` and 40 `k`, the "Search" field inside the form named "Search stock" holds that text and takes at most 100 characters

#### Scenario: Search ending in an emoji
- **WHEN** an admin opens `/stock?q=` followed by 99 `a`, the emoji 😀 and `b`
- **THEN** core is asked with a `q` of the 99 `a` and the whole emoji, the "Search" field holds that text, and there is no alert

#### Scenario: Search cleaned
- **WHEN** a search holds a NUL character, 101 characters, an emoji as its 100th character, or half of a surrogate pair
- **THEN** it becomes the text without the NUL, its first 100 characters, the text up to and with the whole emoji, and the text without the half pair, and each can be written into a request URL

### Requirement: Stock table states
While the stock loads for the first time, `/stock` SHALL show a loading status under its heading; with no matching product, "No products found" instead of the table; when the request fails, the alert "Could not load the stock." with "Try again". An admin with no stores SHALL see "No stores yet" and no selector; when the stores request fails, the alert "Could not load the stores." with "Try again".

#### Scenario: Search without a match
- **WHEN** an admin opens `/stock?q=ghee` and core answers no product
- **THEN** "No products found" is shown, there is no table, and the "Search" field holds `ghee`

#### Scenario: Stock loading
- **WHEN** an admin opens `/stock` and core has not answered the stock yet
- **THEN** the heading "Stock", the "Store" selector and a loading status are shown

#### Scenario: Stock load failure
- **WHEN** core answers the stock with 500 and, after the admin presses "Try again", with one product
- **THEN** the alert "Could not load the stock." is shown first, then the product's quantity field and no alert

#### Scenario: No stores
- **WHEN** an admin opens `/stock` and core answers an empty list of stores
- **THEN** "No stores yet" is shown and there is no "Store" selector

#### Scenario: Stores load failure
- **WHEN** core answers the stores with 500 and, after the admin presses "Try again", with one store
- **THEN** the alert "Could not load the stores." is shown first, then that store's stock

### Requirement: Stock edits
A quantity typed into a row SHALL be kept as an unsaved edit of that product for the store shown, across pages, searches, the filter and Back or Forward. A status region SHALL show "No unsaved changes", "1 unsaved change" or "<n> unsaved changes", and each edited row an "Unsaved" badge. A value that reads as the quantity core holds SHALL NOT be an edit. "Discard changes" SHALL drop every edit and keep keyboard focus; with no edit it SHALL do nothing.

#### Scenario: Edit typed back
- **WHEN** an admin changes a quantity from `17` to `18`, then back to `17`, and presses "Save changes"
- **THEN** "1 unsaved change" shows after the first change with "Save changes" not `aria-disabled`; after the second, "No unsaved changes" shows, no row is marked "Unsaved", "Save changes" is `aria-disabled` but not `disabled`, and no `PUT` is sent

#### Scenario: Discard
- **WHEN** an admin changes two quantities, one to `30` and one to nothing, and presses "Discard changes"
- **THEN** "2 unsaved changes" showed before; afterwards both fields hold what core holds, "No unsaved changes" is shown, "Discard changes" has focus, and no `PUT` was sent

#### Scenario: Value read as the stored quantity
- **WHEN** an admin types `017` for a product core holds 17 of, then saves an edit of another product and presses "Discard changes"
- **THEN** after `017` the count, a `status` region, reads "No unsaved changes", the field shows `17` and no row is marked "Unsaved"; after the save "Stock saved." is shown, and it is still shown after "Discard changes"

### Requirement: Stock save
"Save changes" SHALL send every unsaved edit of the store in one `PUT /admin/stores/{id}/stock` with `{"rows":[{"productId","quantity"}]}`, at most 500 rows in the order the edits were made. On 204 the page SHALL show the status "Stock saved.", SHALL no longer count the rows it sent as edits, and SHALL show the stock as core now holds it, also on pages loaded before the save. An edit not sent, or typed while the save ran, SHALL stay unsaved.

#### Scenario: Edits on two pages saved with one PUT
- **WHEN** core holds 30 products, an admin sets the 1st (quantity 0) to `40`, moves to page 2, sets the 25th to `7`, switches "Low stock only" on and presses "Save changes"
- **THEN** "2 unsaved changes" and the 1st product's `40` are still shown under the filter; exactly one `PUT` goes to the store with the two rows `40` and `7` in that order; then "Stock saved." and "No unsaved changes" are shown, the low-stock list no longer holds the 1st product, and with the filter off its field holds `40` with no "Unsaved" badge

#### Scenario: Kept page read again
- **WHEN** an admin edits a product on page 1, moves to page 2, saves, and presses "Previous" while core has not answered page 1 again
- **THEN** the URL holds no `page`, and the product's field is not shown with its old quantity; when core answers, it holds the saved quantity

#### Scenario: Edit typed during a save
- **WHEN** an admin saves one edit and, before core answers the `PUT`, changes another product's quantity
- **THEN** after the answer "1 unsaved change" is shown, the second product keeps its typed value and its "Unsaved" badge, and the first shows its saved quantity

#### Scenario: More than 500 edits
- **WHEN** 501 edits are turned into the rows of a save
- **THEN** there are 500 rows, the first 500 edits in the order they were made

### Requirement: Stock save in progress
While a save runs, "Save changes" SHALL read "Saving…" and be `aria-disabled`, never `disabled`, so it keeps keyboard focus, and a press SHALL send nothing. An edit typed meanwhile SHALL NOT hide the save's result: when core answers, "Stock saved." SHALL be shown for the rows that were saved.

#### Scenario: Focus through a save
- **WHEN** an admin presses "Save changes" and core has not answered the `PUT` yet, then core answers
- **THEN** while the save runs the button reads "Saving…", is `aria-disabled`, not `disabled`, and has focus; after the answer it reads "Save changes", is not `disabled` and still has focus, and "Stock saved." is shown

#### Scenario: Second press during a save
- **WHEN** an admin saves one edit and, before core answers, changes another product's quantity and presses the button again
- **THEN** the button reads "Saving…" and is `aria-disabled`, exactly one `PUT` was sent, with the first edit only, and after the answer "Stock saved." is shown and the button reads "Save changes"

### Requirement: Stock quantity the page cannot send
A typed quantity that is not a whole number from 0 to 100000 (spaces around it ignored) SHALL be marked invalid on its field as it is typed. While one is unsaved, "Save changes" SHALL send nothing and show the alert "Enter a whole number from 0 to 100000 for: <product names>.". The alert SHALL go when any quantity is edited; the mark SHALL go when the value is a quantity.

#### Scenario: Unsendable quantity
- **WHEN** an admin types `12.5` for Sunny Fields Toned Milk and `9` for Banana Robusta, presses "Save changes", types `100001`, then `12`, and presses "Save changes" again
- **THEN** the milk's field is marked invalid and the banana's is not; the first press sends no `PUT` and shows the alert naming Sunny Fields Toned Milk; typing `100001` removes the alert and keeps the mark; `12` removes the mark; the second press sends one `PUT` with `12` and `9` and "Stock saved." is shown

#### Scenario: Quantity as typed
- **WHEN** the typed values are `0`, `100000`, ` 7 `, `007`, `100001`, `-1`, `1.5`, `1e3` and nothing
- **THEN** the first four are the quantities 0, 100000, 7 and 7 and the others are not quantities, and a value that is not a quantity is left out of a save's rows, never sent as a number

### Requirement: Stock save failures
When core answers the save with 400 `validation`, the page SHALL show the alert "These changes were refused: a changed product may have been deleted. Discard the changes and try again."; on any other failure, "Could not save the stock. Try again.". In both cases every edit SHALL stay unsaved and "Stock saved." SHALL NOT be shown. The alert SHALL go when a quantity is edited.

#### Scenario: Save refused for a deleted product
- **WHEN** an admin saves an edit, core answers 400 `validation` on `rows`, and the admin then edits another quantity
- **THEN** the "These changes were refused" alert is shown with the edit still in its field and "1 unsaved change", there is no "Stock saved.", and the alert goes with the next edit

#### Scenario: Other save failure
- **WHEN** core answers the save with 500 and, on the next "Save changes", with 204
- **THEN** "Could not save the stock. Try again." is shown with the edit kept, then "Stock saved." with no alert, and the one successful `PUT` carries the edit

#### Scenario: Save answered without core's error body
- **WHEN** an admin saves an edit and the answer is a 502 with no body
- **THEN** "Could not save the stock. Try again." is shown, the edit is still in its field with "1 unsaved change", "Stock saved." is not shown, and "Save changes" can be pressed again

### Requirement: Stock save result stays with its visit
The alert of a failed save SHALL be shown only while edits are unsaved. Neither that alert nor "Stock saved." SHALL be shown again once the store on screen has changed: returning to the store shows neither.

#### Scenario: Failed save, then another store and back
- **WHEN** an admin's save at Indiranagar is refused with 400 `validation`, the admin chooses Koramangala, presses "Discard and switch", then chooses Indiranagar again
- **THEN** no alert is shown at Koramangala, and back at Indiranagar the field holds what core holds, "No unsaved changes" is shown and there is no alert

#### Scenario: Saved, then another store and back
- **WHEN** an admin saves an edit at Indiranagar, chooses Koramangala, then Indiranagar again
- **THEN** "Stock saved." is shown after the save, not at Koramangala, and not again at Indiranagar, where the field holds the saved quantity

#### Scenario: Save fails after its edits were discarded
- **WHEN** an admin presses "Save changes", presses "Discard changes" before core answers, and core then answers 500
- **THEN** "No unsaved changes" is shown and there is no alert

### Requirement: Stock store switch with unsaved edits
Choosing another store while edits are unsaved SHALL open the dialog "Discard unsaved changes?" with "Cancel" then "Discard and switch", leaving the store as it is. "Cancel" SHALL keep the store and the edits; "Discard and switch" SHALL show the chosen store. With no edits the store SHALL change at once. Any change of store, also through the URL, Back or Forward, SHALL drop the edits for good: they SHALL never be shown for or sent to another store, nor come back.

#### Scenario: Switch asks first
- **WHEN** an admin with one unsaved edit at Indiranagar chooses Koramangala, presses "Cancel", chooses Koramangala again, presses "Discard and switch", and later chooses Indiranagar
- **THEN** the dialog's buttons are "Cancel" then "Discard and switch"; after "Cancel" the edit and "1 unsaved change" remain and core was not asked for Koramangala; after "Discard and switch" Koramangala's stock and "No unsaved changes" are shown; back at Indiranagar, with no dialog, the field holds what core holds

#### Scenario: Escape on the dialog
- **WHEN** an admin with one unsaved edit at Indiranagar chooses Koramangala and presses Escape
- **THEN** the dialog closes, the selector shows Indiranagar, and the edit and "1 unsaved change" remain

#### Scenario: Store changed in the URL
- **WHEN** an admin with one unsaved edit at Indiranagar reaches `/stock?store=<Koramangala id>` through the URL and presses "Save changes"
- **THEN** Koramangala's stock shows what core holds, "No unsaved changes" is shown, and no `PUT` goes to Koramangala

#### Scenario: Return after a store change in the URL
- **WHEN** an admin with one unsaved edit at Indiranagar reaches Koramangala through the URL and goes Back
- **THEN** Indiranagar's field holds what core holds and "No unsaved changes" is shown

#### Scenario: Save answered after a store change
- **WHEN** an admin saves an edit of a product at Indiranagar, reaches Koramangala through the URL before core answers, types the same quantity for the same product there, and core then answers the first save
- **THEN** Koramangala's edit is still there with "1 unsaved change", and "Stock saved." is not shown

### Requirement: Failure answers without core's error body
The app's client SHALL give every caller an error for any answer with a failure status, also when the body is empty or is not core's error envelope: the caller SHALL then get code `internal` with the answer's status. A failure carrying core's envelope and every success, with or without a body, SHALL reach the caller unchanged. A 401 to the current token SHALL end the session whatever its body.

#### Scenario: Failure without core's error body
- **WHEN** a request is answered 502 with no body, with an empty body and `Content-Length: 0`, with the plain text "Bad Gateway", or with JSON that is not core's envelope
- **THEN** the caller gets no data, an error with code `internal`, and the status 502, and the session is kept

#### Scenario: Core's error passes through
- **WHEN** a request is answered 400 with core's envelope `validation` naming `lowStock`
- **THEN** the caller gets exactly that error, code, message and field, with status 400

#### Scenario: Success without a body
- **WHEN** a request is answered 204
- **THEN** the caller gets no error and the status 204

#### Scenario: 401 without core's error body
- **WHEN** a request carrying the current token is answered 401 with no body
- **THEN** the session is cleared, its loss is reported once, and the caller gets an error with code `internal` and status 401

### Requirement: Stock against core
The admin e2e suite SHALL run the stock page against the real core and the demo seed, with axe finding no violation in every state it visits: the list, the low-stock filter, an unsaved edit and the discard dialog.

#### Scenario: Admin sets stock at a store
- **WHEN** the seeded admin opens Stock, chooses Koramangala, switches "Low stock only" on and off, searches "sunny fields toned", raises Sunny Fields Toned Milk's quantity by one, chooses Indiranagar and cancels the dialog, saves and reloads
- **THEN** Indiranagar was shown first, the URL ends in `stock?store=<Koramangala id>`, every row under the filter carries "Low stock", the edited row is marked "Unsaved", "Stock saved." is shown, after the reload the field holds the new quantity at Koramangala, and the old quantity is saved back

#### Scenario: Store staff set stock at their own store only
- **WHEN** the seeded Koramangala store staff member opens Stock, then `/stock?store=<Indiranagar id>`
- **THEN** the "Stock" table is shown with "Store: Koramangala" and no "Store" selector, and after the second URL core is asked for Koramangala's stock and there is still no selector
