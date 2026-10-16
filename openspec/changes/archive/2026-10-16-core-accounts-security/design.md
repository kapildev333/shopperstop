## Context

Customers, sessions and the limiter live in `internal/auth` (`auth.go`: `Auth`, `newToken`, `tokenHash`, `startSession`; `customer.go`: `Customer`, `checkEmail`, `checkPasswordLength`, `refused`, the customer handlers). Session tokens are 32 random bytes, stored as `sha256(token || pepper)`. `startSession` already deletes every expired session (core-P3-L3, accounts "Expired sessions are deleted"), so the sweep D46 lists is done. `auth.New` has twelve callers (main, app and seed tests); the limiter's `TrustProxy` shows the pattern of an exported field set after `New`. `seed.Reset` truncates a fixed table list; Postgres refuses to truncate `customers` while an unlisted table references it. `core-admin seed-demo` loads config, opens a pool and loads, with no host check; every caller (Makefile `seed`, `e2e`, the four apps' Playwright global setups, CI) uses `localhost`.

Everything below was spiked in this worktree at 49553f4 and the tree restored before the commit: every package green under `-race -count=1` after each task; `make gen postman` clean; `make test-web`: `packages/ui`, web, admin and rider typecheck; mobile fails only as "Cross-area" says. Each task's diff applies with `git apply` on the previous task (checked as a chain, and Task 3 alone).

## Goals / Non-Goals

**Goals:** verification and reset with codes hashed at rest, single use, 24 h, one live code per purpose; reset ends every session; reset requests never reveal whether an email is registered; a guard on `seed-demo` against a remote database; no new dependency.

**Non-Goals:** a mail transport; staff password reset; the app screens; gating anything on `emailVerified`; changing the email.

## Decisions

### 1. Mailer: one interface, a logging implementation, a test fake

`auth.Mailer{Send(ctx, Mail) error}` with `Mail{To, Subject, Body}`; `auth.LogMailer` logs `mail` with `to`, `subject`, `body` at info. `Auth.Mailer` is an exported field that `New` sets to `LogMailer{}`, so no caller of `New` changes; tests assign their `outbox` fake. Ceiling: the log holds live codes; a real transport replaces `LogMailer` before core serves real customers (`ponytail:` comment in `mail.go`). Mail is sent synchronously inside the request.

### 2. One table for both purposes, one row per customer and purpose

`customer_tokens(token_hash unique, customer_id, purpose, expires_at)` with a unique index on `(customer_id, purpose)`. Issuing is an upsert (`on conflict ... do update`), so a new code replaces the old one in one statement and the table never holds more than two rows per customer: no sweep needed (simplification; ceiling: none at this size). Consuming is `delete ... where token_hash = $1 and purpose = $2 and expires_at > now() returning customer_id`: single use and expiry in one statement, and a code of the other purpose finds no row. The code is `newToken()` and the hash `tokenHash()`, the session helpers. A code is the last word of the mail body (no link: there is no web page yet; the follow-up builds one).

### 3. Verification

`POST /me/email-verification` (RequireCustomer, no body) reads the customer, answers 409 `conflict` "email already verified" when verified, else mails and answers 202. No rate limit (simplification): a signed-in customer can only mail themself; ceiling: unbounded resends per session. `POST /auth/verify-email` is public (the code is the proof) and runs consume + `email_verified = true` in one transaction, answering 204. An empty token is 400 field `token` "is required"; any code that consumes nothing is 400 field `token` "invalid or expired token" (one message: the answer does not say which).

### 4. Reset

`POST /auth/password-reset` reads `{email}`, counts the attempt with `refused` against `Auth.ResetLimit`, a second `Limiter` built in `main` with the sign-in numbers (10 per email, 100 per IP, an hour), so reset requests have their own budget and never consume a customer's sign-in attempts (`ResetLimit` is an exported field set after `New`, like `Mailer` and `TrustProxy`; nil admits every request), validates the email (400 field `email`), looks the customer up and mails only when found, and answers 202 with no body either way. A failure to issue or mail the code for a found email is logged with slog (customer id and error, never the code) and still answers 202, so a mail outage never shows as a difference. Ceiling: an unknown email answers sooner (no upsert, no mail); a queued mailer closes that gap. `POST /auth/password-reset/confirm` checks the password length first (400 field `password`, code not spent), then in one transaction consumes the code, hashes (bcrypt 12, so no hash is paid for a bad code), sets the password and `email_verified = true` (the code proved the address), and deletes every customer session of that customer; 204. The confirm route is not rate limited: a 43-character random code cannot be guessed, and a bad code costs one indexed delete.

### 5. `emailVerified` is required in `Customer`

It is a boolean that is always present (`isActive` on `Staff` is the precedent), so the schema lists it in `required`; marking it optional would make `core.d.ts` lie. The cost is one mobile fixture line (see "Cross-area").

### 6. Seed

`customer_tokens` joins `truncateTables` (otherwise `truncate customers` fails); the demo customer is inserted with `email_verified` true, so demo and e2e flows see a verified customer.

### 7. `seed-demo` guard

`localDatabase(url)` parses with `pgconn.ParseConfig` (pgx, already a dependency) and accepts only hosts `localhost`, `127.0.0.1`, `::1` or a path (Unix socket directory) for the host and every fallback host. It runs after `config.Load`, before the pool opens. It guards plain `seed-demo` too, not only `--reset` (decision beyond the request): a plain load into a shared database would create the demo admin with its public password. `--force` skips it. Flags: `--reset` and `--force`, each at most once, in any order; anything else prints usage and exits 2. Ceiling: a remote database reached through an SSH tunnel on `localhost` passes; the guard stops slips, not intent.

### 8. `openapi.json` edits by script

Two Python scripts below, run once from `services/core`, never committed; save each to a scratchpad file not named after a stdlib module. Task 1's script also carries platform-P4-L3's mechanical reorder (relayed by the manager): the `rider` request example of `POST /admin/orders/{id}/status` before the `staff` one. `openapi.json` round-trips byte for byte through `json.dumps(d, indent=2, ensure_ascii=False) + '\n'`.

### Cross-area: one mobile line

`apps/mobile/src/profile-sheet.test.tsx` line 7 builds `customer` without `emailVerified` and passes it as `Customer`; with Task 1's `core.d.ts`, `tsc` fails with TS2741 at lines 15, 32 and 46. The fix, which typechecks against main's `core.d.ts` and the new one (a variable, so no excess-property check) and keeps the three tests green (spiked both ways):

```ts
const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao', emailVerified: false }
```

It must be on main before this branch merges; until then `make test-web` on this branch fails only with those three TS2741 lines in `apps/mobile`.

### Landing note (manager, from platform-P4-L3)

platform-P4-L3 also regenerates `docs/postman/`. Whichever merges second merges `origin/main`, re-runs `make postman` and commits the collection before its PR.

## Risks / Trade-offs

- [Mobile fixture line] → blocks the merge, not the build; one line, spiked.
- [Codes in the dev log] → acceptable while there are no real customers (Decision 1).
- [Reset timing reveals registration] → named ceiling (Decision 4).
- [Separate reset limiter] → a reset flood from one IP is refused at its own 100 per hour, and an email's sign-in budget is untouched; the two budgets sit side by side per process, so an IP may make 200 attempts an hour across both routes.

## Code (verbatim diffs from the spike)

Apply each block with `git apply` from the worktree root (save it to a scratchpad file first). Generated files are not shown: after the SQL edits run `make gen` (sqlc, then `core.d.ts`), after the `openapi.json` script run `make gen postman`.

## Task 1: email verification

