// Package delivery is the rider's work on core's orders: the ready orders of
// the rider's store that nobody has claimed, and the claim that gives one to
// the rider (rider-deliveries). Core's order table decides every status move;
// this package only records what the rider carries.
package delivery

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
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
	PaymentMethod string     `json:"paymentMethod"`           // cod | online
	PaymentStatus string     `json:"paymentStatus,omitempty"` // online only, as core held it at the claim
	ItemCount     int        `json:"itemCount"`
	Items         []Item     `json:"items"`
	AssignedAt    time.Time  `json:"assignedAt"`
	DeliveredAt   *time.Time `json:"deliveredAt,omitempty"`
}

// ReadyOrder is one ready order of the rider's store that no delivery holds.
type ReadyOrder struct {
	OrderID       string    `json:"orderId"`
	Number        string    `json:"number"`
	PlacedAt      time.Time `json:"placedAt"`
	ItemCount     int       `json:"itemCount"`
	TotalCents    int64     `json:"totalCents"`
	PaymentMethod string    `json:"paymentMethod"`
	PaymentStatus string    `json:"paymentStatus,omitempty"`
	Pincode       string    `json:"pincode"`
	CustomerName  string    `json:"customerName"`
}

var errClaimed = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "order already claimed"}
var errNotAssigned = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "delivery is not assigned"}
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
		TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, PaymentStatus: o.PaymentStatus,
		Pincode: o.Address.Pincode, CustomerName: o.CustomerName,
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
			TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod, PaymentStatus: o.PaymentStatus,
			ItemCount: int32(units), Items: raw,
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
		TotalCents: row.TotalCents, PaymentMethod: row.PaymentMethod, PaymentStatus: row.PaymentStatus,
		ItemCount: int(row.ItemCount), Items: items, AssignedAt: row.AssignedAt.Time,
	}
	if row.DeliveredAt.Valid {
		t := row.DeliveredAt.Time
		out.DeliveredAt = &t
	}
	return out, nil
}

// List answers one page of the rider's deliveries in one status, newest claim
// first. status is assigned (the default) or delivered; anything else is 400 on
// status.
func (d *Deliveries) List(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page, pageSize, err := httpx.Page(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	status := db.DeliveryStatus(r.URL.Query().Get("status"))
	switch status {
	case "":
		status = db.DeliveryStatusAssigned
	case db.DeliveryStatusAssigned, db.DeliveryStatusDelivered:
	default:
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: "status", Message: "must be assigned or delivered"})
		return
	}
	rider := auth.CurrentRider(ctx)
	total, err := d.q.CountRiderDeliveries(ctx, db.CountRiderDeliveriesParams{RiderID: rider.ID, Status: status})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rows, err := d.q.RiderDeliveries(ctx, db.RiderDeliveriesParams{
		RiderID: rider.ID, Status: status, Limit: int32(pageSize), Offset: int32((page - 1) * pageSize),
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]Delivery, 0, len(rows))
	for _, row := range rows {
		out, err := toDelivery(row)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		items = append(items, out)
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
}

// Get answers one of the rider's deliveries. Another rider's, an unknown id and
// an id that is not a uuid are all 404.
func (d *Deliveries) Get(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := d.q.RiderDelivery(r.Context(), db.RiderDeliveryParams{ID: id, RiderID: auth.CurrentRider(r.Context()).ID})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	out, err := toDelivery(row)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Delivered marks the rider's assigned delivery delivered and answers 200 with
// it. One transaction locks the row, moves the order to delivered in core with
// the rider as actor, then stamps the row; a core refusal or failure rolls the
// stamp back, so the delivery stays assigned.
func (d *Deliveries) Delivered(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rider := auth.CurrentRider(ctx)
	var row db.Delivery
	err = pgx.BeginFunc(ctx, d.pool, func(tx pgx.Tx) error {
		q := d.q.WithTx(tx)
		locked, err := q.LockRiderDelivery(ctx, db.LockRiderDeliveryParams{ID: id, RiderID: rider.ID})
		if err != nil {
			return err
		}
		if locked.Status != db.DeliveryStatusAssigned {
			return errNotAssigned
		}
		if err := d.core.ChangeStatus(ctx, locked.OrderID, "delivered", core.Actor{Type: "rider", ID: rider.ID, Name: rider.Name}); err != nil {
			return err
		}
		row, err = q.MarkDelivered(ctx, id)
		return err
	})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	slog.InfoContext(ctx, "delivery delivered", "deliveryId", row.ID, "orderId", row.OrderID,
		"number", row.OrderNumber, "riderId", rider.ID, "requestId", httpx.RequestID(ctx))
	out, err := toDelivery(row)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// Location is a rider's last reported position and the server's time for it.
type Location struct {
	Lat        float64   `json:"lat"`
	Lng        float64   `json:"lng"`
	RecordedAt time.Time `json:"recordedAt"`
}

// CustomerDelivery is a customer's view of the delivery of their order. The
// rider's position is shown only while the delivery is assigned.
type CustomerDelivery struct {
	RiderName string    `json:"riderName"`
	Status    string    `json:"status"`
	Location  *Location `json:"location,omitempty"`
}

type locationRequest struct {
	Lat *float64 `json:"lat"`
	Lng *float64 `json:"lng"`
}

// coordinate checks one position field: present, and within ±limit.
func coordinate(field string, v *float64, limit float64) error {
	if v == nil {
		return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: "is required"}
	}
	if *v < -limit || *v > limit {
		return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field,
			Message: fmt.Sprintf("must be between -%v and %v", limit, limit)}
	}
	return nil
}

// PutLocation replaces the signed-in rider's position, stamped with the
// server's clock, and answers 204. lat is checked before lng.
func (d *Deliveries) PutLocation(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	var in locationRequest
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := coordinate("lat", in.Lat, 90); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if err := coordinate("lng", in.Lng, 180); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	err := d.q.UpsertLocation(ctx, db.UpsertLocationParams{RiderID: auth.CurrentRider(ctx).ID, Lat: *in.Lat, Lng: *in.Lng})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// OrderDelivery answers the customer's view of the delivery of their order.
// The customer's bearer is read from core, which proves the order is theirs:
// core's 401 and 404 pass through. No bearer is 401 with no core call.
func (d *Deliveries) OrderDelivery(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	token := auth.Bearer(r)
	if token == "" {
		httpx.WriteError(w, r, core.ErrUnauthorized)
		return
	}
	id, err := httpx.PathID(r, "orderId")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if _, err := d.core.CustomerOrder(ctx, token, id); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := d.q.OrderDelivery(ctx, id)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	out := CustomerDelivery{RiderName: row.RiderName, Status: string(row.Status)}
	if row.Lat != nil {
		out.Location = &Location{Lat: *row.Lat, Lng: *row.Lng, RecordedAt: row.RecordedAt.Time}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
