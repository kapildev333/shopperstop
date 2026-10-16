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
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// statusMessage names the seven statuses, for a status that is not one of them.
const statusMessage = "must be one of placed, accepted, packing, ready, out_for_delivery, delivered, cancelled"

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

// staffScope limits a read to the signed-in staff's store; only an admin sees every
// store. Any other role is scoped to its store, so a future role fails closed.
func staffScope(ctx context.Context) scope {
	s := auth.CurrentStaff(ctx)
	if s.Role == "admin" || auth.Service(ctx) != "" {
		return scope{}
	}
	return scope{storeID: &s.StoreID}
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

// StoreList answers 200 with one page of a store's orders, newest first, optionally
// only those in one status, or with active=true only those neither delivered nor
// cancelled. Store staff of another store and an unknown store are 404.
func StoreList(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		if sc := staffScope(ctx); sc.storeID != nil && *sc.storeID != id {
			httpx.WriteError(w, r, notFound())
			return
		}
		if _, err := store.Get(ctx, pool, id); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var status *db.OrderStatus
		if v := r.URL.Query().Get("status"); v != "" {
			st := db.OrderStatus(v)
			if !st.Valid() {
				httpx.WriteError(w, r, invalid("status", statusMessage))
				return
			}
			status = &st
		}
		active, err := activeParam(r, status != nil)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		page, pageSize, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		q := db.New(pool)
		rows, err := q.StoreOrders(ctx, db.StoreOrdersParams{
			StoreID: id, Status: status, Active: active, Off: int32((page - 1) * pageSize), Lim: int32(pageSize),
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		total, err := q.CountStoreOrders(ctx, db.CountStoreOrdersParams{StoreID: id, Status: status, Active: active})
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

// activeParam reads the store list's active filter: absent or empty is false,
// "true" is true, and any other value, or true with a status, is 400 field active.
func activeParam(r *http.Request, withStatus bool) (bool, error) {
	switch r.URL.Query().Get("active") {
	case "":
		return false, nil
	case "true":
		if withStatus {
			return false, invalid("active", "cannot be combined with status")
		}
		return true, nil
	default:
		return false, invalid("active", "must be true")
	}
}

// AdminGet answers 200 with one order in the staff's scope. Store staff get only
// their store's orders; any other order is 404.
func AdminGet(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		respond(w, r, pool, id, staffScope(r.Context()), http.StatusOK)
	}
}

// statusRequest is the POST /admin/orders/{id}/status body.
type statusRequest struct {
	Status string        `json:"status"`
	Note   string        `json:"note"`
	Actor  *actorRequest `json:"actor"`
}

// actorRequest is the rider a service names as the actor of a status change.
type actorRequest struct {
	Type string `json:"type"`
	ID   string `json:"id"`
	Name string `json:"name"`
}

// errRiderMoves refuses a service's move to any status but the rider's two.
var errRiderMoves = &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "a service may only move an order to out_for_delivery or delivered"}

// actorOf returns who makes the status change: the signed-in staff user, who
// names no actor, or the rider a service names, which it must.
func actorOf(ctx context.Context, in *actorRequest) (Actor, error) {
	if auth.Service(ctx) == "" {
		if in != nil {
			return Actor{}, invalid("actor", "only a service names an actor")
		}
		return Actor{Type: "staff", ID: auth.CurrentStaff(ctx).ID}, nil
	}
	if in == nil {
		return Actor{}, invalid("actor", "required")
	}
	name := strings.TrimSpace(in.Name)
	switch {
	case in.Type != "rider":
		return Actor{}, invalid("actor", "type must be rider")
	case !httpx.IsUUID(in.ID):
		return Actor{}, invalid("actor", "id must be a uuid")
	case name == "" || utf8.RuneCountInString(name) > 80:
		return Actor{}, invalid("actor", "name must be 1 to 80 characters")
	}
	return Actor{Type: "rider", ID: in.ID, Name: name}, nil
}

// SetStatus answers 200 with the order after a status change by staff or by a
// service. Staff make any move and name no actor; a service must name the rider
// making a move to out_for_delivery or delivered, and any other target is 403.
// A move the table does not allow is 409 conflict and changes nothing. A cancel
// records the note as cancelReason and returns the order's quantities to stock.
func SetStatus(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var in statusRequest
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if !db.OrderStatus(in.Status).Valid() {
			httpx.WriteError(w, r, invalid("status", statusMessage))
			return
		}
		note, err := text("note", in.Note)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		actor, err := actorOf(ctx, in.Actor)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		to := db.OrderStatus(in.Status)
		if actor.Type == "rider" && to != db.OrderStatusOutForDelivery && to != db.OrderStatusDelivered {
			httpx.WriteError(w, r, errRiderMoves)
			return
		}
		sc := staffScope(ctx)
		if err := Transition(ctx, pool, id, sc, to, actor, note); err != nil {
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
