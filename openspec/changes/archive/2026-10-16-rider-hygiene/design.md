## Context

The rider service copied core's `internal/httpx`, `internal/migrate` and `internal/testdb` at `5335efc` (D31). core-P3-L3 then changed core's copies (`openspec/changes/archive/2026-10-15-core-hygiene/`, design.md Decisions 2 and 3). Today, against core on `main`:

- `services/rider/internal/httpx/router.go` differs from core's only by the word "rider" in the `NewRouter` comment and the missing 405 (`r.MethodNotAllowed(notFound)`, no `methodNotAllowed`, no `allowable`).
- `services/rider/internal/migrate/migrate.go` differs only by the provenance comment and the missing lock (`Apply` runs on the pool; `ponytail:` "no advisory lock").
- `services/rider/internal/testdb/testdb.go` `Migrated` takes its own session lock, key 727101, around `Apply`, exactly as core's did before core-hygiene.
- `services/rider/internal/app/app.go` registers every route flat on the root mux (`r.Get`, `r.Post`, `r.Put`, `r.Patch`, some through `r.With(...)`, which are inline muxes sharing the root tree), so `chi.RouteContext(ctx).Routes.Match` on the root finds every route. Methods registered: GET, POST, PUT (`/me/location`), PATCH (`/admin/riders/{id}`); no DELETE.
- `internal/app/app_test.go` `TestUnknownRouteAndWrongMethod` asserts 404 for `DELETE /healthz`.

The whole design was spiked in this worktree on `a7ce2db` (tree restored before the commit): `TestApplyConcurrentRunsSerialise` fails 3 of 3 runs with SQLSTATE 23505 on `pg_type_typname_nsp_index` before the lock and passes 3 of 3 after; `TestWrongMethodIs405` fails (`DELETE /x/1: status 404`) and `TestUnknownRouteAndWrongMethod` fails (`DELETE /api/rider/v1/healthz: got 404`) before the router change; with the router fixed and the enum not yet edited, `TestUnknownRouteAndWrongMethod` still fails on the enum check; after both, `make test-rider` is green (10 packages), `make gen` changes only `packages/ui/src/api/rider.d.ts` (one line), `make postman` leaves the rider collection unchanged, `apps/rider`, `apps/web` and `apps/admin` typecheck, and `packages/ui` typecheck fails only with TS2344 at `src/api/api.test.ts:73` until the ui fix below is in.

## Goals / Non-Goals

**Goals:** 405 with `Allow` on a wrong method; concurrent rider migrate runs serialise; the rider's copies match core's again apart from names and the lock key.

**Non-Goals:** sweeping expired rider sessions (core-hygiene Decision 1), a trusted proxy for the rider limiter (Decision 4), core's demo rider (Decision 5, core only), HEAD as GET, 405 responses per operation in `openapi.json`, a shared Go module for the copied packages (D31 keeps copies until payment lands).

## Decisions

### 1. 405 exactly as core-hygiene Decision 2

`router.go` gains core's `allowable` and `methodNotAllowed` byte for byte and registers `r.MethodNotAllowed(methodNotAllowed)`. `allowable` keeps core's five methods although the rider registers no DELETE: one extra `Match` per 405 is free, a DELETE route later needs no edit, and the file stays a diff of one comment word from core's (D31: no drift). Behaviour follows core's: the 405 runs inside the root middleware chain (request id, CORS headers, log line with empty route); allowed preflights are answered by `cors` before routing and stay 204; `OPTIONS` that is not an allowed preflight and HEAD on a GET route now answer 405 instead of 404. Body `{"error":{"code":"method_not_allowed","message":"method not allowed"}}`. Ceiling (core's): `allowable` must grow if the rider ever registers another method; routes must stay on the root tree (a `Mount`ed sub-router would need the walk to go through it).

### 2. Migration lock exactly as core-hygiene Decision 3, key 727101

`Apply` acquires a pool connection, hijacks it, takes `pg_advisory_lock(727101)`, and runs bookkeeping, the version read and every file's transaction on that connection; `defer conn.Close(context.Background())` releases the lock even on a cancelled `ctx` or a failed file and never returns a locked connection to the pool. Key 727101 is the value rider's `testdb` already used, distinct from core's 727001. Advisory keys are per database and the services have separate databases, so they could never contend; the distinct key only keeps a shared-database setup (a misconfigured URL) from serialising the two services. `testdb.Migrated` drops its own lock: a second session lock on the same key on another connection would deadlock against `Apply`'s, and `Apply`'s lock covers the citext race it existed for. The lock waits without a timeout; `ctx` bounds it (`testdb` 60 s; `rider-admin migrate` uses `context.Background()`, so a hung holder is a process to kill). Ceiling (core's): test packages migrating in parallel serialise on one key across the test database's schemas, as they already did.

