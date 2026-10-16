package app

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
)

const testPassword = "password123"

// emailSeq makes every email unique, so tests share one schema without clashes.
var emailSeq atomic.Int64

func uniqueEmail(t *testing.T) string {
	return fmt.Sprintf("%s.%d@example.com", strings.ToLower(t.Name()), emailSeq.Add(1))
}

// sessionBody is the 201 and 200 body of register and sign-in.
type sessionBody struct {
	Token    string `json:"token"`
	Customer struct {
		ID    string `json:"id"`
		Email string `json:"email"`
		Name  string `json:"name"`
		Phone string `json:"phone"`
	} `json:"customer"`
}

// cheapHash is the test password at bcrypt.MinCost. Fixtures store it directly
// and sign in with it in milliseconds; only registration through the router
// pays cost 12.
var cheapHash = sync.OnceValue(func() string {
	h, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	if err != nil {
		panic(err)
	}
	return string(h)
})

// seedCustomerEmail inserts a customer row directly at MinCost, then signs it
// in through the router, so the returned session is a real one.
func seedCustomerEmail(t *testing.T, email string) sessionBody {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		"insert into customers (email, password_hash, name) values ($1, $2, 'Asha')", email, cheapHash()); err != nil {
		t.Fatal(err)
	}
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	var s sessionBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("sign-in of seeded %s: got %d %s, want 200", email, status, body)
	}
	return s
}

// seedCustomer is seedCustomerEmail for a fresh email.
func seedCustomer(t *testing.T) sessionBody {
	t.Helper()
	return seedCustomerEmail(t, uniqueEmail(t))
}

// newCustomer is the fixture for tests that need a token or a second account.
func newCustomer(t *testing.T) sessionBody {
	t.Helper()
	return seedCustomer(t)
}

// register creates a customer through the router at cost 12, for the tests
// about registration itself.
func register(t *testing.T, email string) sessionBody {
	t.Helper()
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "",
		map[string]string{"email": email, "password": testPassword, "name": "Asha"})
	if status != http.StatusCreated {
		t.Fatalf("register %s: got %d %s, want 201", email, status, body)
	}
	var s sessionBody
	if err := json.Unmarshal(body, &s); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestRegister(t *testing.T) {
	email := uniqueEmail(t)
	s := register(t, email)
	if s.Token == "" || s.Customer.Email != email || s.Customer.ID == "" {
		t.Fatalf("register: want a token and the customer, got %+v", s)
	}
	status, me := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil)
	if status != http.StatusOK {
		t.Fatalf("GET /me with the registration token: got %d %s, want 200", status, me)
	}
	var got sessionBody
	if err := json.Unmarshal(me, &got.Customer); err != nil {
		t.Fatal(err)
	}
	if got.Customer.ID != s.Customer.ID || got.Customer.Email != email {
		t.Fatalf("GET /me %s: want the registered customer %s", me, s.Customer.ID)
	}
}

// TestRegisterEmailTakenInOtherCase seeds the first account, so only the
// second, refused registration pays for a real hash.
func TestRegisterEmailTakenInOtherCase(t *testing.T) {
	email := uniqueEmail(t)
	seedCustomerEmail(t, email)
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "",
		map[string]string{"email": strings.ToUpper(email), "password": testPassword, "name": "Asha"})
	e := decodeError(t, body)
	if status != http.StatusConflict || e.Error.Code != "conflict" || e.Error.Field != "email" {
		t.Fatalf("second registration: got %d %s, want 409 conflict field email", status, body)
	}
}

func TestRegisterPasswordLength(t *testing.T) {
	for _, password := range []string{strings.Repeat("p", 7), strings.Repeat("p", 73)} {
		status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "",
			map[string]string{"email": uniqueEmail(t), "password": password, "name": "Asha"})
		e := decodeError(t, body)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "password" {
			t.Fatalf("password of %d bytes: got %d %s, want 400 validation field password", len(password), status, body)
		}
	}
}

func TestRegisterInvalidEmailOrName(t *testing.T) {
	cases := []struct {
		name  string
		body  map[string]string
		field string
	}{
		{"bad email", map[string]string{"email": "not-an-email", "password": testPassword, "name": "Asha"}, "email"},
		{"blank name", map[string]string{"email": uniqueEmail(t), "password": testPassword, "name": "   "}, "name"},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "", c.body)
		e := decodeError(t, body)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
}

