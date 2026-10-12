package pg

import (
	"context"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("pg")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// insertCustomer inserts a customer with the given email and returns its id.
func insertCustomer(email string) (string, error) {
	var id string
	err := testPool.QueryRow(context.Background(),
		"insert into customers (email, password_hash, name) values ($1, 'hash', 'Test') returning id", email).Scan(&id)
	return id, err
}

// sqlState returns the SQLSTATE of err, or "" when err is not a PostgreSQL error.
func sqlState(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

// apiError asserts that err maps to the API error with the given status and code.
func apiError(t *testing.T, err error, status int, code string) {
	t.Helper()
	var apiErr *httpx.Error
	if !errors.As(err, &apiErr) {
		t.Fatalf("Map returned %T %v, want *httpx.Error", err, err)
	}
	if apiErr.Status != status || apiErr.Code != code {
		t.Fatalf("Map gave status %d code %q, want %d %q", apiErr.Status, apiErr.Code, status, code)
	}
}

func TestMapUniqueIsConflict(t *testing.T) {
	if _, err := insertCustomer("Ada.Unique@example.com"); err != nil {
		t.Fatalf("first insert: %v", err)
	}
	_, err := insertCustomer("ada.unique@example.com")
	if err == nil {
		t.Fatal("second insert with the same email in other case: want an error, got nil")
	}
	if !IsUnique(err) {
		t.Fatalf("IsUnique(%v) = false, want true", err)
	}
	apiError(t, Map(err), http.StatusConflict, "conflict")
}

func TestMapForeignKeyIsConflict(t *testing.T) {
	_, err := testPool.Exec(context.Background(),
		"insert into addresses (customer_id, label, line1, pincode) values ($1, 'Home', '1 Main St', '560034')",
		"00000000-0000-4000-8000-0000000000ff")
	if err == nil {
		t.Fatal("address with an unknown customer_id: want an error, got nil")
	}
	apiError(t, Map(err), http.StatusConflict, "conflict")
}

func TestMapNoRowsIsNotFound(t *testing.T) {
	var id string
	err := testPool.QueryRow(context.Background(),
		"select id from customers where id = $1", "00000000-0000-4000-8000-0000000000ee").Scan(&id)
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("query error %v, want pgx.ErrNoRows", err)
	}
	apiError(t, Map(err), http.StatusNotFound, "not_found")
}

func TestMapPassesOtherErrors(t *testing.T) {
	plain := errors.New("connection reset by peer")
	if got := Map(plain); got != plain {
		t.Fatalf("Map(plain) = %v, want the same error back", got)
	}
	if IsUnique(plain) {
		t.Fatal("IsUnique(plain) = true, want false")
	}
	if got := Map(nil); got != nil {
		t.Fatalf("Map(nil) = %v, want nil", got)
	}
}

func TestUpdatedAtTrigger(t *testing.T) {
	ctx := context.Background()
	id, err := insertCustomer("trigger@example.com")
	if err != nil {
		t.Fatalf("insert: %v", err)
	}
	if _, err := testPool.Exec(ctx, "update customers set name = 'Renamed' where id = $1", id); err != nil {
		t.Fatalf("update: %v", err)
	}
	var created, updated time.Time
	if err := testPool.QueryRow(ctx,
		"select created_at, updated_at from customers where id = $1", id).Scan(&created, &updated); err != nil {
		t.Fatal(err)
	}
	if !updated.After(created) {
		t.Fatalf("updated_at %v is not after created_at %v", updated, created)
	}
}

func TestStaffRoleMatchesStore(t *testing.T) {
	ctx := context.Background()
	const store = "00000000-0000-4000-8000-000000000401"

	_, err := testPool.Exec(ctx,
		"insert into staff_users (email, password_hash, name, role, store_id) values ('admin.store@example.com', 'hash', 'Admin', 'admin', $1)", store)
	if sqlState(err) != "23514" {
		t.Fatalf("admin with a store_id: error %v, want check violation 23514", err)
	}
	_, err = testPool.Exec(ctx,
		"insert into staff_users (email, password_hash, name, role) values ('staff.nostore@example.com', 'hash', 'Staff', 'store_staff')")
	if sqlState(err) != "23514" {
		t.Fatalf("store staff without a store_id: error %v, want check violation 23514", err)
	}
}
