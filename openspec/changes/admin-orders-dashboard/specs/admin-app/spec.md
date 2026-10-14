## ADDED Requirements

### Requirement: Orders board
`/orders` SHALL show one store's active orders as a column per status, in the order Placed, Accepted, Packing, Ready, Out for delivery, each headed by its name and its count. A card SHALL show the order's number, the time since it was placed, its item count (the quantities added up), its total and the pincode of its address; the longest waiting order is first in its column. Delivered and cancelled orders SHALL NOT be on the board. Core is asked once per status with `pageSize=100`.

#### Scenario: Board listed
- **WHEN** an admin opens `/orders` and the first store has two placed orders, one accepted, one out for delivery placed 125 minutes ago, one delivered and one cancelled
- **THEN** the columns read "Placed" 2, "Accepted" 1, "Packing" 0, "Ready" 0, "Out for delivery" 1, the placed column lists the older order first, a card reads "2 min ago", "1 item, pincode 560038" and "₹45.50", the oldest reads "2 h 5 min ago", the empty columns say "No orders", and neither finished order is shown
- **THEN** core was asked five times, for `placed`, `accepted`, `packing`, `ready` and `out_for_delivery`, each with `pageSize=100`

### Requirement: Orders store for admins
An admin SHALL choose the store with a "Store" selector of every store by name. The chosen store SHALL be in the URL as `store`; without it, or with a value that is no store, the first store is shown. Choosing a store SHALL keep the selector focused and SHALL never show, or announce as new, another store's orders: everything the page kept for the store before is dropped.

#### Scenario: Choose a store
- **WHEN** an admin on the board of Indiranagar chooses Koramangala and core has not answered yet
- **THEN** the URL holds `store=<Koramangala>`, a skeleton shows and no order of Indiranagar is on screen; once core answers, Koramangala's orders show, the announcement region is empty and the selector still has focus

#### Scenario: Store in the URL
- **WHEN** an admin opens `/orders?store=<Koramangala>`, then the URL changes to `store=nope`
- **THEN** Koramangala's board shows first with the selector on Koramangala, then the first store's board with the selector on it

### Requirement: Orders store for store staff
Store staff SHALL see the orders of their own store whatever the URL says, with no store selector and no request for the stores list. The page SHALL show "Store: <name>", read from the public `GET /stores/{id}`, and SHALL work without the name when that request fails.

#### Scenario: Store staff see their own store
- **WHEN** store staff of Whitefield open `/orders?store=<Koramangala>`
- **THEN** the board of Whitefield shows with "Store: Whitefield" and no "Store" selector, and core was asked only for `/admin/me`, `/stores/<Whitefield>` and `/admin/stores/<Whitefield>/orders`

#### Scenario: Store name unavailable
- **WHEN** store staff open `/orders` and `GET /stores/{id}` fails
- **THEN** the board shows without a "Store:" line and without an alert

### Requirement: Orders board polling
The board SHALL ask core again every 10 seconds and show each order where it then stands. It SHALL NOT ask while the browser tab is hidden, and SHALL ask at once when the tab is shown again.

#### Scenario: Poll
- **WHEN** the board shows a placed order, another staff member accepts it, and 10 seconds pass
- **THEN** after 9 seconds core had not been asked again, after 10 it was asked the five lists again, and the card is in "Accepted" with "Placed" saying "No orders"

#### Scenario: Hidden tab
- **WHEN** the tab is hidden for 30 seconds and then shown
- **THEN** core was not asked while it was hidden and was asked once it showed

### Requirement: Orders board announcements
The board SHALL carry one visually hidden `role="status"` region named "New orders". An answer from core that holds placed orders the answer before did not SHALL set it to "New order <number>", or "<n> new orders: <numbers>". The first answer for a store, an equal answer and an order first seen in another status SHALL announce nothing; an equal answer SHALL NOT write the region again; a changed answer with no new placed order SHALL empty it.

#### Scenario: New placed order announced once
- **WHEN** the board has loaded with one placed order, and the next poll brings a second placed order and an accepted one
- **THEN** the region was empty after the first load and reads exactly "New order SS-TEST0002" after the poll
- **THEN** two more polls with the same answer do not write the region again, a poll in which only a status changed empties it, and a poll with two more placed orders sets it to "2 new orders: SS-TEST0004, SS-TEST0005"