// TestPasswordStoredAsBcrypt12 registers through the router, the only test
// that checks the hash the handler stores at cost 12.
func TestPasswordStoredAsBcrypt12(t *testing.T) {
	s := register(t, uniqueEmail(t))
	var hash string
	if err := testPool.QueryRow(context.Background(), "select password_hash from customers where id = $1", s.Customer.ID).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if cost, err := bcrypt.Cost([]byte(hash)); err != nil || cost != 12 {
		t.Fatalf("stored hash cost %d (err %v), want 12", cost, err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(testPassword)); err != nil {
		t.Fatalf("stored hash does not match the password: %v", err)
	}
	if strings.Contains(hash, testPassword) {
		t.Fatal("stored hash contains the password")
	}
}

func TestSignInKeepsOtherSessions(t *testing.T) {
	email := uniqueEmail(t)
	first := seedCustomerEmail(t, email)
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	if status != http.StatusOK {
		t.Fatalf("sign-in: got %d %s, want 200", status, body)
	}
	var second sessionBody
	if err := json.Unmarshal(body, &second); err != nil {
		t.Fatal(err)
	}
	if second.Token == "" || second.Token == first.Token {
		t.Fatal("sign-in returned no new token")
	}
	for _, token := range []string{first.Token, second.Token} {
		if status, body := call(t, http.MethodGet, "/api/core/v1/me", token, nil); status != http.StatusOK {
			t.Fatalf("GET /me with a live session: got %d %s, want 200", status, body)
		}
	}
}

func TestSignInValidation(t *testing.T) {
	cases := []struct {
		name  string
		body  map[string]string
		field string
	}{
		{"bad email", map[string]string{"email": "not-an-email", "password": testPassword}, "email"},
		{"empty password", map[string]string{"email": uniqueEmail(t), "password": ""}, "password"},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", c.body)
		e := decodeError(t, body)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
}

// TestSignInFailuresLookTheSame checks equal work (Decision 10): the unknown-email
// sign-in runs a bcrypt compare against the dummy hash, so it must take at
// least half as long as a wrong-password sign-in, which runs one against the
// customer's cost-12 hash. A ratio, not a floor, so the check holds on a
// loaded machine.
func TestSignInFailuresLookTheSame(t *testing.T) {
	email := uniqueEmail(t)
	register(t, email)
	// Warm the dummy hash so its one-time cost-12 hashing is not timed.
	call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": "warm." + email, "password": testPassword})

	start := time.Now()
	wrongStatus, wrongBody := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": "wrong-password"})
	wrongTook := time.Since(start)
	start = time.Now()
	unknownStatus, unknownBody := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": "nobody." + email, "password": testPassword})
	unknownTook := time.Since(start)
	if wrongStatus != http.StatusUnauthorized || unknownStatus != http.StatusUnauthorized {
		t.Fatalf("wrong password %d, unknown email %d: want both 401", wrongStatus, unknownStatus)
	}
	wrong, unknown := decodeError(t, wrongBody), decodeError(t, unknownBody)
	if wrong.Error.Code != "unauthorized" || wrong.Error.Message != "wrong email or password" {
		t.Fatalf("wrong password body %s: want unauthorized and the shared message", wrongBody)
	}
	if !reflect.DeepEqual(wrong, unknown) {
		t.Fatalf("messages differ: wrong password %+v, unknown email %+v", wrong, unknown)
	}
	if unknownTook < wrongTook/2 {
		t.Fatalf("unknown-email sign-in took %v, wrong-password sign-in took %v: want at least half as long (Decision 10: the unknown path must pay bcrypt too)", unknownTook, wrongTook)
	}
}

func TestSignOutEndsOnlyThatSession(t *testing.T) {
	email := uniqueEmail(t)
	a := seedCustomerEmail(t, email)
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": testPassword})
	var b sessionBody
	if status != http.StatusOK || json.Unmarshal(body, &b) != nil {
		t.Fatalf("sign-in: got %d %s, want 200", status, body)
	}
	if status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-out", a.Token, nil); status != http.StatusNoContent {
		t.Fatalf("sign-out: got %d %s, want 204", status, body)
	}
	if status, _ := call(t, http.MethodGet, "/api/core/v1/me", a.Token, nil); status != http.StatusUnauthorized {
		t.Fatalf("GET /me with the signed-out token: got %d, want 401", status)
	}
	if status, body := call(t, http.MethodGet, "/api/core/v1/me", b.Token, nil); status != http.StatusOK {
		t.Fatalf("GET /me with the other session: got %d %s, want 200", status, body)
	}
}

// TestRegisterRateLimitedPerEmail uses its own server with the production
// limits. Refused attempts count before validation, so short passwords are enough.
func TestRegisterRateLimitedPerEmail(t *testing.T) {
	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), nil)
	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
	t.Cleanup(limited.Close)
	email := uniqueEmail(t)
	for i := range 10 {
		status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/auth/register", "",
			map[string]string{"email": email, "password": "short", "name": "Asha"})
		if status != http.StatusBadRequest {
			t.Fatalf("attempt %d: got %d %s, want 400 (counted, then refused by validation)", i+1, status, body)
		}
	}
	status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/auth/register", "",
		map[string]string{"email": email, "password": testPassword, "name": "Asha"})
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("eleventh attempt: got %d %s, want 429 rate_limited", status, body)
	}
}