Each task's block holds its tests and its code. Split them with `git apply --include='*_test.go' <file>` (the test commit) and then `git apply --exclude='*_test.go' <file>` (the feat commit).

```diff
diff --git a/services/core/internal/app/accounts_test.go b/services/core/internal/app/accounts_test.go
index 1b485bd..b03dc0c 100644
--- a/services/core/internal/app/accounts_test.go
+++ b/services/core/internal/app/accounts_test.go
@@ -34,10 +34,11 @@ func uniqueEmail(t *testing.T) string {
 type sessionBody struct {
 	Token    string `json:"token"`
 	Customer struct {
-		ID    string `json:"id"`
-		Email string `json:"email"`
-		Name  string `json:"name"`
-		Phone string `json:"phone"`
+		ID            string `json:"id"`
+		Email         string `json:"email"`
+		Name          string `json:"name"`
+		Phone         string `json:"phone"`
+		EmailVerified bool   `json:"emailVerified"`
 	} `json:"customer"`
 }
 
diff --git a/services/core/internal/app/app.go b/services/core/internal/app/app.go
index f4964bc..bae125c 100644
--- a/services/core/internal/app/app.go
+++ b/services/core/internal/app/app.go
@@ -37,8 +37,10 @@ func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) c
 	r.Post("/api/core/v1/auth/register", a.Register)
 	r.Post("/api/core/v1/auth/sign-in", a.SignIn)
 	r.With(a.RequireCustomer).Post("/api/core/v1/auth/sign-out", a.SignOut)
+	r.Post("/api/core/v1/auth/verify-email", a.VerifyEmail)
 	r.With(a.RequireCustomer).Get("/api/core/v1/me", a.Me)
 	r.With(a.RequireCustomer).Patch("/api/core/v1/me", a.UpdateMe)
+	r.With(a.RequireCustomer).Post("/api/core/v1/me/email-verification", a.SendEmailVerification)
 	r.With(a.RequireCustomer).Get("/api/core/v1/me/addresses", address.List(pool))
 	r.With(a.RequireCustomer).Post("/api/core/v1/me/addresses", address.Create(pool))
 	r.With(a.RequireCustomer).Patch("/api/core/v1/me/addresses/{id}", address.Update(pool))
diff --git a/services/core/internal/app/app_test.go b/services/core/internal/app/app_test.go
index 6ac263d..127e845 100644
--- a/services/core/internal/app/app_test.go
+++ b/services/core/internal/app/app_test.go
@@ -33,6 +33,8 @@ var (
 	testPool *pgxpool.Pool
 	// filesDir is the files directory every test server stores uploads in.
 	filesDir string
+	// mails captures the mail the shared server sends.
+	mails = &outbox{}
 )
 
 func TestMain(m *testing.M) {
@@ -49,6 +51,7 @@ func TestMain(m *testing.M) {
 		panic(err)
 	}
 	a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), map[string]string{"rider": testServiceToken})
+	a.Mailer = mails
 	srv = httptest.NewServer(New(testPool, []string{"http://localhost:5173"}, a, blob.Disk{Dir: filesDir}))
 	code := m.Run()
 	srv.Close()
diff --git a/services/core/internal/app/email_verification_test.go b/services/core/internal/app/email_verification_test.go
new file mode 100644
index 0000000..199e3ca
--- /dev/null
+++ b/services/core/internal/app/email_verification_test.go
@@ -0,0 +1,161 @@
+package app
+
+import (
+	"context"
+	"crypto/sha256"
+	"encoding/json"
+	"net/http"
+	"strings"
+	"sync"
+	"testing"
+
+	"github.com/kapildev333/shopperstop/services/core/internal/auth"
+)
+
+// outbox is the test mailer: it keeps every mail it is given.
+type outbox struct {
+	mu   sync.Mutex
+	sent []auth.Mail
+}
+
+func (o *outbox) Send(_ context.Context, m auth.Mail) error {
+	o.mu.Lock()
+	defer o.mu.Unlock()
+	o.sent = append(o.sent, m)
+	return nil
+}
+
+// to returns the mail sent to address, oldest first.
+func (o *outbox) to(address string) []auth.Mail {
+	o.mu.Lock()
+	defer o.mu.Unlock()
+	var out []auth.Mail
+	for _, m := range o.sent {
+		if m.To == address {
+			out = append(out, m)
+		}
+	}
+	return out
+}
+
+// mailedToken is the token in the newest mail to address: the body's last word.
+func mailedToken(t *testing.T, o *outbox, address string) string {
+	t.Helper()
+	sent := o.to(address)
+	if len(sent) == 0 {
+		t.Fatalf("no mail to %s", address)
+	}
+	body := sent[len(sent)-1].Body
+	return body[strings.LastIndex(body, " ")+1:]
+}
+
+// me reads GET /me with token.
+func me(t *testing.T, token string) sessionBody {
+	t.Helper()
+	status, body := call(t, http.MethodGet, "/api/core/v1/me", token, nil)
+	var s sessionBody
+	if status != http.StatusOK || json.Unmarshal(body, &s.Customer) != nil {
+		t.Fatalf("GET /me: got %d %s, want 200", status, body)
+	}
+	return s
+}
+
+func sendVerification(t *testing.T, token string) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, "/api/core/v1/me/email-verification", token, nil)
+}
+
+func verifyEmail(t *testing.T, token string) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, "/api/core/v1/auth/verify-email", "", map[string]string{"token": token})
+}
+
+func TestRegisteredCustomerIsUnverified(t *testing.T) {
+	s := register(t, uniqueEmail(t))
+	if s.Customer.EmailVerified || me(t, s.Token).Customer.EmailVerified {
+		t.Fatalf("new customer: emailVerified true, want false")
+	}
+	var raw map[string]json.RawMessage
+	_, body := call(t, http.MethodGet, "/api/core/v1/me", s.Token, nil)
+	if json.Unmarshal(body, &raw) != nil || string(raw["emailVerified"]) != "false" {
+		t.Fatalf("GET /me %s: want emailVerified present and false", body)
+	}
+}
+
+func TestEmailVerification(t *testing.T) {
+	c := seedCustomer(t)
+	if status, body := sendVerification(t, c.Token); status != http.StatusAccepted {
+		t.Fatalf("send verification: got %d %s, want 202", status, body)
+	}
+	sent := mails.to(c.Customer.Email)
+	if len(sent) != 1 || sent[0].Subject != "Verify your ShopperStop email" {
+		t.Fatalf("mail to %s: got %+v, want one verification mail", c.Customer.Email, sent)
+	}
+	token := mailedToken(t, mails, c.Customer.Email)
+	if status, body := verifyEmail(t, token); status != http.StatusNoContent {
+		t.Fatalf("verify: got %d %s, want 204", status, body)
+	}
+	if !me(t, c.Token).Customer.EmailVerified {
+		t.Fatal("after verify: emailVerified false, want true")
+	}
+	status, body := verifyEmail(t, token)
+	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
+		t.Fatalf("token used twice: got %d %s, want 400 validation field token", status, body)
+	}
+	status, body = sendVerification(t, c.Token)
+	if e := decodeError(t, body); status != http.StatusConflict || e.Error.Code != "conflict" || len(mails.to(c.Customer.Email)) != 1 {
+		t.Fatalf("send when verified: got %d %s, want 409 conflict and no new mail", status, body)
+	}
+}
+
+func TestVerifyEmailBadToken(t *testing.T) {
+	c := seedCustomer(t)
+	if status, body := sendVerification(t, c.Token); status != http.StatusAccepted {
+		t.Fatalf("send verification: got %d %s, want 202", status, body)
+	}
+	if _, err := testPool.Exec(context.Background(),
+		"update customer_tokens set expires_at = now() - interval '1 second' where customer_id = $1", c.Customer.ID); err != nil {
+		t.Fatal(err)
+	}
+	for _, token := range []string{"", "not-a-token", mailedToken(t, mails, c.Customer.Email)} {
+		status, body := verifyEmail(t, token)
+		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
+			t.Errorf("token %q: got %d %s, want 400 validation field token", token, status, body)
+		}
+	}
+	if me(t, c.Token).Customer.EmailVerified {
+		t.Fatal("after bad tokens: emailVerified true, want false")
+	}
+}
+
+func TestNewVerificationTokenReplacesOld(t *testing.T) {
+	c := seedCustomer(t)
+	sendVerification(t, c.Token)
+	first := mailedToken(t, mails, c.Customer.Email)
+	sendVerification(t, c.Token)
+	second := mailedToken(t, mails, c.Customer.Email)
+	if status, body := verifyEmail(t, first); status != http.StatusBadRequest {
+		t.Fatalf("replaced token: got %d %s, want 400", status, body)
+	}
+	if status, body := verifyEmail(t, second); status != http.StatusNoContent {
+		t.Fatalf("newest token: got %d %s, want 204", status, body)
+	}
+}
+
+func TestMailedTokenStoredHashed(t *testing.T) {
+	c := seedCustomer(t)
+	sendVerification(t, c.Token)
+	token := mailedToken(t, mails, c.Customer.Email)
+	want := sha256.Sum256(append([]byte(token), testPepper...))
+	var n int
+	var expiresInHours float64
+	if err := testPool.QueryRow(context.Background(),
+		`select count(*), coalesce(max(extract(epoch from expires_at - now()) / 3600), 0)::float8 from customer_tokens t
+		 where customer_id = $1 and token_hash = $2 and purpose = 'verify_email'
+		   and position($3 in t::text) = 0`, c.Customer.ID, want[:], token).Scan(&n, &expiresInHours); err != nil {
+		t.Fatal(err)
+	}
+	if n != 1 || expiresInHours < 23.9 || expiresInHours > 24 {
+		t.Fatalf("token rows: %d expiring in %.2f h, want one hashed row expiring in 24 h", n, expiresInHours)
+	}
+}
diff --git a/services/core/internal/auth/account.go b/services/core/internal/auth/account.go
new file mode 100644
index 0000000..b75455f
--- /dev/null
+++ b/services/core/internal/auth/account.go
@@ -0,0 +1,101 @@
+package auth
+
+import (
+	"context"
+	"errors"
+	"net/http"
+
+	"github.com/jackc/pgx/v5"
+
+	"github.com/kapildev333/shopperstop/services/core/internal/auth/db"
+	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
+	"github.com/kapildev333/shopperstop/services/core/internal/pg"
+)
+
+// Purposes of a mailed token (customer_tokens.purpose). A token works only for its own.
+const (
+	purposeVerifyEmail   = "verify_email"
+	purposeResetPassword = "reset_password"
+)
+
+var (
+	errBadToken        = invalid("token", "invalid or expired token")
+	errAlreadyVerified = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "email already verified"}
+)
+
+type tokenRequest struct {
+	Token string `json:"token"`
+}
+
+// mailToken issues a 24-hour token for the customer and purpose, replacing any
+// earlier one of that purpose, and mails it as the last word of the body.
+func (a *Auth) mailToken(ctx context.Context, customerID, email, purpose, subject, text string) error {
+	token, err := newToken()
+	if err != nil {
+		return err
+	}
+	if err := a.q.IssueCustomerToken(ctx, db.IssueCustomerTokenParams{
+		TokenHash: a.tokenHash(token), CustomerID: customerID, Purpose: purpose,
+	}); err != nil {
+		return err
+	}
+	return a.Mailer.Send(ctx, Mail{To: email, Subject: subject, Body: text + " " + token})
+}
+
+// consumeToken deletes the live token of this purpose in tx and returns its
+// customer; an empty, unknown, used or expired token is 400 field token.
+func (a *Auth) consumeToken(ctx context.Context, q *db.Queries, token, purpose string) (string, error) {
+	if token == "" {
+		return "", invalid("token", "is required")
+	}
+	id, err := q.ConsumeCustomerToken(ctx, db.ConsumeCustomerTokenParams{TokenHash: a.tokenHash(token), Purpose: purpose})
+	if errors.Is(err, pgx.ErrNoRows) {
+		return "", errBadToken
+	}
+	return id, err
+}
+
+// SendEmailVerification mails the signed-in customer a verification token and
+// answers 202; a customer already verified gets 409 and no mail.
+func (a *Auth) SendEmailVerification(w http.ResponseWriter, r *http.Request) {
+	ctx := r.Context()
+	row, err := a.q.CustomerByID(ctx, CustomerID(ctx))
+	if err != nil {
+		httpx.WriteError(w, r, pg.Map(err))
+		return
+	}
+	if row.EmailVerified {
+		httpx.WriteError(w, r, errAlreadyVerified)
+		return
+	}
+	if err := a.mailToken(ctx, row.ID, row.Email, purposeVerifyEmail,
+		"Verify your ShopperStop email", "Use this code within 24 hours to verify your email:"); err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	w.WriteHeader(http.StatusAccepted)
+}
+
+// VerifyEmail spends a verification token, marks its customer's email
+// verified and answers 204. No session is needed: the token is the proof.
+func (a *Auth) VerifyEmail(w http.ResponseWriter, r *http.Request) {
+	var in tokenRequest
+	if err := httpx.ReadJSON(w, r, &in); err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	ctx := r.Context()
+	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
+		q := a.q.WithTx(tx)
+		id, err := a.consumeToken(ctx, q, in.Token, purposeVerifyEmail)
+		if err != nil {
+			return err
+		}
+		return q.VerifyCustomerEmail(ctx, id)
+	})
+	if err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	w.WriteHeader(http.StatusNoContent)
+}
diff --git a/services/core/internal/auth/auth.go b/services/core/internal/auth/auth.go
index c3c16d7..cfd9236 100644
--- a/services/core/internal/auth/auth.go
+++ b/services/core/internal/auth/auth.go
@@ -22,6 +22,10 @@ import (
 
 // Auth holds what the handlers and middleware need.
 type Auth struct {
+	// Mailer sends the verification and password reset mail. New sets
+	// LogMailer; tests replace it before serving.
+	Mailer Mailer
+
 	pool     *pgxpool.Pool
 	q        *db.Queries
 	pepper   []byte
@@ -38,7 +42,7 @@ type service struct {
 // New returns the auth service over pool. pepper is mixed into every token hash.
 // services maps a service name to its token (config.ServiceTokens); nil admits none.
 func New(pool *pgxpool.Pool, pepper string, limit *Limiter, services map[string]string) *Auth {
-	a := &Auth{pool: pool, q: db.New(pool), pepper: []byte(pepper), limit: limit}
+	a := &Auth{Mailer: LogMailer{}, pool: pool, q: db.New(pool), pepper: []byte(pepper), limit: limit}
 	for name, token := range services {
 		a.services = append(a.services, service{name: name, hash: sha256.Sum256([]byte(token))})
 	}
diff --git a/services/core/internal/auth/customer.go b/services/core/internal/auth/customer.go
index a233f37..d06081c 100644
--- a/services/core/internal/auth/customer.go
+++ b/services/core/internal/auth/customer.go
@@ -20,10 +20,11 @@ import (
 
 // Customer is a customer as the API shows it. Phone is omitted when empty.
 type Customer struct {
-	ID    string `json:"id"`
-	Email string `json:"email"`
-	Name  string `json:"name"`
-	Phone string `json:"phone,omitempty"`
+	ID            string `json:"id"`
+	Email         string `json:"email"`
+	Name          string `json:"name"`
+	Phone         string `json:"phone,omitempty"`
+	EmailVerified bool   `json:"emailVerified"`
 }
 
 // customerSession is the body of register (201) and sign-in (200).
@@ -167,7 +168,7 @@ func (a *Auth) Register(w http.ResponseWriter, r *http.Request) {
 	}
 	httpx.WriteJSON(w, http.StatusCreated, customerSession{
 		Token:    token,
-		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone},
+		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified},
 	})
 }
 
@@ -212,7 +213,7 @@ func (a *Auth) SignIn(w http.ResponseWriter, r *http.Request) {
 	}
 	httpx.WriteJSON(w, http.StatusOK, customerSession{
 		Token:    token,
-		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone},
+		Customer: Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified},
 	})
 }
 
@@ -244,7 +245,7 @@ func (a *Auth) Me(w http.ResponseWriter, r *http.Request) {
 		httpx.WriteError(w, r, pg.Map(err))
 		return
 	}
-	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone})
+	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified})
 }
 
 // UpdateMe changes the fields present in the body and answers 200 with the
@@ -272,7 +273,7 @@ func (a *Auth) UpdateMe(w http.ResponseWriter, r *http.Request) {
 		httpx.WriteError(w, r, pg.Map(err))
 		return
 	}
-	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone})
+	httpx.WriteJSON(w, http.StatusOK, Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified})
 }
 
 // CustomerByID answers the customer with this id, for placing an order; an
@@ -282,5 +283,5 @@ func CustomerByID(ctx context.Context, d db.DBTX, id string) (Customer, error) {
 	if err != nil {
 		return Customer{}, pg.Map(err)
 	}
-	return Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone}, nil
+	return Customer{ID: row.ID, Email: row.Email, Name: row.Name, Phone: row.Phone, EmailVerified: row.EmailVerified}, nil
 }
diff --git a/services/core/internal/auth/mail.go b/services/core/internal/auth/mail.go
new file mode 100644
index 0000000..295973c
--- /dev/null
+++ b/services/core/internal/auth/mail.go
@@ -0,0 +1,30 @@
+package auth
+
+import (
+	"context"
+	"log/slog"
+)
+
+// Mail is one message to one address.
+type Mail struct {
+	To      string
+	Subject string
+	Body    string
+}
+
+// Mailer sends mail. Core has no mail transport yet: mail is a process
+// boundary, so the service logs it (LogMailer) and tests capture it.
+type Mailer interface {
+	Send(ctx context.Context, m Mail) error
+}
+
+// LogMailer writes every message, its token included, to the log at info.
+// ponytail: development only, the log carries live tokens; a real transport
+// (SMTP or a provider's API) replaces it before core serves real customers.
+type LogMailer struct{}
+
+// Send logs m and never fails.
+func (LogMailer) Send(ctx context.Context, m Mail) error {
+	slog.InfoContext(ctx, "mail", "to", m.To, "subject", m.Subject, "body", m.Body)
+	return nil
+}
diff --git a/services/core/internal/auth/mail_test.go b/services/core/internal/auth/mail_test.go
new file mode 100644
index 0000000..17cd3d9
--- /dev/null
+++ b/services/core/internal/auth/mail_test.go
@@ -0,0 +1,25 @@
+package auth
+
+import (
+	"bytes"
+	"context"
+	"encoding/json"
+	"log/slog"
+	"testing"
+)
+
+func TestLogMailerLogsTheMessage(t *testing.T) {
+	var buf bytes.Buffer
+	prev := slog.Default()
+	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
+	t.Cleanup(func() { slog.SetDefault(prev) })
+
+	m := Mail{To: "asha@example.com", Subject: "Verify your ShopperStop email", Body: "Use this code: abc"}
+	if err := (LogMailer{}).Send(context.Background(), m); err != nil {
+		t.Fatal(err)
+	}
+	var line struct{ Msg, To, Subject, Body string }
+	if err := json.Unmarshal(buf.Bytes(), &line); err != nil || line.Msg != "mail" || line.To != m.To || line.Subject != m.Subject || line.Body != m.Body {
+		t.Fatalf("log line %s: want msg mail with to, subject and body", buf.Bytes())
+	}
+}
diff --git a/services/core/internal/seed/seed.go b/services/core/internal/seed/seed.go
index ba0ae7d..7f27667 100644
--- a/services/core/internal/seed/seed.go
+++ b/services/core/internal/seed/seed.go
@@ -20,7 +20,7 @@ import (
 )
 
 // truncateTables is every table Reset empties, in one statement. Later lanes add theirs here.
-var truncateTables = []string{"sessions", "addresses", "customers", "staff_users", "store_service_areas", "stores",
+var truncateTables = []string{"sessions", "customer_tokens", "addresses", "customers", "staff_users", "store_service_areas", "stores",
 	// catalog (core-P2-L3)
 	"products", "categories",
 	// stock and cart (core-P2-L4)
@@ -110,7 +110,7 @@ func load(ctx context.Context, tx pgx.Tx, h hashes) error {
 		return fmt.Errorf("insert demo admin: %w", err)
 	}
 	if _, err := tx.Exec(ctx,
-		"insert into customers (id, email, password_hash, name, phone) values ($1, $2, $3, 'Demo Customer', '+919800000000')",
+		"insert into customers (id, email, password_hash, name, phone, email_verified) values ($1, $2, $3, 'Demo Customer', '+919800000000', true)",
 		customerID, customerEmail, h.customer); err != nil {
 		return fmt.Errorf("insert demo customer: %w", err)
 	}
diff --git a/services/core/internal/seed/seed_test.go b/services/core/internal/seed/seed_test.go
index db02838..b218b9d 100644
--- a/services/core/internal/seed/seed_test.go
+++ b/services/core/internal/seed/seed_test.go
@@ -58,6 +58,7 @@ func addOtherRows(t *testing.T) {
 		`insert into addresses (customer_id, label, line1, pincode, is_default) values ('00000000-0000-4000-8000-000000000999', 'Home', 'Elsewhere', '110001', true)`,
 		`insert into staff_users (email, password_hash, name, role) values ('stray@example.com', 'x', 'Stray', 'admin')`,
 		`insert into sessions (token_hash, subject_type, subject_id, expires_at) values (decode('0102', 'hex'), 'customer', '00000000-0000-4000-8000-000000000999', now() + interval '1 day')`,
+		`insert into customer_tokens (token_hash, customer_id, purpose, expires_at) values (decode('0304', 'hex'), '00000000-0000-4000-8000-000000000999', 'reset_password', now() + interval '1 day')`,
 	}
 	for _, s := range stmts {
 		if _, err := testPool.Exec(context.Background(), s); err != nil {
@@ -115,6 +116,7 @@ func TestResetTwiceLeavesDemoAccounts(t *testing.T) {
 	assertCount(t, "customers", 1)
 	assertCount(t, "addresses", 2)
 	assertCount(t, "sessions", 0)
+	assertCount(t, "customer_tokens", 0)
 
 	var id, email, role string
 	var active bool
@@ -126,11 +128,12 @@ func TestResetTwiceLeavesDemoAccounts(t *testing.T) {
 	}
 
 	var cid, cemail, name, phone string
-	if err := testPool.QueryRow(ctx, "select id::text, email::text, name, phone from customers").Scan(&cid, &cemail, &name, &phone); err != nil {
+	var verified bool
+	if err := testPool.QueryRow(ctx, "select id::text, email::text, name, phone, email_verified from customers").Scan(&cid, &cemail, &name, &phone, &verified); err != nil {
 		t.Fatal(err)
 	}
-	if cid != customerID || cemail != "demo@shopperstop.local" || name != "Demo Customer" || phone != "+919800000000" {
-		t.Fatalf("customer row: %s %s %s %s, want the demo customer", cid, cemail, name, phone)
+	if cid != customerID || cemail != "demo@shopperstop.local" || name != "Demo Customer" || phone != "+919800000000" || !verified {
+		t.Fatalf("customer row: %s %s %s %s verified %v, want the demo customer, verified", cid, cemail, name, phone, verified)
 	}
 
 	rows, err := testPool.Query(ctx, "select id::text, customer_id::text, label, line1, pincode, is_default from addresses order by is_default desc")
diff --git a/services/core/migrations/0010_customer_tokens.sql b/services/core/migrations/0010_customer_tokens.sql
new file mode 100644
index 0000000..f21d51c
--- /dev/null
+++ b/services/core/migrations/0010_customer_tokens.sql
@@ -0,0 +1,17 @@
+-- Email verification and password reset (core-accounts-security).
+-- Existing customers start unverified.
+alter table customers add column email_verified boolean not null default false;
+
+-- One-time tokens mailed to a customer. Like sessions, only sha256(token || pepper)
+-- is stored. A customer holds at most one token per purpose: a new one replaces it.
+create table customer_tokens (
+    id          uuid primary key default gen_random_uuid(),
+    token_hash  bytea not null unique,
+    customer_id uuid not null references customers (id) on delete cascade,
+    purpose     text not null check (purpose in ('verify_email', 'reset_password')),
+    expires_at  timestamptz not null,
+    created_at  timestamptz not null default now(),
+    updated_at  timestamptz not null default now()
+);
+create unique index customer_tokens_one_per_purpose on customer_tokens (customer_id, purpose);
+create trigger customer_tokens_updated_at before update on customer_tokens for each row execute function set_updated_at();
diff --git a/services/core/queries/auth.sql b/services/core/queries/auth.sql
index 6794ad6..d81fb3d 100644
--- a/services/core/queries/auth.sql
+++ b/services/core/queries/auth.sql
@@ -1,19 +1,19 @@
 -- name: CreateCustomer :one
 insert into customers (email, password_hash, name)
 values ($1, $2, $3)
-returning id, email, name, phone;
+returning id, email, name, phone, email_verified;
 
 -- name: CustomerByEmail :one
-select id, email, password_hash, name, phone from customers where email = $1;
+select id, email, password_hash, name, phone, email_verified from customers where email = $1;
 
 -- name: CustomerByID :one
-select id, email, name, phone from customers where id = $1;
+select id, email, name, phone, email_verified from customers where id = $1;
 
 -- name: UpdateCustomer :one
 update customers
 set name = coalesce(sqlc.narg(name), name), phone = coalesce(sqlc.narg(phone), phone)
 where id = @id
-returning id, email, name, phone;
+returning id, email, name, phone, email_verified;
 
 -- name: CreateCustomerSession :exec
 insert into sessions (token_hash, subject_type, subject_id, expires_at)
@@ -44,6 +44,23 @@ delete from sessions where expires_at <= now();
 -- name: DeleteSession :exec
 delete from sessions where id = $1;
 
+-- name: IssueCustomerToken :exec
+-- A customer holds one token per purpose: a new token replaces the earlier one.
+insert into customer_tokens (token_hash, customer_id, purpose, expires_at)
+values ($1, $2, $3, now() + interval '24 hours')
+on conflict (customer_id, purpose)
+do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at;
+
+-- name: ConsumeCustomerToken :one
+-- Single use: a live token is deleted as it is read. An unknown, used or
+-- expired token returns no row.
+delete from customer_tokens
+where token_hash = $1 and purpose = $2 and expires_at > now()
+returning customer_id;
+
+-- name: VerifyCustomerEmail :exec
+update customers set email_verified = true where id = $1;
+
 -- name: CreateStaff :one
 insert into staff_users (email, password_hash, name, role, store_id)
 values ($1, $2, $3, $4, $5)
```

