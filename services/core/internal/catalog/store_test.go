package catalog

import (
	"testing"
)

// TestProductsByIDIncludesInactive: ProductsByID answers active and inactive products
// with their stock at the store; an unknown id is absent.
func TestProductsByIDIncludesInactive(t *testing.T) {
	var storeID string
	if err := testPool.QueryRow(ctx(),
		"insert into stores (name, address_line, pincode, promised_minutes) values ('By Id store', '1 Test Rd', '560001', 10) returning id").Scan(&storeID); err != nil {
		t.Fatal(err)
	}
	cat := insertCategory(t, "By Id Dairy", "by-id-dairy", nil)
	stocked := insertProduct(t, cat.ID, "By Id stocked", "by-id-stocked", "", 4500, 5000, true)
	rowless := insertProduct(t, cat.ID, "By Id rowless", "by-id-rowless", "", 4500, 5000, true)
	inactive := insertProduct(t, cat.ID, "By Id inactive", "by-id-inactive", "", 4500, 5000, false)
	unknown := "00000000-0000-4000-8000-0000000007ff"
	for _, s := range []struct {
		id  string
		qty int
	}{{stocked.ID, 4}, {inactive.ID, 9}} {
		if _, err := testPool.Exec(ctx(), "insert into store_stock (store_id, product_id, quantity) values ($1, $2, $3)", storeID, s.id, s.qty); err != nil {
			t.Fatal(err)
		}
	}

	got, err := ProductsByID(ctx(), testPool, storeID, []string{stocked.ID, rowless.ID, inactive.ID, unknown})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 3 {
		t.Fatalf("got %d products, want 3 (unknown id absent): %v", len(got), got)
	}
	if p := got[stocked.ID]; !p.InStock || p.Quantity != 4 || !p.Active {
		t.Errorf("stocked: got %+v, want inStock true quantity 4 active", p)
	}
	if p := got[rowless.ID]; p.InStock || p.Quantity != 0 || !p.Active {
		t.Errorf("rowless: got %+v, want inStock false quantity 0 active", p)
	}
	if p := got[inactive.ID]; p.InStock || p.Quantity != 0 || p.Active {
		t.Errorf("inactive: got %+v, want inStock false quantity 0 not active", p)
	}
}
