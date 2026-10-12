package stock_test

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var (
	testPool *pgxpool.Pool
	seq      atomic.Int64
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("stock")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// uniq returns a name unique within the test schema, so fixtures never collide.
func uniq(t *testing.T) string {
	return fmt.Sprintf("%s-%d", t.Name(), seq.Add(1))
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

// newCategory inserts a category and returns its id.
func newCategory(t *testing.T) string {
	t.Helper()
	name := uniq(t)
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into categories (name, slug) values ($1, $2) returning id`, name, name).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// newProduct inserts a product in the category and returns its id.
func newProduct(t *testing.T, categoryID string, active bool) string {
	t.Helper()
	name := uniq(t)
	var id string
	err := testPool.QueryRow(context.Background(),
		`insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents, is_active)
		 values ($1, $2, $2, '1 unit', 1000, 1000, $3) returning id`,
		categoryID, name, active).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// setStock gives the product a stock row at the store.
func setStock(t *testing.T, storeID, productID string, quantity int32) {
	t.Helper()
	_, err := testPool.Exec(context.Background(),
		`insert into store_stock (store_id, product_id, quantity) values ($1, $2, $3)`, storeID, productID, quantity)
	if err != nil {
		t.Fatal(err)
	}
}

// stored reads the quantity of the product's stock row at the store.
func stored(t *testing.T, storeID, productID string) int32 {
	t.Helper()
	var q int32
	err := testPool.QueryRow(context.Background(),
		`select quantity from store_stock where store_id = $1 and product_id = $2`, storeID, productID).Scan(&q)
	if err != nil {
		t.Fatal(err)
	}
	return q
}

// reserve runs Reserve in its own transaction and returns its error.
func reserve(storeID string, lines ...stock.Line) error {
	return pgx.BeginFunc(context.Background(), testPool, func(tx pgx.Tx) error {
		return stock.Reserve(context.Background(), tx, storeID, lines)
	})
}

// outOfStock returns the *stock.OutOfStockError in err, failing the test when there is none.
func outOfStock(t *testing.T, err error) *stock.OutOfStockError {
	t.Helper()
	var oos *stock.OutOfStockError
	if !errors.As(err, &oos) {
		t.Fatalf("error %v is not an *OutOfStockError", err)
	}
	return oos
}

// collect waits for n results from errs, failing the test when they do not arrive (a deadlock).
func collect(t *testing.T, errs <-chan error, n int) []error {
	t.Helper()
	var out []error
	for i := 0; i < n; i++ {
		select {
		case err := <-errs:
			out = append(out, err)
		case <-time.After(10 * time.Second):
			t.Fatal("reservations did not finish: deadlock")
		}
	}
	return out
}

func TestReserveTakesStock(t *testing.T) {
	store, category := newStore(t), newCategory(t)
	p, q := newProduct(t, category, true), newProduct(t, category, true)
	setStock(t, store, p, 5)
	setStock(t, store, q, 1)

	if err := reserve(store, stock.Line{ProductID: p, Quantity: 2}, stock.Line{ProductID: q, Quantity: 1}); err != nil {
		t.Fatal(err)
	}
	if got := stored(t, store, p); got != 3 {
		t.Fatalf("P quantity %d, want 3", got)
	}
	if got := stored(t, store, q); got != 0 {
		t.Fatalf("Q quantity %d, want 0", got)
	}
}

func TestReserveAllOrNothing(t *testing.T) {
	store, category := newStore(t), newCategory(t)
	p := newProduct(t, category, true)
	q := newProduct(t, category, true)
	r := newProduct(t, category, false) // inactive
	s := newProduct(t, category, true)  // no stock row
	setStock(t, store, p, 5)
	setStock(t, store, q, 1)
	setStock(t, store, r, 9)

	err := reserve(store,
		stock.Line{ProductID: p, Quantity: 2},
		stock.Line{ProductID: q, Quantity: 2},
		stock.Line{ProductID: r, Quantity: 1},
		stock.Line{ProductID: s, Quantity: 1},
	)
	oos := outOfStock(t, err)
	want := []string{q, r, s}
	sort.Strings(want)
	if fmt.Sprint(oos.ProductIDs) != fmt.Sprint(want) {
		t.Fatalf("out of stock %v, want %v (ascending)", oos.ProductIDs, want)
	}
	if got := stored(t, store, p); got != 5 {
		t.Fatalf("P quantity %d, want 5 untouched", got)
	}
	if got := stored(t, store, q); got != 1 {
		t.Fatalf("Q quantity %d, want 1 untouched", got)
	}
	if got := stored(t, store, r); got != 9 {
		t.Fatalf("R quantity %d, want 9 untouched", got)
	}
}

func TestReserveLastUnitRace(t *testing.T) {
	store, category := newStore(t), newCategory(t)
	ctx := context.Background()
	for round := 0; round < 10; round++ {
		p := newProduct(t, category, true)
		setStock(t, store, p, 1)

		start := make(chan struct{})
		errs := make(chan error, 2)
		for i := 0; i < 2; i++ {
			go func() {
				<-start
				errs <- pgx.BeginFunc(ctx, testPool, func(tx pgx.Tx) error {
					return stock.Reserve(ctx, tx, store, []stock.Line{{ProductID: p, Quantity: 1}})
				})
			}()
		}
		close(start)

		var won, lost int
		for _, err := range collect(t, errs, 2) {
			if err == nil {
				won++
				continue
			}
			oos := outOfStock(t, err)
			if len(oos.ProductIDs) != 1 || oos.ProductIDs[0] != p {
				t.Fatalf("round %d: out of stock %v, want [%s]", round, oos.ProductIDs, p)
			}
			lost++
		}
		if won != 1 || lost != 1 {
			t.Fatalf("round %d: %d succeeded and %d out of stock, want 1 and 1", round, won, lost)
		}
		if got := stored(t, store, p); got != 0 {
			t.Fatalf("round %d: quantity %d, want 0", round, got)
		}
	}
}

func TestReserveOppositeOrder(t *testing.T) {
	store, category := newStore(t), newCategory(t)
	ctx := context.Background()
	for round := 0; round < 10; round++ {
		p := newProduct(t, category, true)
		q := newProduct(t, category, true)
		setStock(t, store, p, 20)
		setStock(t, store, q, 20)

		start := make(chan struct{})
		errs := make(chan error, 2)
		orders := [][]stock.Line{
			{{ProductID: p, Quantity: 2}, {ProductID: q, Quantity: 2}},
			{{ProductID: q, Quantity: 2}, {ProductID: p, Quantity: 2}},
		}
		for _, lines := range orders {
			go func() {
				<-start
				errs <- pgx.BeginFunc(ctx, testPool, func(tx pgx.Tx) error {
					return stock.Reserve(ctx, tx, store, lines)
				})
			}()
		}
		close(start)

		for _, err := range collect(t, errs, 2) {
			if err != nil {
				t.Fatalf("round %d: reservation failed: %v", round, err)
			}
		}
		if got := stored(t, store, p); got != 16 {
			t.Fatalf("round %d: P quantity %d, want 16", round, got)
		}
		if got := stored(t, store, q); got != 16 {
			t.Fatalf("round %d: Q quantity %d, want 16", round, got)
		}
	}
}

func TestRelease(t *testing.T) {
	store, category := newStore(t), newCategory(t)
	p := newProduct(t, category, true)
	setStock(t, store, p, 5)
	line := stock.Line{ProductID: p, Quantity: 2}

	if err := reserve(store, line); err != nil {
		t.Fatal(err)
	}
	err := pgx.BeginFunc(context.Background(), testPool, func(tx pgx.Tx) error {
		return stock.Release(context.Background(), tx, store, []stock.Line{line})
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := stored(t, store, p); got != 5 {
		t.Fatalf("P quantity %d after release, want 5", got)
	}
}

func TestQuantity(t *testing.T) {
	ctx := context.Background()
	store, category := newStore(t), newCategory(t)
	p := newProduct(t, category, true)
	setStock(t, store, p, 7)

	got, err := stock.Quantity(ctx, testPool, store, p)
	if err != nil || got != 7 {
		t.Fatalf("Quantity with a row: %d, %v; want 7, nil", got, err)
	}
	none := newProduct(t, category, true)
	got, err = stock.Quantity(ctx, testPool, store, none)
	if err != nil || got != 0 {
		t.Fatalf("Quantity without a row: %d, %v; want 0, nil", got, err)
	}
}

func TestLowCount(t *testing.T) {
	ctx := context.Background()
	store, category := newStore(t), newCategory(t)
	before, err := stock.LowCount(ctx, testPool, store)
	if err != nil {
		t.Fatal(err)
	}

	low := newProduct(t, category, true)
	setStock(t, store, low, 3)
	enough := newProduct(t, category, true)
	setStock(t, store, enough, 5)
	newProduct(t, category, true) // active, no row
	inactive := newProduct(t, category, false)
	setStock(t, store, inactive, 0)

	after, err := stock.LowCount(ctx, testPool, store)
	if err != nil {
		t.Fatal(err)
	}
	// Other tests leave active products with no row at this store, so count the change.
	if after-before != 2 {
		t.Fatalf("LowCount rose by %d, want 2 (the low product and the rowless one)", after-before)
	}
}

func TestReserveEmptyIsNoop(t *testing.T) {
	store := newStore(t)
	if err := reserve(store); err != nil {
		t.Fatalf("empty reservation: %v", err)
	}
}
