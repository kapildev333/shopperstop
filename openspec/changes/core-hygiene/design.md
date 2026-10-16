## Context

Four Phase 2 ceilings, each named in an archived design and in the core area plan, plus one seed request from admin:

- `internal/auth`: sessions live in one `sessions` table (0002). `CustomerSession` and `StaffSession` (`queries/auth.sql`) admit a row only while `expires_at > now()`; `TouchCustomerSession` moves a customer row's `expires_at` to `now() + 30 days` at most once an hour, so `expires_at` is always the row's real expiry (sliding for customers, fixed 12 h for staff). Nothing ever deletes an expired row. All three session starts go through `Auth.startSession` (`auth.go`): `Register`, `SignIn` (`customer.go`), `StaffSignIn` (`staff.go`).
- `internal/httpx/router.go`: `r.MethodNotAllowed(notFound)` answers a wrong method with 404. chi v5.4.0 builds the `Allow` list only for its own default handler; a custom handler gets no list (`rctx.methodsAllowed` is unexported). Every core route is registered flat on the root mux (`app.New`), so `chi.RouteContext(ctx).Routes` is that mux and `Routes.Match` can re-ask it per method.
- `internal/migrate/migrate.go`: `Apply` runs on the pool with no lock; two concurrent runs race on `create table if not exists schema_migrations` (pg_type unique violation) or on the first pending file. `internal/testdb.Migrated` works around it in tests with its own session lock (key 727001) around `Apply`.
- `internal/auth/customer.go`: `clientIP` is `RemoteAddr`'s host; behind Caddy every client shares Caddy's address. Caddy 2 (`deploy/Caddyfile`, `reverse_proxy`) overwrites an untrusted client's `X-Forwarded-For` with the client address, so its first entry is the real client.
- `internal/seed/seed.go`: the demo orders' events name the Koramangala store staff for every staff transition; 0007 added `orders.rider_name` and `order_events.actor_name` and the `rider` actor type; the rider service seeds rider `...0801` "Arjun Rao" at Koramangala (`services/rider/internal/seed/seed.go:34`).

The whole design was spiked in the lane worktree on bcbb9c9 (tree restored before the commit): `gofmt`, `go vet` clean; every new test fails before its `feat` code (the concurrent migrate test fails 3 of 3 runs with SQLSTATE 23505; the seed test with "orders with a rider: 0, want 1"; the app 405 test on the enum once the router is fixed) and passes after; `go test -race -count=1 ./...` green in every package; `make gen postman` changes only `core.d.ts` (Postman unchanged); `make test-web` fails only on `packages/ui/src/api/core.test.ts` (TS2344) and passes (71, 295, 153 tests) with the ui fix below, which also typechecks against the old `core.d.ts`. `make test-rider` green (rider untouched).

## Goals / Non-Goals

**Goals:** expired session rows disappear; 405 with `Allow` on a wrong method; concurrent migrate runs serialise; per-client limits behind a trusted proxy; the delivered demo order names the demo rider.

**Non-Goals:** a `core-admin sweep-sessions` command or a sweeper goroutine; an index on `sessions.expires_at`; HEAD answered as GET; the remote address in the request log (it is not logged today); the rider service's copies of these ceilings; trusting a list of proxy addresses.

## Decisions

### 1. Sweep on session start, one statement

`DeleteExpiredSessions`: `delete from sessions where expires_at <= now();`, called first in `startSession`, so registration, customer sign-in and staff sign-in all sweep. The predicate is the exact complement of the live checks (`expires_at > now()`), and `expires_at` already carries the slide, so a session is deleted only once no request could use it. A failing delete fails the sign-in with 500 (the insert right after would fail on the same database anyway). No command, no goroutine: sign-ins happen whenever anyone uses the product, and expired rows are harmless between sweeps (never admitted). Concurrent sweeps delete the same rows in the same scan order and just wait on each other. Ceiling: one unindexed scan of `sessions` per sign-in; add an index on `expires_at` or a periodic sweep if live sessions reach hundreds of thousands (`ponytail:` comment in `auth.go`).

### 2. 405 through chi's `MethodNotAllowed` hook, `Allow` rebuilt with `Routes.Match`