// signInFrom signs email in at base with testPassword over a new connection
// (so a new client port) carrying forwardedFor as X-Forwarded-For.
func signInFrom(t *testing.T, base, email, forwardedFor string) (int, []byte) {
	t.Helper()
	b, err := json.Marshal(map[string]string{"email": email, "password": testPassword})
	if err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, base+"/api/core/v1/auth/sign-in", bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", forwardedFor)
	req.Close = true
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var out bytes.Buffer
	if _, err := out.ReadFrom(resp.Body); err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out.Bytes()
}

// TestSignInRateLimitedPerIP: two sign-ins from one client IP pass and the
// third is refused, though every attempt names a different email and sends a
// different X-Forwarded-For. Each request opens a new connection, so a new
// client port: the key must drop the port, and X-Forwarded-For must not be trusted.
func TestSignInRateLimitedPerIP(t *testing.T) {
	a := auth.New(testPool, testPepper, auth.NewLimiter(100, 2, time.Hour, time.Now), nil)
	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
	t.Cleanup(limited.Close)
	for i, forwarded := range []string{"203.0.113.1", "203.0.113.2"} {
		email := seedCustomer(t).Customer.Email
		if status, body := signInFrom(t, limited.URL, email, forwarded); status != http.StatusOK {
			t.Fatalf("attempt %d: got %d %s, want 200", i+1, status, body)
		}
	}
	email := seedCustomer(t).Customer.Email
	status, body := signInFrom(t, limited.URL, email, "203.0.113.3")
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("third attempt from one IP: got %d %s, want 429 rate_limited", status, body)
	}
}

// TestSignInRateLimitedPerForwardedIP: behind a trusted proxy the per-IP count
// keys on the first X-Forwarded-For address, so a third sign-in from one
// forwarded client is refused while another client behind the same proxy passes.
func TestSignInRateLimitedPerForwardedIP(t *testing.T) {
	limit := auth.NewLimiter(100, 2, time.Hour, time.Now)
	limit.TrustProxy = true
	a := auth.New(testPool, testPepper, limit, nil)
	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
	t.Cleanup(limited.Close)
	for i, forwarded := range []string{"203.0.113.7", " 203.0.113.7 , 10.0.0.1"} {
		email := seedCustomer(t).Customer.Email
		if status, body := signInFrom(t, limited.URL, email, forwarded); status != http.StatusOK {
			t.Fatalf("attempt %d from 203.0.113.7: got %d %s, want 200", i+1, status, body)
		}
	}
	status, body := signInFrom(t, limited.URL, seedCustomer(t).Customer.Email, "203.0.113.7, 10.0.0.1")
	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
		t.Fatalf("third attempt from 203.0.113.7: got %d %s, want 429 rate_limited", status, body)
	}
	if status, body := signInFrom(t, limited.URL, seedCustomer(t).Customer.Email, "203.0.113.8, 10.0.0.1"); status != http.StatusOK {
		t.Fatalf("first attempt from 203.0.113.8 behind the same proxy: got %d %s, want 200", status, body)
	}
}

