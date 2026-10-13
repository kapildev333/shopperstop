package cart_test

import (
	"context"
	"fmt"
	"os"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/cart"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var (
	testPool *pgxpool.Pool
	seq      atomic.Int64
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("cart")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// uniq returns a name unique within the test schema.
func uniq(t *testing.T) string {
	return fmt.Sprintf("%s-%d", t.Name(), seq.Add(1))
}

// newCustomer inserts a customer and returns its id.
func newCustomer(t *testing.T) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into customers (email, password_hash, name) values ($1, 'hash', 'Test') returning id`,
		uniq(t)+"@example.com").Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// newStore inserts an open store and returns its id.
func newStore(t *testing.T) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into stores (name, address_line, pincode, promised_minutes) values ($1, '1 Test Rd', '560001', 10) returning id`,
		uniq(t)).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// newProduct inserts an active product in its own category and returns its id.
func newProduct(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	name := uniq(t)
	var category, id string
	if err := testPool.QueryRow(ctx, "insert into categories (name, slug) values ($1, $1) returning id", name).Scan(&category); err != nil {
		t.Fatal(err)
	}
	if err := testPool.QueryRow(ctx, `insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents, is_active)
		values ($1, $2, $2, '1 unit', 1000, 1000, true) returning id`, category, name).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// newCart inserts the customer's cart at storeID and returns its id.
func newCart(t *testing.T, customerID, storeID string) string {
	t.Helper()
	var id string
	if err := testPool.QueryRow(context.Background(),
		`insert into carts (customer_id, store_id) values ($1, $2) returning id`, customerID, storeID).Scan(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

// addLine inserts a cart line with an explicit created_at, so the insertion order is fixed.
func addLine(t *testing.T, cartID, productID string, quantity int, createdAt string) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		`insert into cart_items (cart_id, product_id, quantity, created_at) values ($1, $2, $3, $4)`,
		cartID, productID, quantity, createdAt); err != nil {
		t.Fatal(err)
	}
}

func TestLinesReadsCart(t *testing.T) {
	ctx := context.Background()
	customer := newCustomer(t)
	storeID := newStore(t)
	first, second := newProduct(t), newProduct(t)
	cartID := newCart(t, customer, storeID)
	// Inserted second-product-first by timestamp order: the lines come back in insertion order.
	addLine(t, cartID, first, 2, "2026-01-01 10:00:00+00")
	addLine(t, cartID, second, 1, "2026-01-01 10:05:00+00")

	var gotStore string
	var lines []stock.Line
	err := pgx.BeginFunc(ctx, testPool, func(tx pgx.Tx) error {
		var err error
		gotStore, lines, err = cart.Lines(ctx, tx, customer)
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	want := []stock.Line{{ProductID: first, Quantity: 2}, {ProductID: second, Quantity: 1}}
	if gotStore != storeID || len(lines) != len(want) || lines[0] != want[0] || lines[1] != want[1] {
		t.Fatalf("Lines: store %q lines %+v, want store %q lines %+v", gotStore, lines, storeID, want)
	}

	// No cart: no store and no lines, not an error.
	err = pgx.BeginFunc(ctx, testPool, func(tx pgx.Tx) error {
		var err error
		gotStore, lines, err = cart.Lines(ctx, tx, newCustomer(t))
		return err
	})
	if err != nil {
		t.Fatalf("Lines with no cart: %v, want nil", err)
	}
	if gotStore != "" || lines != nil {
		t.Fatalf("Lines with no cart: store %q lines %+v, want \"\" and nil", gotStore, lines)
	}
}

func TestClearWithoutCart(t *testing.T) {
	if err := cart.Clear(context.Background(), testPool, newCustomer(t)); err != nil {
		t.Fatalf("Clear with no cart: %v, want nil", err)
	}
}
