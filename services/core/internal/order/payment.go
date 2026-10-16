package order

import (
	"log/slog"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// paymentRequest is the POST /admin/orders/{id}/payment body.
type paymentRequest struct {
	Status    string `json:"status"`
	Reference string `json:"reference"`
}

// paymentFrom is the payment status each new one must come from: paid only from
// pending, refunded only from paid.
var paymentFrom = map[db.PaymentStatus]db.PaymentStatus{
	db.PaymentStatusPaid:     db.PaymentStatusPending,
	db.PaymentStatusRefunded: db.PaymentStatusPaid,
}

// SetPayment answers 200 with the order after a service marks its payment paid
// or refunded, in one transaction under the order's row lock, with an event by
// the system that keeps the order's status and notes the reference. A cash
// order, or a payment not in the status the new one comes from, is 409 conflict
// and changes nothing.
func SetPayment(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var in paymentRequest
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		to := db.PaymentStatus(in.Status)
		from, ok := paymentFrom[to]
		if !ok {
			httpx.WriteError(w, r, invalid("status", "must be paid or refunded"))
			return
		}
		ref := strings.TrimSpace(in.Reference)
		if ref == "" || utf8.RuneCountInString(ref) > 100 {
			httpx.WriteError(w, r, invalid("reference", "must be 1 to 100 characters"))
			return
		}
		ctx := r.Context()
		service := auth.Service(ctx)
		var row db.LockOrderRow
		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			q := db.New(tx)
			var err error
			if row, err = q.LockOrder(ctx, db.LockOrderParams{ID: id}); err != nil {
				return pg.Map(err)
			}
			if row.PaymentStatus == nil || *row.PaymentStatus != from {
				return &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "the payment is not " + string(from)}
			}
			if err := q.SetPayment(ctx, db.SetPaymentParams{PaymentStatus: &to, PaymentReference: ref, ID: id}); err != nil {
				return err
			}
			return q.AddEvent(ctx, db.AddEventParams{
				OrderID: id, FromStatus: &row.Status, ToStatus: row.Status,
				ActorType: "system", ActorName: &service, Note: "Payment " + string(to) + ", reference " + ref,
			})
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		slog.InfoContext(ctx, "order payment", "orderId", id, "number", row.Number, "from", string(from),
			"to", string(to), "service", service, "requestId", httpx.RequestID(ctx))
		respond(w, r, pool, id, scope{}, http.StatusOK)
	}
}
