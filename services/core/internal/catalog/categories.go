package catalog

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// ListCategories answers the whole category tree; the tree is not paged.
func (c *Catalog) ListCategories(w http.ResponseWriter, r *http.Request) {
	rows, err := c.q.ListCategories(r.Context())
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, CategoryTree{Items: tree(rows)})
}

// categoryCreate is the body of POST /admin/categories.
type categoryCreate struct {
	Name      string  `json:"name"`
	ParentID  *string `json:"parentId"`
	SortOrder *int32  `json:"sortOrder"`
}

// CreateCategory answers 201 with the new category.
func (c *Catalog) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var in categoryCreate
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	name, err := checkName(in.Name)
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if in.ParentID != nil {
		if err := c.checkParent(r.Context(), *in.ParentID); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
	}
	var sortOrder int32
	if in.SortOrder != nil {
		if err := checkSortOrder(*in.SortOrder); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		sortOrder = *in.SortOrder
	}
	row, err := c.insertCategory(r.Context(), name, in.ParentID, sortOrder)
	if err != nil {
		httpx.WriteError(w, r, mapErr(err))
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toCategory(row))
}

// checkParent refuses a parent that is not a category, or that is itself a
// child. A parent is never re-parented, so this check cannot race into a third level.
func (c *Catalog) checkParent(ctx context.Context, id string) error {
	if !httpx.IsUUID(id) {
		return invalid("parentId", "unknown category")
	}
	parent, err := c.q.GetCategory(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return invalid("parentId", "unknown category")
	}
	if err != nil {
		return err
	}
	if parent.ParentID != nil {
		return invalid("parentId", "categories have two levels")
	}
	return nil
}

// insertCategory stores a category under the slug of its name. A slug clash
// retries with a random 6-hex suffix: three attempts in all.
func (c *Catalog) insertCategory(ctx context.Context, name string, parentID *string, sortOrder int32) (db.Category, error) {
	base := slugify(name, "category")
	slug := base
	for attempt := 1; ; attempt++ {
		row, err := c.q.CreateCategory(ctx, db.CreateCategoryParams{Name: name, Slug: slug, ParentID: parentID, SortOrder: sortOrder})
		if !pg.IsUnique(err) || attempt == 3 {
			return row, err
		}
		var suffix [3]byte
		rand.Read(suffix[:]) // crypto/rand crashes rather than failing, so the error is not checked
		slug = base + "-" + hex.EncodeToString(suffix[:])
	}
}

// categoryPatch is the body of PATCH /admin/categories/{id}. Only name and
// sortOrder change; the slug never does.
type categoryPatch struct {
	Name      *string `json:"name"`
	SortOrder *int32  `json:"sortOrder"`
}

// UpdateCategory answers 200 with the updated category.
func (c *Catalog) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	var in categoryPatch
	if err := httpx.ReadPatch(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	args := db.UpdateCategoryParams{ID: id}
	if in.Name != nil {
		name, err := checkName(*in.Name)
		if err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		args.Name = &name
	}
	if in.SortOrder != nil {
		if err := checkSortOrder(*in.SortOrder); err != nil {
			httpx.WriteError(w, r, err)
			return
		}
		args.SortOrder = in.SortOrder
	}
	row, err := c.q.UpdateCategory(r.Context(), args)
	if err != nil {
		httpx.WriteError(w, r, pg.Map(err))
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toCategory(row))
}

// DeleteCategory answers 204. A category with a child or a product is 409: the
// foreign keys refuse the delete.
func (c *Catalog) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id, err := httpx.PathID(r, "id")
	if err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	n, err := c.q.DeleteCategory(r.Context(), id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "category has products or subcategories"})
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
