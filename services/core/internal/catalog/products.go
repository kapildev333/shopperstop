package catalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// maxCents is the largest MRP or price the API takes: ₹10 lakh.
const maxCents = 100_000_000

// checkText trims s and requires from min to max characters.
func checkText(field, s string, min, max int) (string, error) {
	s = strings.TrimSpace(s)
	if n := utf8.RuneCountInString(s); n < min || n > max {
		return "", invalid(field, fmt.Sprintf("must be from %d to %d characters", min, max))
	}
	return s, nil
}

// checkCategoryID requires a canonical uuid; an unknown one is caught by the foreign key.
func checkCategoryID(id string) error {
	if !httpx.IsUUID(id) {
		return invalid("categoryId", "unknown category")
	}
	return nil
}

// checkMrp requires 1 to 100 000 000 cents.
func checkMrp(n int64) error {
	if n < 1 || n > maxCents {
		return invalid("mrpCents", fmt.Sprintf("must be from 1 to %d", maxCents))
	}
	return nil
}

// productCreate is the body of POST /admin/products. IsActive defaults to true.
type productCreate struct {
	Name        string `json:"name"`
	CategoryID  string `json:"categoryId"`
	UnitLabel   string `json:"unitLabel"`
	MrpCents    int64  `json:"mrpCents"`
	PriceCents  int64  `json:"priceCents"`
	Brand       string `json:"brand"`
	Description string `json:"description"`
	IsActive    *bool  `json:"isActive"`
}

// createArgs checks a create body, first failing field wins, and returns the
// row to insert (its slug is set by the caller).
func createArgs(in productCreate) (db.CreateProductParams, error) {
	var out db.CreateProductParams
	var err error
	if out.Name, err = checkText("name", in.Name, 1, 100); err != nil {
		return out, err
	}
	if err := checkCategoryID(in.CategoryID); err != nil {
		return out, err
	}
	if out.Brand, err = checkText("brand", in.Brand, 0, 60); err != nil {
		return out, err
	}
	if out.Description, err = checkText("description", in.Description, 0, 2000); err != nil {
		return out, err
	}
	if out.UnitLabel, err = checkText("unitLabel", in.UnitLabel, 1, 30); err != nil {
		return out, err
	}
	if err := checkMrp(in.MrpCents); err != nil {
		return out, err
	}
	if in.PriceCents < 1 || in.PriceCents > in.MrpCents {
		return out, invalid("priceCents", "must be between 1 and mrpCents")
	}
	out.CategoryID, out.MrpCents, out.PriceCents, out.IsActive = in.CategoryID, in.MrpCents, in.PriceCents, true
	if in.IsActive != nil {
		out.IsActive = *in.IsActive
	}
	return out, nil
}

// insertProduct stores a product under the slug of its name. A slug clash
// retries with a random 6-hex suffix: three attempts in all.
func (c *Catalog) insertProduct(ctx context.Context, args db.CreateProductParams) (db.Product, error) {
	base := slugify(args.Name, "product")
	args.Slug = base
	for attempt := 1; ; attempt++ {
		row, err := c.q.CreateProduct(ctx, args)
		if !pg.IsUnique(err) || attempt == 3 {
			return row, err
		}
		var suffix [3]byte
		rand.Read(suffix[:]) // crypto/rand crashes rather than failing, so the error is not checked
		args.Slug = base + "-" + hex.EncodeToString(suffix[:])
	}
}

// CreateProduct answers 201 with the new product.
func (c *Catalog) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var in productCreate
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	args, err := createArgs(in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := c.insertProduct(r.Context(), args)
	if err != nil {
		httpx.WriteError(w, r, mapErr(err))
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toProduct(row))
}

// GetProduct answers 200 with the product, or 404.
func (c *Catalog) GetProduct(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	row, err := c.q.GetProduct(r.Context(), id)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toProduct(row))
}

// productPatch is the body of PATCH /admin/products/{id}. The slug never changes.
type productPatch struct {
	Name        *string `json:"name"`
	CategoryID  *string `json:"categoryId"`
	Brand       *string `json:"brand"`
	Description *string `json:"description"`
	UnitLabel   *string `json:"unitLabel"`
	MrpCents    *int64  `json:"mrpCents"`
	PriceCents  *int64  `json:"priceCents"`
	IsActive    *bool   `json:"isActive"`
}

