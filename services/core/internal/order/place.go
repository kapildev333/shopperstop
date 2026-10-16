package order

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/address"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/cart"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// Place turns the customer's whole cart into one placed order paid by method
// ("cod" or "online"), in one transaction, and answers the order's id. An online
// order needs a verified email and starts with payment status pending. Any
// failure rolls everything back.
func Place(ctx context.Context, pool *pgxpool.Pool, customerID, addressID, method string) (id string, err error) {
	var number string
	err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		c, err := auth.CustomerByID(ctx, tx, customerID)
		if err != nil {
			return err
		}
		var payment *db.PaymentStatus
		if method == "online" {
			if !c.EmailVerified {
				return &httpx.Error{Status: http.StatusConflict, Code: "email_unverified", Message: "verify your email to pay online"}
			}
			pending := db.PaymentStatusPending
			payment = &pending
		}

		storeID, lines, err := cart.Lines(ctx, tx, customerID)
		if err != nil {
			return err
		}
		if len(lines) == 0 {
			return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Message: "cart is empty"}
		}

		addr, err := address.Get(ctx, tx, customerID, addressID)
		if isCode(err, "not_found") {
			return invalid("addressId", "unknown address")
		}
		if err != nil {
			return err
		}

		s, err := store.ForPincode(ctx, tx, addr.Pincode)
		if isCode(err, "not_serviceable") || (err == nil && s.ID != storeID) {
			return notServed()
		}
		if err != nil {
			return err
		}
		if !s.IsOpen {
			return &httpx.Error{Status: http.StatusConflict, Code: "not_serviceable", Message: "the store is closed"}
		}

		if err := stock.Reserve(ctx, tx, storeID, lines); err != nil {
			return err
		}

		ids := make([]string, len(lines))
		for i, l := range lines {
			ids[i] = l.ProductID
		}
		products, err := catalog.ProductsByID(ctx, tx, storeID, ids)
		if err != nil {
			return err
		}
		var subtotal int64
		for _, l := range lines {
			p, ok := products[l.ProductID]
			if !ok {
				return fmt.Errorf("order: product %s vanished during placement", l.ProductID)
			}
			subtotal += p.PriceCents * int64(l.Quantity)
		}
		if subtotal < s.MinOrderCents {
			return invalid("subtotal", "below the store's minimum order")
		}
		fee := s.DeliveryFeeCents
		if subtotal >= s.FreeDeliveryAboveCents {
			fee = 0
		}

		number, err = newNumber()
		if err != nil {
			return err
		}
		q := db.New(tx)
		id, err = q.CreateOrder(ctx, db.CreateOrderParams{
			Number: number, CustomerID: customerID, StoreID: storeID, StoreName: s.Name, PromisedMinutes: s.PromisedMinutes,
			CustomerName: c.Name, CustomerPhone: c.Phone,
			AddressLabel: addr.Label, AddressLine1: addr.Line1, AddressLine2: addr.Line2, AddressPincode: addr.Pincode,
			SubtotalCents: subtotal, DeliveryFeeCents: fee, TotalCents: subtotal + fee,
			PaymentMethod: method, PaymentStatus: payment,
		})
		if err != nil {
			return err
		}
		arg := db.AddItemsParams{OrderID: id}
		for _, l := range lines {
			p := products[l.ProductID]
			arg.ProductIds = append(arg.ProductIds, l.ProductID)
			arg.Names = append(arg.Names, p.Name)
			arg.UnitLabels = append(arg.UnitLabels, p.UnitLabel)
			arg.ImageUrls = append(arg.ImageUrls, p.ImageURL)
			arg.PriceCents = append(arg.PriceCents, p.PriceCents)
			arg.MrpCents = append(arg.MrpCents, p.MrpCents)
			arg.Quantities = append(arg.Quantities, l.Quantity)
		}
		if err := q.AddItems(ctx, arg); err != nil {
			return err
		}
		if err := addEvent(ctx, q, db.AddEventParams{OrderID: id, ToStatus: db.OrderStatusPlaced, ActorType: "customer", ActorID: &customerID}); err != nil {
			return err
		}
		return cart.Clear(ctx, tx, customerID)
	})
	var oos *stock.OutOfStockError
	switch {
	case errors.As(err, &oos):
		return "", &httpx.Error{Status: http.StatusConflict, Code: "out_of_stock", Message: "some products are out of stock", ProductIDs: oos.ProductIDs}
	case pg.IsUnique(err):
		return "", pg.Map(err)
	case err != nil:
		return "", err
	}
	slog.InfoContext(ctx, "order transition", "orderId", id, "number", number, "to", string(db.OrderStatusPlaced),
		"actorType", "customer", "actorId", customerID, "requestId", httpx.RequestID(ctx))
	return id, nil
}

// isCode reports whether err is an *httpx.Error with the given code.
func isCode(err error, code string) bool {
	var apiErr *httpx.Error
	return errors.As(err, &apiErr) && apiErr.Code == code
}

// notServed is the answer when the address's pincode is not served by the cart's store.
func notServed() *httpx.Error {
	return &httpx.Error{Status: http.StatusConflict, Code: "not_serviceable", Field: "addressId", Message: "the store does not deliver to this address"}
}
