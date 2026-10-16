## Context
core-P5-L1 put `paymentMethod` (`cod` | `online`, always present) and `paymentStatus` (`pending` | `paid` | `refunded`, online only, omitted for cash) on every core order read, including the two the rider makes with its service token: `GET /api/core/v1/admin/stores/{id}/orders?status=ready` (the ready list) and `GET /api/core/v1/admin/orders/{id}` (read before a claim). The rider service already decodes `paymentMethod` into `core.Order`, snapshots it into `deliveries.payment_method` at the claim (migration 0003) and answers it on every `Delivery`; the app already shows "Collect ₹x cash" for an assigned `cod` delivery. What is missing: `paymentMethod` on ready orders, `paymentStatus` anywhere, the app's online lines and the ready list's cash mark.

## Goals / Non-Goals
Goals: the rider sees cash orders on the ready list and, on the delivery page, whether to collect the total or not. Non-goals: recording that cash was collected, refunds, payment in History, any change outside the rider area.

## Decisions

### 1. Snapshot `paymentStatus` at the claim; ready orders read it live
The delivery row is a snapshot of core's order taken at the claim (customer, address, total, items, `payment_method`); every `Delivery` read is answered from the row, with no core call. `paymentStatus` joins that snapshot as one column, `payment_status text not null default ''` (migration `0004_delivery_payment_status`), `''` meaning "core sent none" (cash), mapped to an omitted JSON member by `omitempty` (the `customer_phone` and `address_line2` pattern).

Why a snapshot and not a live read: core's rules freeze the payment of any order a rider can claim. Staff accept only a paid online order (`payment_pending`), `paid` is set only from `pending` and `refunded` only from `paid` after a cancel, and nobody cancels an order from `packing` on. So an online order that reaches `ready` is `paid` and stays `paid` through `out_for_delivery` and `delivered`: the snapshot is exact for the life of the delivery. A live read would add a core call to every delivery read and to every row of the list (the "Your deliveries" links and History), and would make the delivery page fail when core is down, which it does not today. Not storing it at all (the app inferring "Paid online" from `online`) would bake core's rule into the app; the work package asks for the value passed through.

Ready orders already come from a live core read on every request, so `paymentMethod` and `paymentStatus` are copied from `core.Order` with no storage.

Ceiling: if core ever lets a payment change after `ready` (for example a refund of a delivered order), the delivery keeps the claim-time value. Then read the order live in `Get` only (one call), or have the payment service's events reach the rider.

### 2. No check constraint on `payment_status`
`payment_method` has none either; core owns both enums and the rider only copies them. Ceiling: a bad value from core would be stored and shown as no payment line.

### 3. The amount line, while assigned only
Three independent conditions in `delivery.tsx`: `paymentMethod === 'cod'` shows "Collect ₹<total> in cash" (neutral tone, as today, text changed from "Collect ₹x cash"), `paymentStatus === 'paid'` shows "Paid online", `paymentStatus === 'pending'` shows "Awaiting payment" with the warning tone (D53's pending tone). Core sends `paymentStatus` only on online orders, so at most one shows. An online delivery without a status, or `refunded`, shows nothing (both unreachable). A delivered delivery shows no line, as today.

### 4. The "Cash" badge
A neutral `Badge` "Cash" in a flex row beside the card's `Price`, only for `cod`. The work package says "Cash"; D53 lists "Cash on delivery" as the cash badge for the other apps. The rider card is dense and the rider deals only in cash or not, so the shorter word stays. The wording is split by audience: "Cash" is the rider wording on the dense ready card; D53's "Cash on delivery" is the customer and admin wording (web, mobile, admin badges); the rider's delivery page says "Collect ₹x in cash". Online orders get no badge: they are all paid by Decision 1.

### 5. e2e
The cross-app flow already places a cash order ("Place order (COD)"). It asserts `card.getByText('Cash', { exact: true })` on the ready card and a `status` matching `/^Collect ₹[\d,]+(\.\d{2})? in cash$/` on the delivery page, before the existing axe call. A regex rather than the exact total: the order's total is not in the test's hands and the e2e suite does not import `formatInr`. Ceiling: a wrong amount with the right shape passes e2e; the Vitest "Cash on delivery" scenario pins the exact text.

### 6. Capability
The ready list and delivery reads are specified in `deliveries`, not `rider-service`; those deltas modify `deliveries`. `rider-service` "Rider schema migrations" named only `0001` and `0002` in its scenario (stale since 0003); its delta brings the scenario to the four files `0001_init` to `0004_delivery_payment_status`, which `TestEmbeddedMigrationsApplyOnce` asserts. The requirement text stays as it is (445 characters, under the 500-character rule).

## Risks / Trade-offs
- web-P5-L2 reworks checkout. D53 keeps "Place order (COD)" as the cash button; if it is renamed, the rider flow's first step breaks (not this change's assertions).
- `make gen` regenerates every rider sqlc package: `internal/auth/db/models.go` gains `PaymentStatus` in its copy of `Delivery` (sqlc emits all models per package). Expected.

