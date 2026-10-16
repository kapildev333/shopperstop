## Context

Orders live in `internal/order`: `place.go` (`Place`, one transaction: cart, address, store, `stock.Reserve`, `CreateOrder`, items, placement event, `cart.Clear`), `status.go` (the status table, `allowed`, `Transition` under the order's row lock, stock released on a cancel), `handlers.go` (routes, scopes, `actorOf` for service callers), `order.go` (`Order`, `Event`, `views`). `orders.payment_method` exists since 0006 as `text not null default 'cod' check (payment_method = 'cod')` and `Order.paymentMethod` is already a required JSON field with enum `["cod"]`; `order_events.actor_type` already admits `system` (0006, 0007) and `OrderEvent.actorType` already lists it. `auth.CustomerByID` returns `EmailVerified` (core-P4-L2). Service tokens: `config.ServiceTokens` (name to token) feed `auth.New`; `OrService(staff)` admitted any configured service on five routes.

Everything below was spiked in this worktree at 8bee46d and the tree restored before the commit: after each task every core package green under `-race -count=1`; `make gen postman` clean (Postman tests pass); after Task 4 `make test-web` passes (all five workspaces lint, typecheck, test, build). The four diffs apply as a chain with `git apply --include='*_test.go'` then `--exclude='*_test.go'` on 8bee46d (checked). Rebuilding `openapi.json` from 8bee46d with the three scripts in order reproduces the spiked file byte for byte.

## Goals / Non-Goals

**Goals:** the order-side half of D50 and D51: payment method and status on orders, the verified-email rule, the accept guard, the payment route, the payment row of the service actor table, the events feed whose cursor never skips, each service on exactly its routes, the demo paid order.

**Non-Goals:** the payment service; app screens; refunds or timeouts in core (the payment service drives both); retry-idempotent payment changes; a push from core.

## Decisions

### 1. One migration, a constraint for the method and status pair

`0011_payments.sql` swaps the 0006 check for `payment_method in ('cod','online')`, adds enum `payment_status` and nullable `orders.payment_status`, `payment_reference text not null default ''` (like `cancel_reason`; omitted in JSON when empty), and `orders_payment_status check ((payment_method = 'online') = (payment_status is not null))`, so a cash order can never carry a payment status. `order_events.seq bigserial not null` (the `not null` makes sqlc emit `int64`) with unique index `order_events_seq`. Existing events are numbered in no particular order, which is harmless: consumers start at `after=0` once.

### 2. Placement

`createRequest.PaymentMethod`: `""` becomes `cod`; `cod` and `online` pass; anything else (case and spaces included) is 400 field `paymentMethod`, before the transaction. `Place` takes the method, reads the customer first in the transaction (it was read late before), and refuses an unverified online placement with 409 `email_unverified` before looking at the cart: the client fixes the email before anything else. `CreateOrder` writes `payment_method` and `payment_status` (`pending` for online, null for cash). Every read gets `paymentStatus` and `paymentReference` from the row, both omitted when empty.

### 3. Accept guard

`LockOrder` also returns `payment_status`; `Transition` answers 409 `payment_pending` for a move to `accepted` while it is `pending`, after the table check (a move the table refuses stays `conflict`). Cancels are untouched, so the customer, staff and the timeout all cancel an unpaid order and its stock returns.

### 4. Payment route

`order.SetPayment` (new `payment.go`): body first (`status` in `paymentFrom`, `reference` trimmed 1 to 100), then one transaction: `LockOrder` with no scope, compare the current payment status with the one the change must come from (a cash order has none: 409), `SetPayment`, and an event from and to the order's current status by `system` with `actorName` the calling service (`payment`) and note `Payment <status>, reference <ref>`. A changed status is never needed, so `orders.status` and the transition log are untouched; one `order payment` log line records the change. Answers the order with no scope. Simplification: a second identical `paid` is 409, not 200; the payment service reads the order after a 409 to learn whether its own change landed (ceiling: one extra read per lost answer).

### 5. Service actor table, and each service on its own routes

`serviceActors` in `handlers.go`: `rider` names `{type: rider, id, name}` and moves to `out_for_delivery` or `delivered`; `payment` names `{type: system, name}`, no id, and only cancels. `actorOf` now takes the target and checks the row first: an unknown service or a target outside the row is 403 before the actor and before the order is read (so the rider's "cancel without an actor" is now 403, not 400). `Transition`'s `allowed` admits `system` for cancels only; the event's `actor_id` is null when the actor has no id. Per the manager's request (relayed from platform-P5-L1), `OrService(staff, names...)` and the new `RequireService(names...)` take the services each route admits; another service's token falls through to `RequireStaff`, which answers 403 `staff only`. `RequireService` wraps `OrService` around a `RequireStaff` that always refuses with 403 `services only`, so no token or a customer token is 401 and a staff session 403, with no new lookup code. The contract test now probes every operation with each configured service token: a declared operation must admit at least one, an undeclared one must refuse each.

The system's cancel (the payment timeout) is refused 409 `conflict` under the row lock unless the payment is `pending`, so a paid or cash order is never cancelled by the payment service (task 5, a fix after the task 2 review; `Transition` checks it after the table).

### 6. Events feed and commit-ordered seq

`GET /admin/order-events` (`events.go`, `RequireService("payment")`): `after` parsed with `strconv.ParseInt` (0 to 2^62, so `seq` never outgrows it), `limit` 1 to 500, both 400 naming the parameter; one join of `order_events` and `orders` ordered by `seq`; `{items}` with no envelope. `paymentStatus` is the order's current one (simplification; the refund worker needs exactly that). A bigserial alone would let a reader see `seq` 11 committed while 10 is still open and move its cursor past 10 for good, losing a refund; so every event insert first runs `LockEvents` (`pg_advisory_xact_lock(hashtext('order_events'))`) through `order.addEvent`, held to commit, and `seq` is handed out in commit order. Ceiling (`ponytail:` comment on the query): one lock serialises every event write across stores, held only from the event insert to commit; per-store streams if order volume needs it. The seed inserts its events in one transaction alone and needs no lock.

### 7. Seed

`SS-DEMOAAAC` is taken by `...0702` (cancelled), so the paid demo order is `00000000-0000-4000-8000-000000000704` `SS-DEMOAAAE`, `placed` three days ago (the oldest of the four: history order and the "today" dashboard counts stay as they are), 2 of `...0602` and 3 of `...0604`, `online`, `paid`, reference `fake_demo_0a01`, events: placed by the customer, then the payment event by `system` `payment` one minute later with no actor id. The three older orders are written `cod` explicitly. `summary.go` lists `...0704`; Postman keeps `orderId` `...0703`.

### 8. `openapi.json` edits by script

Three Python scripts below, run once from `services/core`, never committed; save each to a scratchpad file not named after a stdlib module. `openapi.json` round-trips byte for byte through `json.dumps(d, indent=2, ensure_ascii=False) + '\n'`. `OrderCreate.paymentMethod` carries no `default` keyword: openapi-typescript would make it required and break `apps/web/src/orders.ts` line 147 (spiked); the description says `cod` when absent.

### Cross-area

- Types: with the final `core.d.ts`, `packages/ui`, web, admin, rider and mobile typecheck and `make test-web` passes (spiked). `Order.paymentMethod` was already required; the enum only widens.
- e2e (not run by this lane; the demo customer sees four orders after Task 4). Fixes valid before and after, for the owning areas to land first:
  - `apps/web/e2e/orders.spec.ts` line 126: `await expect(cards.filter({ hasNotText: 'SS-DEMOAAAE' })).toHaveCount(3)` (`nth(0..2)` stay D, C, B because E is the oldest).
  - `apps/mobile/e2e/orders.spec.ts` line 110: `await expect(page.getByRole('link', { name: /^View order SS-DEMOAAA[BCD],/ })).toHaveCount(3)`.
  - Admin's e2e filters by order number and its dashboard counts orders placed today; E sits in Koramangala's Placed column three days old with Accept enabled (paid). No admin change needed.
- Display (for the Phase 5 app lanes, not blocking): a payment change is an event whose `fromStatus` equals `toStatus`, by `system`, with a human note. Admin's order sheet renders it today as "Placed by payment"; web and mobile timelines may show a second "Placed" step. The app lanes should render such an event by its note.
- Rider: decodes `paymentMethod` as a free string and ignores unknown members; its delivery table has no check on the method; no change. An online order reaches it only after `paid`.
- Payment service: send `fake_demo_0a01` as the demo payment's gateway reference for `...0704`; treat 409 from the payment route as "read the order"; filter feed items with `fromStatus == toStatus` (payment events) out of the cancel handling.

## Risks / Trade-offs

- [Global events lock] → serialises event writes for milliseconds each; named ceiling (Decision 6).
- [The rider's cancel without an actor now 403, was 400] → no caller relies on it; the spec says target first.
- [Feed paymentStatus is current, not historical] → named in the contract; enough for refunds.
- [Two e2e lines] → one line each in web and mobile, valid both ways.
- [Platform tokens] → platform-P5-L1 owns the Makefile; config_test pins its values (`dev-payment-service-token-dev-pay-00`, `e2e-payment-service-token-e2e-pay-00`).

## Code (verbatim diffs from the spike)

Apply each block with `git apply` from the worktree root (save it to a scratchpad file first). Each task's block holds its tests and its code: split them with `git apply --include='*_test.go' <file>` (the test commit) and then `git apply --exclude='*_test.go' <file>` (the feat commit). Generated files are not shown: after the SQL edits run `make gen` (sqlc, then `core.d.ts`); after the task's `openapi.json` script run `make gen postman`.


## Task 1: payment method on placement and reads

```diff
diff --git a/services/core/internal/app/orders_payment_test.go b/services/core/internal/app/orders_payment_test.go
new file mode 100644
index 0000000..14580ca
--- /dev/null
+++ b/services/core/internal/app/orders_payment_test.go
@@ -0,0 +1,92 @@
+package app
+
+import (
+	"context"
+	"encoding/json"
+	"net/http"
+	"strings"
+	"testing"
+)
+
+// verified marks the customer's email verified, as POST /auth/verify-email would.
+func verified(t *testing.T, b buyer) buyer {
+	t.Helper()
+	if _, err := testPool.Exec(context.Background(), "update customers set email_verified = true where id = $1", b.ID); err != nil {
+		t.Fatal(err)
+	}
+	return b
+}
+
+// placePaid sends POST /orders with the buyer's address and paymentMethod method.
+func placePaid(t *testing.T, b buyer, method string) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, ordersPath, b.Token, map[string]any{"addressId": b.AddressID, "paymentMethod": method})
+}
+
+// TestPlaceOnline: a verified customer's online order is placed as a cash one is,
+// with payment status pending on every read and no reference yet.
+func TestPlaceOnline(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	stockTo(t, s.ID, p, 5)
+	b := verified(t, newBuyer(t, s.Pincode))
+	setLine(t, b.Token, s.ID, p, 2)
+
+	status, body := placePaid(t, b, "online")
+	var o orderView
+	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
+		t.Fatalf("place online: got %d %s, want 201", status, body)
+	}
+	if o.Status != "placed" || o.PaymentMethod != "online" || o.PaymentStatus != "pending" || strings.Contains(string(body), "paymentReference") {
+		t.Fatalf("online order %s: want placed, online, pending and no paymentReference", body)
+	}
+	if got := quantityAt(t, s.ID, p); got != 3 {
+		t.Fatalf("stock after placement %d, want 3", got)
+	}
+	for _, read := range []struct{ path, token string }{{ordersPath + "/" + o.ID, b.Token}, {adminOrderPath(o.ID), adminToken(t)}} {
+		if got := readOrder(t, read.path, read.token); got.PaymentMethod != "online" || got.PaymentStatus != "pending" {
+			t.Fatalf("GET %s: paymentMethod %q paymentStatus %q, want online and pending", read.path, got.PaymentMethod, got.PaymentStatus)
+		}
+	}
+}
+
+// TestPlaceCash: an explicit cod order carries no paymentStatus or paymentReference member.
+func TestPlaceCash(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	b := newBuyer(t, s.Pincode)
+	setLine(t, b.Token, s.ID, p, 1)
+	status, body := placePaid(t, b, "cod")
+	if status != http.StatusCreated || !strings.Contains(string(body), `"paymentMethod":"cod"`) || strings.Contains(string(body), "paymentStatus") || strings.Contains(string(body), "paymentReference") {
+		t.Fatalf("place cod: got %d %s, want 201 with paymentMethod cod and no payment status or reference", status, body)
+	}
+}
+
+// TestPlaceOnlineUnverified: an unverified customer cannot pay online and nothing
+// changes; the same cart is placed for cash.
+func TestPlaceOnlineUnverified(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	stockTo(t, s.ID, p, 5)
+	b := newBuyer(t, s.Pincode)
+	setLine(t, b.Token, s.ID, p, 2)
+
+	status, body := placePaid(t, b, "online")
+	expectError(t, "online, unverified", status, body, http.StatusConflict, "email_unverified", "", "")
+	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
+	mustPlace(t, b)
+}
+
+// TestPlacePaymentMethodInvalid: any other method is 400 field paymentMethod and changes nothing.
+func TestPlacePaymentMethodInvalid(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	stockTo(t, s.ID, p, 5)
+	b := verified(t, newBuyer(t, s.Pincode))
+	setLine(t, b.Token, s.ID, p, 2)
+	for _, method := range []string{"card", "ONLINE", " cod"} {
+		status, body := placePaid(t, b, method)
+		expectError(t, method, status, body, http.StatusBadRequest, "validation", "paymentMethod", "")
+	}
+	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
+}
diff --git a/services/core/internal/app/orders_test.go b/services/core/internal/app/orders_test.go
index 29ea01e..ee28c33 100644
--- a/services/core/internal/app/orders_test.go
+++ b/services/core/internal/app/orders_test.go
@@ -86,6 +86,8 @@ type orderView struct {
 	DeliveryFeeCents int64            `json:"deliveryFeeCents"`
 	TotalCents       int64            `json:"totalCents"`
 	PaymentMethod    string           `json:"paymentMethod"`
+	PaymentStatus    string           `json:"paymentStatus"`
+	PaymentReference string           `json:"paymentReference"`
 	PlacedAt         time.Time        `json:"placedAt"`
 	DeliveredAt      *time.Time       `json:"deliveredAt"`
 	CancelledAt      *time.Time       `json:"cancelledAt"`
diff --git a/services/core/internal/order/handlers.go b/services/core/internal/order/handlers.go
index d0d4cc0..bf76ca5 100644
--- a/services/core/internal/order/handlers.go
+++ b/services/core/internal/order/handlers.go
@@ -44,7 +44,8 @@ func staffScope(ctx context.Context) scope {
 
 // createRequest is the POST /orders body.
 type createRequest struct {
-	AddressID string `json:"addressId"`
+	AddressID     string `json:"addressId"`
+	PaymentMethod string `json:"paymentMethod"`
 }
 
 // Create answers 201 with the order placed from the signed-in customer's cart.
@@ -64,8 +65,16 @@ func Create(pool *pgxpool.Pool) http.HandlerFunc {
 			httpx.WriteError(w, r, invalid("addressId", "must be a uuid"))
 			return
 		}
+		switch in.PaymentMethod {
+		case "":
+			in.PaymentMethod = "cod"
+		case "cod", "online":
+		default:
+			httpx.WriteError(w, r, invalid("paymentMethod", "must be cod or online"))
+			return
+		}
 		ctx := r.Context()
-		id, err := Place(ctx, pool, auth.CustomerID(ctx), in.AddressID)
+		id, err := Place(ctx, pool, auth.CustomerID(ctx), in.AddressID, in.PaymentMethod)
 		if err != nil {
 			httpx.WriteError(w, r, err)
 			return
diff --git a/services/core/internal/order/order.go b/services/core/internal/order/order.go
index 4f165b9..ce6a135 100644
--- a/services/core/internal/order/order.go
+++ b/services/core/internal/order/order.go
@@ -53,10 +53,12 @@ type Order struct {
 	SubtotalCents    int64      `json:"subtotalCents"`
 	DeliveryFeeCents int64      `json:"deliveryFeeCents"`
 	TotalCents       int64      `json:"totalCents"`
-	PaymentMethod    string     `json:"paymentMethod"`         // "cod"
-	PlacedAt         time.Time  `json:"placedAt"`              // UTC
-	DeliveredAt      *time.Time `json:"deliveredAt,omitempty"` // UTC when set
-	CancelledAt      *time.Time `json:"cancelledAt,omitempty"` // UTC when set
+	PaymentMethod    string     `json:"paymentMethod"`              // "cod" or "online"
+	PaymentStatus    string     `json:"paymentStatus,omitempty"`    // online orders only: pending, paid or refunded
+	PaymentReference string     `json:"paymentReference,omitempty"` // the payment service's reference, once paid
+	PlacedAt         time.Time  `json:"placedAt"`                   // UTC
+	DeliveredAt      *time.Time `json:"deliveredAt,omitempty"`      // UTC when set
+	CancelledAt      *time.Time `json:"cancelledAt,omitempty"`      // UTC when set
 	CancelReason     string     `json:"cancelReason,omitempty"`
 	RiderName        string     `json:"riderName,omitempty"`
 	Items            []Item     `json:"items"`  // never nil
@@ -126,6 +128,10 @@ func views(ctx context.Context, q *db.Queries, rows []db.Order) ([]Order, error)
 		if r.RiderName != nil {
 			o.RiderName = *r.RiderName
 		}
+		if r.PaymentStatus != nil {
+			o.PaymentStatus = string(*r.PaymentStatus)
+		}
+		o.PaymentReference = r.PaymentReference
 		if r.DeliveredAt != nil {
 			t := r.DeliveredAt.UTC()
 			o.DeliveredAt = &t
diff --git a/services/core/internal/order/place.go b/services/core/internal/order/place.go
index fab7f27..87b84fe 100644
--- a/services/core/internal/order/place.go
+++ b/services/core/internal/order/place.go
@@ -21,11 +21,26 @@ import (
 	"github.com/kapildev333/shopperstop/services/core/internal/store"
 )
 
-// Place turns the customer's whole cart into one placed order, in one
-// transaction, and answers the order's id. Any failure rolls everything back.
-func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID string) (id string, err error) {
+// Place turns the customer's whole cart into one placed order paid by method
+// ("cod" or "online"), in one transaction, and answers the order's id. An online
+// order needs a verified email and starts with payment status pending. Any
+// failure rolls everything back.
+func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID, method string) (id string, err error) {
 	var number string
 	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
+		c, err := auth.CustomerByID(ctx, tx, customerID)
+		if err != nil {
+			return err
+		}
+		var payment *db.PaymentStatus
+		if method == "online" {
+			if !c.EmailVerified {
+				return &httpx.Error{Status: http.StatusConflict, Code: "email_unverified", Message: "verify your email to pay online"}
+			}
+			pending := db.PaymentStatusPending
+			payment = &pending
+		}
+
 		storeID, lines, err := cart.Lines(ctx, tx, customerID)
 		if err != nil {
 			return err
@@ -81,10 +96,6 @@ func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID string
 			fee = 0
 		}
 
-		c, err := auth.CustomerByID(ctx, tx, customerID)
-		if err != nil {
-			return err
-		}
 		number, err = newNumber()
 		if err != nil {
 			return err
@@ -95,6 +106,7 @@ func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID string
 			CustomerName: c.Name, CustomerPhone: c.Phone,
 			AddressLabel: addr.Label, AddressLine1: addr.Line1, AddressLine2: addr.Line2, AddressPincode: addr.Pincode,
 			SubtotalCents: subtotal, DeliveryFeeCents: fee, TotalCents: subtotal + fee,
+			PaymentMethod: method, PaymentStatus: payment,
 		})
 		if err != nil {
 			return err
diff --git a/services/core/internal/order/schema_test.go b/services/core/internal/order/schema_test.go
index 6aeb9c2..7b37124 100644
--- a/services/core/internal/order/schema_test.go
+++ b/services/core/internal/order/schema_test.go
@@ -176,6 +176,30 @@ func TestStoreWithOrderCannotBeDeleted(t *testing.T) {
 	}
 }
 
+// TestPaymentStatusMatchesMethod: a cash order has no payment status, an online
+// order always has one, and no other payment method exists.
+func TestPaymentStatusMatchesMethod(t *testing.T) {
+	ctx := context.Background()
+	customerID, storeID, _ := fixture(t)
+	id, err := insertOrder(customerID, storeID, newNumber(), 1000, 0, 1000)
+	if err != nil {
+		t.Fatal(err)
+	}
+	for _, row := range []struct{ set, constraint string }{
+		{"payment_status = 'pending'", "orders_payment_status"},
+		{"payment_method = 'online'", "orders_payment_status"},
+		{"payment_method = 'card'", "orders_payment_method_check"},
+	} {
+		_, err := testPool.Exec(ctx, "update orders set "+row.set+" where id = $1", id)
+		if code, constraint := pgErr(t, err); code != "23514" || constraint != row.constraint {
+			t.Fatalf("set %s: got %s %s, want 23514 %s", row.set, code, constraint, row.constraint)
+		}
+	}
+	if _, err := testPool.Exec(ctx, "update orders set payment_method = 'online', payment_status = 'pending' where id = $1", id); err != nil {
+		t.Fatalf("online and pending: %v", err)
+	}
+}
+
 // TestBackfillStoreSnapshot: migration 0008 fills an existing order's store_name
 // and promised_minutes from its store, and both columns are NOT NULL after it.
 func TestBackfillStoreSnapshot(t *testing.T) {
diff --git a/services/core/migrations/0011_payments.sql b/services/core/migrations/0011_payments.sql
new file mode 100644
index 0000000..4d977de
--- /dev/null
+++ b/services/core/migrations/0011_payments.sql
@@ -0,0 +1,15 @@
+-- Payments (core-payments, D50, D51): how an order is paid and, for an online
+-- order, where its payment stands; a sequence number on every order event so
+-- services can tail them in commit order.
+alter table orders drop constraint orders_payment_method_check;
+alter table orders add constraint orders_payment_method_check check (payment_method in ('cod', 'online'));
+create type payment_status as enum ('pending', 'paid', 'refunded');
+alter table orders add column payment_status payment_status;
+alter table orders add column payment_reference text not null default '';
+-- A cash order has no payment status; an online order always has one.
+alter table orders add constraint orders_payment_status check ((payment_method = 'online') = (payment_status is not null));
+
+-- Existing events are numbered in no particular order; new ones in commit order
+-- (every event insert takes the events lock first, see queries/order.sql LockEvents).
+alter table order_events add column seq bigserial not null;
+create unique index order_events_seq on order_events (seq);
diff --git a/services/core/queries/order.sql b/services/core/queries/order.sql
index 9fcd493..37883ac 100644
--- a/services/core/queries/order.sql
+++ b/services/core/queries/order.sql
@@ -1,10 +1,10 @@
 -- name: CreateOrder :one
 insert into orders (number, customer_id, store_id, store_name, promised_minutes, customer_name, customer_phone,
                     address_label, address_line1, address_line2, address_pincode,
-                    subtotal_cents, delivery_fee_cents, total_cents)
+                    subtotal_cents, delivery_fee_cents, total_cents, payment_method, payment_status)
 values (@number, @customer_id, @store_id, @store_name, @promised_minutes, @customer_name, @customer_phone,
         @address_label, @address_line1, @address_line2, @address_pincode,
-        @subtotal_cents, @delivery_fee_cents, @total_cents)
+        @subtotal_cents, @delivery_fee_cents, @total_cents, @payment_method, sqlc.narg(payment_status))
 returning id;
 
 -- name: AddItems :exec
```

### `openapi.json` script (Task 1)

```python
# Task 1: paymentMethod on placement, paymentStatus and paymentReference on every order read,
# Error.code email_unverified. Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

o = s['Order']['properties']
o['paymentMethod'] = {"type": "string", "enum": ["cod", "online"], "description": "cod: cash on delivery. online: paid through the payment service; the order carries paymentStatus."}
props = {}
for k, v in o.items():
    props[k] = v
    if k == 'paymentMethod':
        props['paymentStatus'] = {"type": "string", "enum": ["pending", "paid", "refunded"], "description": "Online orders only, omitted for cash: pending until the payment service marks it paid, refunded after a paid order is refunded. Staff cannot accept an order whose payment is pending."}
        props['paymentReference'] = {"type": "string", "description": "The payment service's reference for the last payment change. Omitted until there is one."}
s['Order']['properties'] = props

s['OrderCreate']['properties']['paymentMethod'] = {"type": "string", "enum": ["cod", "online"], "description": "How the customer pays. Optional, cod when absent. online needs a verified email (409 email_unverified) and places the order with paymentStatus pending."}
s['Error']['properties']['error']['properties']['code']['enum'].insert(-1, 'email_unverified')

op = d['paths']['/orders']['post']
op['description'] = op['description'].replace(
    "Answers 201 with the order, status placed.",
    "paymentMethod is cod (the default) or online; an online order is placed the same way, with paymentStatus pending, and needs a verified email. Answers 201 with the order, status placed.")
op['description'] = op['description'].replace(
    "400 naming subtotal when it is below the store's minimum order;",
    "400 naming subtotal when it is below the store's minimum order; 400 naming paymentMethod when it is neither cod nor online;")
op['description'] = op['description'].replace(
    "409 out_of_stock with productIds;",
    "409 out_of_stock with productIds; 409 email_unverified when paymentMethod is online and the customer's email is not verified, checked first;")
op['requestBody']['content']['application/json'].pop('example')
op['requestBody']['content']['application/json']['examples'] = {
    "cod": {"summary": "Cash on delivery (paymentMethod may be left out)", "value": {"addressId": "00000000-0000-4000-8000-000000000301"}},
    "online": {"summary": "Pay online", "value": {"addressId": "00000000-0000-4000-8000-000000000301", "paymentMethod": "online"}},
}
r400 = op['responses']['400']
r400['description'] = r400['description'].replace(" Nothing changes.", ", or paymentMethod is neither cod nor online (field paymentMethod). Nothing changes.")
r409 = op['responses']['409']
r409['description'] = r409['description'].replace(" Nothing changes.", ", or paymentMethod is online and the customer's email is not verified (email_unverified). Nothing changes.")
r409['content']['application/json']['examples']['emailUnverified'] = {
    "summary": "Paying online needs a verified email",
    "value": {"error": {"code": "email_unverified", "message": "verify your email to pay online"}}}

# The 201 example becomes the online order: same shape, paymentStatus pending.
media = op['responses']['201']['content']['application/json']
ex = media['example']
ex['paymentMethod'] = 'online'
ex = {k: v for k, v in ex.items()}
out = {}
for k, v in ex.items():
    out[k] = v
    if k == 'paymentMethod':
        out['paymentStatus'] = 'pending'
media['example'] = out
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 2: payment route, accept guard, service actor table, services per route

```diff
diff --git a/services/core/internal/app/app.go b/services/core/internal/app/app.go
index 2c5b2ac..399eaf2 100644
--- a/services/core/internal/app/app.go
+++ b/services/core/internal/app/app.go
@@ -69,9 +69,9 @@ func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) c
 	r.With(a.RequireAdmin).Put("/api/core/v1/admin/categories/{id}/image", c.PutCategoryImage)
 	r.With(a.RequireAdmin).Put("/api/core/v1/admin/products/{id}/image", c.PutProductImage)
 	r.Get("/api/core/v1/files/{kind}/{name}", c.File)
-	r.With(a.OrService(a.RequireAdmin)).Get("/api/core/v1/admin/stores", store.List(pool))
+	r.With(a.OrService(a.RequireAdmin, "rider")).Get("/api/core/v1/admin/stores", store.List(pool))
 	r.With(a.RequireAdmin).Post("/api/core/v1/admin/stores", store.Create(pool))
-	r.With(a.OrService(a.RequireAdmin)).Get("/api/core/v1/admin/stores/{id}", store.AdminGet(pool))
+	r.With(a.OrService(a.RequireAdmin, "rider")).Get("/api/core/v1/admin/stores/{id}", store.AdminGet(pool))
 	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/stores/{id}", store.Update(pool))
 	r.With(a.RequireAdmin).Delete("/api/core/v1/admin/stores/{id}", store.Delete(pool))
 	r.With(a.RequireAdmin).Get("/api/core/v1/admin/stores/{id}/service-areas", store.ServiceAreas(pool))
@@ -82,9 +82,10 @@ func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) c
 	r.With(a.RequireCustomer).Get("/api/core/v1/orders", order.List(pool))
 	r.With(a.RequireCustomer).Get("/api/core/v1/orders/{id}", order.Get(pool))
 	r.With(a.RequireCustomer).Post("/api/core/v1/orders/{id}/cancel", order.Cancel(pool))
-	r.With(a.OrService(a.RequireStaff)).Get("/api/core/v1/admin/stores/{id}/orders", order.StoreList(pool))
-	r.With(a.OrService(a.RequireStaff)).Get("/api/core/v1/admin/orders/{id}", order.AdminGet(pool))
-	r.With(a.OrService(a.RequireStaff)).Post("/api/core/v1/admin/orders/{id}/status", order.SetStatus(pool))
+	r.With(a.OrService(a.RequireStaff, "rider")).Get("/api/core/v1/admin/stores/{id}/orders", order.StoreList(pool))
+	r.With(a.OrService(a.RequireStaff, "rider", "payment")).Get("/api/core/v1/admin/orders/{id}", order.AdminGet(pool))
+	r.With(a.OrService(a.RequireStaff, "rider", "payment")).Post("/api/core/v1/admin/orders/{id}/status", order.SetStatus(pool))
+	r.With(a.RequireService("payment")).Post("/api/core/v1/admin/orders/{id}/payment", order.SetPayment(pool))
 	r.With(a.RequireStaff).Get("/api/core/v1/admin/dashboard", staff.Dashboard(pool))
 	return r
 }
