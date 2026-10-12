package seed_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/app"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
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
	srv := httptest.NewServer(app.New(testPool, []string{"http://localhost:5173"}, a))
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