### Requirement: Orders time since placed
A card's time since placed SHALL move on by itself, without core being asked and without the rest of the board rendering again: "just now" under a minute, "<m> min ago" under an hour, "<h> h <m> min ago" from there.

#### Scenario: A minute passes
- **WHEN** a card reads "3 min ago" and 65 seconds pass, 9 of them before the next poll
- **THEN** core was not asked during the first 9 seconds and the card reads "4 min ago"

#### Scenario: Wording
- **WHEN** an order was placed 59, 60, 599, 3599, 3600 and 7500 seconds ago
- **THEN** its card reads "just now", "1 min ago", "9 min ago", "59 min ago", "1 h 0 min ago" and "2 h 5 min ago"

### Requirement: Orders board states
The board SHALL show a skeleton while its first answer loads; the alert "Could not load the orders." with "Try again" when it fails with nothing to show; and "No active orders" when the store has none. An admin with no stores SHALL see "No stores yet"; a stores list that fails with nothing to show SHALL show "Could not load the stores." with "Try again".

#### Scenario: Board loading
- **WHEN** core has not answered the lists yet
- **THEN** a skeleton named "Loading" shows under the heading and the store selector, and the orders once core answers

#### Scenario: Board load failure
- **WHEN** core answers the first lists with 500 and the admin presses "Try again" after core recovers
- **THEN** the alert "Could not load the orders." shows first, then the orders and no alert

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

#### Scenario: Failed refresh keeps the history
- **WHEN** History shows one delivered order, a second is delivered, the tab is shown again and core fails, then shown again and core answers
- **THEN** the one row and "Page 1 of 1, 1 orders" stay with the notice and no alert; then both orders are listed and the notice is gone

#### Scenario: Failed refresh keeps the sheet
- **WHEN** an order is opened from its card and core fails to answer the read of the order
- **THEN** the sheet shows the order as the card held it, with "Could not refresh. Showing what was loaded last." as a status inside the sheet, the "Cancel order" button and no alert

### Requirement: Order next status
Each card SHALL carry exactly one button for its order's next status, named with the order's number: "Accept", "Start packing", "Mark ready", "Send out", "Mark delivered". A press SHALL send one `POST /admin/orders/{id}/status` with `{"status":"<next>"}`, show the card where core's answer puts it without listing the orders again, and say "<number> is now <Status>." in a `role="status"` region.

#### Scenario: One button per card
- **WHEN** the board holds one order in each active status
- **THEN** each column's card has one next-status button, named "Accept SS-TEST0001", "Start packing SS-TEST0002", "Mark ready SS-TEST0003", "Send out SS-TEST0004" and "Mark delivered SS-TEST0005"

#### Scenario: Accept
- **WHEN** staff press "Accept SS-TEST0001" on a board with two placed orders
- **THEN** one `POST` with body `{"status":"accepted"}` was sent, "SS-TEST0001 is now Accepted." shows as a status, the card is in "Accepted" with the button "Start packing SS-TEST0001", one card is left in "Placed", and core was not asked for the lists again

### Requirement: Order status change in progress
While a status change runs, the pressed button SHALL read "Saving…", keep keyboard focus and be `aria-disabled`, never `disabled`; every other card's button SHALL be `aria-disabled` too. A second press, on that button or another card's, SHALL send nothing. After the move, a keyboard left nowhere SHALL be put on the card's new button, or on the result when the order left the board.

#### Scenario: Second press during a change
- **WHEN** staff press "Accept SS-TEST0001", core has not answered, and they press it again and then "Start packing SS-TEST0002"
- **THEN** the button reads "Saving… SS-TEST0001", has focus, is not disabled and is `aria-disabled`, as is the other card's button, and one `POST` was sent in all; after core answers the other button is no longer `aria-disabled`

#### Scenario: Focus after a move
- **WHEN** staff press "Accept SS-TEST0001" and core answers
- **THEN** the button "Start packing SS-TEST0001" has focus

### Requirement: Order delivered asks first
"Mark delivered" SHALL open a `Dialog` titled "Mark <number> delivered?" with the buttons "Cancel" then "Mark delivered", because a delivered order cannot be taken back. "Cancel" SHALL send nothing and return focus to the card's button. Confirming SHALL send `{"status":"delivered"}` once; the order then leaves the board.

