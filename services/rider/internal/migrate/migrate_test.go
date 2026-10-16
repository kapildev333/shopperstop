package migrate_test

import (
	"context"
	"os"
	"reflect"
	"slices"
	"strings"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/migrate"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
	"github.com/kapildev333/shopperstop/services/rider/migrations"
)

var pool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	pool, cleanup = testdb.Open("migrate")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// reset drops the runner's bookkeeping and the test tables so each test
// starts from an empty schema.
func reset(t *testing.T, tables ...string) {
	t.Helper()
	ctx := context.Background()
	if _, err := pool.Exec(ctx, "drop table if exists schema_migrations"); err != nil {
		t.Fatal(err)
	}
	for _, tbl := range tables {
		if _, err := pool.Exec(ctx, "drop table if exists "+tbl+" cascade"); err != nil {
			t.Fatal(err)
		}
	}
}

// recorded returns the versions in schema_migrations, or nil when the table
// does not exist yet.
func recorded(t *testing.T) []string {
	t.Helper()
	ctx := context.Background()
	var exists bool
	if err := pool.QueryRow(ctx, "select to_regclass('schema_migrations') is not null").Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if !exists {
		return nil
	}
	rows, err := pool.Query(ctx, "select version from schema_migrations order by version")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return out
}

func tableExists(t *testing.T, name string) bool {
	t.Helper()
	var exists bool
	if err := pool.QueryRow(context.Background(), "select to_regclass($1) is not null", name).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	return exists
}

func TestApplyRecordsVersions(t *testing.T) {
	reset(t, "t1", "t2", "t3")
	fsys := fstest.MapFS{
		"0001_a.sql": {Data: []byte("create table t1 (id int);")},
		"0002_b.sql": {Data: []byte("create table t2 (id int);")},
		"0010_c.sql": {Data: []byte("create table t3 (id int);")},
	}
	ctx := context.Background()
	want := []string{"0001_a", "0002_b", "0010_c"}

	got, err := migrate.Apply(ctx, pool, fsys)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("applied %v, want %v", got, want)
	}
	if !reflect.DeepEqual(recorded(t), want) {
		t.Fatalf("recorded %v, want %v", recorded(t), want)
	}
	if !tableExists(t, "t1") || !tableExists(t, "t2") || !tableExists(t, "t3") {
		t.Fatal("migrations did not create their tables")
	}

	again, err := migrate.Apply(ctx, pool, fsys)
	if err != nil {
		t.Fatalf("second Apply: %v", err)
	}
	if len(again) != 0 {
		t.Fatalf("second run applied %v, want nothing", again)
	}
	if !reflect.DeepEqual(recorded(t), want) {
		t.Fatalf("recorded after second run %v, want %v", recorded(t), want)
	}
}

func TestApplyRollsBackFailedMigration(t *testing.T) {
	reset(t, "t1", "t2")
	ctx := context.Background()
	broken := fstest.MapFS{
		"0001_a.sql": {Data: []byte("create table t1 (id int);")},
		"0002_b.sql": {Data: []byte("create table t2 (id int);\nselect * from missing_table;")},
	}

	_, err := migrate.Apply(ctx, pool, broken)
	if err == nil {
		t.Fatal("Apply with a failing 0002_b.sql: want error, got nil")
	}
	if !strings.Contains(err.Error(), "0002_b.sql") {
		t.Fatalf("error does not name 0002_b.sql: %v", err)
	}
	if tableExists(t, "t2") {
		t.Fatal("t2 exists: the failed file was not rolled back")
	}
	if want := []string{"0001_a"}; !reflect.DeepEqual(recorded(t), want) {
		t.Fatalf("recorded %v, want %v", recorded(t), want)
	}

	fixed := fstest.MapFS{
		"0001_a.sql": {Data: []byte("create table t1 (id int);")},
		"0002_b.sql": {Data: []byte("create table t2 (id int);")},
	}
	got, err := migrate.Apply(ctx, pool, fixed)
	if err != nil {
		t.Fatalf("retry Apply: %v", err)
	}
	if want := []string{"0002_b"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("retry applied %v, want %v", got, want)
	}
	if want := []string{"0001_a", "0002_b"}; !reflect.DeepEqual(recorded(t), want) {
		t.Fatalf("recorded after retry %v, want %v", recorded(t), want)
	}
}

