package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
)

// The staff fixtures are inserted directly (there is no staff route to create
// users until task 8) with the cheap hash of testPassword.
const (
	adminStaffEmail = "admin.staff@example.com"
	storeStaffEmail = "store.staff@example.com"
	testStoreID     = "00000000-0000-4000-8000-000000000401"
)

// staffView is the staff user as the sign-in and /admin/me bodies show it.
type staffView struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	StoreID  string `json:"storeId"`
	IsActive bool   `json:"isActive"`
}

type staffSessionBody struct {
	Token string    `json:"token"`
	Staff staffView `json:"staff"`
}

var seedStaffOnce sync.Once

// seedStaff inserts the shared admin and store-staff users once per package.
func seedStaff(t *testing.T) {
	t.Helper()
	seedStaffOnce.Do(func() {
		_, err := testPool.Exec(context.Background(), `
			insert into staff_users (email, password_hash, name, role, store_id) values
			  ($1, $3, 'Admin', 'admin', null),
			  ($2, $3, 'Store Staff', 'store_staff', $4)`,
			adminStaffEmail, storeStaffEmail, cheapHash(), testStoreID)
		if err != nil {
			panic(err)
		}
	})
}

// insertStaff inserts one staff user with its own email and returns the email.
func insertStaff(t *testing.T, role string, active bool) string {
	t.Helper()
	email := uniqueEmail(t)
	var storeID any
	if role == "store_staff" {
		storeID = testStoreID
	}
	if _, err := testPool.Exec(context.Background(),
		"insert into staff_users (email, password_hash, name, role, store_id, is_active) values ($1, $2, 'Staff', $3, $4, $5)",
		email, cheapHash(), role, storeID, active); err != nil {
		t.Fatal(err)
	}
	return email
}

// staffSignIn signs the staff user in through the router and returns the token.
func staffSignIn(t *testing.T, email string) string {
	t.Helper()
	status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	var s staffSessionBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("staff sign-in of %s: got %d %s, want 200", email, status, body)
	}
	return s.Token
}

// assertStaffRefused checks the one 401 every staff sign-in failure answers.
func assertStaffRefused(t *testing.T, what string, status int, body []byte) {
	t.Helper()
	e := decodeError(t, body)
	if status != http.StatusUnauthorized || e.Error.Code != "unauthorized" || e.Error.Message != "wrong email or password" {
		t.Fatalf("%s: got %d %s, want 401 unauthorized wrong email or password", what, status, body)
	}
}

func TestStaffSignIn(t *testing.T) {
	seedStaff(t)
	status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": storeStaffEmail, "password": testPassword})
	var s staffSessionBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("store staff sign-in: got %d %s, want 200", status, body)
	}
	want := staffView{Email: storeStaffEmail, Name: "Store Staff", Role: "store_staff", StoreID: testStoreID, IsActive: true}
	if s.Token == "" || s.Staff.ID == "" || s.Staff.Email != want.Email || s.Staff.Name != want.Name ||
		s.Staff.Role != want.Role || s.Staff.StoreID != want.StoreID || !s.Staff.IsActive {
		t.Fatalf("store staff sign-in body %s: want token and staff %+v", body, want)
	}
	status, me := call(t, http.MethodGet, "/api/core/v1/admin/me", s.Token, nil)
	var got staffView
	if status != http.StatusOK || json.Unmarshal(me, &got) != nil || got != s.Staff {
		t.Fatalf("GET /admin/me: got %d %s, want 200 with the signed-in staff %+v", status, me, s.Staff)
	}

	// An admin has no storeId member at all.
	status, body = call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": adminStaffEmail, "password": testPassword})
	var fields struct {
		Staff map[string]json.RawMessage `json:"staff"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &fields) != nil {
		t.Fatalf("admin sign-in: got %d %s, want 200", status, body)
	}
	if _, ok := fields.Staff["storeId"]; ok || fields.Staff["role"] == nil {
		t.Fatalf("admin sign-in body %s: want role and no storeId", body)
	}
}

func TestStaffSignInInactive(t *testing.T) {
	email := insertStaff(t, "store_staff", false)
	status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	assertStaffRefused(t, "inactive staff", status, body)
}

func TestStaffSignInCustomerCredentials(t *testing.T) {
	email := seedCustomer(t).Customer.Email
	status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	assertStaffRefused(t, "customer credentials", status, body)
}

// TestStaffSignInRateLimited uses its own server with the production limits:
// wrong passwords count against the same email as right ones.
func TestStaffSignInRateLimited(t *testing.T) {
	seedStaff(t)
	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now))
	limited := httptest.NewServer(New(testPool, nil, a))
	t.Cleanup(limited.Close)
	for i := range 10 {
		status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
			map[string]string{"email": storeStaffEmail, "password": "wrong-password"})
		assertStaffRefused(t, fmt.Sprintf("wrong password attempt %d", i+1), status, body)
	}
	status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": storeStaffEmail, "password": testPassword})
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("eleventh attempt: got %d %s, want 429 rate_limited", status, body)
	}
}

func TestStaffSignOut(t *testing.T) {
	seedStaff(t)
	token := staffSignIn(t, storeStaffEmail)
	if status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-out", token, nil); status != http.StatusNoContent {
		t.Fatalf("sign-out: got %d %s, want 204", status, body)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/admin/me", token, nil); status != http.StatusUnauthorized {
		t.Fatalf("GET /admin/me after sign-out: got %d %s, want 401", status, body)
	}
}

func TestStaffMeWithCustomerToken(t *testing.T) {
	customer := seedCustomer(t)
	for _, c := range []struct{ method, path string }{
		{http.MethodGet, "/api/core/v1/admin/me"},
		{http.MethodPost, "/api/core/v1/admin/auth/sign-out"},
	} {
		status, body := call(t, c.method, c.path, customer.Token, nil)
		if e := decodeError(t, body); status != http.StatusUnauthorized || e.Error.Code != "unauthorized" {
			t.Fatalf("%s %s with a customer token: got %d %s, want 401 unauthorized", c.method, c.path, status, body)
		}
	}
}