### `openapi.json` script (Task 1)

```python
# Task 1: Customer.emailVerified, POST /me/email-verification, POST /auth/verify-email. Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

def err(code, message, field=None):
    e = {"code": code, "message": message}
    if field:
        e["field"] = field
    return {"error": e}

def error_response(description, example):
    return {"description": description, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}, "example": example}}}

c = s['Customer']
c['required'].append('emailVerified')
c['properties']['emailVerified'] = {"type": "boolean", "description": "Whether the customer has proved they read this email: false on registration, true after POST /auth/verify-email or a password reset."}

def mark(node):
    # Every customer in an example gains emailVerified: the demo customer is verified.
    if isinstance(node, dict):
        if {'id', 'email', 'name'} <= node.keys() and 'role' not in node:
            node['emailVerified'] = node['email'] == 'demo@shopperstop.local'
        for v in node.values():
            mark(v)
    elif isinstance(node, list):
        for v in node:
            mark(v)

for item in d['paths'].values():
    for op in item.values():
        if isinstance(op, dict):
            for resp in op.get('responses', {}).values():
                for media in resp.get('content', {}).values():
                    mark(media.get('example'))

s['TokenRequest'] = {"type": "object", "required": ["token"], "properties": {"token": {"type": "string", "description": "The code from the mail, exactly as sent."}}}

unauthorized = error_response("The token is missing, unknown, expired or a staff token.", err("unauthorized", "sign in required"))
bad_token = "The token is empty, unknown, already used, expired (24 hours) or for another purpose; field token. Nothing changes."

new = {}
for path, item in d['paths'].items():
    new[path] = item
    if path == '/auth/sign-out':
        new['/auth/verify-email'] = {"post": {
            "operationId": "postAuthVerifyEmail",
            "summary": "Verify a customer's email",
            "description": "Spends the code from the verification mail (POST /me/email-verification) and marks its customer's email verified. Public: the code is the proof, so it works from any device. A code works once, for 24 hours, and only the newest one a customer was sent.",
            "tags": ["accounts"],
            "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/TokenRequest"}, "example": {"token": "pQ7xN2mK9vR4tL8wZ3cF6hJ1sD5gB0yA2eU4iO6nM8k"}}}},
            "responses": {
                "204": {"description": "The email is verified. No body."},
                "400": error_response(bad_token, err("validation", "invalid or expired token", "token")),
            }}}
    if path == '/me':
        new['/me/email-verification'] = {"post": {
            "operationId": "postMeEmailVerification",
            "summary": "Mail a verification code",
            "description": "Mails the signed-in customer a code for POST /auth/verify-email, valid for 24 hours; a new code replaces any earlier one. No body. In development the mail is written to core's log, not sent.",
            "tags": ["accounts"],
            "security": [{"bearer": []}],
            "responses": {
                "202": {"description": "The mail is on its way. No body."},
                "401": unauthorized,
                "409": error_response("The customer's email is already verified. No mail is sent.", err("conflict", "email already verified")),
            }}}
d['paths'] = new

# platform-P4-L3 (relayed by the manager): the rider example of the status change comes first.
media = d['paths']['/admin/orders/{id}/status']['post']['requestBody']['content']['application/json']
media['examples'] = {'rider': media['examples']['rider'], 'staff': media['examples']['staff']}
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 2: password reset

Applies on Task 1.

```diff
diff --git a/services/core/internal/app/app.go b/services/core/internal/app/app.go
index bae125c..2c5b2ac 100644
--- a/services/core/internal/app/app.go
+++ b/services/core/internal/app/app.go
@@ -38,6 +38,8 @@ func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) c
 	r.Post("/api/core/v1/auth/sign-in", a.SignIn)
 	r.With(a.RequireCustomer).Post("/api/core/v1/auth/sign-out", a.SignOut)
 	r.Post("/api/core/v1/auth/verify-email", a.VerifyEmail)
