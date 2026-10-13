// Package cart holds each customer's one open cart, at one store, and answers
// its totals from current prices and fees.
package cart

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/cart/db"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// Line is one cart line: the product as its store shows it, and the quantity.
type Line struct {
	Product  catalog.StoreProduct `json:"product"`
	Quantity int32                `json:"quantity"`
}

// Cart is a customer's cart with its totals. An empty cart has no StoreID.
type Cart struct {
	StoreID          string `json:"storeId,omitempty"`
	Items            []Line `json:"items"`
	SubtotalCents    int64  `json:"subtotalCents"`
	DeliveryFeeCents int64  `json:"deliveryFeeCents"`
	TotalCents       int64  `json:"totalCents"`
	MinOrderCents    int64  `json:"minOrderCents"`
	ShortfallCents   int64  `json:"shortfallCents"`
}

// Update is the answer to setting a line: the cart after the change, and
// whether the change replaced the cart's store or clamped the quantity.
type Update struct {
	Cart
	Replaced bool `json:"replaced"`
	Clamped  bool `json:"clamped"`
}

// view answers the customer's cart with its totals computed now. A customer
// with no cart gets the empty cart: no store, no lines, every amount 0.
// Inactive products stay in the subtotal at their current price (Spec 2 §7).
func view(ctx context.Context, d db.DBTX, customerID string) (Cart, error) {
	c, err := db.New(d).CartByCustomer(ctx, customerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Cart{Items: []Line{}}, nil
	}
	if err != nil {
		return Cart{}, err
	}
	s, err := store.Get(ctx, d, c.StoreID)
	if err != nil {
		return Cart{}, err
	}
	items, err := db.New(d).CartItems(ctx, c.ID)
	if err != nil {
		return Cart{}, err
	}
	ids := make([]string, len(items))
	for i, it := range items {
		ids[i] = it.ProductID
	}
	products, err := catalog.ProductsByID(ctx, d, c.StoreID, ids)
	if err != nil {
		return Cart{}, err
	}
	out := Cart{StoreID: c.StoreID, Items: make([]Line, 0, len(items))}
	for _, it := range items {
		p, ok := products[it.ProductID]
		if !ok {
			// Deleted after the cart was read; its cart line went with it.
			continue
		}
		out.Items = append(out.Items, Line{Product: p, Quantity: it.Quantity})
		out.SubtotalCents += p.PriceCents * int64(it.Quantity)
	}
	out.DeliveryFeeCents = s.DeliveryFeeCents
	if out.SubtotalCents >= s.FreeDeliveryAboveCents {
		out.DeliveryFeeCents = 0
	}
	out.TotalCents = out.SubtotalCents + out.DeliveryFeeCents
	out.MinOrderCents = s.MinOrderCents
	out.ShortfallCents = max(0, s.FreeDeliveryAboveCents-out.SubtotalCents)
	return out, nil
}

// set sets productID's line in the customer's cart to quantity, in tx. The stock
// at storeID is read first: a quantity above 0 is clamped to it (clamped), and a
// line clamped to 0 is handled as a quantity of 0. A quantity above 0 creates the
// cart at storeID when there is none. A cart at another store is emptied and moved
// to storeID when the quantity is still above 0 (replaced); with a quantity of 0,
// or a line clamped to 0, it is left alone, so a line another store holds none of
// keeps the cart. A quantity of 0 removes the line, and the cart is deleted when
// its last line goes.
func set(ctx context.Context, tx pgx.Tx, customerID, storeID, productID string, quantity int32) (replaced, clamped bool, err error) {
	if quantity > 0 {
		available, err := stock.Quantity(ctx, tx, storeID, productID)
		if err != nil {
			return false, false, err
		}
		if quantity > available {
			quantity, clamped = available, true
		}
	}
	q := db.New(tx)
	if quantity > 0 {
		if err := q.EnsureCart(ctx, db.EnsureCartParams{CustomerID: customerID, StoreID: storeID}); err != nil {
			return false, false, err
		}
	}
	c, err := q.LockCart(ctx, customerID)
	for errors.Is(err, pgx.ErrNoRows) && quantity > 0 {
		// A concurrent removal of the last line deleted the cart after the ensure: ensure again.
		if err := q.EnsureCart(ctx, db.EnsureCartParams{CustomerID: customerID, StoreID: storeID}); err != nil {
			return false, false, err
		}
		c, err = q.LockCart(ctx, customerID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return false, clamped, nil // quantity 0 and no cart: nothing to remove
	}
	if err != nil {
		return false, false, err
	}
	if c.StoreID != storeID {
		if quantity == 0 {
			return false, clamped, nil // removing from another store's cart changes nothing
		}
		if err := q.ClearCart(ctx, c.ID); err != nil {
			return false, false, err
		}
		if err := q.MoveCart(ctx, db.MoveCartParams{ID: c.ID, StoreID: storeID}); err != nil {
			return false, false, err
		}
		replaced = true
	}
	if quantity == 0 {
		err = q.DeleteCartItem(ctx, db.DeleteCartItemParams{CartID: c.ID, ProductID: productID})
	} else {
		err = q.SetCartItem(ctx, db.SetCartItemParams{CartID: c.ID, ProductID: productID, Quantity: quantity})
	}
	if err != nil {
		return false, false, err
	}
	if err := q.DeleteEmptyCart(ctx, c.ID); err != nil {
		return false, false, err
	}
	return replaced, clamped, nil
}

// Lines locks the customer's cart inside tx, for placing an order, and answers
// its store and its lines in insertion order. No cart answers "", nil, nil.
func Lines(ctx context.Context, tx pgx.Tx, customerID string) (storeID string, lines []stock.Line, err error) {
	q := db.New(tx)
	c, err := q.LockCart(ctx, customerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil, nil
	}
	if err != nil {
		return "", nil, err
	}
	items, err := q.CartItems(ctx, c.ID)
	if err != nil {
		return "", nil, err
	}
	lines = make([]stock.Line, len(items))
	for i, it := range items {
		lines[i] = stock.Line{ProductID: it.ProductID, Quantity: it.Quantity}
	}
	return c.StoreID, lines, nil
}

// Clear deletes the customer's cart and its lines. No cart is not an error.
func Clear(ctx context.Context, d db.DBTX, customerID string) error {
	return db.New(d).DeleteCart(ctx, customerID)
}