diff --git a/services/core/internal/app/app_test.go b/services/core/internal/app/app_test.go
index 127e845..0ee5fca 100644
--- a/services/core/internal/app/app_test.go
+++ b/services/core/internal/app/app_test.go
@@ -26,6 +26,9 @@ const testPepper = "test-pepper-test-pepper-test-pepper-00"
 // testServiceToken is the rider service's token on the shared test server.
 const testServiceToken = "test-rider-service-token-test-rider-00"
 
+// testPaymentToken is the payment service's token on the shared test server.
+const testPaymentToken = "test-payment-service-token-test-pay-00"
+
 // srv is the shared test server every route test in this package uses. Its
 // limiter is too large to trip, so only the rate-limit test sees a 429.
 var (
@@ -50,7 +53,7 @@ func TestMain(m *testing.M) {
 		testStoreID); err != nil {
 		panic(err)
 	}
-	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), map[string]string{"rider": testServiceToken})
+	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), map[string]string{"rider": testServiceToken, "payment": testPaymentToken})
 	a.Mailer = mails
 	srv = httptest.NewServer(New(testPool, []string{"http://localhost:5173"}, a, blob.Disk{Dir: filesDir}))
 	code := m.Run()
diff --git a/services/core/internal/app/contract_test.go b/services/core/internal/app/contract_test.go
index c0e9848..301309d 100644
--- a/services/core/internal/app/contract_test.go
+++ b/services/core/internal/app/contract_test.go
@@ -225,7 +225,9 @@ var pathParam = regexp.MustCompile(`\{[^}]+\}`)
 // securityProblems sends one anonymous request to every documented operation
 // and checks the operation's security declaration against the router's answer:
 // a 401 must match declared security, and declared security must document a 401.
