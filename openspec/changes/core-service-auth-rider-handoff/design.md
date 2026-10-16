## Context

Core authenticates two subjects today: customers (`RequireCustomer`) and staff (`RequireStaff`, `RequireAdmin` wraps it), both by a peppered sha256 of a session token looked up in Postgres (`internal/auth/auth.go`). `httpx.SetSubject` puts `subjectType`/`subjectId` on the request log line. Order moves go through `order.Transition` (`internal/order/status.go`) under the order's row lock; `allowed(from, to, actorType)` lets staff make every table move and customers only cancel. `order.SetStatus` (`internal/order/handlers.go`) is the staff handler; `staffScope` makes an admin unscoped and anyone else scoped to their store. `order_events.actor_type` has a check `in ('customer','staff','system')`.

D30 adds a third caller, the rider service, with a static token from `SHOPPERSTOP_CORE_SERVICE_TOKENS`. The Makefile on main passes `rider:dev-rider-service-token-dev-rider-00` (dev) and `rider:e2e-rider-service-token-e2e-rider-00` (e2e); both tokens are 36 bytes. The rider service calls exactly the five routes in `.claude/areas/rider.md` "to core (standing, D30)".

The whole design was spiked in the lane worktree on 30a4e7c (tree restored): it compiles, `go vet` is clean, the four new app tests pass, every package's suite stays green, and `TestContractSecurity` with the new probe fails exactly on the ten `openapi.json` gaps Task 1 closes (five routes without `x-service-token`, five `/admin/` operations without a 403).

## Goals / Non-Goals

**Goals:** a configured service authenticates by bearer token and reaches the five routes like an admin; the rider's two moves record who the rider was; customers and staff read it; nothing else changes for customers and staff.

**Non-Goals:** rider accounts, deliveries or locations (rider area); token rotation without restart; staff names on staff events (admin backlog); verifying the rider's identity in core (the rider service is trusted); a Postman variable for the service token (platform).

## Decisions

### 1. `OrService(mw)` wraps the existing staff middleware; `RequireStaff` answers a service token 403

`a.OrService(a.RequireStaff)` and `a.OrService(a.RequireAdmin)` admit a configured service token as a service subject and hand every other request to the wrapped middleware unchanged. Five routes in `app.go` change their `With(...)`. `RequireStaff` (and so `RequireAdmin`) checks the token against the service tokens before the session lookup and answers 403 `forbidden` "staff only", so every other `/admin` route refuses a service with 403, not 401. `RequireCustomer` is untouched: a service token is no customer session, so customer routes answer 401.

The context carries the service name under its own key; `auth.Service(ctx)` returns it ("" otherwise). `CurrentStaff` stays the zero `Staff` for a service.

