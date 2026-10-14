package seed_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"image"
	_ "image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/app"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/seed"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("seed")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// Fixed ids of design Decision 22.
const (
	adminID          = "00000000-0000-4000-8000-000000000101"
	customerID       = "00000000-0000-4000-8000-000000000201"
	homeID           = "00000000-0000-4000-8000-000000000301"
	workID           = "00000000-0000-4000-8000-000000000302"
	storeKoramangala = "00000000-0000-4000-8000-000000000401"
	storeIndiranagar = "00000000-0000-4000-8000-000000000402"
)

// addOtherRows puts a customer with an address, a staff user and a session in
// the database: the rows a reset must remove.
func addOtherRows(t *testing.T) {
	t.Helper()
	stmts := []string{
		`insert into customers (id, email, password_hash, name) values ('00000000-0000-4000-8000-000000000999', 'other@example.com', 'x', 'Other')`,
		`insert into addresses (customer_id, label, line1, pincode, is_default) values ('00000000-0000-4000-8000-000000000999', 'Home', 'Elsewhere', '110001', true)`,
		`insert into staff_users (email, password_hash, name, role) values ('stray@example.com', 'x', 'Stray', 'admin')`,
		`insert into sessions (token_hash, subject_type, subject_id, expires_at) values (decode('0102', 'hex'), 'customer', '00000000-0000-4000-8000-000000000999', now() + interval '1 day')`,
	}
	for _, s := range stmts {
		if _, err := testPool.Exec(context.Background(), s); err != nil {
			t.Fatalf("add other rows: %v", err)
		}
	}
}

func assertCount(t *testing.T, table string, want int) {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from "+table).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != want {
		t.Fatalf("rows in %s: %d, want %d", table, n, want)
	}
}

// signIn posts the credentials through the real router and returns the status.
func signIn(t *testing.T, base, path, email, password string) int {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.Post(base+path, "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func server(t *testing.T) string {
	t.Helper()
	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now))
	srv := httptest.NewServer(app.New(testPool, []string{"http://localhost:5173"}, a, blob.Disk{Dir: t.TempDir()}))
	t.Cleanup(srv.Close)
	return srv.URL
}

