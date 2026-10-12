package store

import (
	"net/http"
	"regexp"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
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