#### Scenario: Mark delivered
- **WHEN** staff press "Mark delivered SS-TEST0001", press "Cancel", press the card's button again and confirm
- **THEN** after "Cancel" nothing was sent and the card's button has focus; after confirming, one `POST` with `{"status":"delivered"}` was sent, "SS-TEST0001 is now Delivered." shows and has focus, the dialog is closed and the order is not on the board

### Requirement: Order status conflict
When core answers a status change with 409 `conflict`, the page SHALL read the order again with `GET /admin/orders/{id}`, show it where it now stands (off the board when it is finished) and say "<number> was changed by someone else first: it is now <Status>." in a `role="status"` region, with no alert. Nothing SHALL be sent again.

#### Scenario: Accepted by someone else
- **WHEN** another staff member accepted SS-TEST0001 since the last poll and staff press "Accept SS-TEST0001"
- **THEN** one `POST` and one `GET` of the order were sent, the message names "Accepted", and the card is in "Accepted" with "Start packing SS-TEST0001"

#### Scenario: Cancelled by the customer
- **WHEN** the customer cancelled SS-TEST0002 since the last poll and staff press "Accept SS-TEST0002"
- **THEN** the message reads "SS-TEST0002 was changed by someone else first: it is now Cancelled.", the order is off the board and there is no alert

### Requirement: Order status failure
Any other failure of a status change, and a 409 whose order cannot be read again, SHALL show the alert "Could not change the status of <number>. Try again." and leave the card where it is, with focus on its button. The next successful change SHALL remove the alert.

#### Scenario: Status change fails
- **WHEN** core answers "Accept SS-TEST0001" with 500, then with 200 when pressed again
- **THEN** the alert shows with the card still in "Placed" and its button focused; after the second press "SS-TEST0001 is now Accepted." shows with no alert, and two `POST`s were sent in all

#### Scenario: Conflict that cannot be read
- **WHEN** core answers the change with 409 and the read of the order with 500
- **THEN** the alert shows and no "is now" message

### Requirement: Order status change and a poll in the air
A poll that core read before a status change and answers after it SHALL NOT move the card back: the page shows core's answer to the change, drops the poll still in the air, and polls again 10 seconds later.

#### Scenario: Late poll answer
- **WHEN** a poll is in the air holding the order as placed, staff press "Accept", core answers the change, and then the poll's answer arrives
- **THEN** the card is in "Accepted" and stays there, "Placed" says "No orders", and core is asked the lists again at the next interval

### Requirement: Order detail sheet
A card's number, and a History row's, SHALL be a button that opens a `Sheet` titled "Order <number>" with the status badge, when it was placed, the items with quantity, unit and line total, subtotal, delivery fee and total, the customer's name and phone as a `tel:` link (or "No phone number"), the address, and the events oldest first with who made them, when, and their note. Closing it SHALL return focus to the button.

#### Scenario: Order opened from its card
- **WHEN** staff press "SS-TEST0001" on its card
- **THEN** the sheet shows "Placed 13 Oct 2026, 2:50 pm", "1 × Banana Robusta, 1 kg" ₹70, "3 × Pomegranate Bhagwa, 1 kg" ₹960, subtotal ₹1,030, delivery fee ₹0, "Total, cash on delivery" ₹1,030, "Demo Customer", the link "+919800000000" to `tel:+919800000000`, "Home: 12 80 Feet Rd, Koramangala, 560034" and "Placed by the customer, 13 Oct 2026, 2:50 pm"

#### Scenario: Sheet closed
- **WHEN** staff press "Close" on the sheet
- **THEN** no dialog is open and the card's "SS-TEST0001" button has focus

### Requirement: Order sheet follows core
The sheet SHALL show the opened order at once as the card or row held it, read it from `GET /admin/orders/{id}`, and show what core answers. While the order is active the sheet SHALL read it again every 10 seconds; a delivered or cancelled order is read once and not again.

#### Scenario: Order changed since the last poll
- **WHEN** another staff member accepted the order with the note "Packing now" since the board's last poll, the customer has no phone and the address has a second line, and staff open the order
- **THEN** the sheet shows "Accepted by staff, 13 Oct 2026, 2:51 pm: Packing now", "Home: 12 80 Feet Rd, Koramangala, Flat 4, 560034" and "No phone number", with no link

