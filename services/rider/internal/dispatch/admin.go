package dispatch

import (
	"net/http"
	"strings"
	"time"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// OrderDispatch is the staff view of one order's dispatch, for the board line.
type OrderDispatch struct {
	Online   int64           `json:"online"`   // online riders at the order's store
	Dispatch string          `json:"dispatch"` // on | off
	Offers   []DispatchOffer `json:"offers"`   // the latest 10, newest first
}

// DispatchOffer is one offer of the order as staff see it.
type DispatchOffer struct {
	ID         string     `json:"id"`
	RiderName  string     `json:"riderName"`
	Status     string     `json:"status"` // offered | accepted | declined | expired
	EtaSeconds int        `json:"etaSeconds"`
	OfferedAt  time.Time  `json:"offeredAt"`
	AnsweredAt *time.Time `json:"answeredAt,omitempty"`
}

// AdminOrderDispatch answers an order's dispatch to staff. The order is read
// from core with the service token: an unknown order is 404, and so is
// another store's order for store staff.
func (d *Dispatcher) AdminOrderDispatch(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := httpx.PathID(r, "orderId")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	order, err := d.core.Order(ctx, id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	staff := auth.CurrentStaff(ctx)
	if staff.Role != "admin" && !strings.EqualFold(staff.StoreID, order.StoreID) {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	online, err := d.q.CountOnline(ctx, order.StoreID)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rows, err := d.q.OrderOffers(ctx, id)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	out := OrderDispatch{Online: online, Dispatch: "off", Offers: make([]DispatchOffer, 0, len(rows))}
	if d.cfg.Enabled {
		loc, err := d.storeLocation(ctx, order.StoreID)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if loc != nil {
			out.Dispatch = "on"
		}
	}
	for _, row := range rows {
		o := DispatchOffer{ID: row.ID, RiderName: row.RiderName, Status: string(row.Status), EtaSeconds: int(row.EtaSeconds), OfferedAt: row.OfferedAt.Time}
		if row.AnsweredAt.Valid {
			t := row.AnsweredAt.Time
			o.AnsweredAt = &t
		}
		out.Offers = append(out.Offers, o)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
