package catalog

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/catalog/db"
	"github.com/kapildev333/shopperstop/services/core/internal/pg"
	"github.com/kapildev333/shopperstop/services/core/internal/testdb"
)

var (
	testPool *pgxpool.Pool
	q        *db.Queries
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("catalog")
	q = db.New(testPool)
	code := m.Run()
	cleanup()
	os.Exit(code)
}

func ctx() context.Context { return context.Background() }

func strp(s string) *string { return &s }

func insertCategory(t *testing.T, name, slug string, parentID *string) db.Category {
	t.Helper()
	c, err := q.CreateCategory(ctx(), db.CreateCategoryParams{Name: name, Slug: slug, ParentID: parentID})
	if err != nil {
		t.Fatalf("create category %s: %v", slug, err)
	}
	return c
}

func insertProduct(t *testing.T, categoryID, name, slug, brand string, priceCents, mrpCents int64, active bool) db.Product {
	t.Helper()
	p, err := q.CreateProduct(ctx(), db.CreateProductParams{
		CategoryID: categoryID,
		Name:       name,
		Slug:       slug,
		Brand:      brand,
		UnitLabel:  "1 pc",
		MrpCents:   mrpCents,
		PriceCents: priceCents,
		IsActive:   active,
	})
	if err != nil {
		t.Fatalf("create product %s: %v", slug, err)
	}
	return p
}

// sqlState returns the PostgreSQL error code and constraint name, or empty strings.
func sqlState(err error) (code, constraint string) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code, pgErr.ConstraintName
	}
	return "", ""
}

func TestListProductsFilters(t *testing.T) {
	fruit := insertCategory(t, "Filter Fruit", "filter-fruit", nil)
	citrus := insertCategory(t, "Filter Citrus", "filter-citrus", strp(fruit.ID))
	snacks := insertCategory(t, "Filter Snacks", "filter-snacks", nil)

	apple := insertProduct(t, fruit.ID, "Filter Apple", "filter-apple", "Daily Farm", 100, 100, true)
	lime := insertProduct(t, citrus.ID, "Filter Lime", "filter-lime", "Orchard", 50, 60, true)
	pct := insertProduct(t, snacks.ID, "Filter 50% Juice", "filter-50-juice", "Pure", 90, 90, true)
	under := insertProduct(t, snacks.ID, "Filter snack_bar", "filter-snack-bar", "Crunch", 20, 20, false)

	page := func(p db.ListProductsParams) map[string]bool {
		t.Helper()
		p.PageSize, p.PageOffset = 100, 0
		rows, err := q.ListProducts(ctx(), p)
		if err != nil {
			t.Fatalf("list: %v", err)
		}
		total, err := q.CountProducts(ctx(), db.CountProductsParams{Pattern: p.Pattern, CategoryID: p.CategoryID, IsActive: p.IsActive})
		if err != nil {
			t.Fatalf("count: %v", err)
		}
		if total != int64(len(rows)) {
			t.Errorf("count %d != listed %d for %+v", total, len(rows), p)
		}
		ids := map[string]bool{}
		for _, r := range rows {
			ids[r.ID] = true
		}
		return ids
	}
	want := func(name string, got map[string]bool, ids ...string) {
		t.Helper()
		if len(got) != len(ids) {
			t.Errorf("%s: got %d rows, want %d", name, len(got), len(ids))
		}
		for _, id := range ids {
			if !got[id] {
				t.Errorf("%s: missing %s", name, id)
			}
		}
	}

	// A parent includes the products of its children.
	want("parent", page(db.ListProductsParams{CategoryID: strp(fruit.ID)}), apple.ID, lime.ID)
	want("child", page(db.ListProductsParams{CategoryID: strp(citrus.ID)}), lime.ID)
	want("brand", page(db.ListProductsParams{Pattern: strp("%FARM%")}), apple.ID)
	want("escaped percent", page(db.ListProductsParams{Pattern: strp(`%\%%`)}), pct.ID)
	want("escaped underscore", page(db.ListProductsParams{Pattern: strp(`%\_%`)}), under.ID)
	want("inactive", page(db.ListProductsParams{IsActive: boolp(false)}), under.ID)
}

func boolp(b bool) *bool { return &b }

func TestPriceAboveMrpRefused(t *testing.T) {
	cat := insertCategory(t, "Price Check", "price-check", nil)

	_, err := q.CreateProduct(ctx(), db.CreateProductParams{
		CategoryID: cat.ID, Name: "Price Over", Slug: "price-over", UnitLabel: "1 pc",
		MrpCents: 100, PriceCents: 200, IsActive: true,
	})
	if code, c := sqlState(err); code != "23514" || c != "products_price_lte_mrp" {
		t.Fatalf("insert above MRP: code %q constraint %q, want 23514 products_price_lte_mrp (err %v)", code, c, err)
	}

	ok := insertProduct(t, cat.ID, "Price Ok", "price-ok", "", 100, 100, true)
	_, err = q.UpdateProduct(ctx(), db.UpdateProductParams{ID: ok.ID, PriceCents: int64p(200)})
	if code, c := sqlState(err); code != "23514" || c != "products_price_lte_mrp" {
		t.Fatalf("update above MRP: code %q constraint %q, want 23514 products_price_lte_mrp (err %v)", code, c, err)
	}
}

func int64p(n int64) *int64 { return &n }

func TestCategoryDeleteRestricted(t *testing.T) {
	parent := insertCategory(t, "Restrict Parent", "restrict-parent", nil)
	insertCategory(t, "Restrict Child", "restrict-child", strp(parent.ID))
	if _, err := q.DeleteCategory(ctx(), parent.ID); err == nil {
		t.Fatal("delete parent with a child: want 23503")
	} else if code, _ := sqlState(err); code != "23503" {
		t.Fatalf("delete parent with a child: code %q, want 23503 (%v)", code, err)
	}

	withProduct := insertCategory(t, "Restrict Stocked", "restrict-stocked", nil)
	insertProduct(t, withProduct.ID, "Restrict Item", "restrict-item", "", 10, 10, true)
	if _, err := q.DeleteCategory(ctx(), withProduct.ID); err == nil {
		t.Fatal("delete category with a product: want 23503")
	} else if code, _ := sqlState(err); code != "23503" {
		t.Fatalf("delete category with a product: code %q, want 23503 (%v)", code, err)
	}

	empty := insertCategory(t, "Restrict Empty", "restrict-empty", nil)
	if n, err := q.DeleteCategory(ctx(), empty.ID); err != nil || n != 1 {
		t.Fatalf("delete empty category: rows %d, err %v; want 1, nil", n, err)
	}
}

func TestSlugUnique(t *testing.T) {
	insertCategory(t, "Slug First", "slug-taken", nil)
	_, err := q.CreateCategory(ctx(), db.CreateCategoryParams{Name: "Slug Second", Slug: "slug-taken"})
	if !pg.IsUnique(err) {
		t.Fatalf("duplicate category slug: want unique violation, got %v", err)
	}
}

func TestUpdatedAtTrigger(t *testing.T) {
	cat := insertCategory(t, "Trigger", "trigger-cat", nil)
	p := insertProduct(t, cat.ID, "Trigger Item", "trigger-item", "", 10, 10, true)
	time.Sleep(5 * time.Millisecond)
	updated, err := q.UpdateProduct(ctx(), db.UpdateProductParams{ID: p.ID, Name: strp("Trigger Item 2")})
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if !updated.UpdatedAt.Time.After(p.CreatedAt.Time) {
		t.Fatalf("updated_at %v not after created_at %v", updated.UpdatedAt.Time, p.CreatedAt.Time)
	}
}