`methodNotAllowed` matches the request path (chi's own choice: `RawPath` when set, else `Path`) against the root mux for each of GET, POST, PUT, PATCH, DELETE (the only methods core registers), with a fresh `chi.NewRouteContext()` per call, and sets one `Allow` header joined by `, ` in that order. Body: the envelope `{"error":{"code":"method_not_allowed","message":"method not allowed"}}`. It runs inside the root middleware chain, so it carries `X-Request-Id`, CORS headers and the request log line (route pattern empty, as for 404). CORS preflights from allowed origins are answered by `cors` before routing and stay 204. `OPTIONS` that is not an allowed preflight now answers 405 instead of 404; HEAD on a GET route answers 405 `Allow: GET` (net/http drops the body) instead of 404: both follow from the hook, no extra code. `openapi.json` lists no 405 responses (the contract test checks routes, not this fallback); only the enum gains the code, and `TestWrongMethod` fails if it is missing. Ceiling: `allowable` must grow if core ever registers another method.

### 3. Session advisory lock inside `Apply`, on a hijacked connection

`Apply` acquires a pool connection, hijacks it (it leaves the pool), takes `pg_advisory_lock(727001)` and runs bookkeeping, the version read and every file's transaction on that connection; `defer conn.Close(context.Background())` ends the session, which releases the lock even when `ctx` is cancelled or a migration fails, and never returns a locked connection to the pool. Why not `pg_advisory_xact_lock` per file: the version read happens before the file transactions, so two runs would still both decide to apply 0001. Key 727001 is the value `testdb` already used (advisory keys are per database, so the rider database never contends). `testdb.Migrated` drops its own lock: a second lock on another connection with the same key would deadlock, and with `Apply` locking it is redundant (it existed for the citext race, which the new lock covers). The lock waits without a timeout; `ctx` bounds it (`testdb` 60 s). Ceiling: test packages migrating in parallel serialise on one key across schemas of the test database, as they already did.

### 4. `SHOPPERSTOP_CORE_TRUST_PROXY` on the limiter

`config.Config.TrustProxy bool`; `Load` trims the value; `""` and `false` mean false, `true` true, anything else (including `TRUE`, `1`, `yes`) the problem `SHOPPERSTOP_CORE_TRUST_PROXY must be true or false (got "...")`, reported with all other problems. `auth.Limiter` gains an exported `TrustProxy bool`, set by `cmd/core` after `NewLimiter` and before serving (no signature change for the nine callers). `refused` passes it to `clientIP(r, trustProxy)`: the first comma-separated `X-Forwarded-For` entry, trimmed, when trusted and non-empty, else `RemoteAddr`'s host as today. No IP parsing: a trusted proxy writes the value, and an untrusted client could already pick any address. The request log is unchanged (it logs no address). Spoofing: with `true`, anyone who reaches the core port directly chooses their bucket; set it only where core is reachable solely through Caddy. The Makefile does not set it (dev, e2e and `prod-local` keep `false`; `prod-local` is one user on localhost).

### 5. Demo rider on SS-DEMOAAAB, literal values

The orders insert gains `rider_name` (`'Arjun Rao'` for `...0701`, null for the others); the events statement gains `actor_name`, and the two last `...0701` rows change actor type `staff` to `rider`; the actor-id `case` maps `rider` to `'00000000-0000-4000-8000-000000000801'::uuid` and the actor-name `case` maps `rider` to `'Arjun Rao'` (null otherwise, as live staff and customer events write). Literal, like the customer and address snapshots, because the rider is in another service's database. `summary.go` describes `...0701` as "SS-DEMOAAAB, delivered" and names no rider, so it is unchanged and `TestSummaryMatchesSeed` stays green. The existing "events with no actor" and "status is the latest event" assertions still hold. Ceiling: if the rider seed renames its demo rider, both seeds change together.

### Cross-area: `packages/ui/src/api/core.test.ts`

`response types are usable by name` asserts `toEqualTypeOf` the nine-code union, so the regenerated `core.d.ts` fails `tsc` (TS2344). Fix for ui, valid against both the old and the new `core.d.ts` (checked with `tsc -p tsconfig.json` on both): assert that the known codes extend the generated union instead of equalling it.

```diff
-  expectTypeOf<components['schemas']['Error']['error']['code']>().toEqualTypeOf<
+  expectTypeOf<
     | 'validation'
     | 'unauthorized'
     | 'forbidden'
     | 'not_found'
     | 'conflict'
     | 'out_of_stock'
     | 'not_serviceable'
     | 'rate_limited'
     | 'internal'
-  >()
+  >().toExtend<components['schemas']['Error']['error']['code']>()
```

No app (web, admin) breaks: `apps/admin/src/routes/sign-in.tsx:13` maps codes through `Partial<Record<ApiError['code'], string>>`, which a new member does not break. The rider app and mobile are not on main.

## Risks / Trade-offs

- [The sweep adds a write to every sign-in] → one indexed-by-nothing delete over a table bounded by live sessions; acceptable at this scale, ceiling named.
- [A migrate run blocked by a hung holder waits forever] → `core-admin migrate` uses `context.Background()`; a hung holder is a stuck process to kill, which ends its session and frees the lock.
- [`TrustProxy=true` without a proxy lets clients choose their bucket] → default false, documented in the field comment and here.

## Code (verbatim diffs from the spike)

Apply each `test` diff in the task's first commit and the `feat` diff in the second. Generated files (`internal/auth/db/auth.sql.go`, `packages/ui/src/api/core.d.ts`) come from `make gen` and are not shown.

### Task 1: migration lock, tests

```diff
diff --git a/services/core/internal/migrate/migrate_test.go b/services/core/internal/migrate/migrate_test.go
index e83cefc..7946f6e 100644
--- a/services/core/internal/migrate/migrate_test.go
+++ b/services/core/internal/migrate/migrate_test.go
@@ -4,7 +4,9 @@ import (
 	"context"
 	"os"
 	"reflect"
+	"slices"
 	"strings"
+	"sync"
 	"testing"
 	"testing/fstest"
 
@@ -198,3 +200,36 @@ func TestApplyRejectsDuplicateVersion(t *testing.T) {
 		t.Fatal("t1 exists: a file was applied before the refusal")
 	}
 }
+
+// TestApplyConcurrentRunsSerialise: two runs started together both succeed and
+// every file is applied and recorded exactly once. The first file sleeps so
+// that, without the lock, the second run reads schema_migrations while the
+// first is still inside 0001_a and tries to apply it too.
+func TestApplyConcurrentRunsSerialise(t *testing.T) {
+	reset(t, "t1", "t2")
+	fsys := fstest.MapFS{
+		"0001_a.sql": {Data: []byte("select pg_sleep(0.3); create table t1 (id int);")},
+		"0002_b.sql": {Data: []byte("create table t2 (id int);")},
+	}
+	ctx := context.Background()
+	var wg sync.WaitGroup
+	var applied [2][]string
+	var errs [2]error
+	for i := range 2 {
+		wg.Go(func() { applied[i], errs[i] = migrate.Apply(ctx, pool, fsys) })
+	}
+	wg.Wait()
+	for i, err := range errs {
+		if err != nil {
+			t.Fatalf("run %d: %v", i+1, err)
+		}
+	}
+	want := []string{"0001_a", "0002_b"}
+	both := slices.Sorted(slices.Values(append(slices.Clone(applied[0]), applied[1]...)))
+	if !reflect.DeepEqual(both, want) {
+		t.Fatalf("the two runs applied %v and %v, want each of %v exactly once", applied[0], applied[1], want)
+	}
+	if got := recorded(t); !reflect.DeepEqual(got, want) {
+		t.Fatalf("recorded %v, want %v", got, want)
+	}
+}
```

### Task 1: migration lock, code

```diff
diff --git a/services/core/internal/migrate/migrate.go b/services/core/internal/migrate/migrate.go
index bed59bc..c4c60ca 100644
--- a/services/core/internal/migrate/migrate.go
+++ b/services/core/internal/migrate/migrate.go
@@ -12,6 +12,9 @@ import (
 	"github.com/jackc/pgx/v5/pgxpool"
 )
 
+// lockKey is the session advisory lock every Apply holds on its database.
+const lockKey = 727001
+
 var fileName = regexp.MustCompile(`^(\d{4})_[a-z0-9_]+\.sql$`)
 
 const bookkeeping = `create table if not exists schema_migrations (
@@ -24,9 +27,9 @@ const bookkeeping = `create table if not exists schema_migrations (
 // recorded, in file-name order. Each file runs in its own transaction with
 // its version insert, so a failure leaves no trace of that file and stops the
 // run. Apply returns the versions applied by this call. Two files sharing a
-// number are refused before anything runs. Two runners racing fail on the
-// primary key instead of waiting.
-// ponytail: no advisory lock; add pg_advisory_lock when deploys migrate from more than one process.
+// number are refused before anything runs. The whole run holds a session
+// advisory lock on its own connection, so a second runner on the same
+// database waits for the first and then applies only what is still pending.
 func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error) {
 	entries, err := fs.ReadDir(fsys, ".")
 	if err != nil {
@@ -49,10 +52,22 @@ func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error
 		files = append(files, e.Name())
 	}
 
-	if _, err := pool.Exec(ctx, bookkeeping); err != nil {
+	// The connection leaves the pool and is closed at the end: closing the
+	// session releases the lock even when ctx is already cancelled.
+	pc, err := pool.Acquire(ctx)
+	if err != nil {
+		return nil, fmt.Errorf("migrate: connect: %w", err)
+	}
+	conn := pc.Hijack()
+	defer conn.Close(context.Background())
+	if _, err := conn.Exec(ctx, "select pg_advisory_lock($1)", lockKey); err != nil {
+		return nil, fmt.Errorf("migrate: lock: %w", err)
+	}
+
+	if _, err := conn.Exec(ctx, bookkeeping); err != nil {
 		return nil, fmt.Errorf("migrate: create schema_migrations: %w", err)
 	}
-	rows, err := pool.Query(ctx, "select version from schema_migrations")
+	rows, err := conn.Query(ctx, "select version from schema_migrations")
 	if err != nil {
 		return nil, fmt.Errorf("migrate: read schema_migrations: %w", err)
 	}
@@ -80,7 +95,7 @@ func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error
 		if err != nil {
 			return applied, fmt.Errorf("migrate %s: read: %w", name, err)
 		}
-		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
+		err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
 			if _, err := tx.Exec(ctx, string(body)); err != nil {
 				return err
 			}
diff --git a/services/core/internal/testdb/testdb.go b/services/core/internal/testdb/testdb.go
index a458d69..91f6696 100644
--- a/services/core/internal/testdb/testdb.go
+++ b/services/core/internal/testdb/testdb.go
@@ -17,10 +17,6 @@ import (
 
 const defaultURL = "postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable"
 
-// migrationLock serialises migrations across test packages: two packages
-// creating the citext extension at once race on pg_extension.
-const migrationLock = 727001
-
 // Open returns a pool whose connections search the schema test_<name>_<pid>,
 // created fresh, then public (the citext type lives there). The cleanup drops
 // that schema and closes the pool. Open panics when the database is
@@ -62,27 +58,13 @@ func Open(name string) (*pgxpool.Pool, func()) {
 }
 
 // Migrated is Open followed by every embedded migration applied to the test
-// schema, under a database-wide advisory lock. It panics on any error.
+// schema. migrate.Apply's advisory lock serialises the packages, which would
+// otherwise race creating the citext extension. It panics on any error.
 func Migrated(name string) (*pgxpool.Pool, func()) {
 	pool, cleanup := Open(name)
 	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
 	defer cancel()
-
-	conn, err := pool.Acquire(ctx)
-	if err != nil {
-		cleanup()
-		panic(fmt.Sprintf("testdb: acquire migration connection: %v", err))
-	}
-	defer conn.Release()
-	if _, err := conn.Exec(ctx, "select pg_advisory_lock($1)", migrationLock); err != nil {
-		cleanup()
-		panic(fmt.Sprintf("testdb: lock migrations: %v", err))
-	}
-	_, err = migrate.Apply(ctx, pool, migrations.FS)
-	if _, uerr := conn.Exec(ctx, "select pg_advisory_unlock($1)", migrationLock); err == nil {
-		err = uerr
-	}
-	if err != nil {
+	if _, err := migrate.Apply(ctx, pool, migrations.FS); err != nil {
 		cleanup()
 		panic(fmt.Sprintf("testdb: migrate %s: %v", name, err))
 	}
```

### Task 2: session sweep and trusted proxy, tests

```diff
diff --git a/services/core/internal/app/accounts_test.go b/services/core/internal/app/accounts_test.go
index 7ef94d2..0294a67 100644
--- a/services/core/internal/app/accounts_test.go
+++ b/services/core/internal/app/accounts_test.go
@@ -293,6 +293,33 @@ func TestRegisterRateLimitedPerEmail(t *testing.T) {
 	}
 }
 
+// signInFrom signs email in at base with testPassword over a new connection
+// (so a new client port) carrying forwardedFor as X-Forwarded-For.
+func signInFrom(t *testing.T, base, email, forwardedFor string) (int, []byte) {
+	t.Helper()
+	b, err := json.Marshal(map[string]string{"email": email, "password": testPassword})
+	if err != nil {
+		t.Fatal(err)
+	}
+	req, err := http.NewRequest(http.MethodPost, base+"/api/core/v1/auth/sign-in", bytes.NewReader(b))
+	if err != nil {
+		t.Fatal(err)
+	}
+	req.Header.Set("Content-Type", "application/json")
+	req.Header.Set("X-Forwarded-For", forwardedFor)
+	req.Close = true
+	resp, err := http.DefaultClient.Do(req)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer resp.Body.Close()
+	var out bytes.Buffer
+	if _, err := out.ReadFrom(resp.Body); err != nil {
+		t.Fatal(err)
+	}
+	return resp.StatusCode, out.Bytes()
+}
+
 // TestSignInRateLimitedPerIP: two sign-ins from one client IP pass and the
 // third is refused, though every attempt names a different email and sends a
 // different X-Forwarded-For. Each request opens a new connection, so a new
@@ -301,43 +328,43 @@ func TestSignInRateLimitedPerIP(t *testing.T) {
 	a := auth.New(testPool, testPepper, auth.NewLimiter(100, 2, time.Hour, time.Now), nil)
 	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
 	t.Cleanup(limited.Close)
-	signIn := func(email, forwardedFor string) (int, []byte) {
-		t.Helper()
-		b, err := json.Marshal(map[string]string{"email": email, "password": testPassword})
-		if err != nil {
-			t.Fatal(err)
-		}
-		req, err := http.NewRequest(http.MethodPost, limited.URL+"/api/core/v1/auth/sign-in", bytes.NewReader(b))
-		if err != nil {
-			t.Fatal(err)
-		}
-		req.Header.Set("Content-Type", "application/json")
-		req.Header.Set("X-Forwarded-For", forwardedFor)
-		req.Close = true
-		resp, err := http.DefaultClient.Do(req)
-		if err != nil {
-			t.Fatal(err)
-		}
-		defer resp.Body.Close()
-		var out bytes.Buffer
-		if _, err := out.ReadFrom(resp.Body); err != nil {
-			t.Fatal(err)
-		}
-		return resp.StatusCode, out.Bytes()
-	}
 	for i, forwarded := range []string{"203.0.113.1", "203.0.113.2"} {
 		email := seedCustomer(t).Customer.Email
-		if status, body := signIn(email, forwarded); status != http.StatusOK {
+		if status, body := signInFrom(t, limited.URL, email, forwarded); status != http.StatusOK {
 			t.Fatalf("attempt %d: got %d %s, want 200", i+1, status, body)
 		}
 	}
 	email := seedCustomer(t).Customer.Email
-	status, body := signIn(email, "203.0.113.3")
+	status, body := signInFrom(t, limited.URL, email, "203.0.113.3")
 	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
 		t.Fatalf("third attempt from one IP: got %d %s, want 429 rate_limited", status, body)
 	}
 }
 
+// TestSignInRateLimitedPerForwardedIP: behind a trusted proxy the per-IP count
+// keys on the first X-Forwarded-For address, so a third sign-in from one
+// forwarded client is refused while another client behind the same proxy passes.
+func TestSignInRateLimitedPerForwardedIP(t *testing.T) {
+	limit := auth.NewLimiter(100, 2, time.Hour, time.Now)
+	limit.TrustProxy = true
+	a := auth.New(testPool, testPepper, limit, nil)
+	limited := httptest.NewServer(New(testPool, nil, a, blob.Disk{Dir: filesDir}))
+	t.Cleanup(limited.Close)
+	for i, forwarded := range []string{"203.0.113.7", " 203.0.113.7 , 10.0.0.1"} {
+		email := seedCustomer(t).Customer.Email
+		if status, body := signInFrom(t, limited.URL, email, forwarded); status != http.StatusOK {
+			t.Fatalf("attempt %d from 203.0.113.7: got %d %s, want 200", i+1, status, body)
+		}
+	}
+	status, body := signInFrom(t, limited.URL, seedCustomer(t).Customer.Email, "203.0.113.7, 10.0.0.1")
+	if e := decodeError(t, body); status != http.StatusTooManyRequests || e.Error.Code != "rate_limited" {
+		t.Fatalf("third attempt from 203.0.113.7: got %d %s, want 429 rate_limited", status, body)
+	}
+	if status, body := signInFrom(t, limited.URL, seedCustomer(t).Customer.Email, "203.0.113.8, 10.0.0.1"); status != http.StatusOK {
+		t.Fatalf("first attempt from 203.0.113.8 behind the same proxy: got %d %s, want 200", status, body)
+	}
+}
+
 func TestPatchMe(t *testing.T) {
 	s := newCustomer(t)
 	status, body := call(t, http.MethodPatch, "/api/core/v1/me", s.Token,
diff --git a/services/core/internal/auth/auth_test.go b/services/core/internal/auth/auth_test.go
index 2e24bdd..df6f435 100644
--- a/services/core/internal/auth/auth_test.go
+++ b/services/core/internal/auth/auth_test.go
@@ -494,3 +494,47 @@ func TestOrServiceKeepsStaffRules(t *testing.T) {
 		t.Fatalf("store staff through OrService(RequireAdmin): %d %s, want 403", rec.Code, rec.Body.String())
 	}
 }
+
+// TestStartSessionSweepsExpired: starting a session deletes every customer and
+// staff session at or past its expiry and keeps the live ones.
+func TestStartSessionSweepsExpired(t *testing.T) {
+	ctx := context.Background()
+	a := New(testPool, testPepper, nil, nil)
+	cust := newCustomer(t)
+	staff := newStaff(t, db.StaffRoleAdmin, nil)
+	var expired, live []string
+	for i, subject := range []struct{ typ, id string }{{"customer", cust.ID}, {"staff", staff.ID}, {"customer", cust.ID}, {"staff", staff.ID}} {
+		tok, err := a.startSession(ctx, subject.typ, subject.id)
+		if err != nil {
+			t.Fatal(err)
+		}
+		if i < 2 {
+			if _, err := testPool.Exec(ctx, "update sessions set expires_at = now() - interval '1 second' where token_hash = $1", hashOf(tok)); err != nil {
+				t.Fatal(err)
+			}
+			expired = append(expired, tok)
+		} else {
+			live = append(live, tok)
+		}
+	}
+	if _, err := a.startSession(ctx, "customer", cust.ID); err != nil {
+		t.Fatal(err)
+	}
+	count := func(tok string) int {
+		var n int
+		if err := testPool.QueryRow(ctx, "select count(*) from sessions where token_hash = $1", hashOf(tok)).Scan(&n); err != nil {
+			t.Fatal(err)
+		}
+		return n
+	}
+	for _, tok := range expired {
+		if n := count(tok); n != 0 {
+			t.Fatalf("expired session still stored (%d rows), want swept", n)
+		}
+	}
+	for _, tok := range live {
+		if n := count(tok); n != 1 {
+			t.Fatalf("live session has %d rows, want kept", n)
+		}
+	}
+}
diff --git a/services/core/internal/config/config_test.go b/services/core/internal/config/config_test.go
index f332481..eda7180 100644
--- a/services/core/internal/config/config_test.go
+++ b/services/core/internal/config/config_test.go
@@ -117,6 +117,27 @@ func TestLoadLogLevel(t *testing.T) {
 	}
 }
 
+// TestLoadTrustProxy: unset, empty and "false" load false, "true" loads true
+// (surrounding spaces ignored), anything else refuses naming the variable.
+func TestLoadTrustProxy(t *testing.T) {
+	for value, want := range map[string]bool{"": false, "false": false, " true ": true, "true": true} {
+		vars := valid()
+		vars["SHOPPERSTOP_CORE_TRUST_PROXY"] = value
+		cfg, err := config.Load(env(vars))
+		if err != nil || cfg.TrustProxy != want {
+			t.Fatalf("Load with %q: TrustProxy %v, err %v; want %v and no error", value, cfg.TrustProxy, err, want)
+		}
+	}
+	for _, value := range []string{"yes", "1", "TRUE"} {
+		vars := valid()
+		vars["SHOPPERSTOP_CORE_TRUST_PROXY"] = value
+		_, err := config.Load(env(vars))
+		if err == nil || !strings.Contains(err.Error(), "SHOPPERSTOP_CORE_TRUST_PROXY must be true or false") {
+			t.Fatalf("Load with %q: %v, want an error naming SHOPPERSTOP_CORE_TRUST_PROXY", value, err)
+		}
+	}
+}
+
 // TestLoadServiceTokens: the Makefile's dev and e2e values load as service rider;
 // unset, empty or only separators load none.
 func TestLoadServiceTokens(t *testing.T) {
```

### Task 2: session sweep and trusted proxy, code

```diff
diff --git a/services/core/cmd/core/main.go b/services/core/cmd/core/main.go
index 16913b1..a5a0560 100644
--- a/services/core/cmd/core/main.go
+++ b/services/core/cmd/core/main.go
@@ -54,7 +54,9 @@ func run(cfg config.Config) error {
 	}
 	slog.Info("core listening", "addr", ln.Addr().String())
 	// Sign-in and registration share one limiter: 10 attempts per email and 100 per IP per hour.
-	a := auth.New(pool, cfg.SessionPepper, auth.NewLimiter(10, 100, time.Hour, time.Now), cfg.ServiceTokens)
+	limit := auth.NewLimiter(10, 100, time.Hour, time.Now)
+	limit.TrustProxy = cfg.TrustProxy
+	a := auth.New(pool, cfg.SessionPepper, limit, cfg.ServiceTokens)
 	srv := newHTTPServer(app.New(pool, cfg.WebOrigins, a, blob.Disk{Dir: cfg.FilesDir}))
 	if err := serve(ctx, srv, ln, shutdownGrace); err != nil {
 		return err
diff --git a/services/core/internal/auth/auth.go b/services/core/internal/auth/auth.go
index 3d6f7a5..c3c16d7 100644
--- a/services/core/internal/auth/auth.go
+++ b/services/core/internal/auth/auth.go
@@ -130,8 +130,14 @@ func (a *Auth) tokenHash(token string) []byte {
 	return sum[:]
 }
 
-// startSession stores a new session for the subject and returns its token.
+// startSession deletes every expired session, then stores a new session for
+// the subject and returns its token.
+// ponytail: the sweep scans sessions on every sign-in (no index on expires_at);
+// add the index or a periodic sweep if sign-ins or live sessions grow large.
 func (a *Auth) startSession(ctx context.Context, subjectType, subjectID string) (string, error) {
+	if err := a.q.DeleteExpiredSessions(ctx); err != nil {
+		return "", err
+	}
 	token, err := newToken()
 	if err != nil {
 		return "", err
diff --git a/services/core/internal/auth/customer.go b/services/core/internal/auth/customer.go
index d3455c2..a233f37 100644
--- a/services/core/internal/auth/customer.go
+++ b/services/core/internal/auth/customer.go
@@ -99,15 +99,22 @@ func checkName(name string) (string, error) {
 // refused answers 429 and reports true when the attempt is over the limit.
 // A nil limiter admits every attempt.
 func (a *Auth) refused(w http.ResponseWriter, r *http.Request, email string) bool {
-	if a.limit == nil || a.limit.Allow(email, clientIP(r)) {
+	if a.limit == nil || a.limit.Allow(email, clientIP(r, a.limit.TrustProxy)) {
 		return false
 	}
 	httpx.WriteError(w, r, &httpx.Error{Status: http.StatusTooManyRequests, Code: "rate_limited", Message: "too many attempts, try again later"})
 	return true
 }
 
-// clientIP is the host part of RemoteAddr, without the port.
-func clientIP(r *http.Request) string {
+// clientIP is the first X-Forwarded-For address when trustProxy is set and
+// the header names one, otherwise the host part of RemoteAddr, without the port.
+func clientIP(r *http.Request, trustProxy bool) string {
+	if trustProxy {
+		first, _, _ := strings.Cut(r.Header.Get("X-Forwarded-For"), ",")
+		if first = strings.TrimSpace(first); first != "" {
+			return first
+		}
+	}
 	host, _, err := net.SplitHostPort(r.RemoteAddr)
 	if err != nil {
 		return r.RemoteAddr
diff --git a/services/core/internal/auth/limit.go b/services/core/internal/auth/limit.go
index 9f15c6f..a84ad3a 100644
--- a/services/core/internal/auth/limit.go
+++ b/services/core/internal/auth/limit.go
@@ -18,8 +18,14 @@ type bucket struct {
 // Limiter counts attempts in fixed windows per key, in memory and per process.
 // ponytail: per process; memory is bounded only per window: above pruneAt keys
 // the ended ones are dropped at most once per window, so a flood of distinct
-// keys can hold up to a window's worth of buckets. A proxy shares one IP bucket.
+// keys can hold up to a window's worth of buckets. Behind a proxy every client
+// shares the proxy's IP bucket unless TrustProxy is set.
 type Limiter struct {
+	// TrustProxy keys the per-IP count on the first X-Forwarded-For address.
+	// Set it before serving, and only when every request comes through a proxy
+	// that overwrites the header: otherwise a client picks its own key.
+	TrustProxy bool
+
 	mu        sync.Mutex
 	perEmail  int
 	perIP     int
diff --git a/services/core/internal/config/config.go b/services/core/internal/config/config.go
index c98b101..e413068 100644
--- a/services/core/internal/config/config.go
+++ b/services/core/internal/config/config.go
@@ -25,6 +25,9 @@ type Config struct {
 	// ServiceTokens maps a service name to its token, from
 	// SHOPPERSTOP_CORE_SERVICE_TOKENS ("name:token,..."), optional; nil when unset.
 	ServiceTokens map[string]string
+	// TrustProxy is SHOPPERSTOP_CORE_TRUST_PROXY: "true" or "false", optional,
+	// default false. True makes the rate limiter key on X-Forwarded-For.
+	TrustProxy bool
 }
 
 // Load reads the configuration through getenv and reports every problem
@@ -86,6 +89,14 @@ func Load(getenv func(string) string) (Config, error) {
 
 	cfg.ServiceTokens, problems = serviceTokens(getenv("SHOPPERSTOP_CORE_SERVICE_TOKENS"), problems)
 
+	switch v := strings.TrimSpace(getenv("SHOPPERSTOP_CORE_TRUST_PROXY")); v {
+	case "", "false":
+	case "true":
+		cfg.TrustProxy = true
+	default:
+		problems = append(problems, fmt.Errorf("SHOPPERSTOP_CORE_TRUST_PROXY must be true or false (got %q)", v))
+	}
+
 	if len(problems) > 0 {
 		return Config{}, errors.Join(problems...)
 	}
diff --git a/services/core/queries/auth.sql b/services/core/queries/auth.sql
index 13bdf74..6794ad6 100644
--- a/services/core/queries/auth.sql
+++ b/services/core/queries/auth.sql
@@ -36,6 +36,11 @@ select s.id as session_id, u.id, u.email, u.name, u.role, u.store_id, u.is_activ
 from sessions s join staff_users u on u.id = s.subject_id
 where s.token_hash = $1 and s.subject_type = 'staff' and s.expires_at > now() and u.is_active;
 
+-- name: DeleteExpiredSessions :exec
+-- A session at or past its expiry can never be used again: CustomerSession and
+-- StaffSession admit only expires_at > now().
+delete from sessions where expires_at <= now();
+
 -- name: DeleteSession :exec
 delete from sessions where id = $1;
 
```

### Task 3: demo rider, tests

```diff
diff --git a/services/core/internal/seed/seed_test.go b/services/core/internal/seed/seed_test.go
index eb52c22..839b442 100644
--- a/services/core/internal/seed/seed_test.go
+++ b/services/core/internal/seed/seed_test.go
@@ -598,6 +598,10 @@ func TestResetLoadsDemoOrders(t *testing.T) {
 	assertSQL(t, "orders to the demo Home address", "select count(*) from orders o join addresses a on a.id = '00000000-0000-4000-8000-000000000301' where o.address_label = 'Home' and o.address_label = a.label and o.address_line1 = a.line1 and o.address_pincode = a.pincode", 3)
 	assertSQL(t, "orders with the Koramangala snapshot", "select count(*) from orders where store_name = 'Koramangala' and promised_minutes = 10", 3)
 	assertSQL(t, "cancelled orders with a reason and a time", "select count(*) from orders where status = 'cancelled' and cancelled_at is not null and cancel_reason = 'Ordered by mistake'", 1)
+	assertSQL(t, "orders with a rider", "select count(*) from orders where rider_name is not null", 1)
+	assertSQL(t, "SS-DEMOAAAB delivered by Arjun Rao", "select count(*) from orders where id = '00000000-0000-4000-8000-000000000701' and rider_name = 'Arjun Rao'", 1)
+	assertSQL(t, "rider events", "select count(*) from order_events where actor_type = 'rider'", 2)
+	assertSQL(t, "SS-DEMOAAAB rider events by rider ...0801", "select count(*) from order_events where order_id = '00000000-0000-4000-8000-000000000701' and to_status in ('out_for_delivery', 'delivered') and actor_type = 'rider' and actor_id = '00000000-0000-4000-8000-000000000801' and actor_name = 'Arjun Rao'", 2)
 }
 
 // TestDemoOrdersThroughTheRouter: the demo customer lists the three demo
```

### Task 3: demo rider, code

```diff
diff --git a/services/core/internal/seed/seed.go b/services/core/internal/seed/seed.go
index 4909159..a9440cb 100644
--- a/services/core/internal/seed/seed.go
+++ b/services/core/internal/seed/seed.go
@@ -161,14 +161,14 @@ func load(ctx context.Context, tx pgx.Tx, h hashes) error {
 -- 1. orders ($1 customer ...0201, $2 store ...0401); totals filled by statement 3
 insert into orders (id, number, customer_id, store_id, store_name, promised_minutes, status, customer_name, customer_phone,
                     address_label, address_line1, address_pincode,
-                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason)
+                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason, rider_name)
 values
   ('00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB', $1, $2, 'Koramangala', 10, 'delivered', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, ''),
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, '', 'Arjun Rao'),
   ('00000000-0000-4000-8000-000000000702', 'SS-DEMOAAAC', $1, $2, 'Koramangala', 10, 'cancelled', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake'),
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake', null),
   ('00000000-0000-4000-8000-000000000703', 'SS-DEMOAAAD', $1, $2, 'Koramangala', 10, 'placed', 'Demo Customer', '+919800000000',
-   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '');
+   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '', null);
 `, customerID, storeKoramangala); err != nil {
 		return fmt.Errorf("insert demo orders: %w", err)
 	}
@@ -201,18 +201,21 @@ where t.order_id = o.id and s.id = o.store_id and o.number like 'SS-DEMO%';
 		return fmt.Errorf("set demo order totals: %w", err)
 	}
 	if _, err := tx.Exec(ctx, `
--- 4. events ($1 the Koramangala store staff ...0102 as the staff actor)
-insert into order_events (order_id, from_status, to_status, actor_type, actor_id, note, created_at)
+-- 4. events ($1 the Koramangala store staff ...0102 as the staff actor; the rider
+--    is the rider service's demo rider ...0801 Arjun Rao, who delivered SS-DEMOAAAB)
+insert into order_events (order_id, from_status, to_status, actor_type, actor_id, actor_name, note, created_at)
 select o.id, e.from_status::order_status, e.to_status::order_status, e.actor_type,
-       case e.actor_type when 'customer' then o.customer_id when 'staff' then $1::uuid end,
+       case e.actor_type when 'customer' then o.customer_id when 'staff' then $1::uuid
+                         when 'rider' then '00000000-0000-4000-8000-000000000801'::uuid end,
+       case e.actor_type when 'rider' then 'Arjun Rao' end,
        e.note, o.placed_at + e.after
 from (values
   ('00000000-0000-4000-8000-000000000701', null, 'placed', 'customer', '', interval '0'),
   ('00000000-0000-4000-8000-000000000701', 'placed', 'accepted', 'staff', '', interval '1 minute'),
   ('00000000-0000-4000-8000-000000000701', 'accepted', 'packing', 'staff', '', interval '2 minutes'),
   ('00000000-0000-4000-8000-000000000701', 'packing', 'ready', 'staff', '', interval '5 minutes'),
-  ('00000000-0000-4000-8000-000000000701', 'ready', 'out_for_delivery', 'staff', '', interval '6 minutes'),
-  ('00000000-0000-4000-8000-000000000701', 'out_for_delivery', 'delivered', 'staff', '', interval '11 minutes'),
+  ('00000000-0000-4000-8000-000000000701', 'ready', 'out_for_delivery', 'rider', '', interval '6 minutes'),
+  ('00000000-0000-4000-8000-000000000701', 'out_for_delivery', 'delivered', 'rider', '', interval '11 minutes'),
   ('00000000-0000-4000-8000-000000000702', null, 'placed', 'customer', '', interval '0'),
   ('00000000-0000-4000-8000-000000000702', 'placed', 'cancelled', 'customer', 'Ordered by mistake', interval '2 minutes'),
   ('00000000-0000-4000-8000-000000000703', null, 'placed', 'customer', '', interval '0')
```

### Task 4: 405 method_not_allowed, tests

```diff
diff --git a/services/core/internal/app/app_test.go b/services/core/internal/app/app_test.go
index 40f2aee..6ac263d 100644
--- a/services/core/internal/app/app_test.go
+++ b/services/core/internal/app/app_test.go
@@ -9,6 +9,7 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"os"
+	"slices"
 	"strings"
 	"testing"
 	"time"
@@ -200,3 +201,64 @@ func TestReadyzWhenDatabaseIsDown(t *testing.T) {
 		t.Fatalf("readyz took %v, want about 2s", elapsed)
 	}
 }
+
+// TestWrongMethod: a served path asked with a method it does not serve answers
+// 405 method_not_allowed with Allow naming the path's methods, and the code is
+// one the contract's Error schema lists.
+func TestWrongMethod(t *testing.T) {
+	doc, err := os.ReadFile("../../openapi.json")
+	if err != nil {
+		t.Fatal(err)
+	}
+	var spec struct {
+		Components struct {
+			Schemas struct {
+				Error struct {
+					Properties struct {
+						Error struct {
+							Properties struct {
+								Code struct {
+									Enum []string `json:"enum"`
+								} `json:"code"`
+							} `json:"properties"`
+						} `json:"error"`
+					} `json:"properties"`
+				} `json:"Error"`
+			} `json:"schemas"`
+		} `json:"components"`
+	}
+	if err := json.Unmarshal(doc, &spec); err != nil {
+		t.Fatal(err)
+	}
+	codes := spec.Components.Schemas.Error.Properties.Error.Properties.Code.Enum
+
+	for _, row := range []struct{ method, path, allow string }{
+		{http.MethodDelete, "/api/core/v1/healthz", "GET"},
+		{http.MethodPut, "/api/core/v1/me", "GET, PATCH"},
+		{http.MethodGet, "/api/core/v1/auth/sign-in", "POST"},
+	} {
+		req, err := http.NewRequest(row.method, srv.URL+row.path, nil)
+		if err != nil {
+			t.Fatal(err)
+		}
+		resp, err := http.DefaultClient.Do(req)
+		if err != nil {
+			t.Fatal(err)
+		}
+		body, err := io.ReadAll(resp.Body)
+		resp.Body.Close()
+		if err != nil {
+			t.Fatal(err)
+		}
+		e := decodeError(t, body)
+		if resp.StatusCode != http.StatusMethodNotAllowed || e.Error.Code != "method_not_allowed" {
+			t.Fatalf("%s %s: got %d %s, want 405 method_not_allowed", row.method, row.path, resp.StatusCode, body)
+		}
+		if got := resp.Header.Get("Allow"); got != row.allow {
+			t.Fatalf("%s %s: Allow %q, want %q", row.method, row.path, got, row.allow)
+		}
+		if !slices.Contains(codes, e.Error.Code) {
+			t.Fatalf("openapi.json Error code enum %v does not list %s", codes, e.Error.Code)
+		}
+	}
+}
diff --git a/services/core/internal/httpx/router_test.go b/services/core/internal/httpx/router_test.go
index 7c80854..7fdadf8 100644
--- a/services/core/internal/httpx/router_test.go
+++ b/services/core/internal/httpx/router_test.go
@@ -68,6 +68,43 @@ func TestUnknownRouteIsNotFound(t *testing.T) {
 	}
 }
 
+// TestWrongMethodIs405: a path the router serves, asked with another method,
+// answers 405 method_not_allowed with Allow listing the path's methods in a
+// fixed order; a CORS preflight on that path still answers 204.
+func TestWrongMethodIs405(t *testing.T) {
+	captureLogs(t)
+	r := NewRouter([]string{"http://b"})
+	ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) }
+	r.Patch("/x/{id}", ok)
+	r.Get("/x/{id}", ok)
+	r.Get("/y", ok)
+
+	for _, row := range []struct{ method, path, allow string }{
+		{http.MethodDelete, "/x/1", "GET, PATCH"},
+		{http.MethodPost, "/y", "GET"},
+		{http.MethodOptions, "/y", "GET"},
+	} {
+		w := do(t, r, httptest.NewRequest(row.method, row.path, nil))
+		if w.Code != http.StatusMethodNotAllowed {
+			t.Fatalf("%s %s: status %d, want 405", row.method, row.path, w.Code)
+		}
+		if got := w.Header().Get("Allow"); got != row.allow {
+			t.Fatalf("%s %s: Allow %q, want %q", row.method, row.path, got, row.allow)
+		}
+		want := `{"error":{"code":"method_not_allowed","message":"method not allowed"}}` + "\n"
+		if got := w.Body.String(); got != want {
+			t.Fatalf("%s %s: body %q, want %q", row.method, row.path, got, want)
+		}
+	}
+
+	req := httptest.NewRequest(http.MethodOptions, "/x/1", nil)
+	req.Header.Set("Origin", "http://b")
+	req.Header.Set("Access-Control-Request-Method", "PATCH")
+	if w := do(t, r, req); w.Code != http.StatusNoContent {
+		t.Fatalf("preflight: status %d, want 204", w.Code)
+	}
+}
+
 func TestPanicIsInternal(t *testing.T) {
 	logs := captureLogs(t)
 	r := NewRouter(nil)
```

### Task 4: 405 method_not_allowed, code

```diff
diff --git a/services/core/internal/httpx/router.go b/services/core/internal/httpx/router.go
index a1927ef..ce25f83 100644
--- a/services/core/internal/httpx/router.go
+++ b/services/core/internal/httpx/router.go
@@ -7,6 +7,7 @@ import (
 	"log/slog"
 	"net/http"
 	"runtime/debug"
+	"strings"
 	"time"
 
 	"github.com/go-chi/chi/v5"
@@ -15,12 +16,13 @@ import (
 
 // NewRouter returns the core router with its middleware in order: request
 // id, log and recover, CORS for origins, then whatever routes the caller
-// registers. Unknown paths and wrong methods get the 404 envelope.
+// registers. Unknown paths get the 404 envelope; a known path with a method
+// it does not serve gets 405 with Allow.
 func NewRouter(origins []string) chi.Router {
 	r := chi.NewRouter()
 	r.Use(requestID, logAndRecover, cors(origins))
 	r.NotFound(notFound)
-	r.MethodNotAllowed(notFound)
+	r.MethodNotAllowed(methodNotAllowed)
 	return r
 }
 
@@ -28,6 +30,28 @@ func notFound(w http.ResponseWriter, r *http.Request) {
 	WriteError(w, r, &Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"})
 }
 
+// allowable are the methods Allow may list, in the order it lists them.
+var allowable = []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete}
+
+// methodNotAllowed answers 405 method_not_allowed with Allow naming every
+// method the router serves on the request's path. chi does not hand a custom
+// handler the methods it found, so each one is matched again on the whole tree.
+func methodNotAllowed(w http.ResponseWriter, r *http.Request) {
+	path := r.URL.RawPath
+	if path == "" {
+		path = r.URL.Path
+	}
+	routes := chi.RouteContext(r.Context()).Routes
+	var allow []string
+	for _, m := range allowable {
+		if routes.Match(chi.NewRouteContext(), m, path) {
+			allow = append(allow, m)
+		}
+	}
+	w.Header().Set("Allow", strings.Join(allow, ", "))
+	WriteError(w, r, &Error{Status: http.StatusMethodNotAllowed, Code: "method_not_allowed", Message: "method not allowed"})
+}
+
 // requestID keeps a client X-Request-Id of 1 to 128 bytes, otherwise makes
 // 16 random bytes in hex, and echoes it on the response and in the context.
 func requestID(next http.Handler) http.Handler {
```

### Task 4: `openapi.json` edit

Run from `services/core` with `python3 -I <script>` (Python `json` round-trips the file byte for byte; Node reorders numeric keys). The script must not be named after a stdlib module (a file `enum.py` shadows `enum`).

```python
import json
p = 'openapi.json'
with open(p, encoding='utf-8') as f:
    doc = json.load(f)
codes = doc['components']['schemas']['Error']['properties']['error']['properties']['code']['enum']
assert 'method_not_allowed' not in codes
codes.insert(codes.index('rate_limited') + 1, 'method_not_allowed')
with open(p, 'w', encoding='utf-8') as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)
    f.write('\n')
```

The resulting diff is one line, `"method_not_allowed",` after `"rate_limited",` in the `Error` schema.
