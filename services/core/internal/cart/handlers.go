package cart

import (
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// maxQuantity is the most of one product a cart line holds.
const maxQuantity = 20

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

// itemSet is the PUT body. Quantity is a pointer so an absent one is told apart from 0.
type itemSet struct {
	StoreID   string `json:"storeId"`
	ProductID string `json:"productId"`
	Quantity  *int   `json:"quantity"`
}

// check answers the first problem with the body: the ids are uuids, and
// quantity is present and from 0 to 20.
func check(in itemSet) error {
	if !httpx.IsUUID(in.StoreID) {
		return invalid("storeId", "must be a uuid")
	}
	if !httpx.IsUUID(in.ProductID) {
		return invalid("productId", "must be a uuid")
	}
	if in.Quantity == nil {
		return invalid("quantity", "required")
	}
	if *in.Quantity < 0 || *in.Quantity > maxQuantity {
		return invalid("quantity", "0 to 20")
	}
	return nil
}

// Get answers the signed-in customer's cart with its totals.
func Get(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		c, err := view(r.Context(), pool, auth.CustomerID(r.Context()))
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, c)
	}
}

// PutItem sets one line of the customer's cart to an absolute quantity and
// answers 200 with the cart. A quantity above 0 needs an active product; the
// store must exist. The validation is outside the transaction, the write inside.
func PutItem(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		var in itemSet
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := check(in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if _, err := store.Get(ctx, pool, in.StoreID); err != nil {
			var apiErr *httpx.Error
			if errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound {
				httpx.WriteError(w, r, invalid("storeId", "unknown store"))
				return
			}
			httpx.WriteError(w, r, err)
			return
		}
		if *in.Quantity > 0 {
			// An absent product is the zero value, whose Active is false.
			products, err := catalog.ProductsByID(ctx, pool, in.StoreID, []string{in.ProductID})
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			if !products[in.ProductID].Active {
				httpx.WriteError(w, r, invalid("productId", "product not available"))
				return
			}
		}
		customerID := auth.CustomerID(ctx)
		err := pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			return set(ctx, tx, customerID, in.StoreID, in.ProductID, int32(*in.Quantity))
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		c, err := view(ctx, pool, customerID)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, Update{Cart: c})
	}
}

// Delete empties the signed-in customer's cart and answers 204, also when there is none.
func Delete(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := Clear(r.Context(), pool, auth.CustomerID(r.Context())); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