+	r.Post("/api/core/v1/auth/password-reset", a.RequestPasswordReset)
+	r.Post("/api/core/v1/auth/password-reset/confirm", a.ConfirmPasswordReset)
 	r.With(a.RequireCustomer).Get("/api/core/v1/me", a.Me)
 	r.With(a.RequireCustomer).Patch("/api/core/v1/me", a.UpdateMe)
 	r.With(a.RequireCustomer).Post("/api/core/v1/me/email-verification", a.SendEmailVerification)
diff --git a/services/core/internal/app/password_reset_test.go b/services/core/internal/app/password_reset_test.go
new file mode 100644
index 0000000..1404a70
--- /dev/null
+++ b/services/core/internal/app/password_reset_test.go
@@ -0,0 +1,146 @@
+package app
+
+import (
+	"context"
+	"encoding/json"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	"github.com/kapildev333/shopperstop/services/core/internal/auth"
+	"github.com/kapildev333/shopperstop/services/core/internal/blob"
+)
+
+const newPassword = "newpass123"
+
+func requestReset(t *testing.T, email string) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, "/api/core/v1/auth/password-reset", "", map[string]string{"email": email})
+}
+
+func confirmReset(t *testing.T, token, password string) (int, []byte) {
+	t.Helper()
+	return call(t, http.MethodPost, "/api/core/v1/auth/password-reset/confirm", "", map[string]string{"token": token, "password": password})
+}
+
+func signInStatus(t *testing.T, email, password string) int {
+	t.Helper()
+	status, _ := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": password})
+	return status
+}
+
+// signInAs signs in through the router and fails the test unless it answers 200.
+func signInAs(t *testing.T, email, password string) sessionBody {
+	t.Helper()
+	status, body := call(t, http.MethodPost, "/api/core/v1/auth/sign-in", "", map[string]string{"email": email, "password": password})
+	var s sessionBody
+	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
+		t.Fatalf("sign-in %s: got %d %s, want 200", email, status, body)
+	}
+	return s
+}
+
+func TestPasswordReset(t *testing.T) {
+	a := seedCustomer(t)
+	b := signInAs(t, a.Customer.Email, testPassword).Token
+	if status, body := requestReset(t, a.Customer.Email); status != http.StatusAccepted || len(body) != 0 {
+		t.Fatalf("request reset: got %d %q, want 202 and no body", status, body)
+	}
+	sent := mails.to(a.Customer.Email)
+	if len(sent) != 1 || sent[0].Subject != "Reset your ShopperStop password" {
+		t.Fatalf("mail to %s: got %+v, want one reset mail", a.Customer.Email, sent)
+	}
+	token := mailedToken(t, mails, a.Customer.Email)
+	if status, body := confirmReset(t, token, newPassword); status != http.StatusNoContent {
+		t.Fatalf("confirm: got %d %s, want 204", status, body)
+	}
+	for _, old := range []string{a.Token, b} {
+		if status, _ := call(t, http.MethodGet, "/api/core/v1/me", old, nil); status != http.StatusUnauthorized {
+			t.Fatalf("GET /me with a session from before the reset: got %d, want 401", status)
+		}
+	}
+	if got := signInStatus(t, a.Customer.Email, testPassword); got != http.StatusUnauthorized {
+		t.Fatalf("sign-in with the old password: got %d, want 401", got)
+	}
+	s := signInAs(t, a.Customer.Email, newPassword)
+	if !s.Customer.EmailVerified {
+		t.Fatal("after reset: emailVerified false, want true")
+	}
+	status, body := confirmReset(t, token, "another123")
+	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "token" {
+		t.Fatalf("token used twice: got %d %s, want 400 field token", status, body)
+	}
+}
+
+func TestPasswordResetUnknownEmail(t *testing.T) {
+	email := uniqueEmail(t)
+	known := seedCustomer(t)
+	unknownStatus, unknownBody := requestReset(t, email)
+	knownStatus, knownBody := requestReset(t, known.Customer.Email)
+	if unknownStatus != http.StatusAccepted || unknownStatus != knownStatus || string(unknownBody) != string(knownBody) {
+		t.Fatalf("unknown email: got %d %q, known: %d %q, want the same 202", unknownStatus, unknownBody, knownStatus, knownBody)
+	}
+	if n := len(mails.to(email)); n != 0 {
+		t.Fatalf("mail to an unknown email: %d, want 0", n)
+	}
+}
+
+func TestPasswordResetBadInput(t *testing.T) {
+	c := seedCustomer(t)
+	status, body := requestReset(t, "not-an-email")
+	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "email" {
+		t.Fatalf("bad email: got %d %s, want 400 field email", status, body)
+	}
+	requestReset(t, c.Customer.Email)
+	token := mailedToken(t, mails, c.Customer.Email)
+	status, body = confirmReset(t, token, "short")
+	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "password" {
+		t.Fatalf("short password: got %d %s, want 400 field password", status, body)
+	}
+	sendVerification(t, c.Token)
+	verifyToken := mailedToken(t, mails, c.Customer.Email)
+	for _, bad := range []string{"", "not-a-token", verifyToken} {
+		status, body := confirmReset(t, bad, newPassword)
+		if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Code != "validation" || e.Error.Field != "token" {
+			t.Errorf("token %q: got %d %s, want 400 validation field token", bad, status, body)
+		}
+	}
+	if status, body := confirmReset(t, token, newPassword); status != http.StatusNoContent {
+		t.Fatalf("reset token after a refused password: got %d %s, want 204", status, body)
+	}
+}
+
+func TestPasswordResetTokenExpires(t *testing.T) {
+	c := seedCustomer(t)
+	requestReset(t, c.Customer.Email)
+	if _, err := testPool.Exec(context.Background(),
+		"update customer_tokens set expires_at = now() - interval '1 second' where customer_id = $1", c.Customer.ID); err != nil {
+		t.Fatal(err)
+	}
+	status, body := confirmReset(t, mailedToken(t, mails, c.Customer.Email), newPassword)
+	if e := decodeError(t, body); status != http.StatusBadRequest || e.Error.Field != "token" {
+		t.Fatalf("expired token: got %d %s, want 400 field token", status, body)
+	}
+	if got := signInStatus(t, c.Customer.Email, testPassword); got != http.StatusOK {
+		t.Fatalf("sign-in with the old password: got %d, want 200", got)
+	}
+}
+
+func TestPasswordResetRateLimited(t *testing.T) {
+	a := auth.New(testPool, testPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), nil)
+	a.Mailer = &outbox{}
+	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
+	defer limited.Close()
+	email := uniqueEmail(t)
+	for i := 1; i <= 11; i++ {
+		status, body := callAt(t, limited.URL, http.MethodPost, "/api/core/v1/auth/password-reset", "", map[string]string{"email": email})
+		want := http.StatusAccepted
+		if i == 11 {
+			want = http.StatusTooManyRequests
+		}
+		if status != want {
+			t.Fatalf("attempt %d: got %d %s, want %d", i, status, body, want)
+		}
+	}
+}
diff --git a/services/core/internal/auth/account.go b/services/core/internal/auth/account.go
index b75455f..8430aff 100644
--- a/services/core/internal/auth/account.go
+++ b/services/core/internal/auth/account.go
@@ -27,6 +27,15 @@ type tokenRequest struct {
 	Token string `json:"token"`
 }
 