#### Scenario: Open sheet polled
- **WHEN** a sheet is open on a placed order and the order moves to packing at the store
- **THEN** after 10 seconds the order was read a second time, the sheet shows "Packing" and no "Cancel order" button

#### Scenario: Finished order not polled
- **WHEN** staff open a cancelled order from History and 30 seconds pass
- **THEN** the order was read once and the list was not asked again

### Requirement: Order cancel with a reason
The sheet SHALL offer "Cancel order" only while the order is placed or accepted. It SHALL open a `Dialog` "Cancel order <number>?" in place of the sheet, with a "Reason" field of at most 500 characters and the buttons "Keep order" then "Cancel order". A reason is required. Confirming SHALL send one `POST` with `{"status":"cancelled","note":"<reason, trimmed>"}`; the sheet then shows "Order cancelled.", the order cancelled with its reason, and the order leaves the board.

#### Scenario: Cancel offered
- **WHEN** staff open a placed, an accepted and a packing order in turn
- **THEN** the first two sheets have a "Cancel order" button and the third has none

#### Scenario: Order cancelled
- **WHEN** staff open SS-TEST0001, press "Cancel order", type " Out of stock " and confirm
- **THEN** one `POST` with `{"status":"cancelled","note":"Out of stock"}` was sent, the sheet shows "Order cancelled." as a status, "Cancelled", "Reason for cancelling: Out of stock" and the event with its note, and has no "Cancel order" button; after closing, the order is off the board and the other order is still on it

#### Scenario: Reason missing
- **WHEN** staff confirm with a reason of spaces only, then type a letter
- **THEN** nothing was sent and the field is invalid with "Enter a reason."; after the letter the message is gone and the field is valid

#### Scenario: Keep order
- **WHEN** staff open the cancel dialog and press "Keep order", then open it again and press Escape
- **THEN** both times the sheet "Order SS-TEST0001" is the open dialog again and nothing was sent

### Requirement: Order cancel in progress and refused
While a cancel runs its button SHALL read "Cancelling…", keep focus and be `aria-disabled`, never `disabled`; a second press sends nothing and the dialog cannot be closed. A failure SHALL show "Could not cancel the order. Try again." in the dialog and keep the reason. A 409 SHALL close the dialog and show on the sheet "Someone else changed this order first: it is now <Status>.", with the order where it stands on the sheet and on the board.

#### Scenario: Second press during a cancel
- **WHEN** staff confirm a cancel, core has not answered, and they press the button again, then "Keep order", then Escape
- **THEN** the button reads "Cancelling…", has focus, is not disabled and is `aria-disabled`, the cancel dialog is still open and one `POST` was sent; once core answers "Order cancelled." shows

#### Scenario: Cancel fails
- **WHEN** core answers the cancel with 500, then with 200 when confirmed again
- **THEN** the alert shows in the dialog with the reason still in the field; after the second press "Order cancelled." shows with no alert, and two `POST`s were sent

#### Scenario: Cancel refused once packing
- **WHEN** packing started on an accepted order while its cancel dialog was open, and staff confirm
- **THEN** the sheet shows "Someone else changed this order first: it is now Packing." as a status, no "Cancel order" button and no "Order cancelled."; after closing, the card has the button "Mark ready SS-TEST0001"

### Requirement: Order status badges
A status badge SHALL carry the status as text, with the names Placed, Accepted, Packing, Ready, Out for delivery, Delivered and Cancelled, and SHALL be the `accent` badge while the order is under way, `success` when delivered and `neutral` when cancelled; never `danger` or `warning` (D28).

#### Scenario: Badge of an order under way and of a cancelled one
- **WHEN** staff open a placed order, and cancel it
- **THEN** the badge reads "Placed" on the accent surface, then "Cancelled" on the neutral surface

### Requirement: Orders history
`/orders` SHALL have the tabs "Board" and "History", the current one marked `aria-current="page"` and held in the URL (`tab=history`), with the store kept. History SHALL list one page of 24 finished orders of the store, newest first, in a table "Order history": number, placed, customer, items, total, and when it was delivered or cancelled. "Delivered" and "Cancelled" SHALL choose which, in the URL (`status=cancelled`), from page 1.

