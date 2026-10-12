// Package catalog owns the categories and products: the admin routes that
// edit them, and the store-facing reads that come later.
package catalog

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
)

// Catalog serves the catalog routes. New must not touch pool or files: the
// contract test builds the router with nil.
type Catalog struct {
	q     *db.Queries
	files blob.Store
}

// New returns the catalog handlers over pool, storing uploads in files.
func New(pool *pgxpool.Pool, files blob.Store) *Catalog {
	return &Catalog{q: db.New(pool), files: files}
}

// Category is a category as the admin routes show it. ParentID is omitted
// for a parent and ImageURL when there is no image.
type Category struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	ParentID  string `json:"parentId,omitempty"`
	SortOrder int32  `json:"sortOrder"`
	ImageURL  string `json:"imageUrl,omitempty"`
}

// CategoryNode is a parent category with its children, which is never nil.
type CategoryNode struct {
	Category
	Children []Category `json:"children"`
}

// CategoryTree is the body of GET /admin/categories.
type CategoryTree struct {
	Items []CategoryNode `json:"items"`
}

// imageURL is the path the file route serves key at; "" when there is no image.
func imageURL(key string) string {
	if key == "" {
		return ""
	}
	return "/api/core/v1/files/" + key
}

func toCategory(c db.Category) Category {
	out := Category{ID: c.ID, Name: c.Name, Slug: c.Slug, SortOrder: c.SortOrder, ImageURL: imageURL(c.ImageKey)}
	if c.ParentID != nil {
		out.ParentID = *c.ParentID
	}
	return out
}

// tree groups rows, already ordered by sort order and name, into parents with
// their children in the same order. A child whose parent is missing is dropped;
// the foreign key makes that impossible.
func tree(rows []db.Category) []CategoryNode {
	nodes := []CategoryNode{}
	index := map[string]int{}
	for _, r := range rows {
		if r.ParentID == nil {
			index[r.ID] = len(nodes)
			nodes = append(nodes, CategoryNode{Category: toCategory(r), Children: []Category{}})
		}
	}
	for _, r := range rows {
		if r.ParentID == nil {
			continue
		}
		if i, ok := index[*r.ParentID]; ok {
			nodes[i].Children = append(nodes[i].Children, toCategory(r))
		}
	}
	return nodes
}

// mapErr turns a write's database error into the API error. The category
// parent foreign key gets its own message; everything else is pg.Map's.
func mapErr(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" && pgErr.ConstraintName == "categories_parent_id_fkey" {
		return invalid("parentId", "unknown category")
	}
	return pg.Map(err)
}

func invalid(field, message string) *httpx.Error {
	return &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Field: field, Message: message}
}

var notFound = &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}

// checkName trims name and requires 1 to 100 characters.
func checkName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if n := utf8.RuneCountInString(name); n < 1 || n > 100 {
		return "", invalid("name", "must be from 1 to 100 characters")
	}
	return name, nil
}

// checkSortOrder requires 0 to 9999.
func checkSortOrder(n int32) error {
	if n < 0 || n > 9999 {
		return invalid("sortOrder", "must be from 0 to 9999")
	}
	return nil
}