## Files
Task 1 (service): `services/rider/migrations/0004_delivery_payment_status.sql` (new), `services/rider/queries/deliveries.sql`, `services/rider/internal/core/core.go`, `services/rider/internal/delivery/delivery.go`, `services/rider/openapi.json`, tests `services/rider/internal/app/deliveries_test.go`, `services/rider/internal/migrate/migrate_test.go`; generated by `make gen postman`: `services/rider/internal/delivery/db/deliveries.sql.go`, `services/rider/internal/delivery/db/models.go`, `services/rider/internal/auth/db/models.go`, `packages/ui/src/api/rider.d.ts`, `docs/postman/shopperstop-rider.postman_collection.json`.

Task 2 (app): `apps/rider/src/ready.tsx`, `apps/rider/src/delivery.tsx`, tests `apps/rider/src/ready.test.tsx`, `apps/rider/src/delivery.test.tsx`, `apps/rider/src/fake-api.ts`, `apps/rider/e2e/flow.spec.ts`.

## Code
Spiked on 048b4a4 and reverted: with Task 1's diffs `GOFLAGS=-count=1 make test-rider` passed (all packages ok) and `make gen postman` changed exactly the five generated files above; with Task 2's diffs on top, rider Vitest 10 files / 64 tests passed, lint, typecheck and build exit 0. Red counts: Task 1 tests alone fail to compile (`o.PaymentStatus undefined (type core.Order has no field or method PaymentStatus)`, `go vet ./internal/app/`), and `TestEmbeddedMigrationsApplyOnce` fails (`0004_delivery_payment_status` missing); Task 2 tests alone: 5 failed / 59 passed (`delivery.test.tsx` assigned delivery shown, cash on delivery, paid online, awaiting payment; `ready.test.tsx` cash orders marked). Task 2's tests need Task 1's regenerated `rider.d.ts` to typecheck (`paymentStatus`, `ReadyOrder.paymentMethod`).

Apply each block with `git apply` from the worktree root (copy the text between the fences to a scratch file outside the repo).