#### Scenario: Delivered orders listed
- **WHEN** an admin opens `/orders?tab=history` and the store has two delivered orders, a cancelled and a placed one
- **THEN** the table lists the two delivered orders, newest first, a row reading "SS-TEST0001", "13 Oct 2026, 2:31 pm", "Demo Customer", "4 items", "₹1,030", "13 Oct 2026, 3:31 pm" under the last heading "Delivered", with "Page 1 of 1, 2 orders", "Delivered" pressed and "History" the current tab; core was asked once, with `status=delivered`, `page=1`, `pageSize=24`

#### Scenario: Tabs
- **WHEN** an admin on `/orders?store=<Koramangala>` presses "History", then "Board", then goes Back
- **THEN** the URL holds `store` and `tab=history` and the history shows with no board column; then the board with `store` alone; then the history again with "History" current

#### Scenario: Cancelled orders
- **WHEN** an admin on page 2 of the delivered orders presses "Cancelled" and core has not answered yet
- **THEN** a skeleton shows with no table and the pressed button keeps focus; once core answers the one cancelled order shows under the heading "Cancelled" with when it was cancelled, the URL holds `tab=history&status=cancelled` and core was asked once more, for page 1; "Delivered" brings back page 1 of the delivered orders and removes `status` from the URL

#### Scenario: No finished orders
- **WHEN** the store has no cancelled order and the admin opens the cancelled list
- **THEN** "No cancelled orders" shows with no table and no pager

#### Scenario: History loading and load failure
- **WHEN** core has not answered the list, then answers 500, and the admin presses "Try again" after core recovers
- **THEN** a skeleton shows under the status buttons, then the alert "Could not load the orders.", then the table and no alert

### Requirement: Orders history pager
History SHALL have a pager: "Previous", "Page <x> of <y>, <n> orders" and "Next", the page in the URL. The button at an end SHALL be `aria-disabled`, never `disabled`, and do nothing. While the next page loads, the rows on screen SHALL stay in an `aria-busy` container under the page number core answered for them, and the pressed button keeps focus.

#### Scenario: Pager
- **WHEN** an admin on page 1 of 30 delivered orders presses "Previous", then "Next" while core holds its answer
- **THEN** "Previous" was `aria-disabled` and asked core nothing; while page 2 loads the table is `aria-busy` and still reads "Page 1 of 2, 30 orders" with its own rows; then page 2 shows six orders, not busy, "Next" has focus, is `aria-disabled` and not disabled, the URL holds `page=2`, "History" is still the current tab, and another press of "Next" asks core nothing

### Requirement: Orders URL values
The page SHALL read only what it can use from the URL and never ask core for what core would refuse: a `tab` other than `history` is the board; a `status` other than `cancelled` is the delivered list; a `page` that is not a whole number above 1 is page 1; a `page` above 100000 is cut to 100000. A page past the end SHALL move to the last page that has rows.

#### Scenario: Unreadable values
- **WHEN** the URL holds `tab=archive`; `tab=history&status=placed`; `tab=history&page=banana`, `page=0` or `page=1.5`
- **THEN** the board shows with "Board" current; in every other case the delivered orders show and core was asked for `status=delivered`, `page=1`

#### Scenario: Over-large page
- **WHEN** an admin opens `/orders?tab=history&page=2147483648` at a store with 30 delivered orders
- **THEN** core was asked for page 100000 and then page 2, "Page 2 of 2, 30 orders" shows and the URL holds `page=2`

### Requirement: Orders history and the store
Choosing a store on History SHALL keep the tab, start at page 1 with one request, and never show the other store's rows. A history list kept from before a status change SHALL be read again on the next visit and SHALL NOT be shown meanwhile as it was.

#### Scenario: Store chosen on History
- **WHEN** an admin on page 2 of Indiranagar's history chooses Koramangala and core has not answered yet
- **THEN** a skeleton shows with no table; once core answers Koramangala's one order shows with "Page 1 of 1, 1 orders", the URL holds `store` and `tab=history` only, and Koramangala was asked once, for page 1

#### Scenario: History after a delivery
- **WHEN** an admin sees "No delivered orders" on History, marks an order delivered on the board and opens History again before core answers
- **THEN** a skeleton shows and "No delivered orders" does not; once core answers the delivered order is listed