// TestResetTwiceLeavesDemoAccounts: two resets over a database holding other
// rows leave exactly the fixed demo accounts, and both demo sign-ins answer 200.
func TestResetTwiceLeavesDemoAccounts(t *testing.T) {
	ctx := context.Background()
	addOtherRows(t)
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}

	assertCount(t, "staff_users", 3)
	assertCount(t, "customers", 1)
	assertCount(t, "addresses", 2)
	assertCount(t, "sessions", 0)

	var id, email, role string
	var active bool
	if err := testPool.QueryRow(ctx, "select id::text, email::text, role::text, is_active from staff_users where role = 'admin'").Scan(&id, &email, &role, &active); err != nil {
		t.Fatal(err)
	}
	if id != adminID || email != "admin@shopperstop.local" || role != "admin" || !active {
		t.Fatalf("staff row: %s %s %s active %v, want the demo admin", id, email, role, active)
	}

	var cid, cemail, name, phone string
	if err := testPool.QueryRow(ctx, "select id::text, email::text, name, phone from customers").Scan(&cid, &cemail, &name, &phone); err != nil {
		t.Fatal(err)
	}
	if cid != customerID || cemail != "demo@shopperstop.local" || name != "Demo Customer" || phone != "+919800000000" {
		t.Fatalf("customer row: %s %s %s %s, want the demo customer", cid, cemail, name, phone)
	}

	rows, err := testPool.Query(ctx, "select id::text, customer_id::text, label, line1, pincode, is_default from addresses order by is_default desc")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	want := []struct {
		id, label, line1, pincode string
		isDefault                 bool
	}{
		{homeID, "Home", "12 80 Feet Rd, Koramangala", "560034", true},
		{workID, "Work", "100 Feet Rd, Indiranagar", "560038", false},
	}
	for i := 0; rows.Next(); i++ {
		var aid, owner, label, line1, pincode string
		var isDefault bool
		if err := rows.Scan(&aid, &owner, &label, &line1, &pincode, &isDefault); err != nil {
			t.Fatal(err)
		}
		w := want[i]
		if aid != w.id || owner != customerID || label != w.label || line1 != w.line1 || pincode != w.pincode || isDefault != w.isDefault {
			t.Fatalf("address %d: %s %s %s %s %s %v, want %+v", i, aid, owner, label, line1, pincode, isDefault, w)
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	base := server(t)
	if got := signIn(t, base, "/api/core/v1/auth/sign-in", "demo@shopperstop.local", "demo12345"); got != http.StatusOK {
		t.Fatalf("customer sign-in: %d, want 200", got)
	}
	if got := signIn(t, base, "/api/core/v1/admin/auth/sign-in", "admin@shopperstop.local", "admin12345"); got != http.StatusOK {
		t.Fatalf("admin sign-in: %d, want 200", got)
	}
}

// TestLoadTwiceFails: Load on a seeded database errors on the primary key and
// leaves the rows it found in place.
func TestLoadTwiceFails(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	err := seed.Load(ctx, testPool)
	if err == nil || !strings.Contains(err.Error(), "duplicate key") {
		t.Fatalf("load on a seeded database: %v, want a duplicate key error", err)
	}
	assertCount(t, "staff_users", 3)
	assertCount(t, "customers", 1)
	assertCount(t, "addresses", 2)
}

// TestLoadRollsBackWhenCustomerInsertFails: with the demo admin removed, the
// admin insert succeeds inside the transaction and the customer insert hits the
// existing demo customer. The transaction rolls back, so the admin row is not
// left behind, and the customer and its addresses are untouched.
func TestLoadRollsBackWhenCustomerInsertFails(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := testPool.Exec(ctx, "delete from staff_users"); err != nil {
		t.Fatalf("delete admin: %v", err)
	}
	err := seed.Load(ctx, testPool)
	if err == nil || !strings.Contains(err.Error(), "insert demo customer") || !strings.Contains(err.Error(), "duplicate key") {
		t.Fatalf("load with the customer present: %v, want an insert demo customer duplicate key error", err)
	}
	assertCount(t, "staff_users", 0)
	assertCount(t, "customers", 1)
	assertCount(t, "addresses", 2)
}

// postJSON posts body as JSON and returns the status and the raw answer.
func postJSON(t *testing.T, url string, body any) (int, []byte) {
	t.Helper()
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.Post(url, "application/json", bytes.NewReader(raw))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

// getJSON reads url and returns the status and the raw answer.
func getJSON(t *testing.T, url string) (int, []byte) {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

// TestResetTwiceLeavesDemoStores: two resets over a database holding another
// store leave exactly the two demo stores, and their pincodes answer them.
func TestResetTwiceLeavesDemoStores(t *testing.T) {
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, `with s as (
		insert into stores (name, address_line, pincode, promised_minutes) values ('Stray', '1 Stray Rd', '110001', 10) returning id)
		insert into store_service_areas (store_id, pincode) select id, '110001' from s`); err != nil {
		t.Fatalf("add stray store: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}

	assertCount(t, "stores", 2)
	assertCount(t, "store_service_areas", 4)

	base := server(t)
	for pincode, want := range map[string]string{"560095": storeKoramangala, "560008": storeIndiranagar} {
		status, body := getJSON(t, base+"/api/core/v1/serviceability?pincode="+pincode)
		var s struct {
			Store struct {
				ID     string `json:"id"`
				IsOpen bool   `json:"isOpen"`
			} `json:"store"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Store.ID != want || !s.Store.IsOpen {
			t.Fatalf("serviceability %s: got %d %s, want 200 open store %s", pincode, status, body, want)
		}
	}
	if status, body := getJSON(t, base+"/api/core/v1/serviceability?pincode=110001"); status != http.StatusNotFound {
		t.Fatalf("stray pincode 110001: got %d %s, want 404 not_serviceable", status, body)
	}
}

// TestResetLeavesDemoStoreStaff: after a reset the two demo store-staff users
// sign in with the demo password and carry their store.
func TestResetLeavesDemoStoreStaff(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	for _, c := range []struct{ id, email, storeID string }{
		{"00000000-0000-4000-8000-000000000102", "koramangala@shopperstop.local", storeKoramangala},
		{"00000000-0000-4000-8000-000000000103", "indiranagar@shopperstop.local", storeIndiranagar},
	} {
		status, body := postJSON(t, base+"/api/core/v1/admin/auth/sign-in", map[string]string{"email": c.email, "password": "staff12345"})
		var s struct {
			Staff struct {
				ID       string `json:"id"`
				Role     string `json:"role"`
				StoreID  string `json:"storeId"`
				IsActive bool   `json:"isActive"`
			} `json:"staff"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &s) != nil ||
			s.Staff.ID != c.id || s.Staff.Role != "store_staff" || s.Staff.StoreID != c.storeID || !s.Staff.IsActive {
			t.Fatalf("sign-in %s: got %d %s, want 200 store staff %s of store %s", c.email, status, body, c.id, c.storeID)
		}
	}
}

// assertSQL runs a query that returns one integer and fails unless it equals want.
func assertSQL(t *testing.T, what, query string, want int) {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), query).Scan(&n); err != nil {
		t.Fatalf("%s: %v", what, err)
	}
	if n != want {
		t.Fatalf("%s: %d, want %d", what, n, want)
	}
}

// TestResetLoadsDemoCatalog: two resets over a database holding an extra
// category and product leave exactly the demo catalog, and a Load on top of it
// fails without changing anything.
func TestResetLoadsDemoCatalog(t *testing.T) {
	ctx := context.Background()
	var extra string
	if err := testPool.QueryRow(ctx, "insert into categories (name, slug) values ('Extra', 'extra') returning id::text").Scan(&extra); err != nil {
		t.Fatalf("insert extra category: %v", err)
	}
	if _, err := testPool.Exec(ctx, "insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents) values ($1, 'Extra Product', 'extra-product', '1 unit', 100, 100)", extra); err != nil {
		t.Fatalf("insert extra product: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}

	assertCount(t, "categories", 49)
	assertCount(t, "products", 148)
	assertSQL(t, "parent categories", "select count(*) from categories where parent_id is null", 12)
	assertSQL(t, "child categories", "select count(*) from categories where parent_id is not null", 37)
	assertSQL(t, "parents outside 2 to 4 children", "select count(*) from categories p where p.parent_id is null and (select count(*) from categories c where c.parent_id = p.id) not between 2 and 4", 0)
	assertSQL(t, "parent sort orders 10..120", "select count(distinct sort_order) from categories where parent_id is null and sort_order in (10,20,30,40,50,60,70,80,90,100,110,120)", 12)
	assertSQL(t, "child sort orders 10..40", "select count(*) from categories where parent_id is not null and sort_order in (10,20,30,40)", 37)
	assertSQL(t, "products in a parent category", "select count(*) from products p join categories c on c.id = p.category_id where c.parent_id is null", 0)
	assertSQL(t, "fixed product ids", "select count(*) from products where id between '00000000-0000-4000-8000-000000000601' and '00000000-0000-4000-8000-000000000694'", 148)
	assertSQL(t, "banana robusta", "select count(*) from products where id = '00000000-0000-4000-8000-000000000601' and name = 'Banana Robusta' and slug = 'banana-robusta' and unit_label = '1 kg'", 1)
	assertSQL(t, "inactive products", "select count(*) from products where not is_active and id = '00000000-0000-4000-8000-000000000694'", 1)
	assertSQL(t, "inactive products total", "select count(*) from products where not is_active", 1)
	assertSQL(t, "slugs not kebab-case", "select count(*) from (select slug from categories union all select slug from products) s where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'", 0)
	assertSQL(t, "product images not the parent's seed image", "select count(*) from products p join categories c on c.id = p.category_id join categories g on g.id = c.parent_id where p.image_key <> 'products/seed-' || g.slug || '.png'", 0)
	assertSQL(t, "child category images not the parent's seed image", "select count(*) from categories c join categories g on g.id = c.parent_id where c.image_key <> 'categories/seed-' || g.slug || '.png'", 0)
	assertSQL(t, "parent category images not their own seed image", "select count(*) from categories where parent_id is null and image_key <> 'categories/seed-' || slug || '.png'", 0)

	if err := seed.Load(ctx, testPool); err == nil || !strings.Contains(err.Error(), "duplicate key") {
		t.Fatalf("load on a seeded database: %v, want a duplicate key error", err)
	}
	assertCount(t, "categories", 49)
	assertCount(t, "products", 148)
}

// TestDemoImagesServed: Files writes the twelve placeholder images, and the
// file route serves one of them as a PNG.
func TestDemoImagesServed(t *testing.T) {
	dir := t.TempDir()
	store := blob.Disk{Dir: dir}
	if err := seed.Files(context.Background(), store); err != nil {
		t.Fatalf("files: %v", err)
	}
	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now))
	srv := httptest.NewServer(app.New(testPool, []string{"http://localhost:5173"}, a, store))
	t.Cleanup(srv.Close)

	resp, err := http.Get(srv.URL + "/api/core/v1/files/products/seed-fruits-vegetables.png")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK || resp.Header.Get("Content-Type") != "image/png" {
		t.Fatalf("demo image: %d %q, want 200 image/png", resp.StatusCode, resp.Header.Get("Content-Type"))
	}

	entries, err := os.ReadDir("images")
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 12 {
		t.Fatalf("embedded images: %d, want 12", len(entries))
	}
	for _, e := range entries {
		info, err := e.Info()
		if err != nil {
			t.Fatal(err)
		}
		if info.Size() >= 2048 {
			t.Errorf("%s is %d bytes, want under 2 KB", e.Name(), info.Size())
		}
		f, err := os.Open(filepath.Join("images", e.Name()))
		if err != nil {
			t.Fatal(err)
		}
		cfg, format, err := image.DecodeConfig(f)
		f.Close()
		if err != nil {
			t.Fatalf("%s: %v", e.Name(), err)
		}
		if format != "png" || cfg.Width != 256 || cfg.Height != 256 {
			t.Errorf("%s: %s %dx%d, want png 256x256", e.Name(), format, cfg.Width, cfg.Height)
		}
	}
	stored, err := os.ReadDir(filepath.Join(dir, "products"))
	if err != nil {
		t.Fatal(err)
	}
	if len(stored) != 12 {
		t.Fatalf("stored product images: %d, want 12", len(stored))
	}
}

// stockSnapshot reads every stock row as "store product quantity", in order.
func stockSnapshot(t *testing.T) []string {
	t.Helper()
	rows, err := testPool.Query(context.Background(), "select store_id::text, product_id::text, quantity from store_stock order by store_id, product_id")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var store, product string
		var quantity int
		if err := rows.Scan(&store, &product, &quantity); err != nil {
			t.Fatal(err)
		}
		out = append(out, fmt.Sprintf("%s %s %d", store, product, quantity))
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

// TestResetLoadsDemoStock: a reset loads the same stock every time, one row
// per store and product, a zero and a low count at each store, and drops a
// cart and a changed quantity left over from before it.
func TestResetLoadsDemoStock(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := testPool.Exec(ctx, "insert into carts (customer_id, store_id) values ($1, $2)", customerID, storeKoramangala); err != nil {
		t.Fatalf("insert cart: %v", err)
	}
	if _, err := testPool.Exec(ctx, "insert into cart_items (cart_id, product_id, quantity) select id, '00000000-0000-4000-8000-000000000601', 2 from carts"); err != nil {
		t.Fatalf("insert cart item: %v", err)
	}
	if _, err := testPool.Exec(ctx, "update store_stock set quantity = 99 where store_id = $1 and product_id = '00000000-0000-4000-8000-000000000601'", storeKoramangala); err != nil {
		t.Fatalf("change quantity: %v", err)
	}

	var snapshots [][]string
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
		snapshots = append(snapshots, stockSnapshot(t))
	}
	if fmt.Sprint(snapshots[0]) != fmt.Sprint(snapshots[1]) {
		t.Fatalf("stock differs between resets:\nfirst  %v\nsecond %v", snapshots[0], snapshots[1])
	}

	assertSQL(t, "stock rows less stores times products", "select (select count(*) from stores) * (select count(*) from products) - (select count(*) from store_stock)", 0)
	assertSQL(t, "stores with a zero and a count from 1 to 4", "select count(*) from (select store_id from store_stock group by store_id having count(*) filter (where quantity = 0) > 0 and count(*) filter (where quantity between 1 and 4) > 0) s", 2)
	assertSQL(t, "banana robusta at 10 or more at both stores", "select count(*) from store_stock where product_id = '00000000-0000-4000-8000-000000000601' and quantity >= 10", 2)
	assertSQL(t, "changed quantity reverted", "select count(*) from store_stock where quantity = 99", 0)
	assertCount(t, "carts", 0)
	assertCount(t, "cart_items", 0)
}

// Fixed ids of the demo orders of design Decision 15.
const (
	orderDelivered = "00000000-0000-4000-8000-000000000701"
	orderCancelled = "00000000-0000-4000-8000-000000000702"
	orderPlaced    = "00000000-0000-4000-8000-000000000703"
	productBanana  = "00000000-0000-4000-8000-000000000601"
)

// token posts the credentials to path and returns the token of the 200 answer.
func token(t *testing.T, base, path, email, password string) string {
	t.Helper()
	status, body := postJSON(t, base+path, map[string]string{"email": email, "password": password})
	var s struct {
		Token string `json:"token"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Token == "" {
		t.Fatalf("sign-in %s: got %d %s, want 200 with a token", email, status, body)
	}
	return s.Token
}

// request sends one request with a bearer token and an optional JSON body, and
// returns the status and the raw answer.
func request(t *testing.T, base, method, path, bearer string, body any) (int, []byte) {
	t.Helper()
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, base+path, reader)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+bearer)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

// TestResetLoadsDemoOrders: a reset loads the three demo orders with their
// items and events, drops an order left over from before it, and the rows
// agree with each other: totals, statuses, events and timestamps.
func TestResetLoadsDemoOrders(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	addOtherRows(t)
	var other string
	if err := testPool.QueryRow(ctx, `insert into orders (number, customer_id, store_id, customer_name, address_label, address_line1, address_pincode, subtotal_cents, delivery_fee_cents, total_cents)
		values ('SS-OTHERAAA', '00000000-0000-4000-8000-000000000999', $1, 'Other', 'Home', 'Elsewhere', '110001', 7000, 0, 7000) returning id::text`, storeKoramangala).Scan(&other); err != nil {
		t.Fatalf("insert other order: %v", err)
	}
	if _, err := testPool.Exec(ctx, `insert into order_items (order_id, product_id, name, unit_label, price_cents, mrp_cents, quantity)
		values ($1, $2, 'Banana Robusta', '1 kg', 7000, 7000, 1)`, other, productBanana); err != nil {
		t.Fatalf("insert other order item: %v", err)
	}
	if _, err := testPool.Exec(ctx, `insert into order_events (order_id, to_status, actor_type, actor_id)
		values ($1, 'placed', 'customer', '00000000-0000-4000-8000-000000000999')`, other); err != nil {
		t.Fatalf("insert other order event: %v", err)
	}
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}

	assertCount(t, "orders", 3)
	assertCount(t, "order_items", 5)
	assertCount(t, "order_events", 9)

	rows, err := testPool.Query(ctx, "select id::text, number, status::text, customer_id::text, store_id::text from orders order by id")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	want := []struct{ id, number, status string }{
		{orderDelivered, "SS-DEMOAAAB", "delivered"},
		{orderCancelled, "SS-DEMOAAAC", "cancelled"},
		{orderPlaced, "SS-DEMOAAAD", "placed"},
	}
	for i := 0; rows.Next(); i++ {
		var id, number, status, customer, store string
		if err := rows.Scan(&id, &number, &status, &customer, &store); err != nil {
			t.Fatal(err)
		}
		if i >= len(want) || id != want[i].id || number != want[i].number || status != want[i].status || customer != customerID || store != storeKoramangala {
			t.Fatalf("order %d: %s %s %s customer %s store %s, want %+v for the demo customer at Koramangala", i, id, number, status, customer, store, want[i])
		}
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}

	assertSQL(t, "totals that do not add up", "select count(*) from orders o where o.total_cents <> o.subtotal_cents + o.delivery_fee_cents or o.subtotal_cents <> (select coalesce(sum(i.price_cents * i.quantity), 0) from order_items i where i.order_id = o.id)", 0)
	assertSQL(t, "orders below the store minimum", "select count(*) from orders where subtotal_cents < 9900", 0)
	assertSQL(t, "banana robusta lines in delivered and placed", "select count(*) from order_items where product_id = '00000000-0000-4000-8000-000000000601' and order_id in ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000703')", 2)
	assertSQL(t, "orders whose status is not the latest event", "select count(*) from orders o where o.status::text <> (select e.to_status::text from order_events e where e.order_id = o.id order by e.created_at desc, e.id desc limit 1)", 0)
	assertSQL(t, "placed events with no previous status", "select count(*) from order_events where from_status is null and to_status = 'placed'", 3)
	assertSQL(t, "events with no actor", "select count(*) from order_events where actor_id is null", 0)
	assertSQL(t, "delivered orders with a delivery time", "select count(*) from orders where status = 'delivered' and delivered_at is not null", 1)
	assertSQL(t, "cancelled orders with a reason and a time", "select count(*) from orders where status = 'cancelled' and cancelled_at is not null and cancel_reason = 'Ordered by mistake'", 1)
}

// TestDemoOrdersThroughTheRouter: the demo customer lists the three demo
// orders newest first, the admin cannot delete the ordered demo product, and
// the demo customer cancels the placed order.
func TestDemoOrdersThroughTheRouter(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	customer := token(t, base, "/api/core/v1/auth/sign-in", "demo@shopperstop.local", "demo12345")
	admin := token(t, base, "/api/core/v1/admin/auth/sign-in", "admin@shopperstop.local", "admin12345")

	status, body := request(t, base, http.MethodGet, "/api/core/v1/orders", customer, nil)
	var list struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &list) != nil || list.Total != 3 {
		t.Fatalf("GET /orders: got %d %s, want 200 with total 3", status, body)
	}
	for i, id := range []string{orderPlaced, orderCancelled, orderDelivered} {
		if i >= len(list.Items) || list.Items[i].ID != id {
			t.Fatalf("GET /orders: got %s, want %s, %s, %s newest first", body, orderPlaced, orderCancelled, orderDelivered)
		}
	}

	status, body = request(t, base, http.MethodDelete, "/api/core/v1/admin/products/"+productBanana, admin, nil)
	var refused struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if status != http.StatusConflict || json.Unmarshal(body, &refused) != nil || refused.Error.Code != "conflict" {
		t.Fatalf("DELETE ordered product: got %d %s, want 409 conflict", status, body)
	}
	assertSQL(t, "ordered product still there", "select count(*) from products where id = '"+productBanana+"'", 1)

	status, body = request(t, base, http.MethodPost, "/api/core/v1/orders/"+orderPlaced+"/cancel", customer, map[string]string{})
	var cancelled struct {
		Status string `json:"status"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &cancelled) != nil || cancelled.Status != "cancelled" {
		t.Fatalf("cancel placed demo order: got %d %s, want 200 cancelled", status, body)
	}
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset after the cancel: %v", err)
	}
}

var (
	summaryID      = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)
	summaryPostman = regexp.MustCompile(`\(Postman (\w+)\)$`)
)