func TestApplyRejectsMisnamedFile(t *testing.T) {
	reset(t, "t1")
	fsys := fstest.MapFS{
		"0001_a.sql":     {Data: []byte("create table t1 (id int);")},
		"add-stores.sql": {Data: []byte("create table t2 (id int);")},
	}

	_, err := migrate.Apply(context.Background(), pool, fsys)
	if err == nil {
		t.Fatal("Apply with add-stores.sql: want error, got nil")
	}
	if !strings.Contains(err.Error(), "add-stores.sql") {
		t.Fatalf("error does not name add-stores.sql: %v", err)
	}
	if got := recorded(t); len(got) != 0 {
		t.Fatalf("recorded %v, want nothing", got)
	}
	if tableExists(t, "t1") {
		t.Fatal("t1 exists: a file was applied before the refusal")
	}
}

func TestApplyRejectsDuplicateVersion(t *testing.T) {
	reset(t, "t1", "t2")
	fsys := fstest.MapFS{
		"0001_a.sql": {Data: []byte("create table t1 (id int);")},
		"0002_a.sql": {Data: []byte("create table t2 (id int);")},
		"0002_b.sql": {Data: []byte("create table t2 (id int);")},
	}

	_, err := migrate.Apply(context.Background(), pool, fsys)
	if err == nil {
		t.Fatal("Apply with two 0002 files: want error, got nil")
	}
	want := "migrate 0002_b.sql: version 0002 already used by 0002_a.sql"
	if err.Error() != want {
		t.Fatalf("error %q, want %q", err.Error(), want)
	}
	if got := recorded(t); len(got) != 0 {
		t.Fatalf("recorded %v, want nothing", got)
	}
	if tableExists(t, "t1") {
		t.Fatal("t1 exists: a file was applied before the refusal")
	}
}

// TestEmbeddedMigrationsApplyOnce applies the rider's embedded files: the first
// run records 0001_init, 0002_riders and 0003_deliveries, the second applies nothing.
func TestEmbeddedMigrationsApplyOnce(t *testing.T) {
	reset(t, "riders", "sessions")
	ctx := context.Background()
	if _, err := pool.Exec(ctx, "drop function if exists set_updated_at() cascade"); err != nil {
		t.Fatal(err)
	}
	want := []string{"0001_init", "0002_riders", "0003_deliveries"}

	got, err := migrate.Apply(ctx, pool, migrations.FS)
	if err != nil {
		t.Fatalf("Apply: %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("applied %v, want %v", got, want)
	}
	again, err := migrate.Apply(ctx, pool, migrations.FS)
	if err != nil {
		t.Fatalf("second Apply: %v", err)
	}
	if len(again) != 0 {
		t.Fatalf("second run applied %v, want nothing", again)
	}
	if !reflect.DeepEqual(recorded(t), want) {
		t.Fatalf("recorded %v, want %v", recorded(t), want)
	}
}

// TestApplyConcurrentRunsSerialise: two runs started together both succeed and
// every file is applied and recorded exactly once. The first file sleeps so
// that, without the lock, the second run reads schema_migrations while the
// first is still inside 0001_a and tries to apply it too.
func TestApplyConcurrentRunsSerialise(t *testing.T) {
	reset(t, "t1", "t2")
	fsys := fstest.MapFS{
		"0001_a.sql": {Data: []byte("select pg_sleep(0.3); create table t1 (id int);")},
		"0002_b.sql": {Data: []byte("create table t2 (id int);")},
	}
	ctx := context.Background()
	var wg sync.WaitGroup
	var applied [2][]string
	var errs [2]error
	for i := range 2 {
		wg.Go(func() { applied[i], errs[i] = migrate.Apply(ctx, pool, fsys) })
	}
	wg.Wait()
	for i, err := range errs {
		if err != nil {
			t.Fatalf("run %d: %v", i+1, err)
		}
	}
	want := []string{"0001_a", "0002_b"}
	both := slices.Sorted(slices.Values(append(slices.Clone(applied[0]), applied[1]...)))
	if !reflect.DeepEqual(both, want) {
		t.Fatalf("the two runs applied %v and %v, want each of %v exactly once", applied[0], applied[1], want)
	}
	if got := recorded(t); !reflect.DeepEqual(got, want) {
		t.Fatalf("recorded %v, want %v", got, want)
	}
}