+type passwordResetRequest struct {
+	Email string `json:"email"`
+}
+
+type passwordResetConfirm struct {
+	Token    string `json:"token"`
+	Password string `json:"password"`
+}
+
 // mailToken issues a 24-hour token for the customer and purpose, replacing any
 // earlier one of that purpose, and mails it as the last word of the body.
 func (a *Auth) mailToken(ctx context.Context, customerID, email, purpose, subject, text string) error {
@@ -99,3 +108,72 @@ func (a *Auth) VerifyEmail(w http.ResponseWriter, r *http.Request) {
 	}
 	w.WriteHeader(http.StatusNoContent)
 }
+
+// RequestPasswordReset mails a reset token when the email is a customer's and
+// answers 202 either way, so the answer never says whether it is registered.
+// Attempts count against the sign-in limiter like a sign-in.
+// ponytail: an unknown email answers sooner (no insert, no mail); a queued
+// mailer that sends after the answer closes the gap.
+func (a *Auth) RequestPasswordReset(w http.ResponseWriter, r *http.Request) {
+	var in passwordResetRequest
+	if err := httpx.ReadJSON(w, r, &in); err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	if a.refused(w, r, in.Email) {
+		return
+	}
+	email, err := checkEmail(in.Email)
+	if err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	ctx := r.Context()
+	row, err := a.q.CustomerByEmail(ctx, email)
+	if err == nil {
+		err = a.mailToken(ctx, row.ID, row.Email, purposeResetPassword,
+			"Reset your ShopperStop password", "Use this code within 24 hours to set a new password:")
+	}
+	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	w.WriteHeader(http.StatusAccepted)
+}
+
+// ConfirmPasswordReset spends a reset token, sets the new password (the
+// register rules), marks the email verified, ends every session of the
+// customer, and answers 204, all in one transaction. A bad password is
+// refused before the token is spent; the hash runs only for a live token.
+func (a *Auth) ConfirmPasswordReset(w http.ResponseWriter, r *http.Request) {
+	var in passwordResetConfirm
+	if err := httpx.ReadJSON(w, r, &in); err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	if err := checkPasswordLength(in.Password); err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	ctx := r.Context()
+	err := pgx.BeginFunc(ctx, a.pool, func(tx pgx.Tx) error {
+		q := a.q.WithTx(tx)
+		id, err := a.consumeToken(ctx, q, in.Token, purposeResetPassword)
+		if err != nil {
+			return err
+		}
+		hash, err := HashPassword(in.Password)
+		if err != nil {
+			return err
+		}
+		if err := q.ResetCustomerPassword(ctx, db.ResetCustomerPasswordParams{ID: id, PasswordHash: hash}); err != nil {
+			return err
+		}
+		return q.DeleteCustomerSessions(ctx, id)
+	})
+	if err != nil {
+		httpx.WriteError(w, r, err)
+		return
+	}
+	w.WriteHeader(http.StatusNoContent)
+}
diff --git a/services/core/queries/auth.sql b/services/core/queries/auth.sql
index d81fb3d..b77be5e 100644
--- a/services/core/queries/auth.sql
+++ b/services/core/queries/auth.sql
@@ -44,6 +44,9 @@ delete from sessions where expires_at <= now();
 -- name: DeleteSession :exec
 delete from sessions where id = $1;
 