### 3. Tests reuse core's

`TestApplyConcurrentRunsSerialise` and `TestWrongMethodIs405` are core's tests verbatim. `TestUnknownRouteAndWrongMethod` keeps its name (the scenario keeps its name) and becomes core's `TestWrongMethod` table plus the unknown-path row: `GET /nope` 404 with no `Allow`, `DELETE /healthz` `Allow: GET`, `PUT /admin/riders/{uuid}` `Allow: GET, PATCH` (a staff route: the 405 answers before any auth middleware, which runs only on a matched route), `GET /auth/sign-in` `Allow: POST`; every code must be in the `Error` enum of `openapi.json`. The preflight scenario is proven by `TestWrongMethodIs405`'s last request (and the existing CORS test).

### 4. Sweep stays out

core's sweep (Decision 1) would be one `delete from sessions where expires_at <= now()` in the rider's session start, but it changes a third requirement ("Rider bearer sessions"), needs a sqlc query, a test and a third task, and riders sign in rarely (30-day sliding sessions), so expired rows pile up slowly and are never admitted. Backlog.

### Cross-area: `packages/ui/src/api/api.test.ts`

"rider response types are usable by name" asserts the seven-code rider union with `toEqualTypeOf`, so the regenerated `rider.d.ts` fails `tsc` (TS2344). Fix for ui, the same shape core-hygiene gave `core.test.ts` (#226), checked with `tsc -p tsconfig.json` against the old and the new `rider.d.ts` (both exit 0):

```diff
@@ -69,7 +69,8 @@ it('rider response types are usable by name', () => {
   expectTypeOf<RiderPaths['/readyz']['get']['responses'][200]['content']['application/json']>().toEqualTypeOf<{
     status: 'ok'
   }>()
-  expectTypeOf<RiderComponents['schemas']['Error']['error']['code']>().toEqualTypeOf<
+  // The seven Phase 3 codes stay in the contract; the rider service may add codes (rider-P4-L1 adds method_not_allowed).
+  expectTypeOf<
     | 'validation'
     | 'unauthorized'
     | 'forbidden'
@@ -77,5 +78,5 @@ it('rider response types are usable by name', () => {
     | 'conflict'
     | 'rate_limited'
     | 'internal'
-  >()
+  >().toExtend<RiderComponents['schemas']['Error']['error']['code']>()
 })
```

`apps/rider/src/routes/sign-in.tsx:13` maps codes through `Partial<Record<ApiError['code'], string>>`, which a new member does not break; the three apps typecheck against the new file.

## Risks / Trade-offs

- [Task 2 merges before ui's fix] → `make test-web` fails on TS2344 in `api.test.ts`; the manager lands ui's change first (or merges this branch with main after it lands), as core-P3-L3 did with #226.
- [A rider client relied on 404 for a wrong method] → none does: the rider app, web and admin only call served routes with their served methods.
- [HEAD on a GET route is 405 instead of 404] → same as core; nothing probes with HEAD (`deploy/Caddyfile` has no health check; the three Playwright configs poll `/api/rider/v1/healthz` with GET).

## Files

`services/rider/internal/migrate/migrate.go`, `migrate_test.go`; `services/rider/internal/testdb/testdb.go`; `services/rider/internal/httpx/router.go`, `router_test.go`; `services/rider/internal/app/app_test.go`; `services/rider/openapi.json`; generated `packages/ui/src/api/rider.d.ts`. All in the rider area except the generated file (D19 extended).

## Code (verbatim diffs from the spike)

Each diff applies with `git apply` from the worktree root on `a7ce2db`. Apply each `test` diff in the task's first commit and the `feat` diff in the second. `packages/ui/src/api/rider.d.ts` comes from `make gen` and is not shown.

### Task 1: migration lock, tests

```diff
diff --git a/services/rider/internal/migrate/migrate_test.go b/services/rider/internal/migrate/migrate_test.go
index a6646cd..2dd60bd 100644
--- a/services/rider/internal/migrate/migrate_test.go
+++ b/services/rider/internal/migrate/migrate_test.go
@@ -4,7 +4,9 @@ import (
 	"context"
 	"os"
 	"reflect"
+	"slices"
 	"strings"
+	"sync"
 	"testing"
 	"testing/fstest"
 
@@ -228,3 +230,36 @@ func TestEmbeddedMigrationsApplyOnce(t *testing.T) {
 		t.Fatalf("recorded %v, want %v", recorded(t), want)
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
diff --git a/services/rider/internal/migrate/migrate.go b/services/rider/internal/migrate/migrate.go
index 5f82337..cebe757 100644
--- a/services/rider/internal/migrate/migrate.go
+++ b/services/rider/internal/migrate/migrate.go
@@ -13,6 +13,10 @@ import (
 	"github.com/jackc/pgx/v5/pgxpool"
 )
 
+// lockKey is the session advisory lock every Apply holds on its database
+// (core's runner uses 727001; advisory keys are per database anyway).
+const lockKey = 727101
+
 var fileName = regexp.MustCompile(`^(\d{4})_[a-z0-9_]+\.sql$`)
 
 const bookkeeping = `create table if not exists schema_migrations (
@@ -25,9 +29,9 @@ const bookkeeping = `create table if not exists schema_migrations (
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
@@ -50,10 +54,22 @@ func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error
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
@@ -81,7 +97,7 @@ func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error
 		if err != nil {
 			return applied, fmt.Errorf("migrate %s: read: %w", name, err)
 		}
-		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
+		err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
 			if _, err := tx.Exec(ctx, string(body)); err != nil {
 				return err
 			}
diff --git a/services/rider/internal/testdb/testdb.go b/services/rider/internal/testdb/testdb.go
index bf2cf85..9ce8d84 100644
--- a/services/rider/internal/testdb/testdb.go
+++ b/services/rider/internal/testdb/testdb.go
@@ -18,10 +18,6 @@ import (
 
 const defaultURL = "postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable"
 
-// migrationLock serialises migrations across test packages: two packages
-// creating the citext extension at once race on pg_extension.
-const migrationLock = 727101
-
 // Open returns a pool whose connections search the schema test_<name>_<pid>,
 // created fresh, then public (the citext type lives there). The cleanup drops
 // that schema and closes the pool. Open panics when the database is
@@ -63,27 +59,13 @@ func Open(name string) (*pgxpool.Pool, func()) {
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

### Task 2: 405 method_not_allowed, tests

```diff
diff --git a/services/rider/internal/app/app_test.go b/services/rider/internal/app/app_test.go
index 6e02d65..5c2ceae 100644
--- a/services/rider/internal/app/app_test.go
+++ b/services/rider/internal/app/app_test.go
@@ -8,6 +8,7 @@ import (
 	"net/http"
 	"net/http/httptest"
 	"os"
+	"slices"
 	"strings"
 	"testing"
 	"time"
@@ -145,13 +146,56 @@ func TestReadyzWhenDatabaseIsDown(t *testing.T) {
 	}
 }
 
-// TestUnknownRouteAndWrongMethod: both answer the error envelope with code not_found.
+// TestUnknownRouteAndWrongMethod: an unknown path answers 404 not_found; a
+// served path asked with a method it does not serve answers 405
+// method_not_allowed with Allow naming the path's methods, and the code is one
+// the contract's Error schema lists.
 func TestUnknownRouteAndWrongMethod(t *testing.T) {
-	for _, c := range []struct{ method, path string }{
-		{http.MethodGet, "/api/rider/v1/nope"},
-		{http.MethodDelete, "/api/rider/v1/healthz"},
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
+	for _, c := range []struct{ method, path, allow string }{
+		{http.MethodGet, "/api/rider/v1/nope", ""},
+		{http.MethodDelete, "/api/rider/v1/healthz", "GET"},
+		{http.MethodPut, "/api/rider/v1/admin/riders/123e4567-e89b-12d3-a456-426614174000", "GET, PATCH"},
+		{http.MethodGet, "/api/rider/v1/auth/sign-in", "POST"},
 	} {
-		status, body := call(t, c.method, c.path)
+		req, err := http.NewRequest(c.method, srv.URL+c.path, nil)
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
 		var env struct {
 			Error struct {
 				Code string `json:"code"`
@@ -160,8 +204,18 @@ func TestUnknownRouteAndWrongMethod(t *testing.T) {
 		if err := json.Unmarshal(body, &env); err != nil {
 			t.Fatalf("%s %s: body %s is not the error envelope: %v", c.method, c.path, body, err)
 		}
-		if status != http.StatusNotFound || env.Error.Code != "not_found" {
-			t.Fatalf("%s %s: got %d %s, want 404 not_found", c.method, c.path, status, body)
+		wantStatus, wantCode := http.StatusMethodNotAllowed, "method_not_allowed"
+		if c.allow == "" {
+			wantStatus, wantCode = http.StatusNotFound, "not_found"
+		}
+		if resp.StatusCode != wantStatus || env.Error.Code != wantCode {
+			t.Fatalf("%s %s: got %d %s, want %d %s", c.method, c.path, resp.StatusCode, body, wantStatus, wantCode)
+		}
+		if got := resp.Header.Get("Allow"); got != c.allow {
+			t.Fatalf("%s %s: Allow %q, want %q", c.method, c.path, got, c.allow)
+		}
+		if !slices.Contains(codes, env.Error.Code) {
+			t.Fatalf("openapi.json Error code enum %v does not list %s", codes, env.Error.Code)
 		}
 	}
 }
diff --git a/services/rider/internal/httpx/router_test.go b/services/rider/internal/httpx/router_test.go
index ec17c79..9853c82 100644
--- a/services/rider/internal/httpx/router_test.go
+++ b/services/rider/internal/httpx/router_test.go
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

### Task 2: 405 method_not_allowed, code

The `openapi.json` hunk is the one-line result of this script, run from `services/rider` as `python3 -I <script>` (the script must not be named after a stdlib module); either the hunk or the script gives the same bytes.

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

```diff
diff --git a/services/rider/internal/httpx/router.go b/services/rider/internal/httpx/router.go
index 2e985a8..ee18732 100644
--- a/services/rider/internal/httpx/router.go
+++ b/services/rider/internal/httpx/router.go
@@ -7,6 +7,7 @@ import (
 	"log/slog"
 	"net/http"
 	"runtime/debug"
+	"strings"
 	"time"
 
 	"github.com/go-chi/chi/v5"
@@ -15,12 +16,13 @@ import (
 
 // NewRouter returns the rider router with its middleware in order: request
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
diff --git a/services/rider/openapi.json b/services/rider/openapi.json
index 73c39dd..bc57a1b 100644
--- a/services/rider/openapi.json
+++ b/services/rider/openapi.json
@@ -1574,6 +1574,7 @@
                   "not_found",
                   "conflict",
                   "rate_limited",
+                  "method_not_allowed",
                   "internal"
                 ]
               },
```
