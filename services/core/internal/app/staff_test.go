package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
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

// missingStaffID is a canonical uuid no staff user has.
const (
	staffUsersPath = "/api/core/v1/admin/staff-users"
	missingStaffID = "00000000-0000-4000-8000-0000000001ff"
)

// staffID returns the id of the staff user with email.
func staffID(t *testing.T, email string) string {
	t.Helper()
	var id string
	if err := testPool.QueryRow(context.Background(), "select id from staff_users where email = $1", email).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// staffUserBody is the 201 and 200 body of the staff-user routes.
func staffUserBody(t *testing.T, body []byte) staffView {
	t.Helper()
	var got staffView
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("body %s is not a staff user: %v", body, err)
	}
	return got
}

func TestStoreStaffForbiddenOnStaffUsers(t *testing.T) {
	seedStaff(t)
	token := staffSignIn(t, storeStaffEmail)
	for _, c := range []struct {
		method, path string
		body         any
	}{
		{http.MethodGet, staffUsersPath, nil},
		{http.MethodPost, staffUsersPath, map[string]string{}},
		{http.MethodPatch, staffUsersPath + "/" + missingStaffID, map[string]string{}},
	} {
		status, body := call(t, c.method, c.path, token, c.body)
		if e := decodeError(t, body); status != http.StatusForbidden || e.Error.Code != "forbidden" {
			t.Fatalf("%s %s as store staff: got %d %s, want 403 forbidden", c.method, c.path, status, body)
		}
	}
}

// TestCreateStoreStaffUser creates a store-staff user through the router, signs
// in with the password it was given, then resets that user's password: the old
// one fails and the new one works. Cost 12 is paid for the create hash, the
// sign-in, the reset hash, the refused old sign-in and the new sign-in.
func TestCreateStoreStaffUser(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	email := uniqueEmail(t)
	status, body := call(t, http.MethodPost, staffUsersPath, admin,
		map[string]string{"email": email, "password": "staff12345", "name": "HSR", "role": "store_staff", "storeId": testStoreID})
	got := staffUserBody(t, body)
	if status != http.StatusCreated || got.ID == "" || got.Email != email || got.Name != "HSR" ||
		got.Role != "store_staff" || got.StoreID != testStoreID || !got.IsActive {
		t.Fatalf("create store staff: got %d %s, want 201 with the new store-staff user", status, body)
	}
	status, body = call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": email, "password": "staff12345"})
	if status != http.StatusOK {
		t.Fatalf("sign-in of the created user: got %d %s, want 200", status, body)
	}

	t.Run("password reset", func(t *testing.T) {
		status, body := call(t, http.MethodPatch, staffUsersPath+"/"+got.ID, admin, map[string]string{"password": "newpass123"})
		if status != http.StatusOK {
			t.Fatalf("password reset: got %d %s, want 200", status, body)
		}
		status, body = call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
			map[string]string{"email": email, "password": "staff12345"})
		assertStaffRefused(t, "old password after reset", status, body)
		status, body = call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
			map[string]string{"email": email, "password": "newpass123"})
		if status != http.StatusOK {
			t.Fatalf("new password after reset: got %d %s, want 200", status, body)
		}
	})
}

func TestCreateStaffUnknownRole(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	status, body := call(t, http.MethodPost, staffUsersPath, admin,
		map[string]string{"email": uniqueEmail(t), "password": "staff12345", "name": "Owner", "role": "owner"})
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "role" {
		t.Fatalf("role owner: got %d %s, want 400 validation field role", status, body)
	}
}

func TestCreateStaffRoleStoreMismatch(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	cases := []struct {
		name string
		body map[string]string
	}{
		{"store staff without a store", map[string]string{"role": "store_staff"}},
		{"admin with a store", map[string]string{"role": "admin", "storeId": testStoreID}},
	}
	for _, c := range cases {
		c.body["email"] = uniqueEmail(t)
		c.body["password"] = "staff12345"
		c.body["name"] = "Staff"
		status, body := call(t, http.MethodPost, staffUsersPath, admin, c.body)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "storeId" {
			t.Fatalf("%s: got %d %s, want 400 validation field storeId", c.name, status, body)
		}
	}
}

func TestCreateStaffTakenEmail(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	status, body := call(t, http.MethodPost, staffUsersPath, admin,
		map[string]string{"email": strings.ToUpper(adminStaffEmail), "password": "staff12345", "name": "Again", "role": "admin"})
	if e := decodeError(t, body); status != http.StatusConflict || e.Error.Code != "conflict" || e.Error.Field != "email" {
		t.Fatalf("taken email: got %d %s, want 409 conflict field email", status, body)
	}
}

