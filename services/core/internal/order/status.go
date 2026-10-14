package order

import (
	"context"
	"log/slog"
	"net/http"
	"slices"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
)

// next is the status table: the moves an order may make from each status.
var next = map[db.OrderStatus][]db.OrderStatus{
	db.OrderStatusPlaced:         {db.OrderStatusAccepted, db.OrderStatusCancelled},
	db.OrderStatusAccepted:       {db.OrderStatusPacking, db.OrderStatusCancelled},
	db.OrderStatusPacking:        {db.OrderStatusReady},
	db.OrderStatusReady:          {db.OrderStatusOutForDelivery},
	db.OrderStatusOutForDelivery: {db.OrderStatusDelivered},
}

// allowed reports whether an actor of actorType ("customer" or "staff") may move
// an order from one status to another: the table allows it, and a customer may
// only cancel.
func allowed(from, to db.OrderStatus, actorType string) bool {
	return slices.Contains(next[from], to) && (actorType == "staff" || to == db.OrderStatusCancelled)
}

// Transition moves the order to status to, in one transaction under the order's
// row lock, and records the event with note. A cancel also returns the order's
// quantities to the store's stock. An order outside sc is "not found"; a move the
// table does not allow is 409 conflict and changes nothing.
func Transition(ctx context.Context, pool *pgxpool.Pool, id string, sc scope, to db.OrderStatus, actor Actor, note string) error {
	var row db.LockOrderRow
	err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		var err error
		if row, err = q.LockOrder(ctx, db.LockOrderParams{ID: id, CustomerID: sc.customerID, StoreID: sc.storeID}); err != nil {
			return pg.Map(err)
		}
		if !allowed(row.Status, to, actor.Type) {
			return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "cannot move an order from " + string(row.Status) + " to " + string(to)}
		}
		if err := q.SetStatus(ctx, db.SetStatusParams{Status: to, CancelReason: note, ID: id}); err != nil {
			return err
		}
		if to == db.OrderStatusCancelled {
			items, err := q.OrderItems(ctx, []string{id})
			if err != nil {
				return err
			}
			lines := make([]stock.Line, len(items))
			for i, it := range items {
				lines[i] = stock.Line{ProductID: it.ProductID, Quantity: it.Quantity}
			}
			if err := stock.Release(ctx, tx, row.StoreID, lines); err != nil {
				return err
			}
		}
		return q.AddEvent(ctx, db.AddEventParams{
			OrderID: id, FromStatus: &row.Status, ToStatus: to,
			ActorType: actor.Type, ActorID: &actor.ID, Note: note,
		})
	})
	if err != nil {
		return err
	}
	slog.InfoContext(ctx, "order transition", "orderId", id, "number", row.Number, "from", string(row.Status),
		"to", string(to), "actorType", actor.Type, "actorId", actor.ID, "requestId", httpx.RequestID(ctx))
	return nil
}

// Today answers the store's orders placed today by current status, with all seven
// statuses as keys, and the total of the orders delivered today.
func Today(ctx context.Context, d db.DBTX, storeID string) (map[string]int64, int64, error) {
	q := db.New(d)
	rows, err := q.CountsToday(ctx, storeID)
	if err != nil {
		return nil, 0, err
	}
	byStatus := make(map[string]int64, len(db.AllOrderStatusValues()))
	for _, s := range db.AllOrderStatusValues() {
		byStatus[string(s)] = 0
	}
	for _, r := range rows {
		byStatus[string(r.Status)] = r.Orders
	}
	revenue, err := q.RevenueToday(ctx, storeID)
	if err != nil {
		return nil, 0, err
	}
	return byStatus, revenue, nil
}
