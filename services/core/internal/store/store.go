// Package store owns stores and the pincodes each one delivers to. Other
// packages read a store through Get and ForPincode, never their own SQL.
package store

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/store/db"
)

// Store is the public view of a store: what checkout shows.
type Store struct {
	ID                     string `json:"id"`
	Name                   string `json:"name"`
	City                   string `json:"city,omitempty"`
	IsOpen                 bool   `json:"isOpen"`
	DeliveryFeeCents       int64  `json:"deliveryFeeCents"`
	FreeDeliveryAboveCents int64  `json:"freeDeliveryAboveCents"`
	MinOrderCents          int64  `json:"minOrderCents"`
	PromisedMinutes        int32  `json:"promisedMinutes"`
}

// AdminStore is the admin view: Store plus the store's own address.
type AdminStore struct {
	Store
	AddressLine string `json:"addressLine"`
	Pincode     string `json:"pincode"`
}

// Get returns the store with the given id. q is a pool or a pgx.Tx.
// An unknown id is 404 not_found.
func Get(ctx context.Context, q db.DBTX, id string) (Store, error) {
	row, err := db.New(q).GetStore(ctx, id)
	if err != nil {
		return Store{}, pg.Map(err)
	}
	return public(row), nil
}

// ForPincode returns the store that delivers to pincode. An unserved
// pincode is 404 not_serviceable.
func ForPincode(ctx context.Context, q db.DBTX, pincode string) (Store, error) {
	row, err := db.New(q).StoreForPincode(ctx, pincode)
	if errors.Is(err, pgx.ErrNoRows) {
		return Store{}, &httpx.Error{Status: http.StatusNotFound, Code: "not_serviceable", Message: "we do not deliver to this pincode yet"}
	}
	if err != nil {
		return Store{}, err
	}
	return public(row), nil
}

// All answers every store by name, for the staff dashboard. Ceiling: the first 1000 stores.
func All(ctx context.Context, q db.DBTX) ([]Store, error) {
	rows, err := db.New(q).ListStores(ctx, db.ListStoresParams{Limit: 1000, Offset: 0})
	if err != nil {
		return nil, err
	}
	out := make([]Store, 0, len(rows))
	for _, row := range rows {
		out = append(out, public(row))
	}
	return out, nil
}

func public(row db.Store) Store {
	return Store{
		ID: row.ID, Name: row.Name, City: row.City, IsOpen: row.IsOpen,
		DeliveryFeeCents: row.DeliveryFeeCents, FreeDeliveryAboveCents: row.FreeDeliveryAboveCents,
		MinOrderCents: row.MinOrderCents, PromisedMinutes: row.PromisedMinutes,
	}
}

// admin is the admin view of a stored row.
func admin(row db.Store) AdminStore {
	return AdminStore{Store: public(row), AddressLine: row.AddressLine, Pincode: row.Pincode}
}

// maxMoney is the largest money value an admin may enter: ₹1,00,000 in paise.
const maxMoney = 10_000_000

// fields is the create and change body. On change a nil member is absent and
// stays unchanged; on create withDefaults fills every nil member first.
type fields struct {
	Name                   *string `json:"name"`
	City                   *string `json:"city"`
	AddressLine            *string `json:"addressLine"`
	Pincode                *string `json:"pincode"`
	IsOpen                 *bool   `json:"isOpen"`
	DeliveryFeeCents       *int64  `json:"deliveryFeeCents"`
	FreeDeliveryAboveCents *int64  `json:"freeDeliveryAboveCents"`
	MinOrderCents          *int64  `json:"minOrderCents"`
	PromisedMinutes        *int32  `json:"promisedMinutes"`
}

// withDefaults gives each absent member its zero value: a new store is closed,
// with no fee and no minimum, and the blank text and zero minutes that check refuses.
func (f *fields) withDefaults() {
	f.Name = orZero(f.Name)
	f.City = orZero(f.City)
	f.AddressLine = orZero(f.AddressLine)
	f.Pincode = orZero(f.Pincode)
	f.IsOpen = orZero(f.IsOpen)
	f.DeliveryFeeCents = orZero(f.DeliveryFeeCents)
	f.FreeDeliveryAboveCents = orZero(f.FreeDeliveryAboveCents)
	f.MinOrderCents = orZero(f.MinOrderCents)
	f.PromisedMinutes = orZero(f.PromisedMinutes)
}

func orZero[T any](p *T) *T {
	if p == nil {
		return new(T)
	}
	return p
}

// check trims Name, City and AddressLine in place, then checks each present member in
// order; the first failure is the answer. Every failure is 400 validation
// naming the field, and nothing is written.
func check(f *fields) error {
	if f.Name != nil {
		*f.Name = strings.TrimSpace(*f.Name)
		if n := utf8.RuneCountInString(*f.Name); n < 1 || n > 100 {
			return invalid("name", "name must be 1 to 100 characters")
		}
	}
	if f.City != nil {
		*f.City = strings.TrimSpace(*f.City)
		if utf8.RuneCountInString(*f.City) > 100 {
			return invalid("city", "city must be at most 100 characters")
		}
	}
	if f.AddressLine != nil {
		*f.AddressLine = strings.TrimSpace(*f.AddressLine)
		if n := utf8.RuneCountInString(*f.AddressLine); n < 1 || n > 200 {
			return invalid("addressLine", "addressLine must be 1 to 200 characters")
		}
	}
	if f.Pincode != nil && !pincodePattern.MatchString(*f.Pincode) {
		return invalid("pincode", "pincode must be 6 digits")
	}
	for _, m := range []struct {
		field string
		v     *int64
	}{
		{"deliveryFeeCents", f.DeliveryFeeCents},
		{"freeDeliveryAboveCents", f.FreeDeliveryAboveCents},
		{"minOrderCents", f.MinOrderCents},
	} {
		if m.v != nil && (*m.v < 0 || *m.v > maxMoney) {
			return invalid(m.field, "must be 0 to 10000000")
		}
	}
	if f.PromisedMinutes != nil && (*f.PromisedMinutes < 1 || *f.PromisedMinutes > 240) {
		return invalid("promisedMinutes", "must be 1 to 240")
	}
	return nil
}

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}