Alternative: a separate `RequireService` plus `RequireStaffOrService`/`RequireAdminOrService` middlewares (D30's working name). Two more middlewares for the same branch; `OrService` is one function and keeps the staff path byte-for-byte the same.

### 2. Tokens are compared as sha256 digests in constant time

`auth.New` gains a fourth parameter `services map[string]string` (nil admits none) and stores `{name, sha256(token)}` per service. `serviceName(token)` hashes the bearer once and compares it with every stored digest with `subtle.ConstantTimeCompare`, without breaking early. Equal-length digests hide the token length too. No pepper: the digests never leave memory.

### 3. Config: optional, strict when set

`config.Config.ServiceTokens map[string]string` (nil when unset or empty). Entries are split on `,`, trimmed, empty ones dropped, each cut at the first `:`. Refused, with one problem each and never the token in the text: no colon or empty name (`entries must be name:token`), token under 32 bytes, a repeated name, a repeated token (two names on one token would make the subject ambiguous). The name has no charset rule (it only appears in logs). Review fix (5d62990): whitespace anywhere inside a trimmed entry is refused too (`entries must be name:token with no spaces`), since a bearer header never carries it.

### 4. The request log names the service as `subjectType` `service`, `subjectId` `<name>`

D30 says "logged like staff"; the area plan's `service=<name>` is read as that: the existing two fields, no new key. `OrService` sets it on admission; `RequireStaff` sets it before its 403, so refused calls are attributed too.

### 5. A service may only move orders to `out_for_delivery` or `delivered`; anything else is 403

`SetStatus` resolves the actor first (`actorOf`), then, for a rider actor, refuses any target other than the two with 403 `forbidden` "a service may only move an order to out_for_delivery or delivered" before the order is read. 403 because it is about who asks, not the order's state; it also reveals nothing about the order. The table still decides from where: `ready` to `delivered` by a service is the table's 409. `allowed` becomes a switch over the actor type so a rider can never cancel even if a later caller skips the handler check (defence in depth, same table).

Staff keep every transition (fallback for a store that delivers itself).

### 6. `actor` validation: one field name, distinct messages

All refusals name field `actor`: from staff `only a service names an actor`; from a service, missing `required`, `type must be rider`, `id must be a uuid`, `name must be 1 to 80 characters` (runes, after `strings.TrimSpace`). JSON `null` reads as absent. The order of checks in the handler is: path id (404), body (400), `status` (400), `note` (400), `actor` (400), service target (403), then `Transition` (404 scope, 409 table).

### 7. Snapshots: `rider_name` on the order, `actor_name` on the event

Migration 0007 adds `orders.rider_name text` and `order_events.actor_name text` (both nullable, no backfill) and replaces the `actor_type` check to admit `rider`. `Transition` passes `RiderName` to `SetStatus` only for a rider moving to `out_for_delivery`; the query keeps the old value otherwise (`coalesce(sqlc.narg(rider_name), rider_name)`), so a later `delivered` by any rider, or any staff move, leaves it. `AddEvent` writes `actor_name` when the actor has a name (only riders do). The rider's id goes into the existing `actor_id` (no FK: riders live in the rider database); events do not expose `actorId`, as today.

`views` maps both nullable columns to `omitempty` strings, so every order read, customer ones included, carries `riderName` and `actorName` only when set.

### 8. Contract: `x-service-token: true`, security unchanged

The five routes keep `security: [{"bearer": []}]` and gain `"x-service-token": true`; every other secured `/admin/` operation documents a 403 with an example. `securityProblems(baseURL, serviceToken, doc)` sends a second request with the service token to every secured operation: declared operations must not answer 401 or 403; undeclared `/admin/` operations must answer 403 and document it; other secured operations must answer 401. `serviceToken == ""` skips the probe (toy tests).

Alternative: a second security scheme `service` with `security: [{"bearer": []}, {"service": []}]`. More native, but it changes the platform requirement "Authenticated operations declare bearer security" and the shape `scripts/postman.mjs` and its tests read (platform's files). An extension leaves both alone and Postman's output unchanged for these keys.

### Code (verbatim, from the spike)

`services/core/migrations/0007_rider_handoff.sql`:

```sql
-- Rider handoff (D30): the rider's name on the order and the actor's name on its events.
alter table orders add column rider_name text;
alter table order_events add column actor_name text;
alter table order_events drop constraint order_events_actor_type_check;
alter table order_events add constraint order_events_actor_type_check
    check (actor_type in ('customer', 'staff', 'system', 'rider'));
```

`services/core/queries/order.sql`, three edits (then `make gen`, which runs sqlc v1.31.1 and rewrites every `internal/*/db/models.go` plus `internal/order/db/order.sql.go`; commit all of them):

```sql
-- name: AddEvent :exec
insert into order_events (order_id, from_status, to_status, actor_type, actor_id, actor_name, note)
values (@order_id, sqlc.narg(from_status), @to_status, @actor_type, sqlc.narg(actor_id), sqlc.narg(actor_name), @note);

-- name: SetStatus :exec
update orders
set status        = @status,
    delivered_at  = case when @status = 'delivered'::order_status then now() else delivered_at end,
    cancelled_at  = case when @status = 'cancelled'::order_status then now() else cancelled_at end,
    cancel_reason = case when @status = 'cancelled'::order_status then @cancel_reason else cancel_reason end,
    rider_name    = coalesce(sqlc.narg(rider_name), rider_name)
where id = @id;

-- name: OrderEvents :many
select order_id, from_status, to_status, actor_type, actor_name, note, created_at
from order_events where order_id = any(@order_ids::uuid[])
order by order_id, created_at, id;
```

`services/core/internal/config/config.go`: replace `const minPepperBytes = 32` with

```go
const (
	minPepperBytes       = 32
	minServiceTokenBytes = 32
)
```

add the field as the last one of `Config`

```go
	// ServiceTokens maps a service name to its token, from
	// SHOPPERSTOP_CORE_SERVICE_TOKENS ("name:token,..."), optional; nil when unset.
	ServiceTokens map[string]string
```

call it just before `if len(problems) > 0 {` in `Load`

```go
	cfg.ServiceTokens, problems = serviceTokens(getenv("SHOPPERSTOP_CORE_SERVICE_TOKENS"), problems)
```

and append

```go
// serviceTokens parses "name:token,..." into a map and appends one problem per
// bad entry: no colon, an empty name, a token under 32 bytes, a repeated name
// or a repeated token. The token itself never appears in a problem.
func serviceTokens(v string, problems []error) (map[string]string, []error) {
	const name = "SHOPPERSTOP_CORE_SERVICE_TOKENS"
	var tokens map[string]string
	seen := map[string]bool{}
	for _, entry := range strings.Split(v, ",") {
		if entry = strings.TrimSpace(entry); entry == "" {
			continue
		}
		service, token, ok := strings.Cut(entry, ":")
		switch {
		case !ok || service == "":
			problems = append(problems, fmt.Errorf("%s entries must be name:token", name))
		case len(token) < minServiceTokenBytes:
			problems = append(problems, fmt.Errorf("%s token for %q must be at least %d bytes", name, service, minServiceTokenBytes))
		case tokens[service] != "":
			problems = append(problems, fmt.Errorf("%s names %q twice", name, service))
		case seen[token]:
			problems = append(problems, fmt.Errorf("%s gives %q the token of another service", name, service))
		default:
			if tokens == nil {
				tokens = map[string]string{}
			}
			tokens[service] = token
			seen[token] = true
		}
	}
	return tokens, problems
}
```

`services/core/cmd/core/main.go`:

```go
	a := auth.New(pool, cfg.SessionPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), cfg.ServiceTokens)
```

`services/core/internal/auth/auth.go`: import `crypto/subtle`; the struct, `New` and `serviceName`:

```go
// Auth holds what the handlers and middleware need.
type Auth struct {
	pool     *pgxpool.Pool
	q        *db.Queries
	pepper   []byte
	limit    *Limiter
	services []service
}

// service is one configured service: its name and the sha256 of its token.
type service struct {
	name string
	hash [32]byte
}

// New returns the auth service over pool. pepper is mixed into every token hash.
// services maps a service name to its token (config.ServiceTokens); nil admits none.
func New(pool *pgxpool.Pool, pepper string, limit *Limiter, services map[string]string) *Auth {
	a := &Auth{pool: pool, q: db.New(pool), pepper: []byte(pepper), limit: limit}
	for name, token := range services {
		a.services = append(a.services, service{name: name, hash: sha256.Sum256([]byte(token))})
	}
	return a
}

// serviceName returns the name of the service whose token is token, or "".
// Every configured token is compared, in constant time, over sha256 digests so
// neither the length nor the content of a token leaks through timing.
func (a *Auth) serviceName(token string) string {
	h := sha256.Sum256([]byte(token))
	name := ""
	for _, s := range a.services {
		if subtle.ConstantTimeCompare(h[:], s.hash[:]) == 1 {
			name = s.name
		}
	}
	return name
}
```

`type serviceKey struct{}` next to `customerKey`/`staffKey`; in the `var (...)` of errors add

```go
	errStaffOnly    = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "staff only"}
```

and after the error block:

```go
// Service returns the name of the calling service, or "" outside OrService.
func Service(ctx context.Context) string {
	name, _ := ctx.Value(serviceKey{}).(string)
	return name
}

// OrService admits a service token as a service subject and hands every other
// request to staff (RequireStaff or RequireAdmin), which then decides.
func (a *Auth) OrService(staff func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		guarded := staff(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			name := a.serviceName(bearer(r))
			if name == "" {
				guarded.ServeHTTP(w, r)
				return
			}
			ctx := r.Context()
			httpx.SetSubject(ctx, "service", name)
			next.ServeHTTP(w, r.WithContext(context.WithValue(ctx, serviceKey{}, name)))
		})
	}
}
```

In `RequireStaff`, right after the `token == ""` check, and one line added to its doc comment (`// A service token is 403: services reach only the routes wrapped in OrService.`):

```go
		if name := a.serviceName(token); name != "" {
			httpx.SetSubject(ctx, "service", name)
			httpx.WriteError(w, r, errStaffOnly)
			return
		}
```

`services/core/internal/app/app.go`, five lines change (`a.RequireAdmin` / `a.RequireStaff` become `a.OrService(a.RequireAdmin)` / `a.OrService(a.RequireStaff)`):

```go
	r.With(a.OrService(a.RequireAdmin)).Get("/api/core/v1/admin/stores", store.List(pool))
	r.With(a.OrService(a.RequireAdmin)).Get("/api/core/v1/admin/stores/{id}", store.AdminGet(pool))
	r.With(a.OrService(a.RequireStaff)).Get("/api/core/v1/admin/stores/{id}/orders", order.StoreList(pool))
	r.With(a.OrService(a.RequireStaff)).Get("/api/core/v1/admin/orders/{id}", order.AdminGet(pool))
	r.With(a.OrService(a.RequireStaff)).Post("/api/core/v1/admin/orders/{id}/status", order.SetStatus(pool))
```

`services/core/internal/order/handlers.go`, `staffScope`:

```go
	s := auth.CurrentStaff(ctx)
	if s.Role == "admin" || auth.Service(ctx) != "" {
		return scope{}
	}
```

(Task 1 stops here; the rest is Task 2.)

`statusRequest` gains `Actor *actorRequest \`json:"actor"\``; new code below it:

```go
// actorRequest is the rider a service names as the actor of a status change.
type actorRequest struct {
	Type string `json:"type"`
	ID   string `json:"id"`
	Name string `json:"name"`
}

// errRiderMoves refuses a service's move to any status but the rider's two.
var errRiderMoves = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "a service may only move an order to out_for_delivery or delivered"}

// actorOf returns who makes the status change: the signed-in staff user, who
// names no actor, or the rider a service names, which it must.
func actorOf(ctx context.Context, in *actorRequest) (Actor, error) {
	if auth.Service(ctx) == "" {
		if in != nil {
			return Actor{}, invalid("actor", "only a service names an actor")
		}
		return Actor{Type: "staff", ID: auth.CurrentStaff(ctx).ID}, nil
	}
	if in == nil {
		return Actor{}, invalid("actor", "required")
	}
	name := strings.TrimSpace(in.Name)
	switch {
	case in.Type != "rider":
		return Actor{}, invalid("actor", "type must be rider")
	case !httpx.IsUUID(in.ID):
		return Actor{}, invalid("actor", "id must be a uuid")
	case name == "" || utf8.RuneCountInString(name) > 80:
		return Actor{}, invalid("actor", "name must be 1 to 80 characters")
	}
	return Actor{Type: "rider", ID: in.ID, Name: name}, nil
}
```

In `SetStatus`, replace the three lines from `sc := staffScope(ctx)` to the `Transition(...)` call's `if` with:

```go
		ctx := r.Context()
		actor, err := actorOf(ctx, in.Actor)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		to := db.OrderStatus(in.Status)
		if actor.Type == "rider" && to != db.OrderStatusOutForDelivery && to != db.OrderStatusDelivered {
			httpx.WriteError(w, r, errRiderMoves)
			return
		}
		sc := staffScope(ctx)
		if err := Transition(ctx, pool, id, sc, to, actor, note); err != nil {
```

and update its doc comment to name the service, the actor and the 403.

`services/core/internal/order/order.go`: `Event` gains `ActorName string \`json:"actorName,omitempty"\`` after `ActorType` (comment on `ActorType` becomes `customer | staff | system | rider`); `Order` gains `RiderName string \`json:"riderName,omitempty"\`` after `CancelReason`; `type Actor struct{ Type, ID, Name string }` (comment: Type is "customer", "staff" or "rider"; Name is set for a rider only); in `views`, after the `FromStatus` block `if e.ActorName != nil { ev.ActorName = *e.ActorName }`, and before the `DeliveredAt` block `if r.RiderName != nil { o.RiderName = *r.RiderName }`.

`services/core/internal/order/status.go`:

```go
// allowed reports whether an actor of actorType may move an order from one
// status to another: the table allows it, staff make every move, a customer
// only cancels, and a rider only takes out for delivery and delivers.
func allowed(from, to db.OrderStatus, actorType string) bool {
	if !slices.Contains(next[from], to) {
		return false
	}
	switch actorType {
	case "staff":
		return true
	case "customer":
		return to == db.OrderStatusCancelled
	case "rider":
		return to == db.OrderStatusOutForDelivery || to == db.OrderStatusDelivered
	}
	return false
}
```

In `Transition`, replace the `SetStatus` call and extend `AddEvent`:

```go
		var riderName, actorName *string
		if actor.Name != "" {
			actorName = &actor.Name
		}
		if actor.Type == "rider" && to == db.OrderStatusOutForDelivery {
			riderName = &actor.Name
		}
		if err := q.SetStatus(ctx, db.SetStatusParams{Status: to, CancelReason: note, RiderName: riderName, ID: id}); err != nil {
```

```go
			ActorType: actor.Type, ActorID: &actor.ID, ActorName: actorName, Note: note,
```

### Tests (verbatim, from the spike where marked)

`internal/app/app_test.go` (Task 1): below `testPepper`

```go
// testServiceToken is the rider service's token on the shared test server.
const testServiceToken = "test-rider-service-token-test-rider-00"
```

and `TestMain` builds `a := auth.New(testPool, testPepper, auth.NewLimiter(1_000_000, 1_000_000, time.Hour, time.Now), map[string]string{"rider": testServiceToken})`. Every other `auth.New(...)` call in `internal/app`, `internal/seed` and `cmd/core` gains `, nil` (or `cfg.ServiceTokens` in `main.go`); in `internal/auth` tests `New(testPool, testPepper, nil)` becomes `New(testPool, testPepper, nil, nil)`.

`internal/config/config_test.go` (Task 1):

```go
// TestLoadServiceTokens: the Makefile's dev and e2e values load as service rider;
// unset, empty or only separators load none.
func TestLoadServiceTokens(t *testing.T) {
	for _, token := range []string{"dev-rider-service-token-dev-rider-00", "e2e-rider-service-token-e2e-rider-00"} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = "rider:" + token
		cfg, err := config.Load(env(vars))
		if err != nil {
			t.Fatalf("Load with rider:%s: %v", token, err)
		}
		if len(cfg.ServiceTokens) != 1 || cfg.ServiceTokens["rider"] != token {
			t.Fatalf("ServiceTokens %v, want only rider:%s", cfg.ServiceTokens, token)
		}
	}
	for _, v := range []string{"", " , "} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = v
		cfg, err := config.Load(env(vars))
		if err != nil || len(cfg.ServiceTokens) != 0 {
			t.Fatalf("Load with %q: %v %v, want no tokens and no error", v, cfg.ServiceTokens, err)
		}
	}
	cfg, err := config.Load(env(valid()))
	if err != nil || cfg.ServiceTokens != nil {
		t.Fatalf("Load unset: %v %v, want nil tokens and no error", cfg.ServiceTokens, err)
	}
}

// TestLoadRefusesBadServiceTokens: each bad value fails naming the variable and
// the rule, and the error never contains the token.
func TestLoadRefusesBadServiceTokens(t *testing.T) {
	const tok = "0123456789abcdef0123456789abcdef"
	for _, row := range []struct{ value, secret, want string }{
		{"rider:abc123", "abc123", "at least 32 bytes"},
		{"rider" + tok, tok, "name:token"},
		{":" + tok, tok, "name:token"},
		{"rider:" + tok + ",rider:" + tok + "x", tok, "twice"},
		{"rider:" + tok + ",payment:" + tok, tok, "another service"},
	} {
		vars := valid()
		vars["SHOPPERSTOP_CORE_SERVICE_TOKENS"] = row.value
		_, err := config.Load(env(vars))
		if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_SERVICE_TOKENS") ||
			!strings.Contains(err.Error(), row.want) || strings.Contains(err.Error(), row.secret) {
			t.Fatalf("Load with %q: %v, want an error naming the variable and %q, without the token", row.value, err, row.want)
		}
	}
}
```

`internal/auth/auth_test.go` (Task 1): two probe routes in `probeRouter`, before `return r`:

```go
	serviceOrStaff := func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.WriteString(w, Service(r.Context())+"|"+CurrentStaff(r.Context()).ID)
	}
	r.With(a.OrService(a.RequireStaff)).Get("/probe/service", serviceOrStaff)
	r.With(a.OrService(a.RequireAdmin)).Get("/probe/service-admin", serviceOrStaff)
```

and

```go
// serviceToken is the rider's token in the auth tests.
const serviceToken = "test-rider-service-token-test-rider-00"

// withService is the auth service with one service, rider.
func withService() *Auth {
	return New(testPool, testPepper, nil, map[string]string{"rider": serviceToken})
}

// TestServiceTokenAdmitted: the service token passes OrService over staff and over
// admins as service rider with no staff user, and the request line names it.
func TestServiceTokenAdmitted(t *testing.T) {
	h := probeRouter(withService())
	lastLine := captureRequestLog(t)
	for _, path := range []string{"/probe/service", "/probe/service-admin"} {
		rec := get(h, path, "Bearer "+serviceToken)
		if rec.Code != http.StatusOK || rec.Body.String() != "rider|" {
			t.Fatalf("%s: %d %q, want 200 rider|", path, rec.Code, rec.Body.String())
		}
		line := lastLine()
		if line["subjectType"] != "service" || line["subjectId"] != "rider" {
			t.Fatalf("%s: request line subject %v %v, want service rider", path, line["subjectType"], line["subjectId"])
		}
	}
}

// TestServiceTokenRefusedElsewhere: the service token is 403 forbidden behind
// RequireStaff and RequireAdmin (logged as the service) and 401 behind
// RequireCustomer; a token one character longer is 401 behind OrService.
func TestServiceTokenRefusedElsewhere(t *testing.T) {
	h := probeRouter(withService())
	lastLine := captureRequestLog(t)
	for _, path := range []string{"/probe/staff", "/probe/admin"} {
		rec := get(h, path, "Bearer "+serviceToken)
		if rec.Code != http.StatusForbidden || errCode(t, rec) != "forbidden" {
			t.Fatalf("%s: %d %s, want 403 forbidden", path, rec.Code, rec.Body.String())
		}
		if line := lastLine(); line["subjectType"] != "service" || line["subjectId"] != "rider" {
			t.Fatalf("%s: request line subject %v %v, want service rider", path, line["subjectType"], line["subjectId"])
		}
	}
	if rec := get(h, "/probe/customer", "Bearer "+serviceToken); rec.Code != http.StatusUnauthorized || errCode(t, rec) != "unauthorized" {
		t.Fatalf("customer probe: %d %s, want 401 unauthorized", rec.Code, rec.Body.String())
	}
	if rec := get(h, "/probe/service", "Bearer "+serviceToken+"x"); rec.Code != http.StatusUnauthorized || errCode(t, rec) != "unauthorized" {
		t.Fatalf("wrong token: %d %s, want 401 unauthorized", rec.Code, rec.Body.String())
	}
}

// TestNoServiceTokens: with none configured, the token is just an unknown token.
func TestNoServiceTokens(t *testing.T) {
	h := probeRouter(New(testPool, testPepper, nil, nil))
	for _, path := range []string{"/probe/service", "/probe/staff"} {
		if rec := get(h, path, "Bearer "+serviceToken); rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s: %d, want 401", path, rec.Code)
		}
	}
}

// TestOrServiceKeepsStaffRules: staff pass OrService(RequireStaff) as themselves,
// and store staff stay 403 behind OrService(RequireAdmin).
func TestOrServiceKeepsStaffRules(t *testing.T) {
	ctx := context.Background()
	a := withService()
	store := testStoreID
	clerk := newStaff(t, db.StaffRoleStoreStaff, &store)
	tok, err := a.startSession(ctx, "staff", clerk.ID)
	if err != nil {
		t.Fatal(err)
	}
	h := probeRouter(a)
	if rec := get(h, "/probe/service", "Bearer "+tok); rec.Code != http.StatusOK || rec.Body.String() != "|"+clerk.ID {
		t.Fatalf("staff through OrService: %d %q, want 200 |%s", rec.Code, rec.Body.String(), clerk.ID)
	}
	if rec := get(h, "/probe/service-admin", "Bearer "+tok); rec.Code != http.StatusForbidden || errCode(t, rec) != "forbidden" {
		t.Fatalf("store staff through OrService(RequireAdmin): %d %s, want 403", rec.Code, rec.Body.String())
	}
}
```

`internal/app/service_test.go` (Task 1, new file; the first two are from the spike):

```go
package app

import (
	"net/http"
	"testing"
)

// TestServiceReadsOrdersAndStores: the service reads every store's orders and stores like an admin.
func TestServiceReadsOrdersAndStores(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	for _, path := range []string{
		adminStoresPath,
		adminStoresPath + "/" + s.ID,
		storeOrdersPath(s.ID) + "?status=ready",
		adminOrderPath(id),
	} {
		if status, raw := call(t, http.MethodGet, path, testServiceToken, nil); status != http.StatusOK {
			t.Fatalf("GET %s with the service token: got %d %s, want 200", path, status, raw)
		}
	}
}

// TestServiceTokenElsewhere: a service token is 403 on every other staff route and
// 401 on customer routes; a wrong token is 401.
func TestServiceTokenElsewhere(t *testing.T) {
	for _, path := range []string{"/api/core/v1/admin/me", "/api/core/v1/admin/staff-users", "/api/core/v1/admin/dashboard", adminStoresPath + "/" + testStoreID + "/stock"} {
		status, raw := call(t, http.MethodGet, path, testServiceToken, nil)
		expectError(t, path, status, raw, http.StatusForbidden, "forbidden", "", "staff only")
	}
	for _, path := range []string{"/api/core/v1/me", ordersPath} {
		status, raw := call(t, http.MethodGet, path, testServiceToken, nil)
		expectError(t, path, status, raw, http.StatusUnauthorized, "unauthorized", "", "")
	}
	status, raw := call(t, http.MethodGet, adminStoresPath, testServiceToken+"x", nil)
	expectError(t, "wrong token", status, raw, http.StatusUnauthorized, "unauthorized", "", "")
}

// TestServiceOnStoreAdministration: the service reads a store but may not change it
// or read its service areas.
func TestServiceOnStoreAdministration(t *testing.T) {
	s := newShop(t)
	path := adminStoresPath + "/" + s.ID
	if status, raw := call(t, http.MethodGet, path, testServiceToken, nil); status != http.StatusOK {
		t.Fatalf("GET %s: got %d %s, want 200", path, status, raw)
	}
	status, raw := call(t, http.MethodPatch, path, testServiceToken, map[string]any{"isOpen": false})
	expectError(t, "PATCH store", status, raw, http.StatusForbidden, "forbidden", "", "staff only")
	status, raw = call(t, http.MethodGet, path+"/service-areas", testServiceToken, nil)
	expectError(t, "GET service areas", status, raw, http.StatusForbidden, "forbidden", "", "staff only")
}
```

`internal/app/contract_test.go` (Task 1): the struct in `securityProblems` gains `ServiceToken bool \`json:"x-service-token"\``; the signature becomes `securityProblems(baseURL, serviceToken string, doc []byte) []string`; after the existing `switch` on the anonymous answer:

```go
			if op.ServiceToken && !declared {
				problems = append(problems, key+": x-service-token without security")
			}
			if !declared || serviceToken == "" {
				continue
			}
			req.Header.Set("Authorization", "Bearer "+serviceToken)
			resp, err = http.DefaultClient.Do(req)
			if err != nil {
				problems = append(problems, key+": request failed: "+err.Error())
				continue
			}
			resp.Body.Close()
			want := http.StatusUnauthorized
			if strings.HasPrefix(path, "/admin/") {
				want = http.StatusForbidden
			}
			refused := resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden
			switch {
			case op.ServiceToken && refused:
				problems = append(problems, fmt.Sprintf("%s: declares x-service-token but answers %d to the service token", key, resp.StatusCode))
			case !op.ServiceToken && resp.StatusCode != want:
				problems = append(problems, fmt.Sprintf("%s: answers %d to the service token, want %d or x-service-token", key, resp.StatusCode, want))
			case !op.ServiceToken && want == http.StatusForbidden && op.Responses["403"] == nil:
				problems = append(problems, key+": refuses the service token with 403 but documents no 403")
			}
```

`TestContractSecurity` calls `securityProblems(srv.URL, testServiceToken, doc)`; `toySecurityProblems` calls `securityProblems(ts.URL, "", []byte(doc))`. Two toy tests:

```go
// toyServiceProblems serves GET /api/core/v1/admin/extra answering 401 without a
// token and status with one, documented as secured, with x-service-token when
// declared, and probes it with the token "svc".
func toyServiceProblems(t *testing.T, status int, declared bool) []string {
	t.Helper()
	r := chi.NewRouter()
	r.Get("/api/core/v1/admin/extra", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(status)
	})
	ts := httptest.NewServer(r)
	t.Cleanup(ts.Close)
	ext := ""
	if declared {
		ext = `"x-service-token":true,`
	}
	doc := `{"openapi":"3.1.0","servers":[{"url":"/api/core/v1"}],
  "components":{"securitySchemes":{"bearer":{"type":"http","scheme":"bearer"}}},
  "paths":{"/admin/extra":{"get":{"summary":"s","description":"d","tags":["orders"],"security":[{"bearer":[]}],` + ext + `
  "responses":{"200":{"description":"ok"},"401":{"description":"no token"},"403":{"description":"no"}}}}}}`
	return securityProblems(ts.URL, "svc", []byte(doc))
}

// TestContractNamesUndeclaredServiceRoute: a route that admits the service token must say so.
func TestContractNamesUndeclaredServiceRoute(t *testing.T) {
	problems := toyServiceProblems(t, http.StatusOK, false)
	if !containsProblem(problems, "GET /api/core/v1/admin/extra") || !containsProblem(problems, "x-service-token") {
		t.Fatalf("want a problem naming GET /api/core/v1/admin/extra and x-service-token, got %q", problems)
	}
}

// TestContractNamesRefusedServiceRoute: a route declared for services must admit the token.
func TestContractNamesRefusedServiceRoute(t *testing.T) {
	problems := toyServiceProblems(t, http.StatusForbidden, true)
	if !containsProblem(problems, "GET /api/core/v1/admin/extra") || !containsProblem(problems, "answers 403") {
		t.Fatalf("want a problem naming GET /api/core/v1/admin/extra and answers 403, got %q", problems)
	}
	if p := toyServiceProblems(t, http.StatusForbidden, false); len(p) != 0 {
		t.Fatalf("a refused, undeclared route with a 403 documented: want no problems, got %q", p)
	}
}
```

`internal/app/orders_test.go` (Task 2): `orderView` gains `RiderName string \`json:"riderName"\`` after `CancelReason`; `orderEventView` gains `ActorName string \`json:"actorName"\`` after `ActorType`.

`internal/app/orders_rider_test.go` (Task 2, new file, from the spike):

```go
package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

// riderA and riderB are rider ids the rider service would send; core keeps no riders.
const (
	riderA = "00000000-0000-4000-8000-0000000008a1"
	riderB = "00000000-0000-4000-8000-0000000008b2"
)

// rider is the actor member a service sends for a rider.
func rider(id, name string) map[string]string {
	return map[string]string{"type": "rider", "id": id, "name": name}
}

// mustStatus posts a status change and decodes the 200 order.
func mustStatus(t *testing.T, token, orderID string, body any) orderView {
	t.Helper()
	status, raw := setStatus(t, token, orderID, body)
	var o orderView
	if status != http.StatusOK || json.Unmarshal(raw, &o) != nil {
		t.Fatalf("status change %v: got %d %s, want 200", body, status, raw)
	}
	return o
}

// TestRiderHandoff: the service takes a ready order out for delivery for rider A,
// whose name lands on the order and on the event; rider B then delivers it and the
// order keeps rider A's name. The customer reads both.
func TestRiderHandoff(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")

	o := mustStatus(t, testServiceToken, id, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "  Ravi Kumar ")})
	last := o.Events[len(o.Events)-1]
	if o.Status != "out_for_delivery" || o.RiderName != "Ravi Kumar" || last.ActorType != "rider" || last.ActorName != "Ravi Kumar" {
		t.Fatalf("out for delivery: status %s riderName %q last event %+v", o.Status, o.RiderName, last)
	}

	o = mustStatus(t, testServiceToken, id, map[string]any{"status": "delivered", "actor": rider(riderB, "Sunil")})
	last = o.Events[len(o.Events)-1]
	if o.Status != "delivered" || o.DeliveredAt == nil || o.RiderName != "Ravi Kumar" || last.ActorName != "Sunil" {
		t.Fatalf("delivered: status %s riderName %q last event %+v", o.Status, o.RiderName, last)
	}

	mine := readOrder(t, ordersPath+"/"+id, c.Token)
	if mine.RiderName != "Ravi Kumar" || mine.Events[1].ActorName != "Ravi Kumar" || mine.Events[0].ActorName != "" {
		t.Fatalf("customer read: riderName %q events %+v", mine.RiderName, mine.Events)
	}
}

// TestStaffOutForDeliveryHasNoRider: a staff move names no rider, and the order and
// its events carry no riderName or actorName members.
func TestStaffOutForDeliveryHasNoRider(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	id := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	status, raw := setStatus(t, adminToken(t), id, map[string]string{"status": "out_for_delivery"})
	if status != http.StatusOK || strings.Contains(string(raw), "riderName") || strings.Contains(string(raw), "actorName") {
		t.Fatalf("staff out for delivery: got %d %s, want 200 without riderName or actorName", status, raw)
	}
}

// TestServiceActorRules: the service must name a valid rider and may only make the
// rider's two moves; staff may not name an actor. Nothing changes on a refusal.
func TestServiceActorRules(t *testing.T) {
	s := newShop(t)
	p := cartProduct(t, s.ID, stockName(t), 1000)
	c := newCustomer(t)
	ready := orderIn(t, s.ID, c.Customer.ID, p, "ready")
	for _, row := range []struct {
		what  string
		token string
		body  any
		want  int
		code  string
		field string
	}{
		{"no actor", testServiceToken, map[string]any{"status": "out_for_delivery"}, 400, "validation", "actor"},
		{"not a rider", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": map[string]string{"type": "staff", "id": riderA, "name": "Ravi"}}, 400, "validation", "actor"},
		{"bad id", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider("r1", "Ravi")}, 400, "validation", "actor"},
		{"blank name", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "  ")}, 400, "validation", "actor"},
		{"long name", testServiceToken, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, strings.Repeat("a", 81))}, 400, "validation", "actor"},
		{"staff names an actor", adminToken(t), map[string]any{"status": "out_for_delivery", "actor": rider(riderA, "Ravi")}, 400, "validation", "actor"},
		{"service cancels", testServiceToken, map[string]any{"status": "cancelled", "actor": rider(riderA, "Ravi")}, 403, "forbidden", ""},
		{"service skips ahead", testServiceToken, map[string]any{"status": "delivered", "actor": rider(riderA, "Ravi")}, 409, "conflict", ""},
	} {
		status, raw := setStatus(t, row.token, ready, row.body)
		expectError(t, row.what, status, raw, row.want, row.code, row.field, "")
		if got := orderStatus(t, ready); got != "ready" {
			t.Fatalf("%s: status %s, want ready", row.what, got)
		}
		if n := eventCount(t, ready); n != 1 {
			t.Fatalf("%s: %d events, want 1", row.what, n)
		}
	}
	if status, raw := setStatus(t, testServiceToken, ready, map[string]any{"status": "out_for_delivery", "actor": rider(riderA, strings.Repeat("a", 80))}); status != http.StatusOK {
		t.Fatalf("80-character name: got %d %s, want 200", status, raw)
	}
}
```

Also in Task 2, `TestStaffOrderRoutesCustomerToken401`'s scenario ("Service token on a customer route") is covered by `TestServiceTokenElsewhere` (`GET /orders`); no new test.

### `openapi.json` edits

Task 1:
- `listStores`, `getAdminStore`, `listStoreOrders`, `getAdminOrder`, `setOrderStatus`: add `"x-service-token": true` next to `security`; append to each description: `A service token (SHOPPERSTOP_CORE_SERVICE_TOKENS) is admitted as an unscoped reader, like an admin.` (for `setOrderStatus`: `A service token is admitted; see the actor member.`, completed in Task 2).
- Add a `403` response to `GET /admin/me`, `POST /admin/auth/sign-out`, `GET /admin/stores/{id}/stock`, `PUT /admin/stores/{id}/stock`, `GET /admin/dashboard`: description `A service token: services reach only the routes marked x-service-token.`, schema `#/components/schemas/Error`, example `{"error": {"code": "forbidden", "message": "staff only"}}`. On operations that already document a 403 (store staff on admin-only routes), append ` A service token gets the same 403 with message staff only.` to its description.

Task 2:
- `Order.properties.riderName`: `{"type": "string", "minLength": 1, "maxLength": 80, "description": "The rider who took the order out for delivery. Omitted until a rider does; staff moves never set it."}`.
- `OrderEvent.properties.actorType.enum` adds `"rider"`; `OrderEvent.properties.actorName`: `{"type": "string", "description": "The rider's name on an event a rider made. Omitted otherwise."}`.
- `OrderStatusChange.properties.actor`: `{"type": "object", "description": "Required from a service, refused from staff (400 field actor). The rider making the move.", "required": ["type", "id", "name"], "properties": {"type": {"type": "string", "enum": ["rider"]}, "id": {"type": "string", "format": "uuid"}, "name": {"type": "string", "minLength": 1, "maxLength": 80}}}`; the schema description names staff and services.
- `setOrderStatus`: request body `example` becomes `examples` `{"staff": {"value": {"status": "accepted", "note": "Packing now"}}, "rider": {"value": {"status": "out_for_delivery", "actor": {"type": "rider", "id": "00000000-0000-4000-8000-000000000801", "name": "Demo Rider"}}}}`; the 200 response's `example` becomes `examples` with `accepted` (the current example) and `outForDeliveryByRider` (the same order with `status` `out_for_delivery`, `riderName` `Demo Rider` and a last event `{"fromStatus": "ready", "toStatus": "out_for_delivery", "actorType": "rider", "actorName": "Demo Rider", "createdAt": "2026-10-13T09:40:00Z"}` after `placed`, `accepted`, `packing`, `ready` events); the 400 description adds the actor cases; a new `403` with example `{"error": {"code": "forbidden", "message": "a service may only move an order to out_for_delivery or delivered"}}` and the description `A service moving the order to any status but out_for_delivery or delivered. Nothing changes.`; the operation description states the actor rule and the snapshot.

Then `make gen postman` and commit the regenerated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` with the code.

## Risks / Trade-offs

- **The admin app's typecheck breaks on the regenerated `core.d.ts`** (Task 2): `apps/admin/src/order-sheet.tsx` indexes `{customer, staff, system}` by `event.actorType`; with `rider` in the union TypeScript reports TS7053. The fix is admin's (add a `rider` key, valid before and after this change). Mitigation: requested from admin to land before this change merges; Task 2's gate runs `make test-web` and stops if that is the only failure.
- **Static tokens**: rotating needs a restart of core and the rider service; a leaked token reads every order with customer names, phones and addresses (the rider needs the address). Ceiling: per-service scopes or signed short-lived tokens when a second service arrives.
- **Core trusts the actor**: the rider id and name are whatever the rider service sends. Ceiling accepted by D30 (no gateway).
- **`auth.New` signature change** touches every test that builds one (mechanical, the compiler finds them).
- **Every `/admin` staff request hashes the bearer once more** (one sha256 and N constant-time compares, N services): negligible.
- **Demo data**: the seeded delivered order has no `riderName`; the rider seed cannot call core. A later change may set it once rider-P3-L2 fixes the demo rider's name.

## Migration Plan

0007 is additive (two nullable columns, one widened check); no backfill, no lock beyond the brief `alter table`. D26: until the change merges, it is applied only to the per-run schemas of `shopperstop_core_test`; never to `shopperstop_core` or `shopperstop_core_e2e`. Rollback: drop the two columns and restore the three-value check (no rider rows can exist before the rider service runs).

## Files

`services/core/`: `migrations/0007_rider_handoff.sql` (new), `queries/order.sql`, `internal/*/db/models.go` and `internal/order/db/order.sql.go` (sqlc output), `internal/config/config.go` and `config_test.go`, `internal/auth/auth.go` and `auth_test.go`, `cmd/core/main.go`, `internal/app/app.go`, `app_test.go`, `contract_test.go`, `service_test.go` (new), `orders_test.go`, `orders_rider_test.go` (new), `accounts_test.go`, `staff_test.go`, `internal/seed/seed_test.go` (the `auth.New` calls), `internal/order/handlers.go`, `order.go`, `status.go`, `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, `docs/postman/shopperstop-core.postman_collection.json` (D19, D23).