### Task 1: tests
```diff
diff --git a/services/rider/internal/app/deliveries_test.go b/services/rider/internal/app/deliveries_test.go
index 68a1c7e..c3de579 100644
--- a/services/rider/internal/app/deliveries_test.go
+++ b/services/rider/internal/app/deliveries_test.go
@@ -44,8 +44,24 @@ func addOrder(t *testing.T, store, status string, placed time.Time) core.Order {
 // addOrderFor is addOrder with customerToken as the bearer that reads the order as its customer.
 func addOrderFor(t *testing.T, store, status string, placed time.Time, customerToken string) core.Order {
 	t.Helper()
+	o := newOrder(store, status, placed)
+	coreFake.AddOrder(o, customerToken)
+	return o
+}
+
+// addOnlineOrder is addOrder for an order paid online, whose payment core holds as paymentStatus.
+func addOnlineOrder(t *testing.T, store, status string, placed time.Time, paymentStatus string) core.Order {
+	t.Helper()
+	o := newOrder(store, status, placed)
+	o.PaymentMethod, o.PaymentStatus = "online", paymentStatus
+	coreFake.AddOrder(o, "")
+	return o
+}
+
+// newOrder is a cash order of store in status, placed at placed, with two lines.
+func newOrder(store, status string, placed time.Time) core.Order {
 	id := newID()
-	o := core.Order{
+	return core.Order{
 		ID: id, Number: "SS-" + strings.ToUpper(id[len(id)-6:]), StoreID: store, Status: status,
 		CustomerName: "Demo Customer", CustomerPhone: "+919800000000",
 		Address:    core.OrderAddress{Line1: "12 80 Feet Rd, Koramangala", Pincode: "560034"},
@@ -55,8 +71,6 @@ func addOrderFor(t *testing.T, store, status string, placed time.Time, customerT
 			{Name: "Shimla Apple", UnitLabel: "1 kg", Quantity: 1},
 		},
 	}
-	coreFake.AddOrder(o, customerToken)
-	return o
 }
 
 // readyJSON is one ready order as the list answers it.
@@ -189,6 +203,32 @@ func TestReadyOrdersOwnStoreOnly(t *testing.T) {
 	}
 }
 
+func TestReadyOrdersPassPaymentThrough(t *testing.T) {
+	store := newID()
+	_, token := riderAt(t, store)
+	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
+	cash := addOrder(t, store, "ready", t0)
+	online := addOnlineOrder(t, store, "ready", t0.Add(time.Minute), "paid")
+
+	status, body := callAt(t, srv.URL, http.MethodGet, readyPath, token, nil)
+	var list struct {
+		Items []map[string]any `json:"items"`
+	}
+	if status != http.StatusOK || json.Unmarshal(body, &list) != nil || len(list.Items) != 2 {
+		t.Fatalf("ready orders: got %d %s, want 200 with two orders", status, body)
+	}
+	got, paid := list.Items[0], list.Items[1]
+	if got["orderId"] != cash.ID || got["paymentMethod"] != "cod" {
+		t.Fatalf("cash order %v: want %s with paymentMethod cod", got, cash.ID)
+	}
+	if _, ok := got["paymentStatus"]; ok {
+		t.Fatalf("cash order %v: want no paymentStatus member", got)
+	}
+	if paid["orderId"] != online.ID || paid["paymentMethod"] != "online" || paid["paymentStatus"] != "paid" {
+		t.Fatalf("online order %v: want %s with paymentMethod online and paymentStatus paid", paid, online.ID)
+	}
+}
+
 func TestReadyOrdersDropClaimed(t *testing.T) {
 	store := newID()
 	riderID, token := riderAt(t, store)
@@ -254,6 +294,40 @@ func TestClaim(t *testing.T) {
 	}
 }
 
+func TestClaimKeepsPayment(t *testing.T) {
+	store := newID()
+	_, token := riderAt(t, store)
+	t0 := time.Date(2026, 10, 15, 9, 0, 0, 0, time.UTC)
+	online := addOnlineOrder(t, store, "ready", t0, "paid")
+	cash := addOrder(t, store, "ready", t0)
+
+	// The claim's answer and a later read both carry the payment core held at the claim.
+	status, body := callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": online.ID})
+	var claimed map[string]any
+	if status != http.StatusCreated || json.Unmarshal(body, &claimed) != nil {
+		t.Fatalf("claim: got %d %s, want 201", status, body)
+	}
+	status, body = callAt(t, srv.URL, http.MethodGet, claimPath+"/"+claimed["id"].(string), token, nil)
+	var read map[string]any
+	if status != http.StatusOK || json.Unmarshal(body, &read) != nil {
+		t.Fatalf("read: got %d %s, want 200", status, body)
+	}
+	for name, d := range map[string]map[string]any{"claim": claimed, "read": read} {
+		if d["paymentMethod"] != "online" || d["paymentStatus"] != "paid" {
+			t.Fatalf("%s %v: want paymentMethod online and paymentStatus paid", name, d)
+		}
+	}
+
+	status, body = callAt(t, srv.URL, http.MethodPost, claimPath, token, map[string]string{"orderId": cash.ID})
+	var cod map[string]any
+	if status != http.StatusCreated || json.Unmarshal(body, &cod) != nil {
+		t.Fatalf("cash claim: got %d %s, want 201", status, body)
+	}
+	if _, ok := cod["paymentStatus"]; ok || cod["paymentMethod"] != "cod" {
+		t.Fatalf("cash claim %v: want paymentMethod cod and no paymentStatus member", cod)
+	}
+}
+
 func TestClaimLogsClaim(t *testing.T) {
 	store := newID()
 	riderID, token := riderAt(t, store)
diff --git a/services/rider/internal/migrate/migrate_test.go b/services/rider/internal/migrate/migrate_test.go
index 2dd60bd..61a6408 100644
--- a/services/rider/internal/migrate/migrate_test.go
+++ b/services/rider/internal/migrate/migrate_test.go
@@ -203,14 +203,14 @@ func TestApplyRejectsDuplicateVersion(t *testing.T) {
 }
 
 // TestEmbeddedMigrationsApplyOnce applies the rider's embedded files: the first
-// run records 0001_init, 0002_riders and 0003_deliveries, the second applies nothing.
+// run records 0001_init to 0004_delivery_payment_status, the second applies nothing.
 func TestEmbeddedMigrationsApplyOnce(t *testing.T) {
 	reset(t, "riders", "sessions")
 	ctx := context.Background()
 	if _, err := pool.Exec(ctx, "drop function if exists set_updated_at() cascade"); err != nil {
 		t.Fatal(err)
 	}
-	want := []string{"0001_init", "0002_riders", "0003_deliveries"}
+	want := []string{"0001_init", "0002_riders", "0003_deliveries", "0004_delivery_payment_status"}
 
 	got, err := migrate.Apply(ctx, pool, migrations.FS)
 	if err != nil {
```

