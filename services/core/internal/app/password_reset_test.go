package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
)

const newPassword = "newpass123"

func requestReset(t *testing.T, email string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, "/api/core/v1/auth/password-reset", "", map[string]string{"email": email})
}

func confirmReset(t *testing.T, token, password string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, "/api/core/v1/auth/password-reset/confirm", "", map[string]string{"token": token, "password": password})
}

func signInStatus(t *testing.T, email, password string) int {
	t.Helper()
	status, _ := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": password})
	return status
}

// signInAs signs in through the router and fails the test unless it answers 200.
func signInAs(t *testing.T, email, password string) sessionBody {
	t.Helper()
	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": password})
	var s sessionBody
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("sign-in %s: got %d %s, want 200", email, status, body)
	}
	return s
}

func TestPasswordReset(t *testing.T) {
	a := seedCustomer(t)
	b := signInAs(t, a.Customer.Email, testPassword).Token
	if status, body := requestReset(t, a.Customer.Email); status != http.StatusAccepted || len(body) != 0 {
		t.Fatalf("request reset: got %d %q, want 202 and no body", status, body)
	}
	sent := mails.to(a.Customer.Email)
	if len(sent) != 1 || sent[0].Subject != "Reset your ShopperStop password" {
		t.Fatalf("mail to %s: got %+v, want one reset mail", a.Customer.Email, sent)
	}
	token := mailedToken(t, mails, a.Customer.Email)
	if status, body := confirmReset(t, token, newPassword); status != http.StatusNoContent {
		t.Fatalf("confirm: got %d %s, want 204", status, body)
	}
	for _, old := range []string{a.Token, b} {
		if status, _ := call(t, http.MethodGet, "/api/core/v1/me", old, nil); status != http.StatusUnauthorized {
			t.Fatalf("GET /me with a session from before the reset: got %d, want 401", status)
		}
	}
	if got := signInStatus(t, a.Customer.Email, testPassword); got != http.StatusUnauthorized {
		t.Fatalf("sign-in with the old password: got %d, want 401", got)
	}
	s := signInAs(t, a.Customer.Email, newPassword)
	if !s.Customer.EmailVerified {
		t.Fatal("after reset: emailVerified false, want true")
	}
	status, body := confirmReset(t, token, "another123")
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "token" {
		t.Fatalf("token used twice: got %d %s, want 400 field token", status, body)
	}
}

func TestPasswordResetUnknownEmail(t *testing.T) {
	email := uniqueEmail(t)
	known := seedCustomer(t)
	unknownStatus, unknownBody := requestReset(t, email)
	knownStatus, knownBody := requestReset(t, known.Customer.Email)
	if unknownStatus != http.StatusAccepted || unknownStatus != knownStatus || string(unknownBody) != string(knownBody) {
		t.Fatalf("unknown email: got %d %q, known: %d %q, want the same 202", unknownStatus, unknownBody, knownStatus, knownBody)
	}
	if n := len(mails.to(email)); n != 0 {
		t.Fatalf("mail to an unknown email: %d, want 0", n)
	}
}

func TestPasswordResetBadInput(t *testing.T) {
	c := seedCustomer(t)
	status, body := requestReset(t, "not-an-email")
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "email" {
		t.Fatalf("bad email: got %d %s, want 400 field email", status, body)
	}
	requestReset(t, c.Customer.Email)
	token := mailedToken(t, mails, c.Customer.Email)
	status, body = confirmReset(t, token, "short")
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "password" {
		t.Fatalf("short password: got %d %s, want 400 field password", status, body)
	}
	sendVerification(t, c.Token)
	verifyToken := mailedToken(t, mails, c.Customer.Email)
	for _, bad := range []string{"", "not-a-token", verifyToken} {
		status, body := confirmReset(t, bad, newPassword)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
			t.Errorf("token %q: got %d %s, want 400 validation field token", bad, status, body)
		}
	}
	if status, body := confirmReset(t, token, newPassword); status != http.StatusNoContent {
		t.Fatalf("reset token after a refused password: got %d %s, want 204", status, body)
	}
}

func TestPasswordResetTokenExpires(t *testing.T) {
	c := seedCustomer(t)
	requestReset(t, c.Customer.Email)
	if _, err := testPool.Exec(context.Background(),
		"update customer_tokens set expires_at = now() - interval '1 second' where customer_id = $1", c.Customer.ID); err != nil {
		t.Fatal(err)
	}
	status, body := confirmReset(t, mailedToken(t, mails, c.Customer.Email), newPassword)
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "token" {
		t.Fatalf("expired token: got %d %s, want 400 field token", status, body)
	}
	if got := signInStatus(t, c.Customer.Email, testPassword); got != http.StatusOK {
		t.Fatalf("sign-in with the old password: got %d, want 200", got)
	}
}

func TestPasswordResetRateLimited(t *testing.T) {
	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), nil)
	a.Mailer = &outbox{}
	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
	defer limited.Close()
	email := uniqueEmail(t)
	for i := 1; i <= 11; i++ {
		status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/auth/password-reset", "", map[string]string{"email": email})
		want := http.StatusAccepted
		if i == 11 {
			want = http.StatusTooManyRequests
		}
		if status != want {
			t.Fatalf("attempt %d: got %d %s, want %d", i, status, body, want)
		}
	}
}