// patchArgs checks the members a patch sets. The price rule is left to the
// database checks, so a patch that changes only one amount is compared with
// the stored other one atomically; they answer 23514, which mapErr turns into priceCents.
func patchArgs(in productPatch) (db.UpdateProductParams, error) {
	out := db.UpdateProductParams{PriceCents: in.PriceCents, IsActive: in.IsActive}
	if in.Name != nil {
		name, err := checkText("name", *in.Name, 1, 100)
		if err != nil {
			return out, err
		}
		out.Name = &name
	}
	if in.CategoryID != nil {
		if err := checkCategoryID(*in.CategoryID); err != nil {
			return out, err
		}
		out.CategoryID = in.CategoryID
	}
	if in.Brand != nil {
		brand, err := checkText("brand", *in.Brand, 0, 60)
		if err != nil {
			return out, err
		}
		out.Brand = &brand
	}
	if in.Description != nil {
		desc, err := checkText("description", *in.Description, 0, 2000)
		if err != nil {
			return out, err
		}
		out.Description = &desc
	}
	if in.UnitLabel != nil {
		unit, err := checkText("unitLabel", *in.UnitLabel, 1, 30)
		if err != nil {
			return out, err
		}
		out.UnitLabel = &unit
	}
	if in.MrpCents != nil {
		if err := checkMrp(*in.MrpCents); err != nil {
			return out, err
		}
		out.MrpCents = in.MrpCents
	}
	return out, nil
}

// UpdateProduct answers 200 with the updated product, or 404.
func (c *Catalog) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var in productPatch
	if err := httpx.ReadPatch(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	args, err := patchArgs(in)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	args.ID = id
	row, err := c.q.UpdateProduct(r.Context(), args)
	if err != nil {
		httpx.WriteError(w, r, mapErr(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toProduct(row))
}

// DeleteProduct answers 204. A product an order line refers to is 409 and
// stays; an unknown id is 404.
func (c *Catalog) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	n, err := c.q.DeleteProduct(r.Context(), id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "product was ordered; set isActive to false instead"})
		return
	}
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	if n == 0 {
		httpx.WriteError(w, r, notFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListProducts answers the paged list of active and inactive products, ordered
// by name, filtered by q, categoryId (with its children) and isActive.
func (c *Catalog) ListProducts(w http.ResponseWriter, r *http.Request) {
	page, pageSize, err := httpx.Page(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	pat, categoryID, isActive, err := productFilters(r)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	rows, err := c.q.ListProducts(r.Context(), db.ListProductsParams{
		Pattern: pat, CategoryID: categoryID, IsActive: isActive,
		PageOffset: int32((page - 1) * pageSize), PageSize: int32(pageSize),
	})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	total, err := c.q.CountProducts(r.Context(), db.CountProductsParams{Pattern: pat, CategoryID: categoryID, IsActive: isActive})
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	items := make([]Product, 0, len(rows))
	for _, row := range rows {
		items = append(items, toProduct(row))
	}
	httpx.WriteJSON(w, http.StatusOK, httpx.NewList(items, page, pageSize, total))
}

// productFilters reads q (trimmed, at most 100 characters, empty means none),
// categoryId (a uuid when present) and isActive (true or false when present).
func productFilters(r *http.Request) (pat *string, categoryID *string, isActive *bool, err error) {
	query := r.URL.Query()
	if q := strings.TrimSpace(query.Get("q")); q != "" {
		if utf8.RuneCountInString(q) > 100 {
			return nil, nil, nil, invalid("q", "must be at most 100 characters")
		}
		if strings.ContainsRune(q, 0) { // Postgres rejects a NUL byte in text (22021)
			return nil, nil, nil, invalid("q", "must not contain a NUL byte")
		}
		p := pattern(q)
		pat = &p
	}
	if query.Has("categoryId") {
		id := query.Get("categoryId")
		if err := checkCategoryID(id); err != nil {
			return nil, nil, nil, err
		}
		categoryID = &id
	}
	if query.Has("isActive") {
		v := query.Get("isActive")
		if v != "true" && v != "false" {
			return nil, nil, nil, invalid("isActive", "must be true or false")
		}
		isActive = new(bool)
		*isActive = v == "true"
	}
	return pat, categoryID, isActive, nil
}