### Task 1: code
```diff
diff --git a/services/rider/internal/core/core.go b/services/rider/internal/core/core.go
index 80d5d41..57fd86d 100644
--- a/services/rider/internal/core/core.go
+++ b/services/rider/internal/core/core.go
@@ -64,7 +64,8 @@ type Order struct {
 	CustomerPhone string       `json:"customerPhone,omitempty"`
 	Address       OrderAddress `json:"address"`
 	TotalCents    int64        `json:"totalCents"`
-	PaymentMethod string       `json:"paymentMethod"`
+	PaymentMethod string       `json:"paymentMethod"`           // cod | online
+	PaymentStatus string       `json:"paymentStatus,omitempty"` // online only: pending | paid | refunded
 	PlacedAt      time.Time    `json:"placedAt"`
 	Items         []OrderItem  `json:"items"`
 }
diff --git a/services/rider/internal/delivery/delivery.go b/services/rider/internal/delivery/delivery.go
index 756aa6e..9b2e6ca 100644
--- a/services/rider/internal/delivery/delivery.go
+++ b/services/rider/internal/delivery/delivery.go
@@ -50,7 +50,8 @@ type Delivery struct {
 	CustomerPhone string     `json:"customerPhone,omitempty"`
 	Address       Address    `json:"address"`
 	TotalCents    int64      `json:"totalCents"`
-	PaymentMethod string     `json:"paymentMethod"`
+	PaymentMethod string     `json:"paymentMethod"`           // cod | online
+	PaymentStatus string     `json:"paymentStatus,omitempty"` // online only, as core held it at the claim
 	ItemCount     int        `json:"itemCount"`
 	Items         []Item     `json:"items"`
 	AssignedAt    time.Time  `json:"assignedAt"`
@@ -59,13 +60,15 @@ type Delivery struct {
 
 // ReadyOrder is one ready order of the rider's store that no delivery holds.
 type ReadyOrder struct {
-	OrderID      string    `json:"orderId"`
-	Number       string    `json:"number"`
-	PlacedAt     time.Time `json:"placedAt"`
-	ItemCount    int       `json:"itemCount"`
-	TotalCents   int64     `json:"totalCents"`
-	Pincode      string    `json:"pincode"`
-	CustomerName string    `json:"customerName"`
+	OrderID       string    `json:"orderId"`
+	Number        string    `json:"number"`
+	PlacedAt      time.Time `json:"placedAt"`
+	ItemCount     int       `json:"itemCount"`
+	TotalCents    int64     `json:"totalCents"`
+	PaymentMethod string    `json:"paymentMethod"`
+	PaymentStatus string    `json:"paymentStatus,omitempty"`
+	Pincode       string    `json:"pincode"`
+	CustomerName  string    `json:"customerName"`
 }
 
 var errClaimed = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "order already claimed"}
@@ -126,7 +129,8 @@ func readyView(o core.Order) ReadyOrder {
 	}
 	return ReadyOrder{
 		OrderID: o.ID, Number: o.Number, PlacedAt: o.PlacedAt, ItemCount: units,
-		TotalCents: o.TotalCents, Pincode: o.Address.Pincode, CustomerName: o.CustomerName,
+		TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, PaymentStatus: o.PaymentStatus,
+		Pincode: o.Address.Pincode, CustomerName: o.CustomerName,
 	}
 }
 
@@ -205,7 +209,8 @@ func (d *Deliveries) claim(ctx context.Context, rider auth.Rider, o core.Order)
 			OrderID: o.ID, OrderNumber: o.Number, StoreID: o.StoreID, RiderID: rider.ID,
 			CustomerName: o.CustomerName, CustomerPhone: o.CustomerPhone,
 			AddressLine1: o.Address.Line1, AddressLine2: o.Address.Line2, AddressPincode: o.Address.Pincode,
-			TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, ItemCount: int32(units), Items: raw,
+			TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, PaymentStatus: o.PaymentStatus,
+			ItemCount: int32(units), Items: raw,
 		})
 		if err != nil {
 			return err
@@ -228,8 +233,8 @@ func toDelivery(row db.Delivery) (Delivery, error) {
 		ID: row.ID, OrderID: row.OrderID, OrderNumber: row.OrderNumber, StoreID: row.StoreID,
 		Status: string(row.Status), CustomerName: row.CustomerName, CustomerPhone: row.CustomerPhone,
 		Address:    Address{Line1: row.AddressLine1, Line2: row.AddressLine2, Pincode: row.AddressPincode},
-		TotalCents: row.TotalCents, PaymentMethod: row.PaymentMethod, ItemCount: int(row.ItemCount),
-		Items: items, AssignedAt: row.AssignedAt.Time,
+		TotalCents: row.TotalCents, PaymentMethod: row.PaymentMethod, PaymentStatus: row.PaymentStatus,
+		ItemCount: int(row.ItemCount), Items: items, AssignedAt: row.AssignedAt.Time,
 	}
 	if row.DeliveredAt.Valid {
 		t := row.DeliveredAt.Time
diff --git a/services/rider/migrations/0004_delivery_payment_status.sql b/services/rider/migrations/0004_delivery_payment_status.sql
new file mode 100644
index 0000000..421dbd9
--- /dev/null
+++ b/services/rider/migrations/0004_delivery_payment_status.sql
@@ -0,0 +1,2 @@
+-- The payment status core held for an online order when a rider claimed it (rider-collect-cash); '' for cash.
+alter table deliveries add column payment_status text not null default '';
diff --git a/services/rider/openapi.json b/services/rider/openapi.json
index bc57a1b..465e047 100644
--- a/services/rider/openapi.json
+++ b/services/rider/openapi.json
@@ -800,6 +800,18 @@
                       "placedAt": "2026-10-15T09:00:00Z",
                       "itemCount": 3,
                       "totalCents": 33900,
+                      "paymentMethod": "cod",
+                      "pincode": "560034",
+                      "customerName": "Demo Customer"
+                    },
+                    {
+                      "orderId": "00000000-0000-4000-8000-000000000704",
+                      "number": "SS-DEMOAAAE",
+                      "placedAt": "2026-10-15T09:10:00Z",
+                      "itemCount": 2,
+                      "totalCents": 21800,
+                      "paymentMethod": "online",
+                      "paymentStatus": "paid",
                       "pincode": "560034",
                       "customerName": "Demo Customer"
                     }
@@ -1751,6 +1763,7 @@
           "placedAt",
           "itemCount",
           "totalCents",
+          "paymentMethod",
           "pincode",
           "customerName"
         ],
@@ -1775,6 +1788,23 @@
           "totalCents": {
             "type": "integer"
           },
+          "paymentMethod": {
+            "type": "string",
+            "enum": [
+              "cod",
+              "online"
+            ],
+            "description": "Core's payment method: cod is cash on delivery, the rider collects the total; online is paid through the payment service."
+          },
+          "paymentStatus": {
+            "type": "string",
+            "enum": [
+              "pending",
+              "paid",
+              "refunded"
+            ],
+            "description": "Online orders only, omitted for cash: core's payment status, read live."
+          },
           "pincode": {
             "type": "string"
           },
@@ -1908,7 +1938,20 @@
           },
           "paymentMethod": {
             "type": "string",
-            "description": "cod"
+            "enum": [
+              "cod",
+              "online"
+            ],
+            "description": "Core's payment method at the claim: cod is cash on delivery, the rider collects the total; online is paid through the payment service."
+          },
+          "paymentStatus": {
+            "type": "string",
+            "enum": [
+              "pending",
+              "paid",
+              "refunded"
+            ],
+            "description": "Online orders only, omitted for cash: core's payment status at the claim. Core freezes it from ready on (a paid order cannot be cancelled once packing), so it stays paid."
           },
           "itemCount": {
             "type": "integer",
diff --git a/services/rider/queries/deliveries.sql b/services/rider/queries/deliveries.sql
index f99bf05..e2b2513 100644
--- a/services/rider/queries/deliveries.sql
+++ b/services/rider/queries/deliveries.sql
@@ -1,8 +1,8 @@
 -- name: CreateDelivery :one
 insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, customer_phone,
-    address_line1, address_line2, address_pincode, total_cents, payment_method, item_count, items)
+    address_line1, address_line2, address_pincode, total_cents, payment_method, payment_status, item_count, items)
 values (@order_id, @order_number, @store_id, @rider_id, @customer_name, @customer_phone,
-    @address_line1, @address_line2, @address_pincode, @total_cents, @payment_method, @item_count, @items)
+    @address_line1, @address_line2, @address_pincode, @total_cents, @payment_method, @payment_status, @item_count, @items)
 returning *;
 
 -- name: ClaimedOrders :many
```