func TestPatchMe(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token,
		map[string]string{"name": "Asha R", "phone": "+919800000001"})
	var got sessionBody
	if err := json.Unmarshal(body, &got.Customer); err != nil {
		t.Fatal(err)
	}
	if status != http.StatusOK || got.Customer.Name != "Asha R" || got.Customer.Phone != "+919800000001" {
		t.Fatalf("PATCH /me: got %d %s, want 200 with the new name and phone", status, body)
	}
	_, me := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil)
	if err := json.Unmarshal(me, &got.Customer); err != nil || got.Customer.Name != "Asha R" || got.Customer.Phone != "+919800000001" {
		t.Fatalf("GET /me after PATCH: %s, want the same name and phone", me)
	}
}

// TestPatchMePhoneOnlyKeepsName: a PATCH with only phone leaves name unchanged.
func TestPatchMePhoneOnlyKeepsName(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"phone": "+919800000003"})
	var got sessionBody
	if err := json.Unmarshal(body, &got.Customer); err != nil {
		t.Fatal(err)
	}
	if status != http.StatusOK || got.Customer.Name != "Asha" || got.Customer.Phone != "+919800000003" {
		t.Fatalf("phone-only PATCH: got %d %s, want 200 with name Asha and the new phone", status, body)
	}
}

// TestPatchMeNameLength counts the name in characters, not bytes.
func TestPatchMeNameLength(t *testing.T) {
	s := newCustomer(t)
	cases := []struct {
		name, value string
		wantStatus  int
	}{
		{"101 ASCII characters", strings.Repeat("a", 101), http.StatusBadRequest},
		{"101 multi-byte characters", strings.Repeat("é", 101), http.StatusBadRequest},
		{"100 multi-byte characters, 200 bytes", strings.Repeat("é", 100), http.StatusOK},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"name": c.value})
		if status != c.wantStatus {
			t.Fatalf("%s: got %d %s, want %d", c.name, status, body, c.wantStatus)
		}
		if c.wantStatus == http.StatusBadRequest {
			if e := decodeError(t, body); e.Error.Code != "validation" || e.Error.Field != "name" {
				t.Fatalf("%s: got %s, want validation field name", c.name, body)
			}
		}
	}
	_, me := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil)
	var got sessionBody
	if err := json.Unmarshal(me, &got.Customer); err != nil {
		t.Fatal(err)
	}
	if n := utf8.RuneCountInString(got.Customer.Name); n != 100 {
		t.Fatalf("stored name has %d characters, want 100", n)
	}
}

func TestPatchMeEmptyPhoneClears(t *testing.T) {
	s := newCustomer(t)
	if status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"phone": "+919800000002"}); status != http.StatusOK {
		t.Fatalf("set phone: got %d %s, want 200", status, body)
	}
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"phone": ""})
	if status != http.StatusOK {
		t.Fatalf("clear phone: got %d %s, want 200", status, body)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(body, &fields); err != nil {
		t.Fatal(err)
	}
	if _, ok := fields["phone"]; ok {
		t.Fatalf("response %s has a phone field after clearing it, want it omitted", body)
	}
	if _, me := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil); strings.Contains(string(me), `"phone"`) {
		t.Fatalf("GET /me %s still has a phone field", me)
	}
}

func TestPatchMeBadPhone(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"phone": "call me"})
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "phone" {
		t.Fatalf("bad phone: got %d %s, want 400 validation field phone", status, body)
	}
}

func TestPatchMeRejectsNull(t *testing.T) {
	s := newCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, json.RawMessage(`{"phone":null}`))
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "phone" {
		t.Fatalf("null phone: got %d %s, want 400 validation field phone", status, body)
	}
}