-func securityProblems(baseURL, serviceToken string, doc []byte) []string {
+// Each secured operation is then probed with every service token: one with
+// x-service-token must admit at least one of them, any other must refuse each.
+func securityProblems(baseURL string, serviceTokens []string, doc []byte) []string {
 	var spec struct {
 		Servers []struct {
 			URL string `json:"url"`
@@ -296,26 +298,33 @@ func securityProblems(baseURL, serviceToken string, doc []byte) []string {
 			if op.ServiceToken && !declared {
 				problems = append(problems, key+": x-service-token without security")
 			}
-			if !declared || serviceToken == "" {
+			if !declared || len(serviceTokens) == 0 {
 				continue
 			}
-			req.Header.Set("Authorization", "Bearer "+serviceToken)
-			resp, err = http.DefaultClient.Do(req)
-			if err != nil {
-				problems = append(problems, key+": request failed: "+err.Error())
-				continue
-			}
-			resp.Body.Close()
 			want := http.StatusUnauthorized
 			if strings.HasPrefix(path, "/admin/") {
 				want = http.StatusForbidden
 			}
-			refused := resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden
+			admitted, last := false, 0
+			for _, token := range serviceTokens {
+				req.Header.Set("Authorization", "Bearer "+token)
+				resp, err = http.DefaultClient.Do(req)
+				if err != nil {
+					problems = append(problems, key+": request failed: "+err.Error())
+					break
+				}
+				resp.Body.Close()
+				last = resp.StatusCode
+				if last != http.StatusUnauthorized && last != http.StatusForbidden {
+					admitted = true
+				}
+				if !op.ServiceToken && last != want {
+					problems = append(problems, fmt.Sprintf("%s: answers %d to a service token, want %d or x-service-token", key, last, want))
+				}
+			}
 			switch {
-			case op.ServiceToken && refused:
-				problems = append(problems, fmt.Sprintf("%s: declares x-service-token but answers %d to the service token", key, resp.StatusCode))
-			case !op.ServiceToken && resp.StatusCode != want:
-				problems = append(problems, fmt.Sprintf("%s: answers %d to the service token, want %d or x-service-token", key, resp.StatusCode, want))
+			case op.ServiceToken && !admitted:
+				problems = append(problems, fmt.Sprintf("%s: declares x-service-token but answers %d to every service token", key, last))
 			case !op.ServiceToken && want == http.StatusForbidden && op.Responses["403"] == nil:
 				problems = append(problems, key+": refuses the service token with 403 but documents no 403")
 			}
@@ -331,7 +340,7 @@ func TestContractSecurity(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	if problems := securityProblems(srv.URL, testServiceToken, doc); len(problems) > 0 {
+	if problems := securityProblems(srv.URL, []string{testServiceToken, testPaymentToken}, doc); len(problems) > 0 {
 		t.Fatalf("security problems:\n%s", strings.Join(problems, "\n"))
 	}
 }
@@ -356,7 +365,7 @@ func toySecurityProblems(t *testing.T, status int, doc string) []string {
 	r.Get("/api/core/v1/extra", func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(status) })
 	ts := httptest.NewServer(r)
 	t.Cleanup(ts.Close)
-	return securityProblems(ts.URL, "", []byte(doc))
+	return securityProblems(ts.URL, nil, []byte(doc))
 }
 
 // TestContractNamesMissingSecurity: a route that answers 401 must declare security.
@@ -407,7 +416,7 @@ func toyServiceProblems(t *testing.T, status int, declared bool) []string {
   "components":{"securitySchemes":{"bearer":{"type":"http","scheme":"bearer"}}},
   "paths":{"/admin/extra":{"get":{"summary":"s","description":"d","tags":["orders"],"security":[{"bearer":[]}],` + ext + `
   "responses":{"200":{"description":"ok"},"401":{"description":"no token"},"403":{"description":"no"}}}}}}`
-	return securityProblems(ts.URL, "svc", []byte(doc))
+	return securityProblems(ts.URL, []string{"svc"}, []byte(doc))
 }
 
 // TestContractNamesUndeclaredServiceRoute: a route that admits the service token must say so.
diff --git a/services/core/internal/app/orders_payment_test.go b/services/core/internal/app/orders_payment_test.go
index 14580ca..66d8ae4 100644
--- a/services/core/internal/app/orders_payment_test.go
+++ b/services/core/internal/app/orders_payment_test.go
@@ -3,6 +3,7 @@ package app
 import (
 	"context"
 	"encoding/json"
+	"log/slog"
 	"net/http"
 	"strings"
 	"testing"
@@ -90,3 +91,254 @@ func TestPlacePaymentMethodInvalid(t *testing.T) {
 	}
 	requireUnchanged(t, b, s.ID, map[string]int32{p: 2}, map[string]int32{p: 5})
 }
+
+// onlineOrder places a verified buyer's cart of 2 units (stock 5) at a new shop
+// online and returns the 201 order with its shop.
+func onlineOrder(t *testing.T) (orderView, shop) {
+	t.Helper()
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	stockTo(t, s.ID, p, 5)
+	b := verified(t, newBuyer(t, s.Pincode))
+	setLine(t, b.Token, s.ID, p, 2)
+	status, body := placePaid(t, b, "online")
+	var o orderView
+	if status != http.StatusCreated || json.Unmarshal(body, &o) != nil {
+		t.Fatalf("place online: got %d %s, want 201", status, body)
+	}
+	return o, s
+}
+
+// setPayment posts a payment change for orderID with token.
+func setPayment(t *testing.T, token, orderID string, body any) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, adminOrderPath(orderID)+"/payment", token, body)
+}
+
+// mustPay posts a payment change with the payment service's token and decodes the 200 order.
+func mustPay(t *testing.T, orderID, status, reference string) orderView {
+	t.Helper()
+	code, body := setPayment(t, testPaymentToken, orderID, map[string]string{"status": status, "reference": reference})
+	var o orderView
+	if code != http.StatusOK || json.Unmarshal(body, &o) != nil {
+		t.Fatalf("payment %s: got %d %s, want 200", status, code, body)
+	}
+	return o
+}
+
+// paymentLines counts the `order payment` log lines written for orderID.
+func paymentLines(buf *lockedBuffer, orderID string) int {
+	n := 0
+	for _, line := range strings.Split(buf.String(), "\n") {
+		if strings.Contains(line, `"msg":"order payment"`) && strings.Contains(line, orderID) {
+			n++
+		}
+	}
+	return n
+}
+
+// TestAcceptAwaitsPayment: staff cannot accept an online order while its payment
+// is pending; once the payment service marks it paid they can.
+func TestAcceptAwaitsPayment(t *testing.T) {
+	o, _ := onlineOrder(t)
+	token := adminToken(t)
+	status, body := setStatus(t, token, o.ID, map[string]string{"status": "accepted"})
+	expectError(t, "accept pending", status, body, http.StatusConflict, "payment_pending", "", "")
+	if got, n := orderStatus(t, o.ID), eventCount(t, o.ID); got != "placed" || n != 1 {
+		t.Fatalf("after the refused accept: status %s with %d events, want placed with 1", got, n)
+	}
+	mustPay(t, o.ID, "paid", "pay_123")
+	if got := mustStatus(t, token, o.ID, map[string]string{"status": "accepted"}); got.Status != "accepted" {
+		t.Fatalf("accept paid: status %s, want accepted", got.Status)
+	}
+}
+
+// TestPendingOnlineOrderCancels: the customer and staff cancel an unpaid online
+// order as they cancel a cash one, and the stock returns.
+func TestPendingOnlineOrderCancels(t *testing.T) {
+	for _, by := range []string{"customer", "staff"} {
+		s := newShop(t)
+		p := cartProduct(t, s.ID, stockName(t), 5000)
+		stockTo(t, s.ID, p, 5)
+		b := verified(t, newBuyer(t, s.Pincode))
+		setLine(t, b.Token, s.ID, p, 2)
+		_, body := placePaid(t, b, "online")
+		var o orderView
+		if err := json.Unmarshal(body, &o); err != nil {
+			t.Fatal(err)
+		}
+		var status int
+		if by == "customer" {
+			status, body = call(t, http.MethodPost, ordersPath+"/"+o.ID+"/cancel", b.Token, map[string]string{})
+		} else {
+			status, body = setStatus(t, adminToken(t), o.ID, map[string]string{"status": "cancelled"})
+		}
+		if status != http.StatusOK || orderStatus(t, o.ID) != "cancelled" || quantityAt(t, s.ID, p) != 5 {
+			t.Fatalf("%s cancels a pending online order: got %d %s, want 200, cancelled and stock 5", by, status, body)
+		}
+	}
+}
+
+// TestPaymentPaidThenRefunded: the payment service marks a pending payment paid
+// and later refunded; each change keeps the order's status, sets the reference,
+// adds one event by the system and logs one `order payment` line.
+func TestPaymentPaidThenRefunded(t *testing.T) {
+	var buf lockedBuffer
+	prev := slog.Default()
+	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
+	t.Cleanup(func() { slog.SetDefault(prev) })
+
+	o, _ := onlineOrder(t)
+	paid := mustPay(t, o.ID, "paid", "  pay_123 ")
+	last := paid.Events[len(paid.Events)-1]
+	if paid.Status != "placed" || paid.PaymentStatus != "paid" || paid.PaymentReference != "pay_123" || len(paid.Events) != 2 {
+		t.Fatalf("paid: status %s payment %s reference %q with %d events, want placed, paid, pay_123 and 2", paid.Status, paid.PaymentStatus, paid.PaymentReference, len(paid.Events))
+	}
+	if last.FromStatus != "placed" || last.ToStatus != "placed" || last.ActorType != "system" || last.ActorName != "payment" || last.Note != "Payment paid, reference pay_123" {
+		t.Fatalf("paid event %+v, want placed to placed by system payment with the reference", last)
+	}
+	if n := paymentLines(&buf, o.ID); n != 1 {
+		t.Fatalf("%d order payment lines after paid, want 1", n)
+	}
+
+	cancelled := mustStatus(t, adminToken(t), o.ID, map[string]string{"status": "cancelled", "note": "store closing"})
+	refunded := mustPay(t, o.ID, "refunded", "rfnd_9")
+	last = refunded.Events[len(refunded.Events)-1]
+	if refunded.Status != "cancelled" || refunded.PaymentStatus != "refunded" || refunded.PaymentReference != "rfnd_9" || len(refunded.Events) != len(cancelled.Events)+1 {
+		t.Fatalf("refunded: status %s payment %s reference %q with %d events, want cancelled, refunded, rfnd_9 and one more", refunded.Status, refunded.PaymentStatus, refunded.PaymentReference, len(refunded.Events))
+	}
+	if last.FromStatus != "cancelled" || last.ToStatus != "cancelled" || last.ActorType != "system" || last.Note != "Payment refunded, reference rfnd_9" {
+		t.Fatalf("refunded event %+v", last)
+	}
+	if mine := readOrder(t, ordersPath+"/"+o.ID, customerTokenOf(t, o.ID)); mine.PaymentStatus != "refunded" || mine.PaymentReference != "rfnd_9" {
+		t.Fatalf("customer read: payment %s reference %q, want refunded and rfnd_9", mine.PaymentStatus, mine.PaymentReference)
+	}
+}
+
+// customerTokenOf signs in a new session of the customer of orderID.
+func customerTokenOf(t *testing.T, orderID string) string {
+	t.Helper()
+	var email string
+	if err := testPool.QueryRow(context.Background(), "select c.email from orders o join customers c on c.id = o.customer_id where o.id = $1", orderID).Scan(&email); err != nil {
+		t.Fatal(err)
+	}
+	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": testPassword})
+	var sb sessionBody
+	if status != http.StatusOK || json.Unmarshal(body, &sb) != nil {
+		t.Fatalf("sign in %s: got %d %s", email, status, body)
+	}
+	return sb.Token
+}
+
+// TestPaymentConflicts: paid only from pending, refunded only from paid, and a
+// cash order has no payment to change; a refusal changes nothing.
+func TestPaymentConflicts(t *testing.T) {
+	o, s := onlineOrder(t)
+	p := cartProduct(t, s.ID, stockName(t), 1000)
+	cash := orderIn(t, s.ID, newCustomer(t).Customer.ID, p, "placed")
+	for _, row := range []struct {
+		what, id, status string
+	}{
+		{"refund a pending payment", o.ID, "refunded"},
+		{"pay a cash order", cash, "paid"},
+		{"refund a cash order", cash, "refunded"},
+	} {
+		status, body := setPayment(t, testPaymentToken, row.id, map[string]string{"status": row.status, "reference": "ref_1"})
+		expectError(t, row.what, status, body, http.StatusConflict, "conflict", "", "")
+		if n := eventCount(t, row.id); n != 1 {
+			t.Fatalf("%s: %d events, want 1", row.what, n)
+		}
+	}
+	mustPay(t, o.ID, "paid", "pay_1")
+	status, body := setPayment(t, testPaymentToken, o.ID, map[string]string{"status": "paid", "reference": "pay_2"})
+	expectError(t, "pay twice", status, body, http.StatusConflict, "conflict", "", "")
+	if got := readOrder(t, adminOrderPath(o.ID), adminToken(t)); got.PaymentReference != "pay_1" || len(got.Events) != 2 {
+		t.Fatalf("after paying twice: reference %q with %d events, want pay_1 and 2", got.PaymentReference, len(got.Events))
+	}
+}
+
+// TestPaymentValidation: the body is checked before the order is read.
+func TestPaymentValidation(t *testing.T) {
+	o, _ := onlineOrder(t)
+	for _, row := range []struct {
+		what  string
+		body  map[string]string
+		field string
+	}{
+		{"unknown status", map[string]string{"status": "failed", "reference": "r"}, "status"},
+		{"pending", map[string]string{"status": "pending", "reference": "r"}, "status"},
+		{"no reference", map[string]string{"status": "paid"}, "reference"},
+		{"blank reference", map[string]string{"status": "paid", "reference": "   "}, "reference"},
+		{"long reference", map[string]string{"status": "paid", "reference": strings.Repeat("r", 101)}, "reference"},
+	} {
+		status, body := setPayment(t, testPaymentToken, o.ID, row.body)
+		expectError(t, row.what, status, body, http.StatusBadRequest, "validation", row.field, "")
+	}
+	status, body := setPayment(t, testPaymentToken, missingOrderID, map[string]string{"status": "paid", "reference": "r"})
+	expectError(t, "unknown order", status, body, http.StatusNotFound, "not_found", "", "")
+	if got := readOrder(t, adminOrderPath(o.ID), adminToken(t)); got.PaymentStatus != "pending" || len(got.Events) != 1 {
+		t.Fatalf("after refusals: payment %s with %d events, want pending and 1", got.PaymentStatus, len(got.Events))
+	}
+}
+
+// TestPaymentRouteForServicesOnly: staff are 403, customers and no token 401.
+func TestPaymentRouteForServicesOnly(t *testing.T) {
+	o, _ := onlineOrder(t)
+	body := map[string]string{"status": "paid", "reference": "r"}
+	status, raw := setPayment(t, adminToken(t), o.ID, body)
+	expectError(t, "admin", status, raw, http.StatusForbidden, "forbidden", "", "services only")
+	for what, token := range map[string]string{"no token": "", "customer": newCustomer(t).Token} {
+		status, raw := setPayment(t, token, o.ID, body)
+		expectError(t, what, status, raw, http.StatusUnauthorized, "unauthorized", "", "")
+	}
+}
+
+// TestPaymentTimeoutCancels: the payment service cancels an unpaid order as the
+// system; the stock returns and the event names the actor and has no actor id.
+func TestPaymentTimeoutCancels(t *testing.T) {
+	o, s := onlineOrder(t)
+	got := mustStatus(t, testPaymentToken, o.ID, map[string]any{"status": "cancelled", "note": "not paid in 15 minutes", "actor": map[string]string{"type": "system", "name": "payment timeout"}})
+	last := got.Events[len(got.Events)-1]
+	if got.Status != "cancelled" || got.CancelReason != "not paid in 15 minutes" || last.ActorType != "system" || last.ActorName != "payment timeout" {
+		t.Fatalf("timeout cancel: status %s reason %q last event %+v", got.Status, got.CancelReason, last)
+	}
+	if got := quantityAt(t, s.ID, o.Items[0].ProductID); got != 5 {
+		t.Fatalf("stock after the timeout cancel %d, want 5", got)
+	}
+	var withID int
+	if err := testPool.QueryRow(context.Background(), "select count(*) from order_events where order_id = $1 and actor_type = 'system' and actor_id is not null", o.ID).Scan(&withID); err != nil {
+		t.Fatal(err)
+	}
+	if withID != 0 {
+		t.Fatalf("%d system events with an actor id, want 0", withID)
+	}
+}
+
+// TestPaymentServiceActorRules: the payment service only cancels, naming a system
+// actor with a name and no id; the rider service still cannot cancel.
+func TestPaymentServiceActorRules(t *testing.T) {
+	o, _ := onlineOrder(t)
+	system := map[string]string{"type": "system", "name": "payment timeout"}
+	for _, row := range []struct {
+		what  string
+		token string
+		body  any
+		want  int
+		code  string
+		field string
+	}{
+		{"payment accepts", testPaymentToken, map[string]any{"status": "accepted", "actor": system}, 403, "forbidden", ""},
+		{"payment delivers", testPaymentToken, map[string]any{"status": "delivered", "actor": system}, 403, "forbidden", ""},
+		{"no actor", testPaymentToken, map[string]any{"status": "cancelled"}, 400, "validation", "actor"},
+		{"rider actor", testPaymentToken, map[string]any{"status": "cancelled", "actor": rider(riderA, "Ravi")}, 400, "validation", "actor"},
+		{"system with an id", testPaymentToken, map[string]any{"status": "cancelled", "actor": map[string]string{"type": "system", "id": riderA, "name": "payment timeout"}}, 400, "validation", "actor"},
+		{"blank name", testPaymentToken, map[string]any{"status": "cancelled", "actor": map[string]string{"type": "system", "name": " "}}, 400, "validation", "actor"},
+		{"rider cancels", testServiceToken, map[string]any{"status": "cancelled", "actor": system}, 403, "forbidden", ""},
+	} {
+		status, raw := setStatus(t, row.token, o.ID, row.body)
+		expectError(t, row.what, status, raw, row.want, row.code, row.field, "")
+		if got, n := orderStatus(t, o.ID), eventCount(t, o.ID); got != "placed" || n != 1 {
+			t.Fatalf("%s: status %s with %d events, want placed with 1", row.what, got, n)
+		}
+	}
+}
diff --git a/services/core/internal/app/service_test.go b/services/core/internal/app/service_test.go
index 6c81c8c..ccd4b8a 100644
--- a/services/core/internal/app/service_test.go
+++ b/services/core/internal/app/service_test.go
@@ -51,3 +51,21 @@ func TestServiceOnStoreAdministration(t *testing.T) {
 	status, raw = call(t, http.MethodGet, path+"/service-areas", testServiceToken, nil)
 	expectError(t, "GET service areas", status, raw, http.StatusForbidden, "forbidden", "", "staff only")
 }
+
+// TestServiceRoutesByName: each service reaches exactly its own routes; the
+// payment service reads an order but no store, and the rider service cannot
+// change a payment.
+func TestServiceRoutesByName(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 1000)
+	id := orderIn(t, s.ID, newCustomer(t).Customer.ID, p, "placed")
+	if status, raw := call(t, http.MethodGet, adminOrderPath(id), testPaymentToken, nil); status != http.StatusOK {
+		t.Fatalf("payment reads the order: got %d %s, want 200", status, raw)
+	}
+	for _, path := range []string{adminStoresPath, adminStoresPath + "/" + s.ID, storeOrdersPath(s.ID)} {
+		status, raw := call(t, http.MethodGet, path, testPaymentToken, nil)
+		expectError(t, "payment GET "+path, status, raw, http.StatusForbidden, "forbidden", "", "staff only")
+	}
+	status, raw := call(t, http.MethodPost, adminOrderPath(id)+"/payment", testServiceToken, map[string]string{"status": "paid", "reference": "r"})
+	expectError(t, "rider pays", status, raw, http.StatusForbidden, "forbidden", "", "")
+}
diff --git a/services/core/internal/auth/auth.go b/services/core/internal/auth/auth.go
index c1d2155..b14a323 100644
--- a/services/core/internal/auth/auth.go
+++ b/services/core/internal/auth/auth.go
@@ -11,6 +11,7 @@ import (
 	"errors"
 	"fmt"
 	"net/http"
+	"slices"
 	"strings"
 
 	"github.com/jackc/pgx/v5"
@@ -85,6 +86,7 @@ var (
 	errUnauthorized = &httpx.Error{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "sign in required"}
 	errAdminsOnly   = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "admins only"}
 	errStaffOnly    = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "staff only"}
+	errServiceOnly  = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "services only"}
 )
 
 // CustomerID returns the signed-in customer's id, or "" outside RequireCustomer.
@@ -105,14 +107,15 @@ func Service(ctx context.Context) string {
 	return name
 }
 
-// OrService admits a service token as a service subject and hands every other
-// request to staff (RequireStaff or RequireAdmin), which then decides.
-func (a *Auth) OrService(staff func(http.Handler) http.Handler) func(http.Handler) http.Handler {
+// OrService admits the token of one of the named services as a service subject
+// and hands every other request to staff (RequireStaff or RequireAdmin), which
+// then decides: another service's token is 403 there.
+func (a *Auth) OrService(staff func(http.Handler) http.Handler, names ...string) func(http.Handler) http.Handler {
 	return func(next http.Handler) http.Handler {
 		guarded := staff(next)
 		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 			name := a.serviceName(bearer(r))
-			if name == "" {
+			if name == "" || !slices.Contains(names, name) {
 				guarded.ServeHTTP(w, r)
 				return
 			}
@@ -123,6 +126,16 @@ func (a *Auth) OrService(staff func(http.Handler) http.Handler) func(http.Handle
 	}
 }
 
+// RequireService admits only the token of one of the named services: a staff
+// session or another service's token is 403 forbidden, anything else 401,
+// exactly as RequireStaff answers it.
+func (a *Auth) RequireService(names ...string) func(http.Handler) http.Handler {
+	refuse := a.RequireStaff(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
+		httpx.WriteError(w, r, errServiceOnly)
+	}))
+	return a.OrService(func(http.Handler) http.Handler { return refuse }, names...)
+}
+
 // newToken returns 32 random bytes as unpadded base64url (43 characters).
 func newToken() (string, error) {
 	var b [32]byte
@@ -204,7 +217,7 @@ func (a *Auth) RequireCustomer(next http.Handler) http.Handler {
 
 // RequireStaff admits a session of an active staff user. Staff sessions are
 // fixed: use never moves their expiry, and deactivation ends them at once.
-// A service token is 403: services reach only the routes wrapped in OrService.
+// A service token is 403: services reach only the routes OrService names them on.
 func (a *Auth) RequireStaff(next http.Handler) http.Handler {
 	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
 		ctx := r.Context()
diff --git a/services/core/internal/auth/auth_test.go b/services/core/internal/auth/auth_test.go
index df6f435..0075a1b 100644
--- a/services/core/internal/auth/auth_test.go
+++ b/services/core/internal/auth/auth_test.go
@@ -107,8 +107,8 @@ func probeRouter(a *Auth) http.Handler {
 	serviceOrStaff := func(w http.ResponseWriter, r *http.Request) {
 		_, _ = io.WriteString(w, Service(r.Context())+"|"+CurrentStaff(r.Context()).ID)
 	}
-	r.With(a.OrService(a.RequireStaff)).Get("/probe/service", serviceOrStaff)
-	r.With(a.OrService(a.RequireAdmin)).Get("/probe/service-admin", serviceOrStaff)
+	r.With(a.OrService(a.RequireStaff, "rider")).Get("/probe/service", serviceOrStaff)
+	r.With(a.OrService(a.RequireAdmin, "rider")).Get("/probe/service-admin", serviceOrStaff)
 	return r
 }
 
diff --git a/services/core/internal/config/config_test.go b/services/core/internal/config/config_test.go
index eda7180..5d2a82c 100644
--- a/services/core/internal/config/config_test.go
+++ b/services/core/internal/config/config_test.go
@@ -138,18 +138,21 @@ func TestLoadTrustProxy(t *testing.T) {
 	}
 }
 
-// TestLoadServiceTokens: the Makefile's dev and e2e values load as service rider;
-// unset, empty or only separators load none.
+// TestLoadServiceTokens: the Makefile's dev and e2e values load as services rider
+// and payment; unset, empty or only separators load none.
 func TestLoadServiceTokens(t *testing.T) {
-	for _, token := range []string{"dev-rider-service-token-dev-rider-00", "e2e-rider-service-token-e2e-rider-00"} {
+	for _, want := range []struct{ rider, payment string }{
+		{"dev-rider-service-token-dev-rider-00", "dev-payment-service-token-dev-pay-00"},
+		{"e2e-rider-service-token-e2e-rider-00", "e2e-payment-service-token-e2e-pay-00"},
+	} {
 		vars := valid()
-		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = "rider:" + token
+		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = "rider:" + want.rider + ",payment:" + want.payment
 		cfg, err := config.Load(env(vars))
 		if err != nil {
-			t.Fatalf("Load with rider:%s: %v", token, err)
+			t.Fatalf("Load with rider and payment: %v", err)
 		}
-		if len(cfg.ServiceTokens) != 1 || cfg.ServiceTokens["rider"] != token {
-			t.Fatalf("ServiceTokens %v, want only rider:%s", cfg.ServiceTokens, token)
+		if len(cfg.ServiceTokens) != 2 || cfg.ServiceTokens["rider"] != want.rider || cfg.ServiceTokens["payment"] != want.payment {
+			t.Fatalf("ServiceTokens %v, want rider:%s and payment:%s", cfg.ServiceTokens, want.rider, want.payment)
 		}
 	}
 	for _, v := range []string{"", " , "} {
diff --git a/services/core/internal/order/handlers.go b/services/core/internal/order/handlers.go
index bf76ca5..bed0fd8 100644
--- a/services/core/internal/order/handlers.go
+++ b/services/core/internal/order/handlers.go
@@ -3,6 +3,7 @@ package order
 import (
 	"context"
 	"net/http"
+	"slices"
 	"strings"
 	"unicode/utf8"
 
@@ -267,43 +268,64 @@ type statusRequest struct {
 	Actor  *actorRequest `json:"actor"`
 }
 
-// actorRequest is the rider a service names as the actor of a status change.
+// actorRequest is the actor a service names for a status change.
 type actorRequest struct {
 	Type string `json:"type"`
 	ID   string `json:"id"`
 	Name string `json:"name"`
 }
 
-// errRiderMoves refuses a service's move to any status but the rider's two.
-var errRiderMoves = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "a service may only move an order to out_for_delivery or delivered"}
+// serviceActor is one row of the service actor table: the actor type a service
+// names and the statuses it may move an order to.
+type serviceActor struct {
+	actorType string
+	to        []db.OrderStatus
+}
+
+// serviceActors is the service actor table, by service name. The rider service
+// moves orders for a rider (who has an id); the payment service cancels unpaid
+// orders as the system (no id). Any other service moves nothing.
+var serviceActors = map[string]serviceActor{
+	"rider":   {"rider", []db.OrderStatus{db.OrderStatusOutForDelivery, db.OrderStatusDelivered}},
+	"payment": {"system", []db.OrderStatus{db.OrderStatusCancelled}},
+}
 
-// actorOf returns who makes the status change: the signed-in staff user, who
-// names no actor, or the rider a service names, which it must.
-func actorOf(ctx context.Context, in *actorRequest) (Actor, error) {
-	if auth.Service(ctx) == "" {
+// actorOf returns who makes the status change to to: the signed-in staff user,
+// who names no actor, or the actor a service names, which it must. A service
+// moving an order anywhere its table row does not allow is 403, checked before
+// the actor and before the order is read.
+func actorOf(ctx context.Context, to db.OrderStatus, in *actorRequest) (Actor, error) {
+	service := auth.Service(ctx)
+	if service == "" {
 		if in != nil {
 			return Actor{}, invalid("actor", "only a service names an actor")
 		}
 		return Actor{Type: "staff", ID: auth.CurrentStaff(ctx).ID}, nil
 	}
+	row, ok := serviceActors[service]
+	if !ok || !slices.Contains(row.to, to) {
+		return Actor{}, &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "this service may not move an order to " + string(to)}
+	}
 	if in == nil {
 		return Actor{}, invalid("actor", "required")
 	}
 	name := strings.TrimSpace(in.Name)
 	switch {
-	case in.Type != "rider":
-		return Actor{}, invalid("actor", "type must be rider")
-	case !httpx.IsUUID(in.ID):
+	case in.Type != row.actorType:
+		return Actor{}, invalid("actor", "type must be "+row.actorType)
+	case row.actorType == "rider" && !httpx.IsUUID(in.ID):
 		return Actor{}, invalid("actor", "id must be a uuid")
+	case row.actorType == "system" && in.ID != "":
+		return Actor{}, invalid("actor", "a system actor has no id")
 	case name == "" || utf8.RuneCountInString(name) > 80:
 		return Actor{}, invalid("actor", "name must be 1 to 80 characters")
 	}
-	return Actor{Type: "rider", ID: in.ID, Name: name}, nil
+	return Actor{Type: row.actorType, ID: in.ID, Name: name}, nil
 }
 
 // SetStatus answers 200 with the order after a status change by staff or by a
-// service. Staff make any move and name no actor; a service must name the rider
-// making a move to out_for_delivery or delivered, and any other target is 403.
+// service. Staff make any move and name no actor; a service names the actor of
+// its row in the service actor table, and a target outside its row is 403.
 // A move the table does not allow is 409 conflict and changes nothing. A cancel
 // records the note as cancelReason and returns the order's quantities to stock.
 func SetStatus(pool *pgxpool.Pool) http.HandlerFunc {
@@ -328,16 +350,12 @@ func SetStatus(pool *pgxpool.Pool) http.HandlerFunc {
 			return
 		}
 		ctx := r.Context()
-		actor, err := actorOf(ctx, in.Actor)
+		to := db.OrderStatus(in.Status)
+		actor, err := actorOf(ctx, to, in.Actor)
 		if err != nil {
 			httpx.WriteError(w, r, err)
 			return
 		}
-		to := db.OrderStatus(in.Status)
-		if actor.Type == "rider" && to != db.OrderStatusOutForDelivery && to != db.OrderStatusDelivered {
-			httpx.WriteError(w, r, errRiderMoves)
-			return
-		}
 		sc := staffScope(ctx)
 		if err := Transition(ctx, pool, id, sc, to, actor, note); err != nil {
 			httpx.WriteError(w, r, err)
diff --git a/services/core/internal/order/payment.go b/services/core/internal/order/payment.go
new file mode 100644
index 0000000..190c4fd
--- /dev/null
+++ b/services/core/internal/order/payment.go
@@ -0,0 +1,87 @@
+package order
+
+import (
+	"log/slog"
+	"net/http"
+	"strings"
+	"unicode/utf8"
+
+	"github.com/jackc/pgx/v5"
+	"github.com/jackc/pgx/v5/pgxpool"
+
+	"github.com/kapildev333/shopperstop/services/core/internal/auth"
+	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
+	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
+	"github.com/kapildev333/shopperstop/services/core/internal/pg"
+)
+
+// paymentRequest is the POST /admin/orders/{id}/payment body.
+type paymentRequest struct {
+	Status    string `json:"status"`
+	Reference string `json:"reference"`
+}
+
+// paymentFrom is the payment status each new one must come from: paid only from
+// pending, refunded only from paid.
+var paymentFrom = map[db.PaymentStatus]db.PaymentStatus{
+	db.PaymentStatusPaid:     db.PaymentStatusPending,
+	db.PaymentStatusRefunded: db.PaymentStatusPaid,
+}
+
+// SetPayment answers 200 with the order after a service marks its payment paid
+// or refunded, in one transaction under the order's row lock, with an event by
+// the system that keeps the order's status and notes the reference. A cash
+// order, or a payment not in the status the new one comes from, is 409 conflict
+// and changes nothing.
+func SetPayment(pool *pgxpool.Pool) http.HandlerFunc {
+	return func(w http.ResponseWriter, r *http.Request) {
+		id, err := httpx.PathID(r, "id")
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		var in paymentRequest
+		if err := httpx.ReadJSON(w, r, &in); err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		to := db.PaymentStatus(in.Status)
+		from, ok := paymentFrom[to]
+		if !ok {
+			httpx.WriteError(w, r, invalid("status", "must be paid or refunded"))
+			return
+		}
+		ref := strings.TrimSpace(in.Reference)
+		if ref == "" || utf8.RuneCountInString(ref) > 100 {
+			httpx.WriteError(w, r, invalid("reference", "must be 1 to 100 characters"))
+			return
+		}
+		ctx := r.Context()
+		service := auth.Service(ctx)
+		var row db.LockOrderRow
+		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
+			q := db.New(tx)
+			var err error
+			if row, err = q.LockOrder(ctx, db.LockOrderParams{ID: id}); err != nil {
+				return pg.Map(err)
+			}
+			if row.PaymentStatus == nil || *row.PaymentStatus != from {
+				return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "the payment is not " + string(from)}
+			}
+			if err := q.SetPayment(ctx, db.SetPaymentParams{PaymentStatus: &to, PaymentReference: ref, ID: id}); err != nil {
+				return err
+			}
+			return q.AddEvent(ctx, db.AddEventParams{
+				OrderID: id, FromStatus: &row.Status, ToStatus: row.Status,
+				ActorType: "system", ActorName: &service, Note: "Payment " + string(to) + ", reference " + ref,
+			})
+		})
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		slog.InfoContext(ctx, "order payment", "orderId", id, "number", row.Number, "from", string(from),
+			"to", string(to), "service", service, "requestId", httpx.RequestID(ctx))
+		respond(w, r, pool, id, scope{}, http.StatusOK)
+	}
+}
diff --git a/services/core/internal/order/status.go b/services/core/internal/order/status.go
index 061a126..83bc9ba 100644
--- a/services/core/internal/order/status.go
+++ b/services/core/internal/order/status.go
@@ -26,7 +26,7 @@ var next = map[db.OrderStatus][]db.OrderStatus{
 
 // allowed reports whether an actor of actorType may move an order from one
 // status to another: the table allows it, staff make every move, a customer
-// only cancels, and a rider only takes out for delivery and delivers.
+// and the system only cancel, and a rider only takes out for delivery and delivers.
 func allowed(from, to db.OrderStatus, actorType string) bool {
 	if !slices.Contains(next[from], to) {
 		return false
@@ -34,7 +34,7 @@ func allowed(from, to db.OrderStatus, actorType string) bool {
 	switch actorType {
 	case "staff":
 		return true
-	case "customer":
+	case "customer", "system":
 		return to == db.OrderStatusCancelled
 	case "rider":
 		return to == db.OrderStatusOutForDelivery || to == db.OrderStatusDelivered
@@ -45,7 +45,8 @@ func allowed(from, to db.OrderStatus, actorType string) bool {
 // Transition moves the order to status to, in one transaction under the order's
 // row lock, and records the event with note. A cancel also returns the order's
 // quantities to the store's stock. An order outside sc is "not found"; a move the
-// table does not allow is 409 conflict and changes nothing.
+// table does not allow is 409 conflict and changes nothing, and so is accepting
+// an order whose payment is pending (409 payment_pending).
 func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to db.OrderStatus, actor Actor, note string) error {
 	var row db.LockOrderRow
 	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
@@ -57,10 +58,16 @@ func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to
 		if !allowed(row.Status, to, actor.Type) {
 			return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "cannot move an order from " + string(row.Status) + " to " + string(to)}
 		}
-		var riderName, actorName *string
+		if to == db.OrderStatusAccepted && row.PaymentStatus != nil && *row.PaymentStatus == db.PaymentStatusPending {
+			return &httpx.Error{Status: http.StatusConflict, Code: "payment_pending", Message: "the order awaits payment"}
+		}
+		var riderName, actorName, actorID *string
 		if actor.Name != "" {
 			actorName = &actor.Name
 		}
+		if actor.ID != "" {
+			actorID = &actor.ID
+		}
 		if actor.Type == "rider" && to == db.OrderStatusOutForDelivery {
 			riderName = &actor.Name
 		}
@@ -82,7 +89,7 @@ func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to
 		}
 		return q.AddEvent(ctx, db.AddEventParams{
 			OrderID: id, FromStatus: &row.Status, ToStatus: to,
-			ActorType: actor.Type, ActorID: &actor.ID, ActorName: actorName, Note: note,
+			ActorType: actor.Type, ActorID: actorID, ActorName: actorName, Note: note,
 		})
 	})
 	if err != nil {
diff --git a/services/core/queries/order.sql b/services/core/queries/order.sql
index 37883ac..8746d10 100644
--- a/services/core/queries/order.sql
+++ b/services/core/queries/order.sql
@@ -25,7 +25,7 @@ where id = @id
   and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id));
 
 -- name: LockOrder :one
-select id, number, status, store_id from orders
+select id, number, status, store_id, payment_status from orders
 where id = @id
   and (sqlc.narg(customer_id)::uuid is null or customer_id = sqlc.narg(customer_id))
   and (sqlc.narg(store_id)::uuid is null or store_id = sqlc.narg(store_id))
@@ -40,6 +40,9 @@ set status        = @status,
     rider_name    = coalesce(sqlc.narg(rider_name), rider_name)
 where id = @id;
 
+-- name: SetPayment :exec
+update orders set payment_status = @payment_status, payment_reference = @payment_reference where id = @id;
+
 -- name: CustomerOrders :many
 select * from orders where customer_id = @customer_id
 order by placed_at desc, id desc
```

### `openapi.json` script (Task 2)

```python
# Task 2: POST /admin/orders/{id}/payment, payment_pending on accept, the service actor
# table (payment cancels as the system), services named per route. Run from services/core.
import copy, json
d = json.load(open('openapi.json'))
s = d['components']['schemas']
P = d['paths']

def err(code, message, field=None):
    e = {"code": code, "message": message}
    if field:
        e["field"] = field
    return {"error": e}

def error_response(description, example=None, examples=None):
    media = {"schema": {"$ref": "#/components/schemas/Error"}}
    if examples:
        media["examples"] = examples
    else:
        media["example"] = example
    return {"description": description, "content": {"application/json": media}}

s['Error']['properties']['error']['properties']['code']['enum'].insert(-1, 'payment_pending')

ev = s['OrderEvent']
ev['description'] = "One entry of an order's history, oldest first. The placement event has no fromStatus. A payment change (POST /admin/orders/{id}/payment) is an event by the system whose fromStatus equals its toStatus (the order's status, unchanged) and whose note names the payment status and reference."
ev['properties']['actorName']['description'] = "The rider's name on an event a rider made; the actor's name on an event the system made (\"payment timeout\" on a timeout cancel, the service's name, \"payment\", on a payment change). Omitted otherwise."

ch = s['OrderStatusChange']
ch['description'] = "A status change by staff or by a service. note is kept on the event; on a cancel it is the order's cancelReason. A service names its actor (the rider service a rider, the payment service the system); staff name no actor."
ch['properties']['actor'] = {
    "type": "object",
    "description": "Required from a service, refused from staff (400 field actor). The rider service names the rider making the move (type rider, id, name); the payment service names the system (type system, name, no id).",
    "required": ["type", "name"],
    "properties": {
        "type": {"type": "string", "enum": ["rider", "system"]},
        "id": {"type": "string", "format": "uuid", "description": "The rider's id: required for a rider, refused for the system."},
        "name": {"type": "string", "minLength": 1, "maxLength": 80},
    },
}

s['OrderPaymentChange'] = {
    "type": "object",
    "description": "The payment service marks an online order's payment paid (from pending) or refunded (from paid).",
    "required": ["status", "reference"],
    "properties": {
        "status": {"type": "string", "enum": ["paid", "refunded"]},
        "reference": {"type": "string", "minLength": 1, "maxLength": 100, "description": "The payment service's reference for this change, trimmed; kept as the order's paymentReference and in the event's note."},
    },
}

reader = " A service token (SHOPPERSTOP_CORE_SERVICE_TOKENS) is admitted as an unscoped reader, like an admin."
for path in ['/admin/stores', '/admin/stores/{id}', '/admin/stores/{id}/orders']:
    op = P[path]['get']
    op['description'] = op['description'].replace(reader, " The rider service's token (SHOPPERSTOP_CORE_SERVICE_TOKENS) is admitted as an unscoped reader, like an admin; another service's token answers 403.")
op = P['/admin/orders/{id}']['get']
op['description'] = op['description'].replace(reader, " The rider and payment services' tokens (SHOPPERSTOP_CORE_SERVICE_TOKENS) are admitted as unscoped readers, like an admin; another service's token answers 403.")

op = P['/admin/orders/{id}/status']['post']
op['description'] = op['description'].replace(
    "a move the table does not allow answers 409 conflict.",
    "a move the table does not allow answers 409 conflict, and accepting an order whose paymentStatus is pending answers 409 payment_pending.").replace(
    " A service token is admitted and must name the rider in actor; it may move an order only to out_for_delivery or delivered, and anything else answers 403. Staff name no actor.",
    " A service token is admitted by the service actor table: the rider service names the rider in actor and may move an order only to out_for_delivery or delivered; the payment service names the system ({type: system, name}, no id) and may only cancel, which returns the stock like any cancel; another target answers 403 before the actor or the order is read, and another service's token answers 403. Staff name no actor.")
op['requestBody']['content']['application/json']['examples']['paymentTimeout'] = {
    "value": {"status": "cancelled", "note": "not paid within 15 minutes", "actor": {"type": "system", "name": "payment timeout"}}}
op['responses']['403']['description'] = "A service moving the order to a status its row of the service actor table does not allow (the rider service: anything but out_for_delivery or delivered; the payment service: anything but cancelled), or another service's token. Nothing changes."
op['responses']['403']['content']['application/json']['example'] = err("forbidden", "this service may not move an order to cancelled")
r409 = op['responses']['409']
r409['description'] = "The table does not allow the move, for example placed to packing, or the order is already delivered or cancelled (conflict); or staff accept an online order whose payment is still pending (payment_pending). Nothing changes."
media = r409['content']['application/json']
media['examples'] = {
    "conflict": {"summary": "The table does not allow the move", "value": media.pop('example')},
    "paymentPending": {"summary": "The online order is not paid yet", "value": err("payment_pending", "the order awaits payment")},
}

order_example = copy.deepcopy(P['/admin/orders/{id}']['get']['responses']['200']['content']['application/json']['example'])
paid = {}
for k, v in order_example.items():
    if k in ('paymentStatus', 'paymentReference'):
        continue
    paid[k] = v
    if k == 'paymentMethod':
        paid[k] = 'online'
        paid['paymentStatus'] = 'paid'
        paid['paymentReference'] = 'plink_Demo0001'
paid['status'] = 'placed'
paid.pop('deliveredAt', None)
paid.pop('cancelledAt', None)
paid.pop('cancelReason', None)
paid.pop('riderName', None)
paid['events'] = [
    {"toStatus": "placed", "actorType": "customer", "createdAt": "2026-10-13T09:20:00Z"},
    {"fromStatus": "placed", "toStatus": "placed", "actorType": "system", "actorName": "payment", "note": "Payment paid, reference plink_Demo0001", "createdAt": "2026-10-13T09:21:00Z"},
]

new = {}
for path, item in P.items():
    new[path] = item
    if path == '/admin/orders/{id}/status':
        new['/admin/orders/{id}/payment'] = {
            "post": {
                "parameters": copy.deepcopy(item['post']['parameters']),
                "operationId": "postAdminOrderPayment",
                "summary": "Mark an order's payment paid or refunded",
                "description": "The payment service only (its token in SHOPPERSTOP_CORE_SERVICE_TOKENS): marks an online order's payment paid, only while it is pending, or refunded, only while it is paid, in one transaction. The order's status does not change; one event by the system is appended (fromStatus and toStatus both the order's status, actorName payment, note \"Payment <status>, reference <reference>\") and the reference becomes paymentReference. Staff can accept the order once it is paid. The body is checked before the order is read: a status other than paid or refunded is 400 field status, a reference that is empty after trimming or longer than 100 characters 400 field reference. A cash order, or a payment not in the status the change comes from (paying twice, refunding a pending payment), answers 409 conflict and changes nothing: a caller retrying after a lost answer reads the order to see whether its change landed. An unknown order is 404. 401 with no token, an unknown token or a customer token; 403 for a staff session or another service's token.",
                "tags": ["orders"],
                "security": [{"bearer": []}],
                "x-service-token": True,
                "requestBody": {"required": True, "content": {"application/json": {
                    "schema": {"$ref": "#/components/schemas/OrderPaymentChange"},
                    "examples": {
                        "paid": {"value": {"status": "paid", "reference": "plink_Demo0001"}},
                        "refunded": {"value": {"status": "refunded", "reference": "rfnd_Demo0001"}},
                    }}}},
                "responses": {
                    "200": {"description": "The order with its new payment status, reference and event.", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Order"}, "example": paid}}},
                    "400": error_response("status is neither paid nor refunded (field status), the reference is empty or longer than 100 characters (field reference), or the body is not JSON. Nothing changes.", err("validation", "must be paid or refunded", "status")),
                    "401": error_response("No token, an unknown token or a customer token.", err("unauthorized", "sign in required")),
                    "403": error_response("A staff session or a service other than payment.", err("forbidden", "services only")),
                    "404": error_response("No order has this id, or the id is not a uuid.", err("not_found", "not found")),
                    "409": error_response("The order is paid in cash, or its payment is not pending (for paid) or not paid (for refunded). Nothing changes.", err("conflict", "the payment is not pending")),
                },
            },
        }
d['paths'] = new
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 3: events feed and commit-ordered seq

```diff
diff --git a/services/core/internal/app/app.go b/services/core/internal/app/app.go
index 399eaf2..eaa11fc 100644
--- a/services/core/internal/app/app.go
+++ b/services/core/internal/app/app.go
@@ -86,6 +86,7 @@ func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) c
 	r.With(a.OrService(a.RequireStaff, "rider", "payment")).Get("/api/core/v1/admin/orders/{id}", order.AdminGet(pool))
 	r.With(a.OrService(a.RequireStaff, "rider", "payment")).Post("/api/core/v1/admin/orders/{id}/status", order.SetStatus(pool))
 	r.With(a.RequireService("payment")).Post("/api/core/v1/admin/orders/{id}/payment", order.SetPayment(pool))
+	r.With(a.RequireService("payment")).Get("/api/core/v1/admin/order-events", order.Feed(pool))
 	r.With(a.RequireStaff).Get("/api/core/v1/admin/dashboard", staff.Dashboard(pool))
 	return r
 }
diff --git a/services/core/internal/app/order_events_test.go b/services/core/internal/app/order_events_test.go
new file mode 100644
index 0000000..e3e9f0b
--- /dev/null
+++ b/services/core/internal/app/order_events_test.go
@@ -0,0 +1,184 @@
+package app
+
+import (
+	"bytes"
+	"context"
+	"encoding/json"
+	"net/http"
+	"strconv"
+	"strings"
+	"testing"
+	"time"
+)
+
+const orderEventsPath = "/api/core/v1/admin/order-events"
+
+// feedItem is one item of GET /admin/order-events.
+type feedItem struct {
+	Seq           int64     `json:"seq"`
+	OrderID       string    `json:"orderId"`
+	OrderNumber   string    `json:"orderNumber"`
+	StoreID       string    `json:"storeId"`
+	CustomerID    string    `json:"customerId"`
+	FromStatus    string    `json:"fromStatus"`
+	ToStatus      string    `json:"toStatus"`
+	PaymentMethod string    `json:"paymentMethod"`
+	PaymentStatus string    `json:"paymentStatus"`
+	ActorType     string    `json:"actorType"`
+	CreatedAt     time.Time `json:"createdAt"`
+}
+
+// lastSeq is the highest event seq so far, 0 with no events.
+func lastSeq(t *testing.T) int64 {
+	t.Helper()
+	var n int64
+	if err := testPool.QueryRow(context.Background(), "select coalesce(max(seq), 0) from order_events").Scan(&n); err != nil {
+		t.Fatal(err)
+	}
+	return n
+}
+
+// feed reads the events feed with the payment service's token and query, failing unless it is 200.
+func feed(t *testing.T, query string) ([]feedItem, string) {
+	t.Helper()
+	status, body := call(t, http.MethodGet, orderEventsPath+query, testPaymentToken, nil)
+	var out struct {
+		Items []feedItem `json:"items"`
+	}
+	if status != http.StatusOK || json.Unmarshal(body, &out) != nil || out.Items == nil {
+		t.Fatalf("GET order-events%s: got %d %s, want 200 with items", query, status, body)
+	}
+	return out.Items, string(body)
+}
+
+// TestEventFeedTailsPlacements: two placements and a payment come out of the feed
+// in commit order with ascending seq, each with its order's ids and current
+// payment state; limit and after page through them.
+func TestEventFeedTailsPlacements(t *testing.T) {
+	before := lastSeq(t)
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 5000)
+	stockTo(t, s.ID, p, 9)
+	cash := newBuyer(t, s.Pincode)
+	setLine(t, cash.Token, s.ID, p, 1)
+	a := mustPlace(t, cash)
+	online := verified(t, newBuyer(t, s.Pincode))
+	setLine(t, online.Token, s.ID, p, 1)
+	_, raw := placePaid(t, online, "online")
+	var b orderView
+	if err := json.Unmarshal(raw, &b); err != nil {
+		t.Fatal(err)
+	}
+	mustPay(t, b.ID, "paid", "pay_feed")
+
+	items, body := feed(t, "?after="+strconv.FormatInt(before, 10))
+	if len(items) != 3 {
+		t.Fatalf("feed after %d: %s, want 3 events", before, body)
+	}
+	if items[0].Seq <= before || items[1].Seq <= items[0].Seq || items[2].Seq <= items[1].Seq {
+		t.Fatalf("seqs %d, %d, %d after %d: want strictly ascending", items[0].Seq, items[1].Seq, items[2].Seq, before)
+	}
+	want := []feedItem{
+		{OrderID: a.ID, OrderNumber: a.Number, StoreID: s.ID, CustomerID: cash.ID, ToStatus: "placed", PaymentMethod: "cod", ActorType: "customer"},
+		{OrderID: b.ID, OrderNumber: b.Number, StoreID: s.ID, CustomerID: online.ID, ToStatus: "placed", PaymentMethod: "online", PaymentStatus: "paid", ActorType: "customer"},
+		{OrderID: b.ID, OrderNumber: b.Number, StoreID: s.ID, CustomerID: online.ID, FromStatus: "placed", ToStatus: "placed", PaymentMethod: "online", PaymentStatus: "paid", ActorType: "system"},
+	}
+	for i, w := range want {
+		got := items[i]
+		w.Seq, w.CreatedAt = got.Seq, got.CreatedAt
+		if got != w || got.CreatedAt.IsZero() || got.CreatedAt.Location() != time.UTC {
+			t.Fatalf("item %d: %+v, want %+v", i, got, w)
+		}
+	}
+	if first := strings.Index(body, "}"); strings.Contains(body[:first], "paymentStatus") || strings.Contains(body[:first], "fromStatus") {
+		t.Fatalf("cash placement item %s: want no paymentStatus and no fromStatus", body[:first+1])
+	}
+
+	if one, _ := feed(t, "?after="+strconv.FormatInt(before, 10)+"&limit=1"); len(one) != 1 || one[0].Seq != items[0].Seq {
+		t.Fatalf("limit=1: %+v, want only seq %d", one, items[0].Seq)
+	}
+	if next, _ := feed(t, "?after="+strconv.FormatInt(items[0].Seq, 10)+"&limit=1"); len(next) != 1 || next[0].Seq != items[1].Seq {
+		t.Fatalf("after the first: %+v, want only seq %d", next, items[1].Seq)
+	}
+	if rest, body := feed(t, "?after="+strconv.FormatInt(items[2].Seq, 10)); len(rest) != 0 || body != `{"items":[]}`+"\n" {
+		t.Fatalf("after the last: %q, want {\"items\":[]}", body)
+	}
+}
+
+// TestEventFeedValidation: after and limit must be whole numbers in range.
+func TestEventFeedValidation(t *testing.T) {
+	for _, row := range []struct{ query, field string }{
+		{"?after=-1", "after"},
+		{"?after=x", "after"},
+		{"?after=", "after"},
+		{"?limit=0", "limit"},
+		{"?limit=501", "limit"},
+		{"?limit=1.5", "limit"},
+	} {
+		status, body := call(t, http.MethodGet, orderEventsPath+row.query, testPaymentToken, nil)
+		expectError(t, row.query, status, body, http.StatusBadRequest, "validation", row.field, "")
+	}
+	if items, _ := feed(t, "?limit=500"); len(items) > 500 {
+		t.Fatalf("limit=500 answered %d items", len(items))
+	}
+}
+
+// TestEventFeedForServicesOnly: only the payment service reads the feed.
+func TestEventFeedForServicesOnly(t *testing.T) {
+	status, body := call(t, http.MethodGet, orderEventsPath, adminToken(t), nil)
+	expectError(t, "admin", status, body, http.StatusForbidden, "forbidden", "", "services only")
+	status, body = call(t, http.MethodGet, orderEventsPath, testServiceToken, nil)
+	expectError(t, "rider service", status, body, http.StatusForbidden, "forbidden", "", "")
+	for what, token := range map[string]string{"no token": "", "customer": newCustomer(t).Token} {
+		status, body := call(t, http.MethodGet, orderEventsPath, token, nil)
+		expectError(t, what, status, body, http.StatusUnauthorized, "unauthorized", "", "")
+	}
+}
+
+// TestEventWritesWaitForTheEventsLock: while another transaction holds the
+// events lock, a status change waits for it, so seq follows commit order.
+func TestEventWritesWaitForTheEventsLock(t *testing.T) {
+	s := newShop(t)
+	p := cartProduct(t, s.ID, stockName(t), 1000)
+	id := orderIn(t, s.ID, newCustomer(t).Customer.ID, p, "placed")
+	token := adminToken(t)
+	ctx := context.Background()
+	tx, err := testPool.Begin(ctx)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer tx.Rollback(ctx)
+	if _, err := tx.Exec(ctx, "select pg_advisory_xact_lock(hashtext('order_events'))"); err != nil {
+		t.Fatal(err)
+	}
+
+	done := make(chan int, 1)
+	go func() {
+		req, _ := http.NewRequest(http.MethodPost, srv.URL+adminOrderPath(id)+"/status", bytes.NewReader([]byte(`{"status":"accepted"}`)))
+		req.Header.Set("Content-Type", "application/json")
+		req.Header.Set("Authorization", "Bearer "+token)
+		resp, err := http.DefaultClient.Do(req)
+		if err != nil {
+			done <- 0
+			return
+		}
+		resp.Body.Close()
+		done <- resp.StatusCode
+	}()
+	select {
+	case status := <-done:
+		t.Fatalf("status change answered %d while the events lock was held, want it to wait", status)
+	case <-time.After(300 * time.Millisecond):
+	}
+	if err := tx.Commit(ctx); err != nil {
+		t.Fatal(err)
+	}
+	select {
+	case status := <-done:
+		if status != http.StatusOK {
+			t.Fatalf("status change after the lock: %d, want 200", status)
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("status change still waiting 5 s after the lock was released")
+	}
+}
diff --git a/services/core/internal/order/events.go b/services/core/internal/order/events.go
new file mode 100644
index 0000000..2a82e53
--- /dev/null
+++ b/services/core/internal/order/events.go
@@ -0,0 +1,82 @@
+package order
+
+import (
+	"net/http"
+	"strconv"
+	"time"
+
+	"github.com/jackc/pgx/v5/pgxpool"
+
+	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
+	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
+)
+
+// FeedEvent is one order event as services tail it, with the order's ids and
+// its payment state when read.
+type FeedEvent struct {
+	Seq           int64     `json:"seq"`
+	OrderID       string    `json:"orderId"`
+	OrderNumber   string    `json:"orderNumber"`
+	StoreID       string    `json:"storeId"`
+	CustomerID    string    `json:"customerId"`
+	FromStatus    string    `json:"fromStatus,omitempty"` // absent on the placement event
+	ToStatus      string    `json:"toStatus"`
+	PaymentMethod string    `json:"paymentMethod"`
+	PaymentStatus string    `json:"paymentStatus,omitempty"` // online orders only
+	ActorType     string    `json:"actorType"`
+	CreatedAt     time.Time `json:"createdAt"` // UTC
+}
+
+// feedParam reads a whole-number query parameter between lo and hi, def when
+// absent; anything else is 400 validation naming it.
+func feedParam(r *http.Request, name string, def, lo, hi int64) (int64, error) {
+	q := r.URL.Query()
+	if !q.Has(name) {
+		return def, nil
+	}
+	n, err := strconv.ParseInt(q.Get(name), 10, 64)
+	if err != nil || n < lo || n > hi {
+		return 0, invalid(name, "must be a whole number from "+strconv.FormatInt(lo, 10)+" to "+strconv.FormatInt(hi, 10))
+	}
+	return n, nil
+}
+
+// Feed answers 200 with {items}: at most limit (default 100, at most 500) order
+// events with seq above after (default 0), ascending by seq. A caller keeps the
+// last seq it handled and asks for the events after it; an empty list means
+// it is up to date. There is no paging envelope: seq is the cursor.
+func Feed(pool *pgxpool.Pool) http.HandlerFunc {
+	return func(w http.ResponseWriter, r *http.Request) {
+		after, err := feedParam(r, "after", 0, 0, 1<<62)
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		limit, err := feedParam(r, "limit", 100, 1, 500)
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		rows, err := db.New(pool).EventFeed(r.Context(), db.EventFeedParams{After: after, Lim: int32(limit)})
+		if err != nil {
+			httpx.WriteError(w, r, err)
+			return
+		}
+		items := make([]FeedEvent, len(rows))
+		for i, e := range rows {
+			items[i] = FeedEvent{
+				Seq: e.Seq, OrderID: e.OrderID, OrderNumber: e.Number, StoreID: e.StoreID, CustomerID: e.CustomerID,
+				ToStatus: string(e.ToStatus), PaymentMethod: e.PaymentMethod, ActorType: e.ActorType, CreatedAt: e.CreatedAt.UTC(),
+			}
+			if e.FromStatus != nil {
+				items[i].FromStatus = string(*e.FromStatus)
+			}
+			if e.PaymentStatus != nil {
+				items[i].PaymentStatus = string(*e.PaymentStatus)
+			}
+		}
+		httpx.WriteJSON(w, http.StatusOK, struct {
+			Items []FeedEvent `json:"items"`
+		}{items})
+	}
+}
diff --git a/services/core/internal/order/order.go b/services/core/internal/order/order.go
index ce6a135..bd89dbd 100644
--- a/services/core/internal/order/order.go
+++ b/services/core/internal/order/order.go
@@ -145,6 +145,16 @@ func views(ctx context.Context, q *db.Queries, rows []db.Order) ([]Order, error)
 	return out, nil
 }
 
+// addEvent appends one order event under the events lock (queries/order.sql
+// LockEvents), held to the end of the caller's transaction, so events are
+// numbered (seq) in the order they commit.
+func addEvent(ctx context.Context, q *db.Queries, arg db.AddEventParams) error {
+	if err := q.LockEvents(ctx); err != nil {
+		return err
+	}
+	return q.AddEvent(ctx, arg)
+}
+
 // newNumber is "SS-" and the 8 characters of base32 of 5 random bytes: A-Z and 2-7, no padding.
 func newNumber() (string, error) {
 	var b [5]byte
diff --git a/services/core/internal/order/payment.go b/services/core/internal/order/payment.go
index 190c4fd..16bfed9 100644
--- a/services/core/internal/order/payment.go
+++ b/services/core/internal/order/payment.go
@@ -71,7 +71,7 @@ func SetPayment(pool *pgxpool.Pool) http.HandlerFunc {
 			if err := q.SetPayment(ctx, db.SetPaymentParams{PaymentStatus: &to, PaymentReference: ref, ID: id}); err != nil {
 				return err
 			}
-			return q.AddEvent(ctx, db.AddEventParams{
+			return addEvent(ctx, q, db.AddEventParams{
 				OrderID: id, FromStatus: &row.Status, ToStatus: row.Status,
 				ActorType: "system", ActorName: &service, Note: "Payment " + string(to) + ", reference " + ref,
 			})
diff --git a/services/core/internal/order/place.go b/services/core/internal/order/place.go
index 87b84fe..4595a01 100644
--- a/services/core/internal/order/place.go
+++ b/services/core/internal/order/place.go
@@ -125,7 +125,7 @@ func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID, metho
 		if err := q.AddItems(ctx, arg); err != nil {
 			return err
 		}
-		if err := q.AddEvent(ctx, db.AddEventParams{OrderID: id, ToStatus: db.OrderStatusPlaced, ActorType: "customer", ActorID: &customerID}); err != nil {
+		if err := addEvent(ctx, q, db.AddEventParams{OrderID: id, ToStatus: db.OrderStatusPlaced, ActorType: "customer", ActorID: &customerID}); err != nil {
 			return err
 		}
 		return cart.Clear(ctx, tx, customerID)
diff --git a/services/core/internal/order/status.go b/services/core/internal/order/status.go
index 83bc9ba..9ce47e6 100644
--- a/services/core/internal/order/status.go
+++ b/services/core/internal/order/status.go
@@ -87,7 +87,7 @@ func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to
 				return err
 			}
 		}
-		return q.AddEvent(ctx, db.AddEventParams{
+		return addEvent(ctx, q, db.AddEventParams{
 			OrderID: id, FromStatus: &row.Status, ToStatus: to,
 			ActorType: actor.Type, ActorID: actorID, ActorName: actorName, Note: note,
 		})
diff --git a/services/core/queries/order.sql b/services/core/queries/order.sql
index 8746d10..7d5cb48 100644
--- a/services/core/queries/order.sql
+++ b/services/core/queries/order.sql
@@ -13,6 +13,13 @@ insert into order_items (order_id, product_id, name, unit_label, image_url, pric
 select @order_id::uuid, unnest(@product_ids::uuid[]), unnest(@names::text[]), unnest(@unit_labels::text[]),
        unnest(@image_urls::text[]), unnest(@price_cents::bigint[]), unnest(@mrp_cents::bigint[]), unnest(@quantities::integer[]);
 
+-- name: LockEvents :exec
+-- Every event insert takes this lock first and holds it to commit, so seq is
+-- handed out in commit order and a reader of the feed never sees seq n+1
+-- committed while n is still in flight.
+-- ponytail: one lock serialises every event write; per-store streams if order volume needs it.
+select pg_advisory_xact_lock(hashtext('order_events'));
+
 -- name: AddEvent :exec
 insert into order_events (order_id, from_status, to_status, actor_type, actor_id, actor_name, note)
 values (@order_id, sqlc.narg(from_status), @to_status, @actor_type, sqlc.narg(actor_id), sqlc.narg(actor_name), @note);
@@ -74,6 +81,15 @@ select order_id, from_status, to_status, actor_type, actor_name, note, created_a
 from order_events where order_id = any(@order_ids::uuid[])
 order by order_id, created_at, id;
 
+-- name: EventFeed :many
+-- The events after seq @after, ascending, with the order's current payment state.
+select e.seq, e.order_id, o.number, o.store_id, o.customer_id, e.from_status, e.to_status,
+       o.payment_method, o.payment_status, e.actor_type, e.created_at
+from order_events e join orders o on o.id = e.order_id
+where e.seq > @after
+order by e.seq
+limit @lim;
+
 -- name: CountsToday :many
 -- Orders placed since midnight in Bengaluru, by current status.
 select status, count(*) as orders from orders
```

### `openapi.json` script (Task 3)

```python
# Task 3: GET /admin/order-events, the events feed services tail. Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

def err(code, message, field=None):
    e = {"code": code, "message": message}
    if field:
        e["field"] = field
    return {"error": e}

def error_response(description, example):
    return {"description": description, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}, "example": example}}}

statuses = ["placed", "accepted", "packing", "ready", "out_for_delivery", "delivered", "cancelled"]
s['OrderEventFeed'] = {
    "type": "object",
    "description": "A cursor list, not a page: no page, pageSize or total. Ask again with after set to the last seq handled; an empty items means the caller is up to date.",
    "required": ["items"],
    "properties": {"items": {"type": "array", "items": {"$ref": "#/components/schemas/OrderFeedEvent"}}},
}
s['OrderFeedEvent'] = {
    "type": "object",
    "description": "One order event as services tail it. seq increases in commit order: an event with a higher seq never commits before one with a lower seq. A payment change is an event whose fromStatus equals its toStatus.",
    "required": ["seq", "orderId", "orderNumber", "storeId", "customerId", "toStatus", "paymentMethod", "actorType", "createdAt"],
    "properties": {
        "seq": {"type": "integer", "format": "int64", "minimum": 1},
        "orderId": {"type": "string", "format": "uuid"},
        "orderNumber": {"type": "string", "pattern": "^SS-[A-Z2-7]{8}$"},
        "storeId": {"type": "string", "format": "uuid"},
        "customerId": {"type": "string", "format": "uuid"},
        "fromStatus": {"type": "string", "enum": statuses, "description": "Omitted on the placement event."},
        "toStatus": {"type": "string", "enum": statuses},
        "paymentMethod": {"type": "string", "enum": ["cod", "online"]},
        "paymentStatus": {"type": "string", "enum": ["pending", "paid", "refunded"], "description": "The order's payment status when the feed is read, not when the event was written. Online orders only."},
        "actorType": {"type": "string", "enum": ["customer", "staff", "system", "rider"]},
        "createdAt": {"type": "string", "format": "date-time"},
    },
}

example = {"items": [
    {"seq": 41, "orderId": "00000000-0000-4000-8000-000000000704", "orderNumber": "SS-DEMOAAAE", "storeId": "00000000-0000-4000-8000-000000000401", "customerId": "00000000-0000-4000-8000-000000000201", "toStatus": "placed", "paymentMethod": "online", "paymentStatus": "paid", "actorType": "customer", "createdAt": "2026-10-13T09:20:00Z"},
    {"seq": 42, "orderId": "00000000-0000-4000-8000-000000000704", "orderNumber": "SS-DEMOAAAE", "storeId": "00000000-0000-4000-8000-000000000401", "customerId": "00000000-0000-4000-8000-000000000201", "fromStatus": "placed", "toStatus": "placed", "paymentMethod": "online", "paymentStatus": "paid", "actorType": "system", "createdAt": "2026-10-13T09:21:00Z"},
    {"seq": 43, "orderId": "00000000-0000-4000-8000-000000000703", "orderNumber": "SS-DEMOAAAD", "storeId": "00000000-0000-4000-8000-000000000401", "customerId": "00000000-0000-4000-8000-000000000201", "fromStatus": "placed", "toStatus": "cancelled", "paymentMethod": "cod", "actorType": "customer", "createdAt": "2026-10-13T09:25:00Z"},
]}

new = {}
for path, item in d['paths'].items():
    new[path] = item
    if path == '/admin/orders/{id}/payment':
        new['/admin/order-events'] = {"get": {
            "operationId": "getAdminOrderEvents",
            "summary": "Tail order events",
            "description": "The payment service only (its token in SHOPPERSTOP_CORE_SERVICE_TOKENS): every order event with seq above after, ascending by seq, at most limit of them, each with its order's id, number, store, customer and current payment state. Services learn about orders by polling this feed with the last seq they handled (D51); core never calls out. seq follows commit order, so a caller that moves its cursor to the last seq it read never skips an event. A cursor list, not a page: the answer is {items} with no page, pageSize or total. after (default 0) must be a whole number at least 0 and limit (default 100) a whole number from 1 to 500, else 400 naming the parameter. 401 with no token, an unknown token or a customer token; 403 for a staff session or another service's token.",
            "tags": ["orders"],
            "security": [{"bearer": []}],
            "x-service-token": True,
            "parameters": [
                {"name": "after", "in": "query", "required": False, "description": "Answer only events with a higher seq. Default 0, from the first event.", "schema": {"type": "integer", "format": "int64", "minimum": 0, "default": 0}, "example": 40},
                {"name": "limit", "in": "query", "required": False, "description": "At most this many events. Default 100.", "schema": {"type": "integer", "minimum": 1, "maximum": 500, "default": 100}, "example": 100},
            ],
            "responses": {
                "200": {"description": "The next events, ascending by seq; empty when there are none.", "content": {"application/json": {"schema": {"$ref": "#/components/schemas/OrderEventFeed"}, "example": example}}},
                "400": error_response("after or limit is not a whole number in its range (field after or limit).", err("validation", "must be a whole number from 1 to 500", "limit")),
                "401": error_response("No token, an unknown token or a customer token.", err("unauthorized", "sign in required")),
                "403": error_response("A staff session or a service other than payment.", err("forbidden", "services only")),
            },
        }}
d['paths'] = new
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 4: demo order paid online

```diff
diff --git a/services/core/internal/seed/seed.go b/services/core/internal/seed/seed.go
index 7f27667..ebbbc8f 100644
--- a/services/core/internal/seed/seed.go
+++ b/services/core/internal/seed/seed.go
@@ -155,20 +155,24 @@ func load(ctx context.Context, tx pgx.Tx, h hashes) error {
 		cross join (select id, row_number() over (order by id) as n from products) p`); err != nil {
 		return fmt.Errorf("insert demo stock: %w", err)
 	}
-	// orders (core-P2-L5, design Decision 15): three demo orders of the demo
-	// customer at Koramangala, their items, totals and events.
+	// orders (core-P2-L5, design Decision 15): four demo orders of the demo
+	// customer at Koramangala, their items, totals and events. SS-DEMOAAAE
+	// (core-payments) is paid online; the payment service seeds its payment.
 	if _, err := tx.Exec(ctx, `
 -- 1. orders ($1 customer ...0201, $2 store ...0401); totals filled by statement 3
 insert into orders (id, number, customer_id, store_id, store_name, promised_minutes, status, customer_name, customer_phone,
                     address_label, address_line1, address_pincode,
-                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason, rider_name)
+                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason, rider_name,
+                    payment_method, payment_status, payment_reference)
 values
   ('00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB', $1, $2, 'Koramangala', 10, 'delivered', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, '', 'Arjun Rao'),
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, '', 'Arjun Rao', 'cod', null, ''),
   ('00000000-0000-4000-8000-000000000702', 'SS-DEMOAAAC', $1, $2, 'Koramangala', 10, 'cancelled', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake', null),
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake', null, 'cod', null, ''),
   ('00000000-0000-4000-8000-000000000703', 'SS-DEMOAAAD', $1, $2, 'Koramangala', 10, 'placed', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '', null);
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '', null, 'cod', null, ''),
+  ('00000000-0000-4000-8000-000000000704', 'SS-DEMOAAAE', $1, $2, 'Koramangala', 10, 'placed', 'Demo Customer', '+919800000000',
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '3 days', null, null, '', null, 'online', 'paid', 'fake_demo_0a01');
 `, customerID, storeKoramangala); err != nil {
 		return fmt.Errorf("insert demo orders: %w", err)
 	}
@@ -183,7 +187,9 @@ from (values
   ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000602', 1),
   ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000603', 1),
   ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000601', 1),
-  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000604', 3)
+  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000604', 3),
+  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000602', 2),
+  ('00000000-0000-4000-8000-000000000704', '00000000-0000-4000-8000-000000000604', 3)
 ) as l (order_id, product_id, quantity)
 join products p on p.id = l.product_id::uuid;
 `); err != nil {
@@ -202,12 +208,13 @@ where t.order_id = o.id and s.id = o.store_id and o.number like 'SS-DEMO%';
 	}
 	if _, err := tx.Exec(ctx, `
 -- 4. events ($1 the Koramangala store staff ...0102 as the staff actor; the rider
---    is the rider service's demo rider ...0801 Arjun Rao, who delivered SS-DEMOAAAB)
+--    is the rider service's demo rider ...0801 Arjun Rao, who delivered SS-DEMOAAAB;
+--    the system event is the payment service marking SS-DEMOAAAE paid, no actor id)
 insert into order_events (order_id, from_status, to_status, actor_type, actor_id, actor_name, note, created_at)
 select o.id, e.from_status::order_status, e.to_status::order_status, e.actor_type,
        case e.actor_type when 'customer' then o.customer_id when 'staff' then $1::uuid
                          when 'rider' then '00000000-0000-4000-8000-000000000801'::uuid end,
-       case e.actor_type when 'rider' then 'Arjun Rao' end,
+       case e.actor_type when 'rider' then 'Arjun Rao' when 'system' then 'payment' end,
        e.note, o.placed_at + e.after
 from (values
   ('00000000-0000-4000-8000-000000000701', null, 'placed', 'customer', '', interval '0'),
@@ -218,7 +225,9 @@ from (values
   ('00000000-0000-4000-8000-000000000701', 'out_for_delivery', 'delivered', 'rider', '', interval '11 minutes'),
   ('00000000-0000-4000-8000-000000000702', null, 'placed', 'customer', '', interval '0'),
   ('00000000-0000-4000-8000-000000000702', 'placed', 'cancelled', 'customer', 'Ordered by mistake', interval '2 minutes'),
-  ('00000000-0000-4000-8000-000000000703', null, 'placed', 'customer', '', interval '0')
+  ('00000000-0000-4000-8000-000000000703', null, 'placed', 'customer', '', interval '0'),
+  ('00000000-0000-4000-8000-000000000704', null, 'placed', 'customer', '', interval '0'),
+  ('00000000-0000-4000-8000-000000000704', 'placed', 'placed', 'system', 'Payment paid, reference fake_demo_0a01', interval '1 minute')
 ) as e (order_id, from_status, to_status, actor_type, note, after)
 join orders o on o.id = e.order_id::uuid;
 `, staffKoramangala); err != nil {
diff --git a/services/core/internal/seed/seed_test.go b/services/core/internal/seed/seed_test.go
index b218b9d..90f0e45 100644
--- a/services/core/internal/seed/seed_test.go
+++ b/services/core/internal/seed/seed_test.go
@@ -489,6 +489,7 @@ const (
 	orderDelivered = "00000000-0000-4000-8000-000000000701"
 	orderCancelled = "00000000-0000-4000-8000-000000000702"
 	orderPlaced    = "00000000-0000-4000-8000-000000000703"
+	orderPaid      = "00000000-0000-4000-8000-000000000704"
 	productBanana  = "00000000-0000-4000-8000-000000000601"
 )
 
@@ -565,9 +566,9 @@ func TestResetLoadsDemoOrders(t *testing.T) {
 		}
 	}
 
-	assertCount(t, "orders", 3)
-	assertCount(t, "order_items", 5)
-	assertCount(t, "order_events", 9)
+	assertCount(t, "orders", 4)
+	assertCount(t, "order_items", 7)
+	assertCount(t, "order_events", 11)
 
 	rows, err := testPool.Query(ctx, "select id::text, number, status::text, customer_id::text, store_id::text from orders order by id")
 	if err != nil {
@@ -578,6 +579,7 @@ func TestResetLoadsDemoOrders(t *testing.T) {
 		{orderDelivered, "SS-DEMOAAAB", "delivered"},
 		{orderCancelled, "SS-DEMOAAAC", "cancelled"},
 		{orderPlaced, "SS-DEMOAAAD", "placed"},
+		{orderPaid, "SS-DEMOAAAE", "placed"},
 	}
 	for i := 0; rows.Next(); i++ {
 		var id, number, status, customer, store string
@@ -596,15 +598,19 @@ func TestResetLoadsDemoOrders(t *testing.T) {
 	assertSQL(t, "orders below the store minimum", "select count(*) from orders where subtotal_cents < 9900", 0)
 	assertSQL(t, "banana robusta lines in delivered and placed", "select count(*) from order_items where product_id = '00000000-0000-4000-8000-000000000601' and order_id in ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000703')", 2)
 	assertSQL(t, "orders whose status is not the latest event", "select count(*) from orders o where o.status::text <> (select e.to_status::text from order_events e where e.order_id = o.id order by e.created_at desc, e.id desc limit 1)", 0)
-	assertSQL(t, "placed events with no previous status", "select count(*) from order_events where from_status is null and to_status = 'placed'", 3)
-	assertSQL(t, "events with no actor", "select count(*) from order_events where actor_id is null", 0)
+	assertSQL(t, "placed events with no previous status", "select count(*) from order_events where from_status is null and to_status = 'placed'", 4)
+	assertSQL(t, "events with no actor", "select count(*) from order_events where actor_id is null and actor_type <> 'system'", 0)
 	assertSQL(t, "delivered orders with a delivery time", "select count(*) from orders where status = 'delivered' and delivered_at is not null", 1)
-	assertSQL(t, "orders to the demo Home address", "select count(*) from orders o join addresses a on a.id = '00000000-0000-4000-8000-000000000301' where o.address_label = 'Home' and o.address_label = a.label and o.address_line1 = a.line1 and o.address_pincode = a.pincode", 3)
-	assertSQL(t, "orders with the Koramangala snapshot", "select count(*) from orders where store_name = 'Koramangala' and promised_minutes = 10", 3)
+	assertSQL(t, "orders to the demo Home address", "select count(*) from orders o join addresses a on a.id = '00000000-0000-4000-8000-000000000301' where o.address_label = 'Home' and o.address_label = a.label and o.address_line1 = a.line1 and o.address_pincode = a.pincode", 4)
+	assertSQL(t, "orders with the Koramangala snapshot", "select count(*) from orders where store_name = 'Koramangala' and promised_minutes = 10", 4)
 	assertSQL(t, "cancelled orders with a reason and a time", "select count(*) from orders where status = 'cancelled' and cancelled_at is not null and cancel_reason = 'Ordered by mistake'", 1)
 	assertSQL(t, "orders with a rider", "select count(*) from orders where rider_name is not null", 1)
 	assertSQL(t, "SS-DEMOAAAB delivered by Arjun Rao", "select count(*) from orders where id = '00000000-0000-4000-8000-000000000701' and rider_name = 'Arjun Rao'", 1)
 	assertSQL(t, "rider events", "select count(*) from order_events where actor_type = 'rider'", 2)
+	assertSQL(t, "cash orders", "select count(*) from orders where payment_method = 'cod' and payment_status is null and payment_reference = ''", 3)
+	assertSQL(t, "SS-DEMOAAAE paid online", "select count(*) from orders where id = '00000000-0000-4000-8000-000000000704' and payment_method = 'online' and payment_status = 'paid' and payment_reference = 'fake_demo_0a01'", 1)
+	assertSQL(t, "SS-DEMOAAAE payment event", "select count(*) from order_events where order_id = '00000000-0000-4000-8000-000000000704' and from_status = 'placed' and to_status = 'placed' and actor_type = 'system' and actor_id is null and actor_name = 'payment' and note = 'Payment paid, reference fake_demo_0a01'", 1)
+	assertSQL(t, "system events", "select count(*) from order_events where actor_type = 'system'", 1)
 	assertSQL(t, "SS-DEMOAAAB rider events by rider ...0801", "select count(*) from order_events where order_id = '00000000-0000-4000-8000-000000000701' and to_status in ('out_for_delivery', 'delivered') and actor_type = 'rider' and actor_id = '00000000-0000-4000-8000-000000000801' and actor_name = 'Arjun Rao'", 2)
 }
 
@@ -628,12 +634,32 @@ func TestDemoOrdersThroughTheRouter(t *testing.T) {
 		} `json:"items"`
 		Total int `json:"total"`
 	}
-	if status != http.StatusOK || json.Unmarshal(body, &list) != nil || list.Total != 3 {
-		t.Fatalf("GET /orders: got %d %s, want 200 with total 3", status, body)
+	if status != http.StatusOK || json.Unmarshal(body, &list) != nil || list.Total != 4 {
+		t.Fatalf("GET /orders: got %d %s, want 200 with total 4", status, body)
 	}
-	for i, id := range []string{orderPlaced, orderCancelled, orderDelivered} {
+	for i, id := range []string{orderPlaced, orderCancelled, orderDelivered, orderPaid} {
 		if i >= len(list.Items) || list.Items[i].ID != id {
-			t.Fatalf("GET /orders: got %s, want %s, %s, %s newest first", body, orderPlaced, orderCancelled, orderDelivered)
+			t.Fatalf("GET /orders: got %s, want %s, %s, %s, %s newest first", body, orderPlaced, orderCancelled, orderDelivered, orderPaid)
+		}
+	}
+
+	// SS-DEMOAAAE reads back paid online on both sides, with its payment event by the system.
+	for _, read := range []struct{ path, bearer string }{{"/api/core/v1/orders/", customer}, {"/api/core/v1/admin/orders/", admin}} {
+		status, body = request(t, base, http.MethodGet, read.path+orderPaid, read.bearer, nil)
+		var o struct {
+			PaymentMethod    string `json:"paymentMethod"`
+			PaymentStatus    string `json:"paymentStatus"`
+			PaymentReference string `json:"paymentReference"`
+			Events           []struct {
+				FromStatus string `json:"fromStatus"`
+				ToStatus   string `json:"toStatus"`
+				ActorType  string `json:"actorType"`
+				ActorName  string `json:"actorName"`
+			} `json:"events"`
+		}
+		if status != http.StatusOK || json.Unmarshal(body, &o) != nil || o.PaymentMethod != "online" || o.PaymentStatus != "paid" || o.PaymentReference != "fake_demo_0a01" ||
+			len(o.Events) != 2 || o.Events[1].FromStatus != "placed" || o.Events[1].ToStatus != "placed" || o.Events[1].ActorType != "system" || o.Events[1].ActorName != "payment" {
+			t.Fatalf("GET %s%s: got %d %s, want 200 paid online with reference fake_demo_0a01 and a payment event by the system", read.path, orderPaid, status, body)
 		}
 	}
 
@@ -757,8 +783,8 @@ func TestSummaryMatchesSeed(t *testing.T) {
 			}
 		}
 	}
-	if signIns != 4 || ids != 12 {
-		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 12", signIns, ids)
+	if signIns != 4 || ids != 13 {
+		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 13", signIns, ids)
 	}
 	// The fixed ids of PLAN.md D20 that Postman uses, and the table each marked line names.
 	wantPostman := map[string]string{"storeId": storeKoramangala, "productId": productBanana, "addressId": homeID, "orderId": orderPlaced}
diff --git a/services/core/internal/seed/summary.go b/services/core/internal/seed/summary.go
index c31080c..621fe6b 100644
--- a/services/core/internal/seed/summary.go
+++ b/services/core/internal/seed/summary.go
@@ -26,4 +26,5 @@ fixed ids (id, table, what)
   00000000-0000-4000-8000-000000000701  orders       SS-DEMOAAAB, delivered
   00000000-0000-4000-8000-000000000702  orders       SS-DEMOAAAC, cancelled
   00000000-0000-4000-8000-000000000703  orders       SS-DEMOAAAD, placed (Postman orderId)
+  00000000-0000-4000-8000-000000000704  orders       SS-DEMOAAAE, placed, paid online (reference fake_demo_0a01)
 `
```

Task 4 changes no `openapi.json`.
