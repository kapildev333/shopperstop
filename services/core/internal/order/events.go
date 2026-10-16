package order

import (
	"net/http"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
)

// FeedEvent is one order event as services tail it, with the order's ids and
// its payment state when read.
type FeedEvent struct {
	Seq           int64     `json:"seq"`
	OrderID       string    `json:"orderId"`
	OrderNumber   string    `json:"orderNumber"`
	StoreID       string    `json:"storeId"`
	CustomerID    string    `json:"customerId"`
	FromStatus    string    `json:"fromStatus,omitempty"` // absent on the placement event
	ToStatus      string    `json:"toStatus"`
	PaymentMethod string    `json:"paymentMethod"`
	PaymentStatus string    `json:"paymentStatus,omitempty"` // online orders only
	ActorType     string    `json:"actorType"`
	CreatedAt     time.Time `json:"createdAt"` // UTC
}

// feedParam reads a whole-number query parameter between lo and hi, def when
// absent; anything else is 400 validation naming it.
func feedParam(r *http.Request, name string, def, lo, hi int64) (int64, error) {
	q := r.URL.Query()
	if !q.Has(name) {
		return def, nil
	}
	n, err := strconv.ParseInt(q.Get(name), 10, 64)
	if err != nil || n < lo || n > hi {
		return 0, invalid(name, "must be a whole number from "+strconv.FormatInt(lo, 10)+" to "+strconv.FormatInt(hi, 10))
	}
	return n, nil
}

// Feed answers 200 with {items}: at most limit (default 100, at most 500) order
// events with seq above after (default 0), ascending by seq. A caller keeps the
// last seq it handled and asks for the events after it; an empty list means
// it is up to date. There is no paging envelope: seq is the cursor.
func Feed(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		after, err := feedParam(r, "after", 0, 0, 1<<62)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		limit, err := feedParam(r, "limit", 100, 1, 500)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		rows, err := db.New(pool).EventFeed(r.Context(), db.EventFeedParams{After: after, Lim: int32(limit)})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		items := make([]FeedEvent, len(rows))
		for i, e := range rows {
			items[i] = FeedEvent{
				Seq: e.Seq, OrderID: e.OrderID, OrderNumber: e.Number, StoreID: e.StoreID, CustomerID: e.CustomerID,
				ToStatus: string(e.ToStatus), PaymentMethod: e.PaymentMethod, ActorType: e.ActorType, CreatedAt: e.CreatedAt.UTC(),
			}
			if e.FromStatus != nil {
				items[i].FromStatus = string(*e.FromStatus)
			}
			if e.PaymentStatus != nil {
				items[i].PaymentStatus = string(*e.PaymentStatus)
			}
		}
		httpx.WriteJSON(w, http.StatusOK, struct {
			Items []FeedEvent `json:"items"`
		}{items})
	}
}