### Task 2: tests
```diff
diff --git a/apps/rider/e2e/flow.spec.ts b/apps/rider/e2e/flow.spec.ts
index c80cee7..93a535a 100644
--- a/apps/rider/e2e/flow.spec.ts
+++ b/apps/rider/e2e/flow.spec.ts
@@ -79,12 +79,14 @@ test('customer to rider to delivered', async ({ request, browser }) => {
     await expect(phone.getByRole('heading', { level: 1, name: 'Ready to pick up', exact: true })).toBeVisible()
     const card = phone.getByRole('list', { name: 'Ready orders', exact: true }).getByRole('listitem').filter({ hasText: number })
     await expect(card).toBeVisible({ timeout: 15_000 })
+    await expect(card.getByText('Cash', { exact: true })).toBeVisible()
     await card.getByRole('button', { name: `Pick up ${number}`, exact: true }).click()
     const pickUp = phone.getByRole('dialog', { name: `Pick up ${number}?`, exact: true })
     await expect(pickUp).toBeVisible()
     await expectNoViolations(phone)
     await pickUp.getByRole('button', { name: 'Pick up', exact: true }).click()
     await expect(phone.getByRole('heading', { level: 1, name: `Order ${number}`, exact: true })).toBeVisible()
+    await expect(phone.getByRole('status').filter({ hasText: /^Collect ₹[\d,]+(\.\d{2})? in cash$/ })).toBeVisible()
     await expectNoViolations(phone)
 
     // The tracking page shows the pick up, and core and the rider service name the rider.
diff --git a/apps/rider/src/delivery.test.tsx b/apps/rider/src/delivery.test.tsx
index cb661a8..43ea83c 100644
--- a/apps/rider/src/delivery.test.tsx
+++ b/apps/rider/src/delivery.test.tsx
@@ -9,7 +9,7 @@ import { renderApp } from './render-app'
 const id = delivery().id
 const deliveryPath = `/api/rider/v1/me/deliveries/${id}`
 const markPath = `${deliveryPath}/delivered`
-const cash = 'Collect ₹339 cash'
+const cash = 'Collect ₹339 in cash'
 
 let geo: ReturnType<typeof fakeGeolocation>
 
@@ -68,18 +68,28 @@ test('cash on delivery', async () => {
   expect(await screen.findByText(cash)).toBeInTheDocument()
 })
 
-test('no cash line for a payment made online', async () => {
-  openDelivery(delivery({ paymentMethod: 'online' }))
+test('paid online', async () => {
+  openDelivery(delivery({ paymentMethod: 'online', paymentStatus: 'paid' }))
 
-  expect(await screen.findByRole('heading', { level: 1, name: 'Order SS-AAAA0001' })).toBeInTheDocument()
+  expect(await screen.findByText('Paid online')).toBeInTheDocument()
   expect(screen.queryByText(/Collect/)).not.toBeInTheDocument()
 })
 
-test('delivered shows no collection', async () => {
-  openDelivery(delivery({ status: 'delivered', deliveredAt: new Date().toISOString() }))
+test('awaiting payment', async () => {
+  openDelivery(delivery({ paymentMethod: 'online', paymentStatus: 'pending' }))
+
+  expect(await screen.findByText('Awaiting payment')).toBeInTheDocument()
+  expect(screen.queryByText(/Collect|Paid online/)).not.toBeInTheDocument()
+})
+
+test.each([
+  ['cod', delivery({ status: 'delivered', deliveredAt: new Date().toISOString() })],
+  ['online', delivery({ status: 'delivered', deliveredAt: new Date().toISOString(), paymentMethod: 'online', paymentStatus: 'paid' })],
+])('delivered %s shows no payment line', async (_, shown) => {
+  openDelivery(shown)
 
   expect(await screen.findByText('Delivered')).toBeInTheDocument()
-  expect(screen.queryByText(/Collect/)).not.toBeInTheDocument()
+  expect(screen.queryByText(/Collect|Paid online/)).not.toBeInTheDocument()
   expect(screen.queryByRole('button', { name: 'Mark delivered' })).not.toBeInTheDocument()
 })
 
diff --git a/apps/rider/src/fake-api.ts b/apps/rider/src/fake-api.ts
index 2854795..dcb327e 100644
--- a/apps/rider/src/fake-api.ts
+++ b/apps/rider/src/fake-api.ts
@@ -34,6 +34,7 @@ export function readyOrder(n: number, over: Partial<ReadyOrder> = {}): ReadyOrde
     placedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
     itemCount: 3,
     totalCents: 33900,
+    paymentMethod: 'cod',
     pincode: '560034',
     customerName: 'Ravi Kumar',
     ...over,
diff --git a/apps/rider/src/ready.test.tsx b/apps/rider/src/ready.test.tsx
index c575638..5ecf621 100644
--- a/apps/rider/src/ready.test.tsx
+++ b/apps/rider/src/ready.test.tsx
@@ -30,6 +30,18 @@ afterEach(() => {
   vi.unstubAllGlobals()
 })
 
+test('cash orders marked', async () => {
+  setToken('tok')
+  const online = readyOrder(2, { paymentMethod: 'online', paymentStatus: 'paid' })
+  fakeApi(routes({ [READY]: () => json(200, { items: [readyOrder(1), online] }) }))
+
+  renderApp('/')
+
+  const cards = within(await screen.findByRole('list', { name: 'Ready orders' })).getAllByRole('listitem')
+  expect(within(cards[0]).getByText('Cash')).toBeInTheDocument()
+  expect(within(cards[1]).queryByText('Cash')).not.toBeInTheDocument()
+})
+
 test('ready orders listed', async () => {
   setToken('tok')
   fakeApi(routes({ [READY]: () => json(200, { items: [readyOrder(1), readyOrder(2)] }) }))
```

