package store

import (
	"net/http"
	"regexp"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/store/db"
)

var pincodePattern = regexp.MustCompile(`^[1-9][0-9]{5}$`)

// serviceability is the body of a served pincode: the store that delivers there.
type serviceability struct {
	Store Store `json:"store"`
}

// Serviceability answers the store that delivers to ?pincode, open or closed.
// A malformed pincode is 400 validation; an unserved one is 404 not_serviceable.
func Serviceability(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		pincode := r.URL.Query().Get("pincode")
		if !pincodePattern.MatchString(pincode) {
			httpx.WriteError(w, r, &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: "pincode", Message: "pincode must be 6 digits"})
			return
		}
		s, err := ForPincode(r.Context(), pool, pincode)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, serviceability{Store: s})
	}
}

// PublicGet answers the public view of the store with the path id. An id
// that is not a uuid or names no store is 404 not_found.
func PublicGet(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		s, err := Get(r.Context(), pool, id)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, s)
	}
}

// List answers one page of stores, admin view, ordered by name then id.
func List(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, pageSize, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		q := db.New(pool)
		total, err := q.CountStores(ctx)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		rows, err := q.ListStores(ctx, db.ListStoresParams{Limit: int32(pageSize), Offset: int32((page - 1) * pageSize)})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		items := make([]AdminStore, 0, len(rows))
		for _, row := range rows {
			items = append(items, admin(row))
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
	}
}

// Create answers 201 with the new store. Absent fields take their defaults
// (closed, zero money) except name, addressLine, pincode and promisedMinutes,
// which must be present and valid.
func Create(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var f fields
		if err := httpx.ReadJSON(w, r, &f); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		f.withDefaults()
		if err := check(&f); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		row, err := db.New(pool).CreateStore(r.Context(), db.CreateStoreParams{
			Name: *f.Name, AddressLine: *f.AddressLine, Pincode: *f.Pincode, IsOpen: *f.IsOpen,
			DeliveryFeeCents: *f.DeliveryFeeCents, FreeDeliveryAboveCents: *f.FreeDeliveryAboveCents,
			MinOrderCents: *f.MinOrderCents, PromisedMinutes: *f.PromisedMinutes,
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, admin(row))
	}
}

// AdminGet answers the admin view of the store in the path. An unknown id is 404.
func AdminGet(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		row, err := db.New(pool).GetStore(r.Context(), id)
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		httpx.WriteJSON(w, http.StatusOK, admin(row))
	}
}

// Update changes the fields present in the body and answers 200 with the store.
// An absent field stays as it is, so {} answers the store unchanged.
func Update(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var f fields
		if err := httpx.ReadPatch(w, r, &f); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := check(&f); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		row, err := db.New(pool).UpdateStore(r.Context(), db.UpdateStoreParams{
			ID: id, Name: f.Name, AddressLine: f.AddressLine, Pincode: f.Pincode, IsOpen: f.IsOpen,
			DeliveryFeeCents: f.DeliveryFeeCents, FreeDeliveryAboveCents: f.FreeDeliveryAboveCents,
			MinOrderCents: f.MinOrderCents, PromisedMinutes: f.PromisedMinutes,
		})
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		httpx.WriteJSON(w, http.StatusOK, admin(row))
	}
}

// Delete removes the store in the path and answers 204. A store that staff
// users (or, later, orders) still refer to is 409 conflict: the database refuses
// the delete. An unknown id is 404.
func Delete(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		n, err := db.New(pool).DeleteStore(r.Context(), id)
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		if n == 0 {
			httpx.WriteError(w, r, &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
