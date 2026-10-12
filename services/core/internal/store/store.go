// Package store owns stores and the pincodes each one delivers to. Other
// packages read a store through Get and ForPincode, never their own SQL.
package store

import (
	"context"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"

	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/store/db"
)

// Store is the public view of a store: what checkout shows.
type Store struct {
	ID                     string `json:"id"`
	Name                   string `json:"name"`
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

func public(row db.Store) Store {
	return Store{
		ID: row.ID, Name: row.Name, IsOpen: row.IsOpen,
		DeliveryFeeCents: row.DeliveryFeeCents, FreeDeliveryAboveCents: row.FreeDeliveryAboveCents,
		MinOrderCents: row.MinOrderCents, PromisedMinutes: row.PromisedMinutes,
	}
}
