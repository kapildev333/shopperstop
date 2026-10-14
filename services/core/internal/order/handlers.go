package order

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

func notFound() *httpx.Error {
	return &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}
}

// customerScope limits a read to the signed-in customer's orders.
func customerScope(ctx context.Context) scope {
	id := auth.CustomerID(ctx)
	return scope{customerID: &id}
}

// createRequest is the POST /orders body.
type createRequest struct {
	AddressID string `json:"addressId"`
}

// Create answers 201 with the order placed from the signed-in customer's cart.
// The body is checked before the transaction; the placement does the rest.
func Create(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in createRequest
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		switch {
		case in.AddressID == "":
			httpx.WriteError(w, r, invalid("addressId", "required"))
			return
		case !httpx.IsUUID(in.AddressID):
			httpx.WriteError(w, r, invalid("addressId", "must be a uuid"))
			return
		}
		ctx := r.Context()
		id, err := Place(ctx, pool, auth.CustomerID(ctx), in.AddressID)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		respond(w, r, pool, id, customerScope(ctx), http.StatusCreated)
	}
}

// List answers 200 with one page of the signed-in customer's orders, newest first.
func List(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, pageSize, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		id := auth.CustomerID(ctx)
		q := db.New(pool)
		rows, err := q.CustomerOrders(ctx, db.CustomerOrdersParams{
			CustomerID: id, Off: int32((page - 1) * pageSize), Lim: int32(pageSize),
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		total, err := q.CountCustomerOrders(ctx, id)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		out, err := views(ctx, q, rows)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.NewList(out, page, pageSize, total))
	}
}

// Get answers 200 with the signed-in customer's order; another customer's or an unknown id is 404.
func Get(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		respond(w, r, pool, id, customerScope(r.Context()), http.StatusOK)
	}
}

// cancelRequest is the POST /orders/{id}/cancel body.
type cancelRequest struct {
	Reason string `json:"reason"`
}

// text trims v and requires at most 500 characters, naming field when it is longer.
func text(field, v string) (string, error) {
	v = strings.TrimSpace(v)
	if utf8.RuneCountInString(v) > 500 {
		return "", invalid(field, "at most 500 characters")
	}
	return v, nil
}

// Cancel answers 200 with the customer's order cancelled and its stock returned.
// Once the order is packing or later, or cancelled, the answer is 409 conflict.
func Cancel(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var in cancelRequest
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		reason, err := text("reason", in.Reason)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		sc := customerScope(ctx)
		actor := Actor{Type: "customer", ID: auth.CustomerID(ctx)}
		if err := Transition(ctx, pool, id, sc, db.OrderStatusCancelled, actor, reason); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		respond(w, r, pool, id, sc, http.StatusOK)
	}
}

// respond reads the order back in the caller's scope and writes it with status.
// Another scope's order is 404, like a missing one.
func respond(w http.ResponseWriter, r *http.Request, pool *pgxpool.Pool, id string, sc scope, status int) {
	ctx := r.Context()
	q := db.New(pool)
	row, err := q.GetOrder(ctx, db.GetOrderParams{ID: id, CustomerID: sc.customerID, StoreID: sc.storeID})
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	out, err := views(ctx, q, []db.Order{row})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, status, out[0])
}