// TestSummaryMatchesSeed: every sign-in seed.Summary prints works, every id it
// prints is one row of the table printed beside it, and the four ids marked
// Postman are the values of docs/postman/local.postman_environment.json.
func TestSummaryMatchesSeed(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	tables := map[string]bool{"staff_users": true, "customers": true, "addresses": true, "stores": true, "products": true, "orders": true}
	postman := map[string]string{}
	signIns, ids := 0, 0
	for _, line := range strings.Split(seed.Summary, "\n") {
		f := strings.Fields(line)
		switch {
		case len(f) == 3 && strings.Contains(f[0], "@"):
			signIns++
			path := "/api/core/v1/admin/auth/sign-in"
			if f[2] == "customer" {
				path = "/api/core/v1/auth/sign-in"
			}
			status, body := postJSON(t, base+path, map[string]string{"email": f[0], "password": f[1]})
			var s struct {
				Staff struct {
					Role string `json:"role"`
				} `json:"staff"`
			}
			if status != http.StatusOK || json.Unmarshal(body, &s) != nil || (f[2] != "customer" && s.Staff.Role != f[2]) {
				t.Errorf("sign-in %q: got %d %s, want 200 as %s", line, status, body, f[2])
			}
		case len(f) >= 2 && summaryID.MatchString(f[0]):
			ids++
			if !tables[f[1]] {
				t.Errorf("line %q names table %q, want one of %v", line, f[1], tables)
				continue
			}
			var n int
			if err := testPool.QueryRow(ctx, "select count(*) from "+f[1]+" where id = $1", f[0]).Scan(&n); err != nil {
				t.Fatal(err)
			}
			if n != 1 {
				t.Errorf("line %q: %d rows in %s with that id, want 1", line, n, f[1])
			}
			if m := summaryPostman.FindStringSubmatch(line); m != nil {
				postman[m[1]] = f[0]
			}
		}
	}
	if signIns != 4 || ids != 12 {
		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 12", signIns, ids)
	}

	raw, err := os.ReadFile("../../../../docs/postman/local.postman_environment.json")
	if err != nil {
		t.Fatal(err)
	}
	var env struct {
		Values []struct{ Key, Value string } `json:"values"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatal(err)
	}
	seen := 0
	for _, v := range env.Values {
		switch v.Key {
		case "storeId", "productId", "addressId", "orderId":
			seen++
			if postman[v.Key] != v.Value {
				t.Errorf("Postman %s is %q, the summary marks %q", v.Key, v.Value, postman[v.Key])
			}
		}
	}
	if seen != 4 || len(postman) != 4 {
		t.Fatalf("Postman environment holds %d of the four id variables and the summary marks %d, want 4 and 4", seen, len(postman))
	}
}
