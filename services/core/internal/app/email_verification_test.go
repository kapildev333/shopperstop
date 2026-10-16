package app

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
)

// outbox is the test mailer: it keeps every mail it is given.
type outbox struct {
	mu   sync.Mutex
	sent []auth.Mail
}

func (o *outbox) Send(_ context.Context, m auth.Mail) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.sent = append(o.sent, m)
	return nil
}

// to returns the mail sent to address, oldest first.
func (o *outbox) to(address string) []auth.Mail {
	o.mu.Lock()
	defer o.mu.Unlock()
	var out []auth.Mail
	for _, m := range o.sent {
		if m.To == address {
			out = append(out, m)
		}
	}
	return out
}

// mailedToken is the token in the newest mail to address: the body's last word.
func mailedToken(t *testing.T, o *outbox, address string) string {
	t.Helper()
	sent := o.to(address)
	if len(sent) == 0 {
		t.Fatalf("no mail to %s", address)
	}
	body := sent[len(sent)-1].Body
	return body[strings.LastIndex(body, " ")+1:]
}

// me reads GET /me with token.
func me(t *testing.T, token string) sessionBody {
	t.Helper()
	status, body := call(t, http.MethodGet, "/api/core/v1/me", token, nil)
	var s sessionBody
	if status != http.StatusOK || json.Unmarshal(body, &s.Customer) != nil {
		t.Fatalf("GET /me: got %d %s, want 200", status, body)
	}
	return s
}

func sendVerification(t *testing.T, token string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, "/api/core/v1/me/email-verification", token, nil)
}

func verifyEmail(t *testing.T, token string) (int, []byte) {
	t.Helper()
	return call(t, http.MethodPost, "/api/core/v1/auth/verify-email", "", map[string]string{"token": token})
}

func TestRegisteredCustomerIsUnverified(t *testing.T) {
	s := register(t, uniqueEmail(t))
	if s.Customer.EmailVerified || me(t, s.Token).Customer.EmailVerified {
		t.Fatalf("new customer: emailVerified true, want false")
	}
	var raw map[string]json.RawMessage
	_, body := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil)
	if json.Unmarshal(body, &raw) != nil || string(raw["emailVerified"]) != "false" {
		t.Fatalf("GET /me %s: want emailVerified present and false", body)
	}
}

func TestEmailVerification(t *testing.T) {
	c := seedCustomer(t)
	if status, body := sendVerification(t, c.Token); status != http.StatusAccepted {
		t.Fatalf("send verification: got %d %s, want 202", status, body)
	}
	sent := mails.to(c.Customer.Email)
	if len(sent) != 1 || sent[0].Subject != "Verify your ShopperStop email" {
		t.Fatalf("mail to %s: got %+v, want one verification mail", c.Customer.Email, sent)
	}
	token := mailedToken(t, mails, c.Customer.Email)
	if status, body := verifyEmail(t, token); status != http.StatusNoContent {
		t.Fatalf("verify: got %d %s, want 204", status, body)
	}
	if !me(t, c.Token).Customer.EmailVerified {
		t.Fatal("after verify: emailVerified false, want true")
	}
	status, body := verifyEmail(t, token)
	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
		t.Fatalf("token used twice: got %d %s, want 400 validation field token", status, body)
	}
	status, body = sendVerification(t, c.Token)
	if e := decodeError(t, body); status != http.StatusConflict || e.Error.Code != "conflict" || len(mails.to(c.Customer.Email)) != 1 {
		t.Fatalf("send when verified: got %d %s, want 409 conflict and no new mail", status, body)
	}
}

func TestVerifyEmailBadToken(t *testing.T) {
	c := seedCustomer(t)
	if status, body := sendVerification(t, c.Token); status != http.StatusAccepted {
		t.Fatalf("send verification: got %d %s, want 202", status, body)
	}
	if _, err := testPool.Exec(context.Background(),
		"update customer_tokens set expires_at = now() - interval '1 second' where customer_id = $1", c.Customer.ID); err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{"", "not-a-token", mailedToken(t, mails, c.Customer.Email)} {
		status, body := verifyEmail(t, token)
		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
			t.Errorf("token %q: got %d %s, want 400 validation field token", token, status, body)
		}
	}
	if me(t, c.Token).Customer.EmailVerified {
		t.Fatal("after bad tokens: emailVerified true, want false")
	}
}

func TestNewVerificationTokenReplacesOld(t *testing.T) {
	c := seedCustomer(t)
	sendVerification(t, c.Token)
	first := mailedToken(t, mails, c.Customer.Email)
	sendVerification(t, c.Token)
	second := mailedToken(t, mails, c.Customer.Email)
	if status, body := verifyEmail(t, first); status != http.StatusBadRequest {
		t.Fatalf("replaced token: got %d %s, want 400", status, body)
	}
	if status, body := verifyEmail(t, second); status != http.StatusNoContent {
		t.Fatalf("newest token: got %d %s, want 204", status, body)
	}
}

func TestMailedTokenStoredHashed(t *testing.T) {
	c := seedCustomer(t)
	sendVerification(t, c.Token)
	token := mailedToken(t, mails, c.Customer.Email)
	want := sha256.Sum256(append([]byte(token), testPepper...))
	var n int
	var expiresInHours float64
	if err := testPool.QueryRow(context.Background(),
		`select count(*), coalesce(max(extract(epoch from expires_at - now()) / 3600), 0)::float8 from customer_tokens t
		 where customer_id = $1 and token_hash = $2 and purpose = 'verify_email'
		   and position($3 in t::text) = 0`, c.Customer.ID, want[:], token).Scan(&n, &expiresInHours); err != nil {
		t.Fatal(err)
	}
	if n != 1 || expiresInHours < 23.9 || expiresInHours > 24 {
		t.Fatalf("token rows: %d expiring in %.2f h, want one hashed row expiring in 24 h", n, expiresInHours)
	}
}
