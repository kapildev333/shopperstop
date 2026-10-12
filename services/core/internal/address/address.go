// Package address serves a customer's delivery addresses under /me/addresses.
// Every query is scoped to the signed-in customer, so another customer's id
// answers 404 like a missing one.
package address

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/address/db"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// Address is one address as the API shows it. Line2 is omitted when empty.
type Address struct {
	ID        string `json:"id"`
	Label     string `json:"label"`
	Line1     string `json:"line1"`
	Line2     string `json:"line2,omitempty"`
	Pincode   string `json:"pincode"`
	IsDefault bool   `json:"isDefault"`
}

type createRequest struct {
	Label     string `json:"label"`
	Line1     string `json:"line1"`
	Line2     string `json:"line2"`
	Pincode   string `json:"pincode"`
	IsDefault bool   `json:"isDefault"`
}

// patchRequest is the PATCH body; an absent field is nil and stays unchanged.
type patchRequest struct {
	Label     *string `json:"label"`
	Line1     *string `json:"line1"`
	Line2     *string `json:"line2"`
	Pincode   *string `json:"pincode"`
	IsDefault *bool   `json:"isDefault"`
}

var pincodePattern = regexp.MustCompile(`^[1-9][0-9]{5}$`)

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

// text trims v and checks it is min to max characters.
func text(field, v string, min, max int) (string, error) {
	t := strings.TrimSpace(v)
	if n := utf8.RuneCountInString(t); n < min || n > max {
		return "", invalid(field, fmt.Sprintf("must be %d to %d characters", min, max))
	}
	return t, nil
}

func checkLabel(v string) (string, error) { return text("label", v, 1, 40) }
func checkLine1(v string) (string, error) { return text("line1", v, 1, 200) }
func checkLine2(v string) (string, error) { return text("line2", v, 0, 200) }

func checkPincode(v string) (string, error) {
	if !pincodePattern.MatchString(v) {
		return "", invalid("pincode", "must be six digits, not starting with 0")
	}
	return v, nil
}

// checkFields validates and trims every present field in order; the first
// failing field is the error. Create passes non-nil pointers to all four.
func checkFields(in *patchRequest) error {
	for _, f := range []struct {
		value *string
		check func(string) (string, error)
	}{{in.Label, checkLabel}, {in.Line1, checkLine1}, {in.Line2, checkLine2}, {in.Pincode, checkPincode}} {
		if f.value == nil {
			continue
		}
		v, err := f.check(*f.value)
		if err != nil {
			return err
		}
		*f.value = v
	}
	return nil
}

// inTx runs fn in one transaction. When clearDefault is set, the customer's
// current default is cleared first, so the partial unique index never sees two.
func inTx(ctx context.Context, pool *pgxpool.Pool, customerID string, clearDefault bool, fn func(q *db.Queries) error) error {
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		q := db.New(tx)
		if clearDefault {
			if err := q.ClearDefaultAddress(ctx, customerID); err != nil {
				return err
			}
		}
		return fn(q)
	})
}

// List answers 200 with one page of the customer's addresses, default first.
func List(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		page, size, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		customer := auth.CustomerID(ctx)
		q := db.New(pool)
		total, err := q.CountAddresses(ctx, customer)
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		// httpx.Page bounds (page-1)*pageSize to int32, so the casts are safe.
		rows, err := q.ListAddresses(ctx, db.ListAddressesParams{CustomerID: customer, Limit: int32(size), Offset: int32((page - 1) * size)})
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		var items []Address
		for _, row := range rows {
			items = append(items, Address(row))
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, size, total))
	}
}

// Create answers 201 with the new address. Validation runs before any write.
func Create(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var in createRequest
		if err := httpx.ReadJSON(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := checkFields(&patchRequest{Label: &in.Label, Line1: &in.Line1, Line2: &in.Line2, Pincode: &in.Pincode}); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		customer := auth.CustomerID(ctx)
		var row db.CreateAddressRow
		err := inTx(ctx, pool, customer, in.IsDefault, func(q *db.Queries) (err error) {
			row, err = q.CreateAddress(ctx, db.CreateAddressParams{
				CustomerID: customer, Label: in.Label, Line1: in.Line1, Line2: in.Line2, Pincode: in.Pincode, IsDefault: in.IsDefault,
			})
			return err
		})
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		httpx.WriteJSON(w, http.StatusCreated, Address(row))
	}
}

// Update answers 200 with the address after changing the fields present in
// the body. An id that is not the customer's answers 404.
func Update(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var in patchRequest
		if err := httpx.ReadPatch(w, r, &in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := checkFields(&in); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		customer := auth.CustomerID(ctx)
		var row db.UpdateAddressRow
		err = inTx(ctx, pool, customer, in.IsDefault != nil && *in.IsDefault, func(q *db.Queries) (err error) {
			row, err = q.UpdateAddress(ctx, db.UpdateAddressParams{
				Label: in.Label, Line1: in.Line1, Line2: in.Line2, Pincode: in.Pincode, IsDefault: in.IsDefault,
				ID: id, CustomerID: customer,
			})
			return err
		})
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		httpx.WriteJSON(w, http.StatusOK, Address(row))
	}
}

// Delete answers 204. An id that is not the customer's, or none, answers 404.
func Delete(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ctx := r.Context()
		n, err := db.New(pool).DeleteAddress(ctx, db.DeleteAddressParams{ID: id, CustomerID: auth.CustomerID(ctx)})
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
