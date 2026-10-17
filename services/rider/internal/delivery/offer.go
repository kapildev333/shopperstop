package delivery

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery/db"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
	"github.com/kapildev333/shopperstop/services/rider/internal/pg"
)

// Offer is the dispatcher's offer of one ready order to one rider (rider-dispatch).
type Offer struct {
	ID            string    `json:"id"`
	OrderID       string    `json:"orderId"`
	Number        string    `json:"number"`
	PlacedAt      time.Time `json:"placedAt"`
	ItemCount     int       `json:"itemCount"`
	TotalCents    int64     `json:"totalCents"`
	PaymentMethod string    `json:"paymentMethod"`
	PaymentStatus string    `json:"paymentStatus,omitempty"`
	Pincode       string    `json:"pincode"`
	EtaSeconds    int       `json:"etaSeconds"`
	OfferedAt     time.Time `json:"offeredAt"`
	ExpiresAt     time.Time `json:"expiresAt"`
}

var errOfferClosed = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "offer is no longer open"}
var errOrderGone = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "order is no longer available"}

// MyOffer answers the signed-in rider's open offer, or 204 when there is none.
func (d *Deliveries) MyOffer(w http.ResponseWriter, r *http.Request) {
	o, err := d.q.OpenOffer(r.Context(), auth.CurrentRider(r.Context()).ID)
	if errors.Is(err, pgx.ErrNoRows) {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, Offer{
		ID: o.ID, OrderID: o.OrderID, Number: o.OrderNumber, PlacedAt: o.PlacedAt.Time,
		ItemCount: int(o.ItemCount), TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod,
		PaymentStatus: o.PaymentStatus, Pincode: o.Pincode, EtaSeconds: int(o.EtaSeconds),
		OfferedAt: o.OfferedAt.Time, ExpiresAt: o.ExpiresAt.Time,
	})
}

// AcceptOffer accepts the rider's open offer and answers 201 with the delivery:
// the claim transaction, opened by marking the offer accepted. Another rider's
// or an unknown offer is 404; an answered or expired one 409 with no core call.
// When the order went to someone else or left ready the offer is voided and the
// answer is 409; when core fails the offer stays open and the answer is 502.
func (d *Deliveries) AcceptOffer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rider := auth.CurrentRider(ctx)
	offer, err := d.q.RiderOffer(ctx, db.RiderOfferParams{ID: id, RiderID: rider.ID})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	if !offer.Open {
		httpx.WriteError(w, r, errOfferClosed)
		return
	}
	order, err := d.core.Order(ctx, offer.OrderID)
	var row db.Delivery
	if err == nil {
		row, err = d.claim(ctx, rider, order, offer.ID)
	}
	switch {
	case err == nil:
	case errors.Is(err, errOfferClosed):
		httpx.WriteError(w, r, errOfferClosed)
		return
	case pg.IsUnique(err), errors.Is(err, core.ErrConflict), errors.Is(err, core.ErrNotFound):
		if err := d.q.VoidOffer(ctx, offer.ID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteError(w, r, errOrderGone)
		return
	default:
		httpx.WriteError(w, r, err)
		return
	}
	slog.InfoContext(ctx, "delivery claimed", "deliveryId", row.ID, "orderId", row.OrderID,
		"number", row.OrderNumber, "riderId", rider.ID, "requestId", httpx.RequestID(ctx))
	slog.InfoContext(ctx, "offer accepted", "offerId", offer.ID, "orderId", offer.OrderID,
		"number", offer.OrderNumber, "riderId", rider.ID, "requestId", httpx.RequestID(ctx))
	out, err := toDelivery(row)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, out)
}

// DeclineOffer declines the rider's open offer and answers 204. Another
// rider's or an unknown offer is 404; an answered or expired one 409.
func (d *Deliveries) DeclineOffer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rider := auth.CurrentRider(ctx)
	row, err := d.q.DeclineOffer(ctx, db.DeclineOfferParams{ID: id, RiderID: rider.ID})
	if errors.Is(err, pgx.ErrNoRows) {
		// Not declined: 404 when it is not the rider's offer, else it was already answered or expired.
		if _, err := d.q.RiderOffer(ctx, db.RiderOfferParams{ID: id, RiderID: rider.ID}); err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		httpx.WriteError(w, r, errOfferClosed)
		return
	}
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	slog.InfoContext(ctx, "offer declined", "offerId", id, "orderId", row.OrderID,
		"number", row.OrderNumber, "riderId", rider.ID, "requestId", httpx.RequestID(ctx))
	w.WriteHeader(http.StatusNoContent)
}
