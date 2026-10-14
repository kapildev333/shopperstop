package order_test

import (
	"context"
	"encoding/base32"
	"encoding/binary"
	"errors"
	"fmt"
	"os"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var (
	testPool *pgxpool.Pool
	seq      atomic.Int64
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("order")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// newNumber returns a fresh order number that matches the schema's format.
func newNumber() string {
	var b [8]byte
	binary.BigEndian.PutUint64(b[:], uint64(seq.Add(1)))
	return "SS-" + base32.StdEncoding.EncodeToString(b[3:])
}

// fixture inserts a customer, a store, a category and a product and returns
// the customer, store and product ids.
func fixture(t *testing.T) (customerID, storeID, productID string) {
	t.Helper()
	ctx := context.Background()
	n := seq.Add(1)
	err := testPool.QueryRow(ctx,
		`insert into customers (email, password_hash, name) values ($1, 'x', 'Asha') returning id`,
		fmt.Sprintf("asha-%d@test.local", n)).Scan(&customerID)
	if err != nil {
		t.Fatal(err)
	}
	err = testPool.QueryRow(ctx,
		`insert into stores (name, address_line, pincode, promised_minutes) values ($1, '1 Test Rd', '570000', 10) returning id`,
		fmt.Sprintf("store-%d", n)).Scan(&storeID)
	if err != nil {
		t.Fatal(err)
	}
	var categoryID string
	err = testPool.QueryRow(ctx,
		`insert into categories (name, slug) values ($1, $1) returning id`,
		fmt.Sprintf("cat-%d", n)).Scan(&categoryID)
	if err != nil {
		t.Fatal(err)
	}
	err = testPool.QueryRow(ctx,
		`insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents) values ($1, $2, $2, '1 unit', 1000, 1000) returning id`,
		categoryID, fmt.Sprintf("product-%d", n)).Scan(&productID)
	if err != nil {
		t.Fatal(err)
	}
	return customerID, storeID, productID
}

// insertOrder inserts an order with the given number and amounts and returns
// its id, or the database error.
func insertOrder(customerID, storeID, number string, subtotal, fee, total int64) (string, error) {
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into orders (number, customer_id, store_id, customer_name, address_label, address_line1, address_pincode,
		                     subtotal_cents, delivery_fee_cents, total_cents)
		 values ($1, $2, $3, 'Asha', 'Home', '1 Test Rd', '570000', $4, $5, $6) returning id`,
		number, customerID, storeID, subtotal, fee, total).Scan(&id)
	return id, err
}

// pgErr returns the SQLSTATE and constraint name of err, which must be a
// *pgconn.PgError.
func pgErr(t *testing.T, err error) (code, constraint string) {
	t.Helper()
	var pg *pgconn.PgError
	if !errors.As(err, &pg) {
		t.Fatalf("error %v is not a *pgconn.PgError", err)
	}
	return pg.Code, pg.ConstraintName
}

func TestOrderNumberFormat(t *testing.T) {
	customerID, storeID, _ := fixture(t)

	for _, number := range []string{"SS-abcdefg2", "SS-ABCDEFG1"} {
		_, err := insertOrder(customerID, storeID, number, 1000, 0, 1000)
		code, constraint := pgErr(t, err)
		if code != "23514" || constraint != "orders_number_check" {
			t.Fatalf("%s: got %s %s, want 23514 orders_number_check", number, code, constraint)
		}
	}

	if _, err := insertOrder(customerID, storeID, "SS-ABCDEFG2", 1000, 0, 1000); err != nil {
		t.Fatalf("valid number rejected: %v", err)
	}
	_, err := insertOrder(customerID, storeID, "SS-ABCDEFG2", 1000, 0, 1000)
	code, constraint := pgErr(t, err)
	if code != "23505" || constraint != "orders_number_key" {
		t.Fatalf("duplicate number: got %s %s, want 23505 orders_number_key", code, constraint)
	}
}

func TestOrderTotalCheck(t *testing.T) {
	customerID, storeID, _ := fixture(t)
	_, err := insertOrder(customerID, storeID, "SS-TOTALCHK", 1000, 100, 1000)
	code, constraint := pgErr(t, err)
	if code != "23514" || constraint != "orders_total" {
		t.Fatalf("got %s %s, want 23514 orders_total", code, constraint)
	}
}

func TestOrderedProductCannotBeDeleted(t *testing.T) {
	ctx := context.Background()
	customerID, storeID, productID := fixture(t)
	orderID, err := insertOrder(customerID, storeID, newNumber(), 1000, 0, 1000)
	if err != nil {
		t.Fatal(err)
	}
	_, err = testPool.Exec(ctx,
		`insert into order_items (order_id, product_id, name, unit_label, price_cents, mrp_cents, quantity)
		 values ($1, $2, 'Product', '1 unit', 1000, 1000, 1)`, orderID, productID)
	if err != nil {
		t.Fatal(err)
	}

	_, err = testPool.Exec(ctx, `delete from products where id = $1`, productID)
	code, constraint := pgErr(t, err)
	if code != "23503" || constraint != "order_items_product_id_fkey" {
		t.Fatalf("got %s %s, want 23503 order_items_product_id_fkey", code, constraint)
	}
	var n int
	if err := testPool.QueryRow(ctx, `select count(*) from products where id = $1`, productID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("product rows %d after refused delete, want 1", n)
	}
}

func TestStoreWithOrderCannotBeDeleted(t *testing.T) {
	ctx := context.Background()
	customerID, storeID, _ := fixture(t)
	if _, err := insertOrder(customerID, storeID, newNumber(), 1000, 0, 1000); err != nil {
		t.Fatal(err)
	}

	_, err := testPool.Exec(ctx, `delete from stores where id = $1`, storeID)
	code, constraint := pgErr(t, err)
	if code != "23503" || constraint != "orders_store_id_fkey" {
		t.Fatalf("got %s %s, want 23503 orders_store_id_fkey", code, constraint)
	}
	var n int
	if err := testPool.QueryRow(ctx, `select count(*) from stores where id = $1`, storeID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("store rows %d after refused delete, want 1", n)
	}
}
