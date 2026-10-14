// Package stock holds each store's quantity per product and takes it for
// orders: a reservation is all or nothing, and a release gives it back.
package stock

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/stock/db"
)

// Line asks for Quantity of one product.
type Line struct {
	ProductID string
	Quantity  int32 // at least 1
}

// OutOfStockError names every product a reservation could not take, ascending.
type OutOfStockError struct {
	ProductIDs []string
}

func (e *OutOfStockError) Error() string { return "out of stock" }

// Reserve locks the store's stock rows for the lines' products in product id
// order, then either takes every quantity or returns an *OutOfStockError
// naming each product that is inactive, has no row or has less than asked,
// taking nothing. The lines hold distinct product ids; no lines is a no-op.
// Other errors come back unchanged.
func Reserve(ctx context.Context, tx pgx.Tx, storeID string, lines []Line) error {
	lines, err := merge(lines)
	if err != nil {
		return err
	}
	if len(lines) == 0 {
		return nil
	}
	ids := make([]string, len(lines))
	for i, l := range lines {
		ids[i] = l.ProductID
	}
	q := db.New(tx)
	rows, err := q.LockStock(ctx, db.LockStockParams{StoreID: storeID, ProductIds: ids})
	if err != nil {
		return err
	}
	have := make(map[string]db.LockStockRow, len(rows))
	for _, r := range rows {
		have[r.ProductID] = r
	}
	var short []string
	for _, l := range lines {
		r, ok := have[l.ProductID]
		if !ok || !r.IsActive || r.Quantity < l.Quantity {
			short = append(short, l.ProductID)
		}
	}
	if len(short) > 0 {
		sort.Strings(short)
		return &OutOfStockError{ProductIDs: short}
	}
	deltas := make([]int32, len(lines))
	for i, l := range lines {
		deltas[i] = -l.Quantity
	}
	return q.AddStock(ctx, db.AddStockParams{StoreID: storeID, ProductIds: ids, Deltas: deltas})
}

// Release adds the lines' quantities back to the store's stock, for an order
// that is cancelled. It locks the rows in product id order, as Reserve does, so
// the two cannot deadlock. A product with no stock row at the store is skipped.
func Release(ctx context.Context, tx pgx.Tx, storeID string, lines []Line) error {
	lines, err := merge(lines)
	if err != nil {
		return err
	}
	if len(lines) == 0 {
		return nil
	}
	ids := make([]string, len(lines))
	deltas := make([]int32, len(lines))
	for i, l := range lines {
		ids[i] = l.ProductID
		deltas[i] = l.Quantity
	}
	q := db.New(tx)
	if _, err := q.LockStock(ctx, db.LockStockParams{StoreID: storeID, ProductIds: ids}); err != nil {
		return err
	}
	return q.AddStock(ctx, db.AddStockParams{StoreID: storeID, ProductIds: ids, Deltas: deltas})
}

// Quantity answers the stored quantity of one product at the store; no row is 0.
func Quantity(ctx context.Context, d db.DBTX, storeID, productID string) (int32, error) {
	q, err := db.New(d).Quantity(ctx, db.QuantityParams{StoreID: storeID, ProductID: productID})
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return q, err
}

// LowCount answers how many active products have a quantity below 5 at the
// store; a product with no row counts as 0.
func LowCount(ctx context.Context, d db.DBTX, storeID string) (int64, error) {
	return db.New(d).CountStock(ctx, db.CountStockParams{StoreID: storeID, LowStock: true})
}

// merge sums the quantities of lines naming the same product, keeping the
// first-seen order, so one row update takes the whole amount. A quantity below
// 1 is a caller bug and is refused before any query runs.
func merge(lines []Line) ([]Line, error) {
	at := make(map[string]int, len(lines))
	var out []Line
	for _, l := range lines {
		if l.Quantity < 1 {
			return nil, fmt.Errorf("stock: quantity %d for product %s, want at least 1", l.Quantity, l.ProductID)
		}
		i, seen := at[l.ProductID]
		if !seen {
			at[l.ProductID] = len(out)
			out = append(out, l)
			continue
		}
		if out[i].Quantity > math.MaxInt32-l.Quantity {
			return nil, fmt.Errorf("stock: quantity for product %s overflows", l.ProductID)
		}
		out[i].Quantity += l.Quantity
	}
	return out, nil
}