+-- name: DeleteCustomerSessions :exec
+delete from sessions where subject_type = 'customer' and subject_id = $1;
+
 -- name: IssueCustomerToken :exec
 -- A customer holds one token per purpose: a new token replaces the earlier one.
 insert into customer_tokens (token_hash, customer_id, purpose, expires_at)
@@ -61,6 +64,10 @@ returning customer_id;
 -- name: VerifyCustomerEmail :exec
 update customers set email_verified = true where id = $1;
 
+-- name: ResetCustomerPassword :exec
+-- The mailed token proved the customer reads this address, so it is verified too.
+update customers set password_hash = $2, email_verified = true where id = $1;
+
 -- name: CreateStaff :one
 insert into staff_users (email, password_hash, name, role, store_id)
 values ($1, $2, $3, $4, $5)
```

### `openapi.json` script (Task 2)

```python
# Task 2: POST /auth/password-reset and /auth/password-reset/confirm. Run from services/core.
import json
d = json.load(open('openapi.json'))
s = d['components']['schemas']

def err(code, message, field=None):
    e = {"code": code, "message": message}
    if field:
        e["field"] = field
    return {"error": e}

def error_response(description, example):
    return {"description": description, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Error"}, "example": example}}}

s['PasswordResetRequest'] = {"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "format": "email", "description": "The email the customer registered with, in any case."}}}
s['PasswordResetConfirm'] = {"type": "object", "required": ["token", "password"], "properties": {
    "token": {"type": "string", "description": "The code from the reset mail, exactly as sent."},
    "password": {"type": "string", "minLength": 8, "maxLength": 72, "description": "The new password: 8 to 72 bytes, not trimmed, as on registration."}}}

new = {}
for path, item in d['paths'].items():
    new[path] = item
    if path == '/auth/verify-email':
        new['/auth/password-reset'] = {"post": {
            "operationId": "postAuthPasswordReset",
            "summary": "Ask for a password reset",
            "description": "When the email belongs to a customer, mails them a code for POST /auth/password-reset/confirm, valid for 24 hours; a new code replaces any earlier one. Answers 202 whether or not the email is registered, so the answer never tells. Every attempt counts against its email and client IP with sign-in and registration: the eleventh for one email within an hour, or the hundred and first from one IP, answers 429. In development the mail is written to core's log, not sent.",
            "tags": ["accounts"],
            "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/PasswordResetRequest"}, "example": {"email": "demo@shopperstop.local"}}}},
            "responses": {
                "202": {"description": "Accepted, registered or not. No body."},
                "400": error_response("The email is missing or not one valid address; field email.", err("validation", "must be a valid email address", "email")),
                "429": error_response("Too many attempts for this email or from this IP within the hour.", err("rate_limited", "too many attempts, try again later")),
            }}}
        new['/auth/password-reset/confirm'] = {"post": {
            "operationId": "postAuthPasswordResetConfirm",
            "summary": "Set a new password",
            "description": "Spends the code from the reset mail, sets the new password (8 to 72 bytes, bcrypt cost 12), marks the email verified and signs the customer out everywhere: every session of the customer ends. Sign in again with the new password. A code works once, for 24 hours, and only the newest one a customer was sent. A bad password is refused before the code is spent.",
            "tags": ["accounts"],
            "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/PasswordResetConfirm"}, "example": {"token": "pQ7xN2mK9vR4tL8wZ3cF6hJ1sD5gB0yA2eU4iO6nM8k", "password": "newpass123"}}}},
            "responses": {
                "204": {"description": "The password is set and every session ended. No body."},
                "400": error_response("The password is not 8 to 72 bytes (field password; the code stays usable), or the token is empty, unknown, already used, expired or for another purpose (field token). Nothing changes.", err("validation", "invalid or expired token", "token")),
            }}}
