## Context

A store is one `stores` row (0003, plus `city` from 0009) read with `select *` through `queries/store.sql`. `store.Store` (`internal/store/store.go`) is the JSON of `GET /serviceability` and `GET /stores/{id}`; `store.AdminStore` embeds it plus `addressLine` and `pincode` for every admin store route. Other packages use `store.Get`/`ForPincode`/`All` for the id, name, money and open state only (the staff dashboard copies fields into its own `DashboardStore`); none serialises `Store` elsewhere. Create and change share `fields` and `check`; `httpx.ReadPatch` already refuses a top-level `null` member with 400 naming it. sqlc runs with `emit_pointers_for_null_types`, so nullable `double precision` columns come out as `*float64`.

The rider service reads core's public store (`services/rider/internal/core/core.go`, `Client.Store`, `GET /stores/{id}`, decoded without `DisallowUnknownFields`), so rider-P5-L2 gets `location` by adding one member to its `core.Store`; `GET /admin/stores/{id}` carries it as well.

The whole design was spiked in this worktree at 150d5e5 and reverted before the commit: `gofmt -l` empty, `go vet ./...` clean, all 15 packages green under `go test -race -count=1 ./...`; the five new or edited tests fail before the code (`TestCreateStoreValidation` 201 for `location.lat`, `TestCreateStoreLocation` and `TestPatchStoreLocation` no location, `TestPublicStoreLocation` column `lat` does not exist, `TestResetTwiceLeavesDemoStores` no location); `make gen postman` clean (27/27); `packages/ui`, `apps/web`, `apps/rider`, `apps/mobile` typecheck against the new `core.d.ts`, `apps/admin` does not (see "Cross-area"). Both diffs below are `git apply --check` clean on 150d5e5.

## Goals / Non-Goals

**Goals:** a store location on every store read, settable by admins on create and change, validated in Go and in the database, seeded for the demo stores; nothing breaks for the apps or the rider service.

**Non-Goals:** the admin form inputs (admin-P5-L2); dispatch (rider-P5-L2); clearing a location; geocoding; address coordinates; PostGIS.

## Decisions

### 1. `location` cannot be cleared; `null` is 400 field `location`

The package's answer: omit to keep, send both numbers to set, explicit `null` not supported. `httpx.ReadPatch` already answers 400 `validation` field `location` "must not be null" for `"location":null` on create and on change, so no code is needed for it. Ceiling: a store that once had a location keeps one; an admin fixes a wrong one by sending the right one. Clearing would need a second meaning for `null` (CLAUDE.md: never null) or a separate flag; nobody needs it, and a store without a location only means "dispatch nothing".

### 2. Two nullable columns, not PostGIS or a composite type