### Requirement: Dashboard
`/` SHALL show a card per store that `GET /admin/dashboard` answers, in core's order (every store by name for an admin, their own for store staff), named by the store: "Orders today" with their sum and a line per status, "Revenue today" and "Low stock" as a count of products. Each card SHALL link "Orders" to `/orders?store=<id>` and "Low stock" to `/stock?store=<id>&lowStock=true`, each link named with the store.

#### Scenario: Dashboard cards
- **WHEN** an admin opens `/` and core answers Indiranagar (no orders, 1 product low) and Koramangala (1, 2, 3, 4, 5, 6, 7 by status, 20 low, revenue 618050)
- **THEN** the cards are headed "Indiranagar" then "Koramangala"; Koramangala reads "Orders today" 28, the seven statuses with their counts, "Revenue today" ₹6,180.50 and "Low stock" "20 products"; Indiranagar reads ₹0 and "1 product"; core was asked for `/admin/me` and `/admin/dashboard` only

#### Scenario: Dashboard links
- **WHEN** an admin presses "Low stock at Koramangala"
- **THEN** the link pointed to `/stock?store=<Koramangala>&lowStock=true`, "Orders at Koramangala" to `/orders?store=<Koramangala>`, and `/stock` opens with `store` and `lowStock` true in the URL

#### Scenario: Store staff dashboard
- **WHEN** store staff open `/` and core answers their one store
- **THEN** one card shows, and its "Low stock" link holds their store

### Requirement: Dashboard states
The dashboard SHALL show a skeleton while its first answer loads; the alert "Could not load the dashboard." with "Try again" when it fails with nothing to show; "No stores yet" when core answers no store. A refresh that fails SHALL keep the cards, with the app's notice "Could not refresh. Showing what was loaded last." and no alert, until the next good answer.

#### Scenario: Dashboard loading
- **WHEN** core has not answered yet
- **THEN** the heading "Dashboard" and a skeleton named "Loading" show, and the card once core answers

#### Scenario: Dashboard load failure
- **WHEN** core answers 500 and the admin presses "Try again" after core recovers
- **THEN** the alert shows first, then the card and no alert

#### Scenario: Failed refresh keeps the dashboard
- **WHEN** the dashboard shows a card, the tab is shown again and core fails, then shown again and core answers one more placed order
- **THEN** the card stays with "Orders today" 28, the notice and no alert; then the card reads 29 and the notice is gone

#### Scenario: No stores on the dashboard
- **WHEN** core answers an empty list
- **THEN** "No stores yet" shows and no card

### Requirement: Orders against core
The admin e2e suite SHALL cover the orders pages and the dashboard against the real core and the demo seed, reset before every run, with axe on every page, sheet and dialog it visits.

#### Scenario: Store staff take the placed order to delivered
- **WHEN** the seeded Koramangala store staff sign in, open Orders, open SS-DEMOAAAD and its cancel dialog without cancelling, press "Accept", "Start packing", "Mark ready", "Send out" and "Mark delivered" with its confirmation, and open History
- **THEN** "Store: Koramangala" shows with no selector; the card read "4 items, pincode 560034" and ₹1,030; the sheet showed the customer, phone, address and items; after each press the status message named the new status and the card stood in that column; after the last the card is gone; History lists SS-DEMOAAAD and SS-DEMOAAAB, the sheet of SS-DEMOAAAD shows "Delivered by staff" and no cancel, "Cancelled" lists SS-DEMOAAAC alone, also after a reload; axe finds no violation anywhere

#### Scenario: Admin sees the dashboard and a store's orders
- **WHEN** the seeded admin signs in and presses "Orders at Koramangala"
- **THEN** the dashboard headed its cards "Indiranagar" and "Koramangala", the "Low stock" link of Koramangala pointed to `/admin/stock?store=<Koramangala>&lowStock=true`, the orders page opens with the selector on Koramangala and "Board" current, History lists SS-DEMOAAAB, and axe finds no violation

### Requirement: Ordered product against core
The admin e2e suite SHALL cover, against the real core and the demo seed, that deleting a product that was ordered offers to deactivate it instead. The offer is not taken, so the product stays active for the other suites.

#### Scenario: Ordered product offers Deactivate instead
- **WHEN** the seeded admin opens Banana Robusta (`…0601`, on the seeded orders), presses "Delete product" and "Delete", then "Cancel", and reloads
- **THEN** the dialog showed the alert "This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it." with the buttons "Cancel" then "Deactivate instead" and no axe violation, and the product's page still opens