// TestPatchStaffUserRules uses cheap fixtures: every refusal happens before any hash.
func TestPatchStaffUserRules(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	target := insertStaff(t, "store_staff", true)
	path := staffUsersPath + "/" + staffID(t, target)
	for _, c := range []struct {
		name  string
		body  any
		field string
	}{
		{"null name", map[string]any{"name": nil}, "name"},
		{"short password", map[string]string{"password": "short"}, "password"},
		{"empty name", map[string]string{"name": ""}, "name"},
	} {
		status, body := call(t, http.MethodPatch, path, admin, c.body)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
	// role is not a patch member: it is ignored and the role does not change.
	status, body := call(t, http.MethodPatch, path, admin, map[string]string{"role": "admin"})
	if got := staffUserBody(t, body); status != http.StatusOK || got.Role != "store_staff" {
		t.Fatalf("role in a patch: got %d %s, want 200 with role store_staff", status, body)
	}
}

// TestAdminDeactivatesSelf: an admin may deactivate their own account, and the
// session that did it then answers 401.
func TestAdminDeactivatesSelf(t *testing.T) {
	email := insertStaff(t, "admin", true)
	token := staffSignIn(t, email)
	status, body := call(t, http.MethodPatch, staffUsersPath+"/"+staffID(t, email), token, map[string]bool{"isActive": false})
	if got := staffUserBody(t, body); status != http.StatusOK || got.IsActive {
		t.Fatalf("self-deactivation: got %d %s, want 200 with isActive false", status, body)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/admin/me", token, nil); status != http.StatusUnauthorized {
		t.Fatalf("own session after self-deactivation: got %d %s, want 401", status, body)
	}
}

func TestPatchUnknownStaff(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	for _, id := range []string{missingStaffID, "abc"} {
		status, body := call(t, http.MethodPatch, staffUsersPath+"/"+id, admin, map[string]string{"name": "Nobody"})
		if e := decodeError(t, body); status != http.StatusNotFound || e.Error.Code != "not_found" {
			t.Fatalf("PATCH %s: got %d %s, want 404 not_found", id, status, body)
		}
	}
}

func TestDeactivatedWhileSignedIn(t *testing.T) {
	email := insertStaff(t, "store_staff", true)
	token := staffSignIn(t, email)
	admin := staffSignIn(t, adminStaffEmail)
	status, body := call(t, http.MethodPatch, staffUsersPath+"/"+staffID(t, email), admin, map[string]bool{"isActive": false})
	if got := staffUserBody(t, body); status != http.StatusOK || got.IsActive {
		t.Fatalf("deactivate: got %d %s, want 200 with isActive false", status, body)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/admin/me", token, nil); status != http.StatusUnauthorized {
		t.Fatalf("GET /admin/me after deactivation: got %d %s, want 401", status, body)
	}
}

func TestListStaff(t *testing.T) {
	seedStaff(t)
	admin := staffSignIn(t, adminStaffEmail)
	status, body := call(t, http.MethodGet, staffUsersPath+"?page=1&pageSize=2", admin, nil)
	var list struct {
		Items    []staffView `json:"items"`
		Page     int         `json:"page"`
		PageSize int         `json:"pageSize"`
		Total    int64       `json:"total"`
	}
	if err := json.Unmarshal(body, &list); err != nil || status != http.StatusOK {
		t.Fatalf("list: got %d %s, want 200", status, body)
	}
	var total int64
	if err := testPool.QueryRow(context.Background(), "select count(*) from staff_users").Scan(&total); err != nil {
		t.Fatal(err)
	}
	if list.Page != 1 || list.PageSize != 2 || list.Total != total || len(list.Items) != 2 {
		t.Fatalf("list %s: want page 1, pageSize 2, total %d, two items", body, total)
	}
	// An admin has no storeId member in the list either.
	var raw struct {
		Items []map[string]json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		t.Fatal(err)
	}
	adminFound := false
	for _, item := range raw.Items {
		if string(item["email"]) == `"`+adminStaffEmail+`"` {
			adminFound = true
			if _, ok := item["storeId"]; ok {
				t.Fatalf("admin list item %s carries storeId", body)
			}
		}
	}
	if !adminFound {
		t.Fatalf("admin %s is not on the first page: %s", adminStaffEmail, body)
	}
	// The expected order comes from the database, which compares citext emails.
	rows, err := testPool.Query(context.Background(), "select email from staff_users order by email limit 2")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	for i := 0; rows.Next(); i++ {
		var email string
		if err := rows.Scan(&email); err != nil {
			t.Fatal(err)
		}
		if list.Items[i].Email != email {
			t.Fatalf("item %d is %s, want %s (ordered by email)", i, list.Items[i].Email, email)
		}
	}
}

// Task 7 review gaps.

func TestStaffSignOutEndsOnlyThatSession(t *testing.T) {
	seedStaff(t)
	first := staffSignIn(t, storeStaffEmail)
	second := staffSignIn(t, storeStaffEmail)
	if status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-out", first, nil); status != http.StatusNoContent {
		t.Fatalf("sign-out: got %d %s, want 204", status, body)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/admin/me", first, nil); status != http.StatusUnauthorized {
		t.Fatalf("signed-out token: got %d %s, want 401", status, body)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/admin/me", second, nil); status != http.StatusOK {
		t.Fatalf("other session after one sign-out: got %d %s, want 200", status, body)
	}
}

// TestSharedLimiterCountsStaffAndCustomer uses a limit of 1 per email. The
// customer and staff routes share one limiter, so the second attempt across
// both is 429 and the staff route pays no compare.
func TestSharedLimiterCountsStaffAndCustomer(t *testing.T) {
	email := uniqueEmail(t)
	a := auth.New(testPool, testPepper, auth.NewLimiter(1, 100, time.Hour, time.Now))
	limited := httptest.NewServer(New(testPool, nil, a))
	t.Cleanup(limited.Close)
	status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": "wrong-password"})
	if status != http.StatusUnauthorized {
		t.Fatalf("customer sign-in: got %d %s, want 401", status, body)
	}
	status, body = callAt(t, limited.URL, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "",
		map[string]string{"email": email, "password": "wrong-password"})
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("staff sign-in after one customer attempt: got %d %s, want 429 rate_limited", status, body)
	}
}

func TestStaffSignInValidation(t *testing.T) {
	cases := []struct {
		name  string
		body  map[string]string
		field string
	}{
		{"bad email", map[string]string{"email": "not-an-email", "password": testPassword}, "email"},
		{"empty password", map[string]string{"email": adminStaffEmail, "password": ""}, "password"},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPost, "/api/core/v1/admin/auth/sign-in", "", c.body)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
}
