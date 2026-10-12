package seed_test

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	_ "image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
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
