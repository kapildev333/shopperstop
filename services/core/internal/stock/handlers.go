package stock

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/stock/db"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// Row is one active product with its quantity at the store, as the admin stock page reads it.
type Row struct {
	ProductID  string `json:"productId"`
	Name       string `json:"name"`
	Brand      string `json:"brand,omitempty"`
	UnitLabel  string `json:"unitLabel"`
	PriceCents int64  `json:"priceCents"`
	ImageURL   string `json:"imageUrl,omitempty"`
	Quantity   int32  `json:"quantity"`
}

const (
	maxRows     = 500
	maxQuantity = 100000
	maxSearch   = 100
)

// likeEscaper matches \, % and _ literally in a search, as catalog's pattern does.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

func notFound() *httpx.Error {
	return &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}
}

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

// canSee reports whether the staff user may act on the store: admins on any
// store, store staff only on their own.
func canSee(staff auth.Staff, storeID string) bool {
	return staff.Role != "store_staff" || staff.StoreID == storeID
}

// storeFor answers the store in the path for the signed-in staff user. A
// malformed id, a store that is not the staff user's own, and an unknown store
// are all 404 not_found; the staff check comes first, so store staff learn
// nothing about other stores.
func storeFor(ctx context.Context, r *http.Request, pool *pgxpool.Pool) (string, error) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		return "", err
	}
	if !canSee(auth.CurrentStaff(ctx), id) {
		return "", notFound()
	}
	if _, err := store.Get(ctx, pool, id); err != nil {
		return "", err
	}
	return id, nil
}

// List answers one page of the store's active products with their quantity
// there, sorted by name. q matches name or brand; lowStock=true keeps the
// products below 5, zero included.
func List(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		storeID, err := storeFor(ctx, r, pool)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		page, pageSize, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		query := r.URL.Query()
		var pat string
		if q := strings.TrimSpace(query.Get("q")); q != "" {
			if utf8.RuneCountInString(q) > maxSearch {
				httpx.WriteError(w, r, invalid("q", "must be at most 100 characters"))
				return
			}
			if strings.ContainsRune(q, 0) { // Postgres rejects a NUL byte in text (22021)
				httpx.WriteError(w, r, invalid("q", "must not contain a NUL byte"))
				return
			}
			pat = "%" + likeEscaper.Replace(q) + "%"
		}
		var lowStock bool
		switch query.Get("lowStock") {
		case "", "false":
		case "true":
			lowStock = true
		default:
			httpx.WriteError(w, r, invalid("lowStock", "must be true or false"))
			return
		}
		q := db.New(pool)
		rows, err := q.ListStock(ctx, db.ListStockParams{
			StoreID: storeID, Pattern: pat, LowStock: lowStock,
			Off: int32((page - 1) * pageSize), Lim: int32(pageSize),
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		total, err := q.CountStock(ctx, db.CountStockParams{StoreID: storeID, Pattern: pat, LowStock: lowStock})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		items := make([]Row, 0, len(rows))
		for _, row := range rows {
			items = append(items, Row{
				ProductID: row.ProductID, Name: row.Name, Brand: row.Brand, UnitLabel: row.UnitLabel,
				PriceCents: row.PriceCents, ImageURL: catalog.ImageURL(row.ImageKey), Quantity: row.Quantity,
			})
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
	}
}

// update is one line of the PUT body. Quantity is a pointer so an absent one is told apart from 0.
type update struct {
	ProductID string `json:"productId"`
	Quantity  *int   `json:"quantity"`
}

// checkRows answers the first problem with the rows: their count, each product
// id, each quantity, then a product listed twice.
func checkRows(rows []update) error {
	if len(rows) < 1 || len(rows) > maxRows {
		return invalid("rows", "1 to 500 rows")
	}
	for _, r := range rows {
		if !httpx.IsUUID(r.ProductID) {
			return invalid("productId", "must be a uuid")
		}
	}
	for _, r := range rows {
		if r.Quantity == nil {
			return invalid("quantity", "quantity is required")
		}
		if *r.Quantity < 0 || *r.Quantity > maxQuantity {
			return invalid("quantity", "0 to 100000")
		}
	}
	seen := make(map[string]bool, len(rows))
	for _, r := range rows {
		if seen[r.ProductID] {
			return invalid("rows", "product listed twice")
		}
		seen[r.ProductID] = true
	}
	return nil
}

// Put sets the quantity of each listed product at the store, creating the rows
// that are absent, in one transaction, and answers 204. Any invalid row refuses
// the whole request and changes nothing.
func Put(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		storeID, err := storeFor(r.Context(), r, pool)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		var body struct {
			Rows []update `json:"rows"`
		}
		if err := httpx.ReadJSON(w, r, &body); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if err := checkRows(body.Rows); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		ids := make([]string, len(body.Rows))
		quantities := make([]int32, len(body.Rows))
		for i, row := range body.Rows {
			ids[i] = row.ProductID
			quantities[i] = int32(*row.Quantity)
		}
		ctx := r.Context()
		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
			return db.New(tx).UpsertStock(ctx, db.UpsertStockParams{StoreID: storeID, ProductIds: ids, Quantities: quantities})
		})
		var pgErr *pgconn.PgError
		switch {
		case errors.As(err, &pgErr) && pgErr.Code == "23503":
			// The store was checked above, so the foreign key that failed is the product.
			httpx.WriteError(w, r, invalid("rows", "unknown product"))
		case err != nil:
			httpx.WriteError(w, r, err)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}
}