`lat double precision check (lat between -90 and 90)`, `lng double precision check (lng between -180 and 180)`, `constraint stores_location_both check ((lat is null) = (lng is null))`. Existing rows get null (no location). Bounds are inclusive in SQL and Go. `double precision` round-trips the JSON numbers exactly (pgx binary float8; Go's shortest float formatting), so 12.9352 comes back as 12.9352. Ceiling: no spatial index or distance query in core; the rider service computes haversine itself (D57).

### 3. Go shape

`store.Location{Lat, Lng float64}` and `Store.Location *Location` with `json:"location,omitempty"`, after `city`; `public` sets it only when both columns are non-null. The body uses `locationFields{Lat, Lng *float64}` so a missing member is visible. `check` runs the location after `city`: a missing member first (field `location` "location needs both lat and lng"), then `lat` (field `location.lat` "lat must be -90 to 90"), then `lng` (field `location.lng` "lng must be -180 to 180"). `"lat": null` inside the object decodes to a nil pointer and so answers field `location`. A non-number (`"lat":"12.9"`) fails the JSON decode and answers 400 `validation` "invalid JSON" without a field, as every other mistyped store member does today. `fields.latLng` hands both pointers (or two nils) to `CreateStore` and `UpdateStore`; the update uses `coalesce(sqlc.narg(lat), lat)` like every other member, which is safe because `check` lets only both or neither through.

### 4. `openapi.json`: one `StoreLocation` schema, by `$ref`, no `default`

A new component `StoreLocation` (`lat`, `lng` required numbers with their ranges, `additionalProperties: false`), referenced by `Store`, `AdminStore`, `StoreCreate` and `StorePatch` as a plain `$ref` with a sibling `description` (OpenAPI 3.1, the file's existing style for nested objects). `location` is never in `required`, so it is optional in every `core.d.ts` type and no typed fixture in web, admin, rider or mobile changes. Every store example gets its demo store's coordinates; the create request example gets HSR Layout's (12.9116, 77.6474). The `PATCH` request example stays `{"promisedMinutes":10}`. The script below is run once from `services/core` and never committed; the file round-trips byte for byte through `json.dumps(d, indent=2, ensure_ascii=False) + '\n'` (checked).

### 5. Demo seed and its test

`seed.go` writes the two coordinates in the existing demo-store insert. `TestResetTwiceLeavesDemoStores` reads them back through `GET /serviceability` for both stores.

### Cross-area: one admin line

`apps/admin/src/store-form.tsx:10` (main, since admin-P4-L1 #278) declares `type Field = keyof StoreCreate` and `Values = Record<Field, string>`; `messages` and `initial` are `Record<Field, string>` literals without `location`. Once `StoreCreate` lists `location`, `tsc` fails with TS2741 at lines 16 and 29. The fix, which typechecks against main's `core.d.ts` and the new one, passes `npm run lint --workspace apps/admin` and keeps `store-form.test.tsx` 10/10 green (spiked both ways):

```ts
type Field = Exclude<keyof StoreCreate, 'location'>
```

It must be on main before this change merges (request to admin through the orchestrator; admin-P5-L2, which adds the latitude and longitude inputs, replaces it). Until then `make test-web` on this branch fails only with TS2741 in `apps/admin/src/store-form.tsx`. Meanwhile a core 400 naming `location`, `location.lat` or `location.lng` is not in the form's `messages`, so it falls to the banner; the form never sends `location` until admin-P5-L2.

## Risks / Trade-offs

- [The admin line is not on main] → blocks the merge, not the build; the manager relays it now (it is safe on main today).
- [No way to clear a location] → Decision 1.
- [rider-P5-L2 runs against a fake core] → it reads `location` from `GET /stores/{id}` (or `/admin/stores/{id}`) as `{lat, lng}` numbers, omitted when unset; that is the whole contract.

## Code (verbatim diffs from the spike; `git apply --check` clean on 150d5e5)

Save each block to a file in your scratchpad and `git apply` it from the worktree root, or edit by hand to the same result. After the feat diff run `make gen` (sqlc, then `core.d.ts`); the script after `make gen` changes only `openapi.json`, so run `make gen postman` again after it.

### Test diff (commit 1)

```diff
diff --git a/services/core/internal/app/admin_stores_test.go b/services/core/internal/app/admin_stores_test.go
index 63ae363..e5f226a 100644
--- a/services/core/internal/app/admin_stores_test.go
+++ b/services/core/internal/app/admin_stores_test.go
@@ -2,6 +2,7 @@ package app
 
 import (
 	"encoding/json"
+	"fmt"
 	"net/http"
 	"strings"
 	"testing"
@@ -12,16 +13,23 @@ const adminStoresPath = "/api/core/v1/admin/stores"
 
 // adminStore is the admin view of a store as the admin routes answer it.
 type adminStore struct {
-	ID                     string `json:"id"`
-	Name                   string `json:"name"`
-	City                   string `json:"city"`
-	AddressLine            string `json:"addressLine"`
-	Pincode                string `json:"pincode"`
-	IsOpen                 bool   `json:"isOpen"`
-	DeliveryFeeCents       int64  `json:"deliveryFeeCents"`
-	FreeDeliveryAboveCents int64  `json:"freeDeliveryAboveCents"`
-	MinOrderCents          int64  `json:"minOrderCents"`
-	PromisedMinutes        int32  `json:"promisedMinutes"`
+	ID                     string         `json:"id"`
+	Name                   string         `json:"name"`
+	City                   string         `json:"city"`
+	Location               *storeLocation `json:"location"`
+	AddressLine            string         `json:"addressLine"`
+	Pincode                string         `json:"pincode"`
+	IsOpen                 bool           `json:"isOpen"`
+	DeliveryFeeCents       int64          `json:"deliveryFeeCents"`
+	FreeDeliveryAboveCents int64          `json:"freeDeliveryAboveCents"`
+	MinOrderCents          int64          `json:"minOrderCents"`
+	PromisedMinutes        int32          `json:"promisedMinutes"`
+}
+
+// storeLocation is a store's location as the store routes answer it.
+type storeLocation struct {
+	Lat float64 `json:"lat"`
+	Lng float64 `json:"lng"`
 }
 
 // adminToken signs the shared admin in and returns the token.
@@ -102,6 +110,10 @@ func TestCreateStoreValidation(t *testing.T) {
 		{"promisedMinutes", with("promisedMinutes", 241)},
 		{"city", with("city", strings.Repeat("x", 101))},
 		{"city", with("city", nil)},
+		{"location.lat", with("location", map[string]any{"lat": 90.5, "lng": 77.6})},
+		{"location.lng", with("location", map[string]any{"lat": 12.9, "lng": -180.5})},
+		{"location", with("location", map[string]any{"lat": 12.9})},
+		{"location", with("location", nil)},
 	}
 	var before int
 	if err := testPool.QueryRow(t.Context(), "select count(*) from stores").Scan(&before); err != nil {
@@ -300,3 +312,60 @@ func TestPatchStoreCity(t *testing.T) {
 		t.Fatalf("clear city: got %d %s, want 200 without a city member", status, raw)
 	}
 }
+
+func TestCreateStoreLocation(t *testing.T) {
+	token := adminToken(t)
+	with := newStoreBody("Located Layout", "561214")
+	with["location"] = map[string]any{"lat": 12.9352, "lng": 77.6245}
+	s := createStore(t, token, with)
+	if got := getAdminStore(t, token, s.ID).Location; s.Location == nil || got == nil || *s.Location != *got || got.Lat != 12.9352 || got.Lng != 77.6245 {
+		t.Fatalf("create with location: got %+v then %+v, want lat 12.9352, lng 77.6245 stored", s.Location, got)
+	}
+	edge := newStoreBody("Edge Layout", "561215")
+	edge["location"] = map[string]any{"lat": -90, "lng": 180}
+	if e := createStore(t, token, edge).Location; e == nil || e.Lat != -90 || e.Lng != 180 {
+		t.Fatalf("create at the range edges: got %+v, want lat -90, lng 180", e)
+	}
+	status, raw := call(t, http.MethodPost, adminStoresPath, token, newStoreBody("Unlocated Layout", "561216"))
+	if status != http.StatusCreated || strings.Contains(string(raw), `"location"`) {
+		t.Fatalf("create without location: got %d %s, want 201 without a location member", status, raw)
+	}
+}
+
+func TestPatchStoreLocation(t *testing.T) {
+	token := adminToken(t)
+	id := insertStore(t, true, "561217")
+	patch := func(body map[string]any) (int, []byte) {
+		return call(t, http.MethodPatch, adminStoresPath+"/"+id, token, body)
+	}
+	at := func() string {
+		l := getAdminStore(t, token, id).Location
+		if l == nil {
+			return "none"
+		}
+		return fmt.Sprint(l.Lat, ",", l.Lng)
+	}
+	if status, raw := patch(map[string]any{"location": map[string]any{"lat": 12.9719, "lng": 77.6412}}); status != http.StatusOK || at() != "12.9719,77.6412" {
+		t.Fatalf("set location: got %d %s, want 200 and 12.9719,77.6412", status, raw)
+	}
+	if status, raw := patch(map[string]any{"name": "Renamed"}); status != http.StatusOK || at() != "12.9719,77.6412" {
+		t.Fatalf("patch without location: got %d %s, want the location unchanged", status, raw)
+	}
+	for _, c := range []struct {
+		field string
+		body  map[string]any
+	}{
+		{"location.lat", map[string]any{"location": map[string]any{"lat": -91, "lng": 77.6}}},
+		{"location.lng", map[string]any{"location": map[string]any{"lat": 12.9, "lng": 181}}},
+		{"location", map[string]any{"location": map[string]any{"lng": 77.6}}},
+		{"location", map[string]any{"location": nil}},
+	} {
+		status, raw := patch(c.body)
+		if e := decodeError(t, raw); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field || at() != "12.9719,77.6412" {
+			t.Fatalf("patch %v: got %d %s, want 400 validation field %s and the location unchanged", c.body, status, raw, c.field)
+		}
+	}
+	if _, err := testPool.Exec(t.Context(), "update stores set lat = null where id = $1", id); err == nil {
+		t.Fatal("lat without lng: the database accepted it, want the both-or-neither check to refuse")
+	}
+}
diff --git a/services/core/internal/app/stores_test.go b/services/core/internal/app/stores_test.go
index f2cd59d..5b24c96 100644
--- a/services/core/internal/app/stores_test.go
+++ b/services/core/internal/app/stores_test.go
@@ -167,3 +167,29 @@ func TestPublicStoreCity(t *testing.T) {
 		}
 	}
 }
+
+func TestPublicStoreLocation(t *testing.T) {
+	id := insertStore(t, true, "561105")
+	if _, err := testPool.Exec(context.Background(), "update stores set lat = 12.9352, lng = 77.6245 where id = $1", id); err != nil {
+		t.Fatal(err)
+	}
+	want := strings.Join(sortedCopy(append([]string{"location"}, publicStoreKeys...)), ",")
+	for _, path := range []string{"/api/core/v1/stores/" + id, "/api/core/v1/serviceability?pincode=561105"} {
+		status, body := call(t, http.MethodGet, path, "", nil)
+		var wrapper struct {
+			Store json.RawMessage `json:"store"`
+		}
+		if status != http.StatusOK || json.Unmarshal(body, &wrapper) != nil {
+			t.Fatalf("GET %s: got %d %s, want 200", path, status, body)
+		}
+		if wrapper.Store != nil {
+			body = wrapper.Store
+		}
+		var s struct {
+			Location map[string]float64 `json:"location"`
+		}
+		if got := strings.Join(keysOf(t, body), ","); got != want || json.Unmarshal(body, &s) != nil || len(s.Location) != 2 || s.Location["lat"] != 12.9352 || s.Location["lng"] != 77.6245 {
+			t.Fatalf("GET %s: got %s, want keys %s and location {lat 12.9352, lng 77.6245}", path, body, want)
+		}
+	}
+}
diff --git a/services/core/internal/seed/seed_test.go b/services/core/internal/seed/seed_test.go
index 90f0e45..fae3b84 100644
--- a/services/core/internal/seed/seed_test.go
+++ b/services/core/internal/seed/seed_test.go
@@ -266,17 +266,25 @@ func TestResetTwiceLeavesDemoStores(t *testing.T) {
 			('00000000-0000-4000-8000-000000000402', 'Indiranagar', '560038'), ('00000000-0000-4000-8000-000000000402', 'Indiranagar', '560008'))`, 4)
 
 	base := server(t)
-	for pincode, want := range map[string]string{"560095": storeKoramangala, "560008": storeIndiranagar} {
+	for pincode, want := range map[string]struct {
+		id       string
+		lat, lng float64
+	}{"560095": {storeKoramangala, 12.9352, 77.6245}, "560008": {storeIndiranagar, 12.9719, 77.6412}} {
 		status, body := getJSON(t, base+"/api/core/v1/serviceability?pincode="+pincode)
 		var s struct {
 			Store struct {
-				ID     string `json:"id"`
-				City   string `json:"city"`
-				IsOpen bool   `json:"isOpen"`
+				ID       string `json:"id"`
+				City     string `json:"city"`
+				IsOpen   bool   `json:"isOpen"`
+				Location struct {
+					Lat float64 `json:"lat"`
+					Lng float64 `json:"lng"`
+				} `json:"location"`
 			} `json:"store"`
 		}
-		if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Store.ID != want || !s.Store.IsOpen || s.Store.City != "Bengaluru" {
-			t.Fatalf("serviceability %s: got %d %s, want 200 open store %s in Bengaluru", pincode, status, body, want)
+		if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Store.ID != want.id || !s.Store.IsOpen || s.Store.City != "Bengaluru" ||
+			s.Store.Location.Lat != want.lat || s.Store.Location.Lng != want.lng {
+			t.Fatalf("serviceability %s: got %d %s, want 200 open store %s in Bengaluru at %v, %v", pincode, status, body, want.id, want.lat, want.lng)
 		}
 	}
 	if status, body := getJSON(t, base+"/api/core/v1/serviceability?pincode=110001"); status != http.StatusNotFound {
```

### Feat diff (commit 2)

```diff
diff --git a/services/core/internal/seed/seed.go b/services/core/internal/seed/seed.go
index ebbbc8f..8a5e8df 100644
--- a/services/core/internal/seed/seed.go
+++ b/services/core/internal/seed/seed.go
@@ -120,9 +120,9 @@ func load(ctx context.Context, tx pgx.Tx, h hashes) error {
 		homeID, workID, customerID); err != nil {
 		return fmt.Errorf("insert demo addresses: %w", err)
 	}
-	if _, err := tx.Exec(ctx, `insert into stores (id, name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes) values
-		($1, 'Koramangala', 'Bengaluru', '80 Feet Rd, Koramangala', '560034', true, 2500, 19900, 9900, 10),
-		($2, 'Indiranagar', 'Bengaluru', '100 Feet Rd, Indiranagar', '560038', true, 2500, 19900, 9900, 12)`,
+	if _, err := tx.Exec(ctx, `insert into stores (id, name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes, lat, lng) values
+		($1, 'Koramangala', 'Bengaluru', '80 Feet Rd, Koramangala', '560034', true, 2500, 19900, 9900, 10, 12.9352, 77.6245),
+		($2, 'Indiranagar', 'Bengaluru', '100 Feet Rd, Indiranagar', '560038', true, 2500, 19900, 9900, 12, 12.9719, 77.6412)`,
 		storeKoramangala, storeIndiranagar); err != nil {
 		return fmt.Errorf("insert demo stores: %w", err)
 	}
diff --git a/services/core/internal/store/handlers.go b/services/core/internal/store/handlers.go
index 398e27e..0acc06c 100644
--- a/services/core/internal/store/handlers.go
+++ b/services/core/internal/store/handlers.go
@@ -100,10 +100,11 @@ func Create(pool *pgxpool.Pool) http.HandlerFunc {
 			httpx.WriteError(w, r, err)
 			return
 		}
+		lat, lng := f.latLng()
 		row, err := db.New(pool).CreateStore(r.Context(), db.CreateStoreParams{
 			Name: *f.Name, City: *f.City, AddressLine: *f.AddressLine, Pincode: *f.Pincode, IsOpen: *f.IsOpen,
 			DeliveryFeeCents: *f.DeliveryFeeCents, FreeDeliveryAboveCents: *f.FreeDeliveryAboveCents,
-			MinOrderCents: *f.MinOrderCents, PromisedMinutes: *f.PromisedMinutes,
+			MinOrderCents: *f.MinOrderCents, PromisedMinutes: *f.PromisedMinutes, Lat: lat, Lng: lng,
 		})
 		if err != nil {
 			httpx.WriteError(w, r, err)
@@ -148,10 +149,11 @@ func Update(pool *pgxpool.Pool) http.HandlerFunc {
 			httpx.WriteError(w, r, err)
 			return
 		}
+		lat, lng := f.latLng()
 		row, err := db.New(pool).UpdateStore(r.Context(), db.UpdateStoreParams{
 			ID: id, Name: f.Name, City: f.City, AddressLine: f.AddressLine, Pincode: f.Pincode, IsOpen: f.IsOpen,
 			DeliveryFeeCents: f.DeliveryFeeCents, FreeDeliveryAboveCents: f.FreeDeliveryAboveCents,
-			MinOrderCents: f.MinOrderCents, PromisedMinutes: f.PromisedMinutes,
+			MinOrderCents: f.MinOrderCents, PromisedMinutes: f.PromisedMinutes, Lat: lat, Lng: lng,
 		})
 		if err != nil {
 			httpx.WriteError(w, r, pg.Map(err))
diff --git a/services/core/internal/store/store.go b/services/core/internal/store/store.go
index e5119c5..fbe0144 100644
--- a/services/core/internal/store/store.go
+++ b/services/core/internal/store/store.go
@@ -18,14 +18,21 @@ import (
 
 // Store is the public view of a store: what checkout shows.
 type Store struct {
-	ID                     string `json:"id"`
-	Name                   string `json:"name"`
-	City                   string `json:"city,omitempty"`
-	IsOpen                 bool   `json:"isOpen"`
-	DeliveryFeeCents       int64  `json:"deliveryFeeCents"`
-	FreeDeliveryAboveCents int64  `json:"freeDeliveryAboveCents"`
-	MinOrderCents          int64  `json:"minOrderCents"`
-	PromisedMinutes        int32  `json:"promisedMinutes"`
+	ID                     string    `json:"id"`
+	Name                   string    `json:"name"`
+	City                   string    `json:"city,omitempty"`
+	Location               *Location `json:"location,omitempty"`
+	IsOpen                 bool      `json:"isOpen"`
+	DeliveryFeeCents       int64     `json:"deliveryFeeCents"`
+	FreeDeliveryAboveCents int64     `json:"freeDeliveryAboveCents"`
+	MinOrderCents          int64     `json:"minOrderCents"`
+	PromisedMinutes        int32     `json:"promisedMinutes"`
+}
+
+// Location is where a store is, in degrees; nil on Store when it has none.
+type Location struct {
+	Lat float64 `json:"lat"`
+	Lng float64 `json:"lng"`
 }
 
 // AdminStore is the admin view: Store plus the store's own address.
@@ -72,11 +79,15 @@ func All(ctx context.Context, q db.DBTX) ([]Store, error) {
 }
 
 func public(row db.Store) Store {
-	return Store{
+	s := Store{
 		ID: row.ID, Name: row.Name, City: row.City, IsOpen: row.IsOpen,
 		DeliveryFeeCents: row.DeliveryFeeCents, FreeDeliveryAboveCents: row.FreeDeliveryAboveCents,
 		MinOrderCents: row.MinOrderCents, PromisedMinutes: row.PromisedMinutes,
 	}
+	if row.Lat != nil && row.Lng != nil {
+		s.Location = &Location{Lat: *row.Lat, Lng: *row.Lng}
+	}
+	return s
 }
 
 // admin is the admin view of a stored row.
@@ -90,15 +101,31 @@ const maxMoney = 10_000_000
 // fields is the create and change body. On change a nil member is absent and
 // stays unchanged; on create withDefaults fills every nil member first.
 type fields struct {
-	Name                   *string `json:"name"`
-	City                   *string `json:"city"`
-	AddressLine            *string `json:"addressLine"`
-	Pincode                *string `json:"pincode"`
-	IsOpen                 *bool   `json:"isOpen"`
-	DeliveryFeeCents       *int64  `json:"deliveryFeeCents"`
-	FreeDeliveryAboveCents *int64  `json:"freeDeliveryAboveCents"`
-	MinOrderCents          *int64  `json:"minOrderCents"`
-	PromisedMinutes        *int32  `json:"promisedMinutes"`
+	Name                   *string         `json:"name"`
+	City                   *string         `json:"city"`
+	Location               *locationFields `json:"location"`
+	AddressLine            *string         `json:"addressLine"`
+	Pincode                *string         `json:"pincode"`
+	IsOpen                 *bool           `json:"isOpen"`
+	DeliveryFeeCents       *int64          `json:"deliveryFeeCents"`
+	FreeDeliveryAboveCents *int64          `json:"freeDeliveryAboveCents"`
+	MinOrderCents          *int64          `json:"minOrderCents"`
+	PromisedMinutes        *int32          `json:"promisedMinutes"`
+}
+
+// locationFields is a location in a create or change body; check refuses one without both members.
+type locationFields struct {
+	Lat *float64 `json:"lat"`
+	Lng *float64 `json:"lng"`
+}
+
+// latLng is the location to write: both nil when absent (create: none; change: unchanged).
+// check has made sure a present location has both.
+func (f *fields) latLng() (lat, lng *float64) {
+	if f.Location == nil {
+		return nil, nil
+	}
+	return f.Location.Lat, f.Location.Lng
 }
 
 // withDefaults gives each absent member its zero value: a new store is closed,
@@ -138,6 +165,16 @@ func check(f *fields) error {
 			return invalid("city", "city must be at most 100 characters")
 		}
 	}
+	if l := f.Location; l != nil {
+		switch {
+		case l.Lat == nil || l.Lng == nil:
+			return invalid("location", "location needs both lat and lng")
+		case *l.Lat < -90 || *l.Lat > 90:
+			return invalid("location.lat", "lat must be -90 to 90")
+		case *l.Lng < -180 || *l.Lng > 180:
+			return invalid("location.lng", "lng must be -180 to 180")
+		}
+	}
 	if f.AddressLine != nil {
 		*f.AddressLine = strings.TrimSpace(*f.AddressLine)
 		if n := utf8.RuneCountInString(*f.AddressLine); n < 1 || n > 200 {
diff --git a/services/core/migrations/0012_store_location.sql b/services/core/migrations/0012_store_location.sql
new file mode 100644
index 0000000..2bc81d0
--- /dev/null
+++ b/services/core/migrations/0012_store_location.sql
@@ -0,0 +1,5 @@
+-- Where a store is, for rider dispatch (D57): ETA from a rider's position to the store.
+-- Both null (no location; the store dispatches nothing) or both set.
+alter table stores add column lat double precision check (lat between -90 and 90);
+alter table stores add column lng double precision check (lng between -180 and 180);
+alter table stores add constraint stores_location_both check ((lat is null) = (lng is null));
diff --git a/services/core/queries/store.sql b/services/core/queries/store.sql
index 83c6cf4..cb9a351 100644
--- a/services/core/queries/store.sql
+++ b/services/core/queries/store.sql
@@ -13,8 +13,8 @@ select * from stores order by name, id limit $1 offset $2;
 select count(*) from stores;
 
 -- name: CreateStore :one
-insert into stores (name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes)
-values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
+insert into stores (name, city, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes, lat, lng)
+values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
 returning *;
 
 -- name: UpdateStore :one
@@ -27,7 +27,9 @@ set name = coalesce(sqlc.narg(name), name),
     delivery_fee_cents = coalesce(sqlc.narg(delivery_fee_cents), delivery_fee_cents),
     free_delivery_above_cents = coalesce(sqlc.narg(free_delivery_above_cents), free_delivery_above_cents),
     min_order_cents = coalesce(sqlc.narg(min_order_cents), min_order_cents),
-    promised_minutes = coalesce(sqlc.narg(promised_minutes), promised_minutes)
+    promised_minutes = coalesce(sqlc.narg(promised_minutes), promised_minutes),
+    lat = coalesce(sqlc.narg(lat), lat),
+    lng = coalesce(sqlc.narg(lng), lng)
 where id = @id
 returning *;
 
```

### `openapi.json` script (commit 2)

```python
# Store.location (core-store-location, D57). Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

def after_city(props, key, value):
    # Insert key right after city, keeping the other members in order.
    out = {}
    for k, v in props.items():
        out[k] = v
        if k == 'city':
            out[key] = value
    return out

s['StoreLocation'] = {
    "type": "object",
    "description": "Where a store is, in degrees (WGS 84). The rider service ranks riders by their distance to it (dispatch).",
    "required": ["lat", "lng"],
    "properties": {
        "lat": {"type": "number", "format": "double", "minimum": -90, "maximum": 90, "description": "Latitude, -90 to 90."},
        "lng": {"type": "number", "format": "double", "minimum": -180, "maximum": 180, "description": "Longitude, -180 to 180."},
    },
    "additionalProperties": False,
    "example": {"lat": 12.9352, "lng": 77.6245},
}
shown = {"$ref": "#/components/schemas/StoreLocation", "description": "Where the store is. Omitted when the store has none; such a store gets no rider dispatch."}
s['Store']['properties'] = after_city(s['Store']['properties'], 'location', shown)
s['AdminStore']['properties'] = after_city(s['AdminStore']['properties'], 'location', shown)
s['StoreCreate']['properties'] = after_city(s['StoreCreate']['properties'], 'location',
    {"$ref": "#/components/schemas/StoreLocation", "description": "Both lat and lng. Absent: no location."})
s['StorePatch']['properties'] = after_city(s['StorePatch']['properties'], 'location',
    {"$ref": "#/components/schemas/StoreLocation", "description": "Both lat and lng; replaces the location. Absent: unchanged. It cannot be cleared (null is refused)."})

at = {"Koramangala": {"lat": 12.9352, "lng": 77.6245}, "Indiranagar": {"lat": 12.9719, "lng": 77.6412}}

def add_location(example):
    if example.get('name') in at and 'promisedMinutes' in example:
        return after_city(example, 'location', at[example['name']])
    return example

p = d['paths']
for path, method, code in [('/serviceability', 'get', '200'), ('/stores/{id}', 'get', '200'), ('/admin/stores', 'get', '200'),
                           ('/admin/stores', 'post', '201'), ('/admin/stores/{id}', 'get', '200'), ('/admin/stores/{id}', 'patch', '200')]:
    c = p[path][method]['responses'][code]['content']['application/json']
    ex = c['example']
    if 'store' in ex:
        ex['store'] = add_location(ex['store'])
    elif 'items' in ex:
        ex['items'] = [add_location(i) for i in ex['items']]
    else:
        c['example'] = add_location(ex)
req = p['/admin/stores']['post']['requestBody']['content']['application/json']
req['example'] = after_city(req['example'], 'location', {"lat": 12.9116, "lng": 77.6474})

post = p['/admin/stores']['post']
assert "plus any of city, isOpen," in post['description'] and "An absent city means none." in post['description']
post['description'] = post['description'].replace("plus any of city, isOpen,", "plus any of city, location, isOpen,").replace(
    "An absent city means none.", "An absent city or location means none. A location needs both lat and lng: one without the other answers 400 field location, an out-of-range one 400 field location.lat or location.lng.")
patch = p['/admin/stores/{id}']['patch']
assert "city (empty clears it)," in patch['description']
patch['description'] = patch['description'].replace("city (empty clears it),",
    "city (empty clears it), location (both lat and lng; it replaces the location and cannot be cleared),")
for path, method in [('/admin/stores', 'post'), ('/admin/stores/{id}', 'patch')]:
    r = p[path][method]['responses']['400']
    r['description'] += " A location's errors name location (lat or lng missing), location.lat or location.lng (out of range)."
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```
