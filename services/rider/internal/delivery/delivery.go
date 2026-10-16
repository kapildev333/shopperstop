// Package delivery is the rider's work on core's orders: the ready orders of
// the rider's store that nobody has claimed, and the claim that gives one to
// the rider (rider-deliveries). Core's order table decides every status move;
// this package only records what the rider carries.
package delivery

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery/db"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
	"github.com/kapildev333/shopperstop/services/rider/internal/pg"
)

// Item is one order line as the delivery keeps it.
type Item struct {
	Name      string `json:"name"`
	UnitLabel string `json:"unitLabel"`
	Quantity  int    `json:"quantity"`
}

// Address is the delivery address as the order had it at placement.
type Address struct {
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	Pincode string `json:"pincode"`
}

// Delivery is one rider's delivery of one order, as the API shows it.
type Delivery struct {
	ID            string     `json:"id"`
	OrderID       string     `json:"orderId"`
	OrderNumber   string     `json:"orderNumber"`
	StoreID       string     `json:"storeId"`
	Status        string     `json:"status"` // assigned | delivered
	CustomerName  string     `json:"customerName"`
	CustomerPhone string     `json:"customerPhone,omitempty"`
	Address       Address    `json:"address"`
	TotalCents    int64      `json:"totalCents"`
	PaymentMethod string     `json:"paymentMethod"`
	ItemCount     int        `json:"itemCount"`
	Items         []Item     `json:"items"`
	AssignedAt    time.Time  `json:"assignedAt"`
	DeliveredAt   *time.Time `json:"deliveredAt,omitempty"`
}

// ReadyOrder is one ready order of the rider's store that no delivery holds.
type ReadyOrder struct {
	OrderID      string    `json:"orderId"`
	Number       string    `json:"number"`
	PlacedAt     time.Time `json:"placedAt"`
	ItemCount    int       `json:"itemCount"`
	TotalCents   int64     `json:"totalCents"`
	Pincode      string    `json:"pincode"`
	CustomerName string    `json:"customerName"`
}

var errClaimed = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "order already claimed"}
var errNotReady = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "order is not ready for pickup"}

// Deliveries serves the rider's deliveries. It is safe for concurrent use.
type Deliveries struct {
	pool *pgxpool.Pool
	q    *db.Queries
	core *core.Client
}

// New returns the delivery service over pool; c reads and moves orders in core.
func New(pool *pgxpool.Pool, c *core.Client) *Deliveries {
	return &Deliveries{pool: pool, q: db.New(pool), core: c}
}

// ReadyOrders answers the ready orders of the rider's store that no delivery
// holds, oldest first. It is one core page of 100, a working set rather than a
// browsable list. ponytail: more than 100 ready orders at once loses the oldest beyond 100; page through core then.
func (d *Deliveries) ReadyOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orders, err := d.core.StoreOrders(ctx, auth.CurrentRider(ctx).StoreID, "ready")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	sort.SliceStable(orders, func(i, j int) bool { return orders[i].PlacedAt.Before(orders[j].PlacedAt) })
	ids := make([]string, len(orders))
	for i, o := range orders {
		ids[i] = o.ID
	}
	claimed, err := d.q.ClaimedOrders(ctx, ids)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	taken := make(map[string]bool, len(claimed))
	for _, id := range claimed {
		taken[id] = true
	}
	items := []ReadyOrder{}
	for _, o := range orders {
		if !taken[o.ID] {
			items = append(items, readyView(o))
		}
	}
	httpx.WriteJSON(w, http.StatusOK, struct {
		Items []ReadyOrder `json:"items"`
	}{items})
}

func readyView(o core.Order) ReadyOrder {
	units := 0
	for _, l := range o.Items {
		units += l.Quantity
	}
	return ReadyOrder{
		OrderID: o.ID, Number: o.Number, PlacedAt: o.PlacedAt, ItemCount: units,
		TotalCents: o.TotalCents, Pincode: o.Address.Pincode, CustomerName: o.CustomerName,
	}
}

