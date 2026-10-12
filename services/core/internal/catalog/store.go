package catalog

import (
	"context"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// displayCap is the most a store product shows as its quantity (D7).
const displayCap = 10

// StoreProduct is an active product as a store shows it: Product without
// isActive, plus its stock at that store. Active is for the cart and never
// reaches JSON; ProductsByID answers inactive products too.
type StoreProduct struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
	Brand       string `json:"brand,omitempty"`
	UnitLabel   string `json:"unitLabel"`
	MrpCents    int64  `json:"mrpCents"`
	PriceCents  int64  `json:"priceCents"`
	CategoryID  string `json:"categoryId"`
	ImageURL    string `json:"imageUrl,omitempty"`
	InStock     bool   `json:"inStock"`
	Quantity    int32  `json:"quantity"`
	Active      bool   `json:"-"`
}

// storeProduct is p at a store holding stock of it. An inactive product is
// never in stock and shows quantity 0.
func storeProduct(p Product, stock int32, active bool) StoreProduct {
	out := StoreProduct{
		ID: p.ID, Name: p.Name, Slug: p.Slug, Description: p.Description, Brand: p.Brand,
		UnitLabel: p.UnitLabel, MrpCents: p.MrpCents, PriceCents: p.PriceCents,
		CategoryID: p.CategoryID, ImageURL: p.ImageURL, Active: active,
	}
	if active {
		out.InStock = stock > 0
		out.Quantity = min(stock, displayCap)
	}
	return out
}

// ProductsByID answers the products with these ids, active and inactive, with
// their stock at the store, keyed by id. Unknown ids are absent. For the cart.
func ProductsByID(ctx context.Context, d db.DBTX, storeID string, ids []string) (map[string]StoreProduct, error) {
	rows, err := db.New(d).StoreProductsByID(ctx, db.StoreProductsByIDParams{StoreID: storeID, Ids: ids})
	if err != nil {
		return nil, err
	}
	out := make(map[string]StoreProduct, len(rows))
	for _, r := range rows {
		p := toProduct(db.Product{
			ID: r.ID, Name: r.Name, Slug: r.Slug, Description: r.Description, Brand: r.Brand,
			UnitLabel: r.UnitLabel, MrpCents: r.MrpCents, PriceCents: r.PriceCents,
			CategoryID: r.CategoryID, ImageKey: r.ImageKey, IsActive: r.IsActive,
		})
		out[r.ID] = storeProduct(p, r.Quantity, r.IsActive)
	}
	return out, nil
}

// storeFilters reads q (trimmed, at most 100 characters, empty means none)
// and categoryId (a uuid when present). isActive is not a store filter.
func storeFilters(r *http.Request) (pat *string, categoryID *string, err error) {
	query := r.URL.Query()
	if q := strings.TrimSpace(query.Get("q")); q != "" {
		if utf8.RuneCountInString(q) > 100 {
			return nil, nil, invalid("q", "must be at most 100 characters")
		}
		p := pattern(q)
		pat = &p
	}
	if query.Has("categoryId") {
		id := query.Get("categoryId")
		if err := checkCategoryID(id); err != nil {
			return nil, nil, err
		}
		categoryID = &id
	}
	return pat, categoryID, nil
}

// StoreProducts answers the paged active products the store sells, ordered by
// name, filtered by q and categoryId (with its children). 404 for an unknown store.
func StoreProducts(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		storeID, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if _, err := store.Get(r.Context(), pool, storeID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		page, pageSize, err := httpx.Page(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		pat, categoryID, err := storeFilters(r)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		q := db.New(pool)
		rows, err := q.StoreProducts(r.Context(), db.StoreProductsParams{
			StoreID: storeID, Pattern: pat, CategoryID: categoryID,
			PageOffset: int32((page - 1) * pageSize), PageSize: int32(pageSize),
		})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		total, err := q.CountStoreProducts(r.Context(), db.CountStoreProductsParams{Pattern: pat, CategoryID: categoryID})
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		items := make([]StoreProduct, 0, len(rows))
		for _, row := range rows {
			p := toProduct(db.Product{
				ID: row.ID, Name: row.Name, Slug: row.Slug, Description: row.Description, Brand: row.Brand,
				UnitLabel: row.UnitLabel, MrpCents: row.MrpCents, PriceCents: row.PriceCents,
				CategoryID: row.CategoryID, ImageKey: row.ImageKey, IsActive: true,
			})
			items = append(items, storeProduct(p, row.Quantity, true))
		}
		httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
	}
}

// StoreProductBySlug answers one active product by its slug with its stock at
// the store. 404 for an unknown store, an unknown slug or an inactive product.
func StoreProductBySlug(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		storeID, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if _, err := store.Get(r.Context(), pool, storeID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		row, err := db.New(pool).StoreProductBySlug(r.Context(), db.StoreProductBySlugParams{StoreID: storeID, Slug: chi.URLParam(r, "slug")})
		if err != nil {
			httpx.WriteError(w, r, pg.Map(err))
			return
		}
		p := toProduct(db.Product{
			ID: row.ID, Name: row.Name, Slug: row.Slug, Description: row.Description, Brand: row.Brand,
			UnitLabel: row.UnitLabel, MrpCents: row.MrpCents, PriceCents: row.PriceCents,
			CategoryID: row.CategoryID, ImageKey: row.ImageKey, IsActive: true,
		})
		httpx.WriteJSON(w, http.StatusOK, storeProduct(p, row.Quantity, true))
	}
}

// StoreCategories answers the store's category tree with only the categories
// that have, themselves or through a child, an active product in stock there.
// A child is listed only when it qualifies itself. 404 for an unknown store.
func StoreCategories(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		storeID, err := httpx.PathID(r, "id")
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		if _, err := store.Get(r.Context(), pool, storeID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		rows, err := db.New(pool).StoreCategories(r.Context(), storeID)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, CategoryTree{Items: tree(rows)})
	}
}