// TestAuthGates sends each authenticated route anonymously and with a customer
// token. Every row gets its own customer, since sign-out ends the token it is sent with.
func TestAuthGates(t *testing.T) {
	gates := []struct {
		method, path string
		body         any
		allowed      int
	}{
		{http.MethodGet, "/api/core/v1/me", nil, http.StatusOK},
		{http.MethodPatch, "/api/core/v1/me", map[string]string{}, http.StatusOK},
		{http.MethodPost, "/api/core/v1/auth/sign-out", nil, http.StatusNoContent},
		{http.MethodGet, "/api/core/v1/me/addresses", nil, http.StatusOK},
		{http.MethodPost, "/api/core/v1/me/addresses", map[string]string{"label": "Home", "line1": "12 Main Rd", "pincode": "560034"}, http.StatusCreated},
		// No address has this id, so an allowed customer gets 404 past the gate.
		{http.MethodPatch, "/api/core/v1/me/addresses/00000000-0000-4000-8000-0000000003ff", map[string]string{}, http.StatusNotFound},
		{http.MethodDelete, "/api/core/v1/me/addresses/00000000-0000-4000-8000-0000000003ff", nil, http.StatusNotFound},
	}
	for _, g := range gates {
		if status, body := call(t, g.method, g.path, "", g.body); status != http.StatusUnauthorized || decodeError(t, body).Error.Code != "unauthorized" {
			t.Fatalf("%s %s anonymous: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
		}
		s := newCustomer(t)
		if status, body := call(t, g.method, g.path, s.Token, g.body); status != g.allowed {
			t.Fatalf("%s %s with a customer token: got %d %s, want %d", g.method, g.path, status, body, g.allowed)
		}
	}

	// Staff routes: no token and a customer token get 401; store staff and admins
	// are allowed. Each row signs in fresh, since sign-out ends the token it sends.
	seedStaff(t)
	// The stock rows use testStoreID, which the store-staff fixture belongs to:
	// a PUT with no rows gets past the gate and answers 400 rows.
	staffGates := []struct {
		method, path string
		body         any
		allowed      int
	}{
		{http.MethodPost, "/api/core/v1/admin/auth/sign-out", nil, http.StatusNoContent},
		{http.MethodGet, "/api/core/v1/admin/me", nil, http.StatusOK},
		{http.MethodGet, stockPath(testStoreID), nil, http.StatusOK},
		{http.MethodPut, stockPath(testStoreID), map[string]any{"rows": []any{}}, http.StatusBadRequest},
		// The order rows: the store's list gets 200 for its staff, an unknown order 404.
		{http.MethodGet, storeOrdersPath(testStoreID), nil, http.StatusOK},
		{http.MethodGet, adminOrderPath(missingOrderID), nil, http.StatusNotFound},
		{http.MethodPost, adminOrderPath(missingOrderID) + "/status", map[string]any{"status": "accepted"}, http.StatusNotFound},
		{http.MethodGet, dashboardPath, nil, http.StatusOK},
	}
	for _, g := range staffGates {
		if status, body := call(t, g.method, g.path, "", g.body); status != http.StatusUnauthorized || decodeError(t, body).Error.Code != "unauthorized" {
			t.Fatalf("%s %s anonymous: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
		}
		customer := newCustomer(t)
		if status, body := call(t, g.method, g.path, customer.Token, g.body); status != http.StatusUnauthorized {
			t.Fatalf("%s %s with a customer token: got %d %s, want 401", g.method, g.path, status, body)
		}
		for _, email := range []string{storeStaffEmail, adminStaffEmail} {
			if status, body := call(t, g.method, g.path, staffSignIn(t, email), g.body); status != g.allowed {
				t.Fatalf("%s %s with the staff token of %s: got %d %s, want %d", g.method, g.path, email, status, body, g.allowed)
			}
		}
	}

	// Cart and order routes: no token and a staff token get 401; a customer token
	// gets past the gate. The PUT with an empty body answers 400 storeId, the POST
	// with an empty body answers 400 validation, and the GET or the cancel of an
	// order nobody owns answers 404. None of the rows writes anything.
	cartGates := []struct {
		method, path string
		body         any
		allowed      int
	}{
		{http.MethodGet, cartPath, nil, http.StatusOK},
		{http.MethodPut, cartItemsPath, map[string]any{}, http.StatusBadRequest},
		{http.MethodDelete, cartPath, nil, http.StatusNoContent},
		{http.MethodPost, ordersPath, map[string]any{}, http.StatusBadRequest},
		{http.MethodGet, ordersPath, nil, http.StatusOK},
		{http.MethodGet, ordersPath + "/" + missingOrderID, nil, http.StatusNotFound},
		{http.MethodPost, ordersPath + "/" + missingOrderID + "/cancel", map[string]any{}, http.StatusNotFound},
	}
	for _, g := range cartGates {
		if status, body := call(t, g.method, g.path, "", g.body); status != http.StatusUnauthorized || decodeError(t, body).Error.Code != "unauthorized" {
			t.Fatalf("%s %s anonymous: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
		}
		customer := newCustomer(t)
		if status, body := call(t, g.method, g.path, customer.Token, g.body); status != g.allowed {
			t.Fatalf("%s %s with a customer token: got %d %s, want %d", g.method, g.path, status, body, g.allowed)
		}
		for _, email := range []string{storeStaffEmail, adminStaffEmail} {
			if status, body := call(t, g.method, g.path, staffSignIn(t, email), g.body); status != http.StatusUnauthorized {
				t.Fatalf("%s %s with the staff token of %s: got %d %s, want 401", g.method, g.path, email, status, body)
			}
		}
	}

	// Admin-only routes: no token and a customer token get 401; store staff get
	// 403; an admin gets past the gate (the body or id then decides the status).
	adminGates := []struct {
		method, path string
		body         any
		allowed      int
	}{
		{http.MethodGet, "/api/core/v1/admin/staff-users", nil, http.StatusOK},
		{http.MethodPost, "/api/core/v1/admin/staff-users", map[string]string{}, http.StatusBadRequest},
		{http.MethodPatch, "/api/core/v1/admin/staff-users/00000000-0000-4000-8000-0000000001ff", map[string]string{}, http.StatusNotFound},
		{http.MethodGet, categoriesPath, nil, http.StatusOK},
		{http.MethodPost, categoriesPath, map[string]string{}, http.StatusBadRequest},
		{http.MethodPatch, categoriesPath + "/" + missingCategoryID, map[string]string{}, http.StatusNotFound},
		{http.MethodDelete, categoriesPath + "/" + missingCategoryID, nil, http.StatusNotFound},
		{http.MethodGet, productsPath, nil, http.StatusOK},
		{http.MethodPost, productsPath, map[string]string{}, http.StatusBadRequest},
		{http.MethodGet, productsPath + "/" + missingProductID, nil, http.StatusNotFound},
		{http.MethodPatch, productsPath + "/" + missingProductID, map[string]string{}, http.StatusNotFound},
		{http.MethodDelete, productsPath + "/" + missingProductID, nil, http.StatusNotFound},
		// The image routes answer 404 for an unknown id before they read the body.
		{http.MethodPut, productImagePath(missingProductID), map[string]string{}, http.StatusNotFound},
		{http.MethodPut, categoryImagePath(missingCategoryID), nil, http.StatusNotFound},
		{http.MethodGet, "/api/core/v1/admin/stores", nil, http.StatusOK},
		{http.MethodPost, "/api/core/v1/admin/stores", map[string]string{}, http.StatusBadRequest},
		{http.MethodGet, "/api/core/v1/admin/stores/" + zeroID, nil, http.StatusNotFound},
		{http.MethodPatch, "/api/core/v1/admin/stores/" + zeroID, map[string]string{}, http.StatusNotFound},
		{http.MethodDelete, "/api/core/v1/admin/stores/" + zeroID, nil, http.StatusNotFound},
		{http.MethodGet, "/api/core/v1/admin/stores/" + zeroID + "/service-areas", nil, http.StatusNotFound},
		{http.MethodPut, "/api/core/v1/admin/stores/" + zeroID + "/service-areas", map[string]any{"pincodes": []string{}}, http.StatusNotFound},
	}
	for _, g := range adminGates {
		if status, body := call(t, g.method, g.path, "", g.body); status != http.StatusUnauthorized || decodeError(t, body).Error.Code != "unauthorized" {
			t.Fatalf("%s %s anonymous: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
		}
		customer := newCustomer(t)
		if status, body := call(t, g.method, g.path, customer.Token, g.body); status != http.StatusUnauthorized {
			t.Fatalf("%s %s with a customer token: got %d %s, want 401", g.method, g.path, status, body)
		}
		if status, body := call(t, g.method, g.path, staffSignIn(t, storeStaffEmail), g.body); status != http.StatusForbidden || decodeError(t, body).Error.Code != "forbidden" {
			t.Fatalf("%s %s with a store-staff token: got %d %s, want 403 forbidden", g.method, g.path, status, body)
		}
		if status, body := call(t, g.method, g.path, staffSignIn(t, adminStaffEmail), g.body); status != g.allowed {
			t.Fatalf("%s %s with an admin token: got %d %s, want %d", g.method, g.path, status, body, g.allowed)
		}
	}
}
