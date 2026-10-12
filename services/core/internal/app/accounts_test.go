package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
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

// register creates a customer through the router and returns its session.
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

// newCustomer registers a fresh customer and returns its session.
func newCustomer(t *testing.T) sessionBody {
	t.Helper()
	return register(t, uniqueEmail(t))
}

var (
	sharedOnce    sync.Once
	sharedSession sessionBody
)

// sharedCustomer is one customer for tests that only read it or are refused
// before any write, so a bcrypt registration is paid once.
func sharedCustomer(t *testing.T) sessionBody {
	t.Helper()
	sharedOnce.Do(func() { sharedSession = register(t, "shared.customer@example.com") })
	return sharedSession
}

func TestRegister(t *testing.T) {
	email := uniqueEmail(t)
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "",
		map[string]string{"email": email, "password": testPassword, "name": "Asha"})
	if status != http.StatusCreated {
		t.Fatalf("register: got %d %s, want 201", status, body)
	}
	var s sessionBody
	if err := json.Unmarshal(body, &s); err != nil {
		t.Fatal(err)
	}
	if s.Token == "" || s.Customer.Email != email || s.Customer.ID == "" {
		t.Fatalf("register body %s: want a token and the customer", body)
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

func TestRegisterEmailTakenInOtherCase(t *testing.T) {
	email := uniqueEmail(t)
	register(t, email)
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
		name, email, field string
		body               map[string]string
	}{
		{"bad email", "not-an-email", "email", map[string]string{"email": "not-an-email", "password": testPassword, "name": "Asha"}},
		{"blank name", "", "name", map[string]string{"email": uniqueEmail(t), "password": testPassword, "name": "   "}},
	}
	for _, c := range cases {
		status, body := call(t, http.MethodPost, "/api/core/v1/auth/register", "", c.body)
		e := decodeError(t, body)
		if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != c.field {
			t.Fatalf("%s: got %d %s, want 400 validation field %s", c.name, status, body, c.field)
		}
	}
}

func TestPasswordStoredAsBcrypt12(t *testing.T) {
	s := newCustomer(t)
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
	first := register(t, email)
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

func TestSignInFailuresLookTheSame(t *testing.T) {
	email := uniqueEmail(t)
	register(t, email)
	wrongStatus, wrongBody := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": email, "password": "wrong-password"})
	unknownStatus, unknownBody := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "",
		map[string]string{"email": "nobody." + email, "password": testPassword})
	if wrongStatus != http.StatusUnauthorized || unknownStatus != http.StatusUnauthorized {
		t.Fatalf("wrong password %d, unknown email %d: want both 401", wrongStatus, unknownStatus)
	}
	wrong, unknown := decodeError(t, wrongBody), decodeError(t, unknownBody)
	if wrong.Error.Code != "unauthorized" || wrong.Error.Message != "wrong email or password" {
		t.Fatalf("wrong password body %s: want unauthorized and the shared message", wrongBody)
	}
	if wrong != unknown {
		t.Fatalf("messages differ: wrong password %+v, unknown email %+v", wrong, unknown)
	}
}

func TestSignOutEndsOnlyThatSession(t *testing.T) {
	email := uniqueEmail(t)
	a := register(t, email)
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
	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now))
	limited := httptest.NewServer(New(testPool, nil, a))
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
	s := sharedCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, map[string]string{"phone": "call me"})
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "phone" {
		t.Fatalf("bad phone: got %d %s, want 400 validation field phone", status, body)
	}
}

func TestPatchMeRejectsNull(t *testing.T) {
	s := sharedCustomer(t)
	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token, json.RawMessage(`{"phone":null}`))
	e := decodeError(t, body)
	if status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "phone" {
		t.Fatalf("null phone: got %d %s, want 400 validation field phone", status, body)
	}
}

// TestAuthGates sends each authenticated route anonymously and with a customer
// token. Sign-out ends the token it is given, so that row gets its own customer.
func TestAuthGates(t *testing.T) {
	gates := []struct {
		method, path string
		body         any
		allowed      int
		ends         bool // ends the session it is sent with
	}{
		{http.MethodGet, "/api/core/v1/me", nil, http.StatusOK, false},
		{http.MethodPatch, "/api/core/v1/me", map[string]string{}, http.StatusOK, false},
		{http.MethodPost, "/api/core/v1/auth/sign-out", nil, http.StatusNoContent, true},
	}
	for _, g := range gates {
		if status, body := call(t, g.method, g.path, "", g.body); status != http.StatusUnauthorized || decodeError(t, body).Error.Code != "unauthorized" {
			t.Fatalf("%s %s anonymous: got %d %s, want 401 unauthorized", g.method, g.path, status, body)
		}
		s := sharedCustomer(t)
		if g.ends {
			s = newCustomer(t)
		}
		if status, body := call(t, g.method, g.path, s.Token, g.body); status != g.allowed {
			t.Fatalf("%s %s with a customer token: got %d %s, want %d", g.method, g.path, status, body, g.allowed)
		}
	}
}