### Task 2: code
```diff
diff --git a/apps/rider/src/delivery.tsx b/apps/rider/src/delivery.tsx
index df0bed0..4e7c6dc 100644
--- a/apps/rider/src/delivery.tsx
+++ b/apps/rider/src/delivery.tsx
@@ -62,8 +62,10 @@ export function DeliveryPage({ deliveryId }: { deliveryId: string }) {
         actions={<Badge variant={assigned ? 'accent' : 'success'}>{assigned ? 'On the way' : 'Delivered'}</Badge>}
       />
       {assigned && delivery.paymentMethod === 'cod' && (
-        <StatusMessage>{`Collect ${formatInr(delivery.totalCents)} cash`}</StatusMessage>
+        <StatusMessage>{`Collect ${formatInr(delivery.totalCents)} in cash`}</StatusMessage>
       )}
+      {assigned && delivery.paymentStatus === 'paid' && <StatusMessage>Paid online</StatusMessage>}
+      {assigned && delivery.paymentStatus === 'pending' && <StatusMessage tone="warning">Awaiting payment</StatusMessage>}
       {mark.isSuccess && <StatusMessage tone="success">{`${delivery.orderNumber} delivered.`}</StatusMessage>}
       {report && <StatusMessage tone="warning">{report}</StatusMessage>}
       <Card className="flex flex-col gap-2 p-4">
diff --git a/apps/rider/src/ready.tsx b/apps/rider/src/ready.tsx
index 1937cec..3afe031 100644
--- a/apps/rider/src/ready.tsx
+++ b/apps/rider/src/ready.tsx
@@ -1,7 +1,7 @@
 import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
 import { Link, useNavigate } from '@tanstack/react-router'
 import { useState } from 'react'
-import { Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
+import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
 import { useSince } from '@shopperstop/ui/app'
 import { deliveryQuery, rider, type ApiError, type Delivery, type ReadyOrder } from './api'
 import { itemCount } from './format'
@@ -45,7 +45,10 @@ function ReadyCard({ order, onPick }: { order: ReadyOrder; onPick: () => void })
           Pincode <span className="tabular-nums">{order.pincode}</span>
         </span>
       </div>
-      <Price cents={order.totalCents} className="text-h3" />
+      <div className="flex items-center gap-2">
+        <Price cents={order.totalCents} className="text-h3" />
+        {order.paymentMethod === 'cod' && <Badge>Cash</Badge>}
+      </div>
       <Button size="lg" className="w-full" aria-label={`Pick up ${order.number}`} onClick={onPick}>
         Pick up
       </Button>
```