d['paths'] = new
open('openapi.json', 'w').write(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
```

## Task 3: seed-demo guard

Independent of Tasks 1 and 2 (applies on either).

```diff
diff --git a/services/core/cmd/core-admin/main.go b/services/core/cmd/core-admin/main.go
index 132bcdc..7972b91 100644
--- a/services/core/cmd/core-admin/main.go
+++ b/services/core/cmd/core-admin/main.go
@@ -11,6 +11,7 @@ import (
 	"os"
 	"strings"
 
+	"github.com/jackc/pgx/v5/pgconn"
 	"github.com/jackc/pgx/v5/pgxpool"
 
 	"github.com/kapildev333/shopperstop/services/core/internal/auth"
@@ -37,10 +38,11 @@ func run(args []string, stdout, stderr io.Writer) int {
 		}
 		return migrateDB(stdout, stderr)
 	case "seed-demo":
-		if len(args) > 2 || (len(args) == 2 && args[1] != "--reset") {
+		reset, force, ok := seedFlags(args[1:])
+		if !ok {
 			return usage(stderr)
 		}
-		return seedDemoCmd(len(args) == 2, stdout, stderr)
+		return seedDemoCmd(reset, force, stdout, stderr)
 	case "create-admin":
 		if len(args) != 2 {
 			return usage(stderr)
@@ -52,10 +54,45 @@ func run(args []string, stdout, stderr io.Writer) int {
 }
 
 func usage(stderr io.Writer) int {
-	fmt.Fprintln(stderr, "usage: core-admin migrate | seed-demo [--reset] | create-admin <email>")
+	fmt.Fprintln(stderr, "usage: core-admin migrate | seed-demo [--reset] [--force] | create-admin <email>")
 	return 2
 }
 
+// seedFlags reads seed-demo's flags: --reset and --force, each at most once, in any order.
+func seedFlags(args []string) (reset, force, ok bool) {
+	for _, a := range args {
+		switch {
+		case a == "--reset" && !reset:
+			reset = true
+		case a == "--force" && !force:
+			force = true
+		default:
+			return false, false, false
+		}
+	}
+	return reset, force, true
+}
+
+// localDatabase refuses a database URL naming any host but this machine
+// (localhost, 127.0.0.1, ::1 or a Unix socket directory), so the demo rows and
+// their public passwords never land on a shared database by mistake.
+func localDatabase(databaseURL string) error {
+	cfg, err := pgconn.ParseConfig(databaseURL)
+	if err != nil {
+		return fmt.Errorf("parse SHOPPERSTOP_CORE_DATABASE_URL: %w", err)
+	}
+	hosts := []string{cfg.Host}
+	for _, f := range cfg.Fallbacks {
+		hosts = append(hosts, f.Host)
+	}
+	for _, h := range hosts {
+		if h != "localhost" && h != "127.0.0.1" && h != "::1" && !strings.HasPrefix(h, "/") {
+			return fmt.Errorf("refusing to load demo data into a database on %s, not this machine; add --force to load it anyway", h)
+		}
+	}
+	return nil
+}
+
 func migrateDB(stdout, stderr io.Writer) int {
 	cfg, err := config.Load(os.Getenv)
 	if err != nil {
@@ -84,13 +121,20 @@ func migrateDB(stdout, stderr io.Writer) int {
 	return 0
 }
 
-// seedDemoCmd loads the demo data, clearing it first when reset is set, and prints seed.Summary.
-func seedDemoCmd(reset bool, stdout, stderr io.Writer) int {
+// seedDemoCmd loads the demo data, clearing it first when reset is set, and
+// prints seed.Summary. Without force it refuses a database on another host.
+func seedDemoCmd(reset, force bool, stdout, stderr io.Writer) int {
 	cfg, err := config.Load(os.Getenv)
 	if err != nil {
 		fmt.Fprintf(stderr, "core-admin: %v\n", err)
 		return 1
 	}
+	if !force {
+		if err := localDatabase(cfg.DatabaseURL); err != nil {
+			fmt.Fprintf(stderr, "core-admin: seed-demo: %v\n", err)
+			return 1
+		}
+	}
 	ctx := context.Background()
 	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
 	if err != nil {
diff --git a/services/core/cmd/core-admin/main_test.go b/services/core/cmd/core-admin/main_test.go
index 1130d7b..44dfe1c 100644
--- a/services/core/cmd/core-admin/main_test.go
+++ b/services/core/cmd/core-admin/main_test.go
@@ -27,7 +27,7 @@ func TestMain(m *testing.M) {
 
 // The argument refusals return before any config load or database call.
 func TestRunRefusesBadArguments(t *testing.T) {
-	for _, args := range [][]string{{"create-admin"}, {"bogus"}} {
+	for _, args := range [][]string{{"create-admin"}, {"bogus"}, {"seed-demo", "--reset", "--reset"}, {"seed-demo", "--yes"}} {
 		var stderr strings.Builder
 		if code := run(args, io.Discard, &stderr); code != 2 || !strings.Contains(stderr.String(), "usage: core-admin") {
 			t.Fatalf("run %v: exit %d stderr %q, want exit 2 with the usage line", args, code, stderr.String())
@@ -153,3 +153,59 @@ func TestSeedDemoExitCodes(t *testing.T) {
 		t.Fatalf("second seed-demo stderr %q, want the duplicate key reason", stderr.String())
 	}
 }
+
+// seedEnv sets the full core environment with the given database URL.
+func seedEnv(t *testing.T, databaseURL string) {
+	t.Helper()
+	t.Setenv("SHOPPERSTOP_CORE_DATABASE_URL", databaseURL)
+	t.Setenv("SHOPPERSTOP_CORE_ADDR", ":8080")
+	t.Setenv("SHOPPERSTOP_CORE_SESSION_PEPPER", "test-pepper-test-pepper-test-pepper-00")
+	t.Setenv("SHOPPERSTOP_CORE_WEB_ORIGINS", "http://localhost:5173")
+	t.Setenv("SHOPPERSTOP_CORE_FILES_DIR", t.TempDir())
+}
+
+func TestLocalDatabase(t *testing.T) {
+	for _, u := range []string{
+		"postgres://u:p@localhost:5432/db",
+		"postgres://u:p@127.0.0.1/db",
+		"postgres://u:p@[::1]:5432/db",
+		"postgres:///db?host=/tmp",
+	} {
+		if err := localDatabase(u); err != nil {
+			t.Errorf("%s: got %v, want accepted", u, err)
+		}
+	}
+	for _, u := range []string{
+		"postgres://u:p@db.example.com:5432/db",
+		"postgres://u:p@10.0.0.5/db",
+		"postgres://u:p@localhost,db.example.com/db",
+	} {
+		if err := localDatabase(u); err == nil || !strings.Contains(err.Error(), "--force") {
+			t.Errorf("%s: got %v, want a refusal naming --force", u, err)
+		}
+	}
+}
+
+// TestSeedDemoRefusesRemoteDatabase: with or without --reset, a remote host is
+// refused before any connection; nothing is printed on stdout.
+func TestSeedDemoRefusesRemoteDatabase(t *testing.T) {
+	seedEnv(t, "postgres://u:p@db.example.com:5432/shopperstop_core?connect_timeout=2")
+	for _, args := range [][]string{{"seed-demo", "--reset"}, {"seed-demo"}} {
+		var stdout, stderr strings.Builder
+		code := run(args, &stdout, &stderr)
+		if code != 1 || stdout.Len() != 0 || !strings.Contains(stderr.String(), "refusing to load demo data into a database on db.example.com") {
+			t.Fatalf("%v: exit %d stdout %q stderr %q, want exit 1 and the refusal", args, code, stdout.String(), stderr.String())
+		}
+	}
+}
+
+// TestSeedDemoForceSkipsTheGuard: --force goes past the guard to the
+// connection, which fails on the unresolvable host.
+func TestSeedDemoForceSkipsTheGuard(t *testing.T) {
+	seedEnv(t, "postgres://u:p@db.invalid:5432/shopperstop_core?connect_timeout=2")
+	var stdout, stderr strings.Builder
+	code := run([]string{"seed-demo", "--force", "--reset"}, &stdout, &stderr)
+	if code != 1 || strings.Contains(stderr.String(), "refusing") || !strings.Contains(stderr.String(), "seed-demo:") {
+		t.Fatalf("exit %d stderr %q, want exit 1 from the connection, not the guard", code, stderr.String())
+	}
+}
```