type claimRequest struct {
	OrderID string `json:"orderId"`
}

// Claim gives the rider a ready order of their store and answers 201 with the
// delivery. Core is read first with the service token: an unknown order or
// another store's order is 404 and core is never asked to move it. Then one
// transaction inserts the delivery and moves the order to out_for_delivery in
// core; any failure rolls the insert back.
func (d *Deliveries) Claim(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in claimRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if !httpx.IsUUID(in.OrderID) {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: "orderId", Message: "must be a uuid"})
		return
	}
	rider := auth.CurrentRider(ctx)
	order, err := d.core.Order(ctx, in.OrderID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if !strings.EqualFold(order.StoreID, rider.StoreID) {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	row, err := d.claim(ctx, rider, order)
	switch {
	case pg.IsUnique(err):
		httpx.WriteError(w, r, errClaimed)
		return
	case errors.Is(err, core.ErrConflict):
		httpx.WriteError(w, r, errNotReady)
		return
	case err != nil:
		httpx.WriteError(w, r, err)
		return
	}
	slog.InfoContext(ctx, "delivery claimed", "deliveryId", row.ID, "orderId", row.OrderID,
		"number", row.OrderNumber, "riderId", rider.ID, "requestId", httpx.RequestID(ctx))
	out, err := toDelivery(row)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, out)
}

// claim is the transaction of Claim. The insert takes the order's unique slot
// first, so concurrent claims serialise on it; core's move runs last, so its
// refusal or failure returns from the function and rolls the insert back.
func (d *Deliveries) claim(ctx context.Context, rider auth.Rider, o core.Order) (db.Delivery, error) {
	lines := o.Items
	if lines == nil {
		lines = []core.OrderItem{}
	}
	raw, err := json.Marshal(lines)
	if err != nil {
		return db.Delivery{}, err
	}
	units := 0
	for _, l := range lines {
		units += l.Quantity
	}
	var row db.Delivery
	err = pgx.BeginFunc(ctx, d.pool, func(tx pgx.Tx) error {
		var err error
		row, err = d.q.WithTx(tx).CreateDelivery(ctx, db.CreateDeliveryParams{
			OrderID: o.ID, OrderNumber: o.Number, StoreID: o.StoreID, RiderID: rider.ID,
			CustomerName: o.CustomerName, CustomerPhone: o.CustomerPhone,
			AddressLine1: o.Address.Line1, AddressLine2: o.Address.Line2, AddressPincode: o.Address.Pincode,
			TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, ItemCount: int32(units), Items: raw,
		})
		if err != nil {
			return err
		}
		return d.core.ChangeStatus(ctx, o.ID, "out_for_delivery", core.Actor{Type: "rider", ID: rider.ID, Name: rider.Name})
	})
	return row, err
}

// toDelivery is the API view of a stored delivery.
func toDelivery(row db.Delivery) (Delivery, error) {
	var items []Item
	if err := json.Unmarshal(row.Items, &items); err != nil {
		return Delivery{}, err
	}
	if items == nil {
		items = []Item{}
	}
	out := Delivery{
		ID: row.ID, OrderID: row.OrderID, OrderNumber: row.OrderNumber, StoreID: row.StoreID,
		Status: string(row.Status), CustomerName: row.CustomerName, CustomerPhone: row.CustomerPhone,
		Address:    Address{Line1: row.AddressLine1, Line2: row.AddressLine2, Pincode: row.AddressPincode},
		TotalCents: row.TotalCents, PaymentMethod: row.PaymentMethod, ItemCount: int(row.ItemCount),
		Items: items, AssignedAt: row.AssignedAt.Time,
	}
	if row.DeliveredAt.Valid {
		t := row.DeliveredAt.Time
		out.DeliveredAt = &t
	}
	return out, nil
}
