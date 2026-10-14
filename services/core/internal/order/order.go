// Package order places orders from carts, moves them through their statuses and answers them to customers and staff.
package order

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"time"

	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
)

// Address is the delivery address as it was at placement.
type Address struct {
	Label   string `json:"label"`
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	Pincode string `json:"pincode"`
}

// Item is one order line as it was at placement.
type Item struct {
	ProductID  string `json:"productId"`
	Name       string `json:"name"`
	UnitLabel  string `json:"unitLabel"`
	ImageURL   string `json:"imageUrl,omitempty"`
	PriceCents int64  `json:"priceCents"`
	MrpCents   int64  `json:"mrpCents"`
	Quantity   int32  `json:"quantity"`
}

// Event is one entry of the order's status history.
type Event struct {
	FromStatus string    `json:"fromStatus,omitempty"` // absent on the placement event
	ToStatus   string    `json:"toStatus"`
	ActorType  string    `json:"actorType"` // customer | staff | system
	Note       string    `json:"note,omitempty"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Order is one order as the API shows it.
type Order struct {
	ID               string     `json:"id"`
	Number           string     `json:"number"`
	StoreID          string     `json:"storeId"`
	Status           string     `json:"status"`
	CustomerName     string     `json:"customerName"`
	CustomerPhone    string     `json:"customerPhone,omitempty"`
	Address          Address    `json:"address"`
	SubtotalCents    int64      `json:"subtotalCents"`
	DeliveryFeeCents int64      `json:"deliveryFeeCents"`
	TotalCents       int64      `json:"totalCents"`
	PaymentMethod    string     `json:"paymentMethod"`         // "cod"
	PlacedAt         time.Time  `json:"placedAt"`              // UTC
	DeliveredAt      *time.Time `json:"deliveredAt,omitempty"` // UTC when set
	CancelledAt      *time.Time `json:"cancelledAt,omitempty"` // UTC when set
	CancelReason     string     `json:"cancelReason,omitempty"`
	Items            []Item     `json:"items"`  // never nil
	Events           []Event    `json:"events"` // never nil, oldest first
}

// Actor is who made a change: Type is "customer" or "staff".
type Actor struct{ Type, ID string }

// scope limits a read to one customer or one store; nil means no filter.
type scope struct{ customerID, storeID *string }

// views turns rows into Orders, in the rows' order, with one OrderItems and one
// OrderEvents call for all of them. Items and Events are never nil.
func views(ctx context.Context, q *db.Queries, rows []db.Order) ([]Order, error) {
	out := make([]Order, 0, len(rows))
	if len(rows) == 0 {
		return out, nil
	}
	ids := make([]string, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	itemRows, err := q.OrderItems(ctx, ids)
	if err != nil {
		return nil, err
	}
	eventRows, err := q.OrderEvents(ctx, ids)
	if err != nil {
		return nil, err
	}
	items := make(map[string][]Item, len(rows))
	for _, it := range itemRows {
		items[it.OrderID] = append(items[it.OrderID], Item{
			ProductID: it.ProductID, Name: it.Name, UnitLabel: it.UnitLabel, ImageURL: it.ImageUrl,
			PriceCents: it.PriceCents, MrpCents: it.MrpCents, Quantity: it.Quantity,
		})
	}
	events := make(map[string][]Event, len(rows))
	for _, e := range eventRows {
		ev := Event{ToStatus: string(e.ToStatus), ActorType: e.ActorType, Note: e.Note, CreatedAt: e.CreatedAt.UTC()}
		if e.FromStatus != nil {
			ev.FromStatus = string(*e.FromStatus)
		}
		events[e.OrderID] = append(events[e.OrderID], ev)
	}
	for _, r := range rows {
		o := Order{
			ID: r.ID, Number: r.Number, StoreID: r.StoreID, Status: string(r.Status),
			CustomerName: r.CustomerName, CustomerPhone: r.CustomerPhone,
			Address:       Address{Label: r.AddressLabel, Line1: r.AddressLine1, Line2: r.AddressLine2, Pincode: r.AddressPincode},
			SubtotalCents: r.SubtotalCents, DeliveryFeeCents: r.DeliveryFeeCents, TotalCents: r.TotalCents,
			PaymentMethod: r.PaymentMethod, PlacedAt: r.PlacedAt.UTC(), CancelReason: r.CancelReason,
			Items: items[r.ID], Events: events[r.ID],
		}
		if o.Items == nil {
			o.Items = []Item{}
		}
		if o.Events == nil {
			o.Events = []Event{}
		}
		if r.DeliveredAt != nil {
			t := r.DeliveredAt.UTC()
			o.DeliveredAt = &t
		}
		if r.CancelledAt != nil {
			t := r.CancelledAt.UTC()
			o.CancelledAt = &t
		}
		out = append(out, o)
	}
	return out, nil
}

// newNumber is "SS-" and the 8 characters of base32 of 5 random bytes: A-Z and 2-7, no padding.
func newNumber() (string, error) {
	var b [5]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "SS-" + base32.StdEncoding.EncodeToString(b[:]), nil
}
