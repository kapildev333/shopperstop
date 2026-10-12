package store_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
	"github.com/kapildev333/shopperstop/services/core/internal/store/db"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("store")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// newStore inserts a store with the given open flag and returns its id.
func newStore(t *testing.T, isOpen bool) string {
	t.Helper()
	row, err := db.New(testPool).CreateStore(context.Background(), db.CreateStoreParams{
		Name: "Test store", AddressLine: "1 Test Rd", Pincode: "560001", IsOpen: isOpen,
		DeliveryFeeCents: 2500, FreeDeliveryAboveCents: 19900, MinOrderCents: 9900, PromisedMinutes: 10,
	})
	if err != nil {
		t.Fatal(err)
	}
	return row.ID
}

// serve gives the store the pincodes.
func serve(t *testing.T, storeID string, pincodes ...string) {
	t.Helper()
	if err := db.New(testPool).AddServiceAreas(context.Background(), db.AddServiceAreasParams{StoreID: storeID, Pincodes: pincodes}); err != nil {
		t.Fatal(err)
	}
}

// apiError returns the *httpx.Error in err, failing the test when there is none.
func apiError(t *testing.T, err error) *httpx.Error {
	t.Helper()
	var e *httpx.Error
	if !errors.As(err, &e) {
		t.Fatalf("error %v is not an *httpx.Error", err)
	}
	return e
}

// sqlState returns the SQLSTATE of err, or "" when err is not a PostgreSQL error.
func sqlState(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code
	}
	return ""
}

func TestForPincodeFindsStore(t *testing.T) {
	ctx := context.Background()
	open := newStore(t, true)
	serve(t, open, "560034")
	closed := newStore(t, false)
	serve(t, closed, "560095")

	got, err := store.ForPincode(ctx, testPool, "560034")
	if err != nil || got.ID != open || !got.IsOpen || got.DeliveryFeeCents != 2500 || got.PromisedMinutes != 10 {
		t.Fatalf("ForPincode 560034: got %+v, %v; want the open store %s", got, err, open)
	}
	got, err = store.ForPincode(ctx, testPool, "560095")
	if err != nil || got.ID != closed || got.IsOpen {
		t.Fatalf("ForPincode 560095: got %+v, %v; want the closed store %s", got, err, closed)
	}
}

func TestForPincodeUnserved(t *testing.T) {
	_, err := store.ForPincode(context.Background(), testPool, "110001")
	if e := apiError(t, err); e.Status != 404 || e.Code != "not_serviceable" {
		t.Fatalf("ForPincode 110001: got %d %s, want 404 not_serviceable", e.Status, e.Code)
	}
}

func TestGetUnknown(t *testing.T) {
	_, err := store.Get(context.Background(), testPool, "00000000-0000-0000-0000-000000000000")
	if e := apiError(t, err); e.Status != 404 || e.Code != "not_found" {
		t.Fatalf("Get zero id: got %d %s, want 404 not_found", e.Status, e.Code)
	}
}

func TestPincodeServedOnce(t *testing.T) {
	first := newStore(t, true)
	serve(t, first, "560101")
	second := newStore(t, true)
	err := db.New(testPool).AddServiceAreas(context.Background(), db.AddServiceAreasParams{StoreID: second, Pincodes: []string{"560101"}})
	if !pg.IsUnique(err) {
		t.Fatalf("second store takes 560101: error %v, want unique violation 23505", err)
	}
}

func TestDeleteCascadesServiceAreas(t *testing.T) {
	ctx := context.Background()
	id := newStore(t, true)
	serve(t, id, "560102", "560103")
	if _, err := db.New(testPool).DeleteStore(ctx, id); err != nil {
		t.Fatal(err)
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from store_service_areas where store_id = $1", id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Fatalf("service areas after delete: %d rows, want 0", n)
	}
}

// staffSeq makes each staff email unique within the package.
var staffSeq atomic.Int64

func TestStaffStoreMustExist(t *testing.T) {
	ctx := context.Background()
	insertStaff := func(storeID string) error {
		_, err := testPool.Exec(ctx,
			"insert into staff_users (email, password_hash, name, role, store_id) values ($1, 'hash', 'Staff', 'store_staff', $2)",
			fmt.Sprintf("staff.%d@example.com", staffSeq.Add(1)), storeID)
		return err
	}
	if state := sqlState(insertStaff("00000000-0000-4000-8000-0000000000ff")); state != "23503" {
		t.Fatalf("staff with an unknown store: SQLSTATE %q, want 23503", state)
	}

	id := newStore(t, true)
	if err := insertStaff(id); err != nil {
		t.Fatalf("staff with a real store: %v", err)
	}
	_, err := db.New(testPool).DeleteStore(ctx, id)
	if state := sqlState(err); state != "23503" {
		t.Fatalf("delete a store with staff: SQLSTATE %q, want 23503", state)
	}
	var n int
	if err := testPool.QueryRow(ctx, "select count(*) from stores where id = $1", id).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("store with staff after refused delete: %d rows, want 1", n)
	}
}
