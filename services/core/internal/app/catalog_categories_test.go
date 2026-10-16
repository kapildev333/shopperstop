package app

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"testing"
)

const categoriesPath = "/api/core/v1/admin/categories"

// missingCategoryID is a canonical uuid no category has.
const missingCategoryID = "00000000-0000-4000-8000-0000000005ff"

// categoryView is a category as the admin routes show it.
type categoryView struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Slug      string `json:"slug"`
	ParentID  string `json:"parentId"`
	SortOrder int32  `json:"sortOrder"`
	ImageURL  string `json:"imageUrl"`
}

type categoryNodeView struct {
	categoryView
	Children []categoryView `json:"children"`
}

// createCategory posts body as the admin and returns the 201 category.
func createCategory(t *testing.T, token string, body map[string]any) categoryView {
	t.Helper()
	status, resp := call(t, http.MethodPost, categoriesPath, token, body)
	if status != http.StatusCreated {
		t.Fatalf("create %v: got %d %s, want 201", body, status, resp)
	}
	var c categoryView
	if err := json.Unmarshal(resp, &c); err != nil {
		t.Fatal(err)
	}
	return c
}

// listTree returns the items of GET /admin/categories.
func listTree(t *testing.T, token string) []categoryNodeView {
	t.Helper()
	status, body := call(t, http.MethodGet, categoriesPath, token, nil)
	var tree struct {
		Items []categoryNodeView `json:"items"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &tree) != nil {
		t.Fatalf("GET /admin/categories: got %d %s, want 200", status, body)
	}
	return tree.Items
}

func treeHas(items []categoryNodeView, id string) bool {
	for _, n := range items {
		if n.ID == id {
			return true
		}
	}
	return false
}

// expectError asserts an error answer with the given status and code, and
// the field and message when they are not empty.
func expectError(t *testing.T, what string, status int, body []byte, wantStatus int, code, field, message string) {
	t.Helper()
	e := decodeError(t, body)
	if status != wantStatus || e.Error.Code != code || e.Error.Field != field || (message != "" && e.Error.Message != message) {
		t.Fatalf("%s: got %d %s, want %d %s field %q message %q", what, status, body, wantStatus, code, field, message)
	}
	codes, err := errorCodes()
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Contains(codes, code) {
		t.Fatalf("%s: code %s is not in openapi.json's Error code enum %v", what, code, codes)
	}
}

func TestCategoryTree(t *testing.T) {
	token := adminToken(t)
	b := createCategory(t, token, map[string]any{"name": "Tree Parent B", "sortOrder": 1})
	a := createCategory(t, token, map[string]any{"name": "Tree Parent A", "sortOrder": 2})
	y := createCategory(t, token, map[string]any{"name": "Tree Kid Y", "parentId": b.ID})
	x := createCategory(t, token, map[string]any{"name": "Tree Kid X", "parentId": b.ID})

	// The tree holds every test's categories; keep this test's parents in order.
	var ours []categoryNodeView
	for _, n := range listTree(t, token) {
		if n.ID == a.ID || n.ID == b.ID {
			ours = append(ours, n)
		}
	}
	if len(ours) != 2 || ours[0].ID != b.ID || ours[1].ID != a.ID {
		t.Fatalf("parents in tree order: got %+v, want B then A", ours)
	}
	if len(ours[0].Children) != 2 || ours[0].Children[0].ID != x.ID || ours[0].Children[1].ID != y.ID {
		t.Fatalf("children of B: got %+v, want x then y", ours[0].Children)
	}
	if ours[1].Children == nil || len(ours[1].Children) != 0 {
		t.Fatalf("children of A: got %v, want an empty array", ours[1].Children)
	}
}

func TestCreateChildCategory(t *testing.T) {
	token := adminToken(t)
	parent := createCategory(t, token, map[string]any{"name": "Child Parent"})
	child := createCategory(t, token, map[string]any{"name": "Milk", "parentId": parent.ID})
	if child.ParentID != parent.ID || child.SortOrder != 0 {
		t.Fatalf("child: got parentId %q sortOrder %d, want %q and 0", child.ParentID, child.SortOrder, parent.ID)
	}
}

func TestCategoryThirdLevelRefused(t *testing.T) {
	token := adminToken(t)
	parent := createCategory(t, token, map[string]any{"name": "Deep Parent"})
	child := createCategory(t, token, map[string]any{"name": "Deep Child", "parentId": parent.ID})
	status, body := call(t, http.MethodPost, categoriesPath, token, map[string]any{"name": "Too Deep", "parentId": child.ID})
	expectError(t, "third level", status, body, http.StatusBadRequest, "validation", "parentId", "categories have two levels")
}

func TestCategoryUnknownParent(t *testing.T) {
	token := adminToken(t)
	for _, parentID := range []string{missingCategoryID, "not-a-uuid"} {
		status, body := call(t, http.MethodPost, categoriesPath, token, map[string]any{"name": "Orphan", "parentId": parentID})
		expectError(t, "parent "+parentID, status, body, http.StatusBadRequest, "validation", "parentId", "unknown category")
	}
}

func TestCategoryMissingName(t *testing.T) {
	token := adminToken(t)
	for _, name := range []string{"", "   ", strings.Repeat("é", 101)} {
		status, body := call(t, http.MethodPost, categoriesPath, token, map[string]any{"name": name})
		expectError(t, "name of "+name, status, body, http.StatusBadRequest, "validation", "name", "")
	}
}

func TestCategorySortOrderRange(t *testing.T) {
	token := adminToken(t)
	for _, n := range []int{-1, 10000} {
		status, body := call(t, http.MethodPost, categoriesPath, token, map[string]any{"name": "Sorted", "sortOrder": n})
		expectError(t, "sortOrder", status, body, http.StatusBadRequest, "validation", "sortOrder", "")
	}
}

func TestCategorySlugDerived(t *testing.T) {
	token := adminToken(t)
	status, body := call(t, http.MethodPost, categoriesPath, token, map[string]any{"name": "Fruits & Vegetables"})
	var got map[string]json.RawMessage
	if status != http.StatusCreated || json.Unmarshal(body, &got) != nil {
		t.Fatalf("create: got %d %s, want 201", status, body)
	}
	var slug string
	if err := json.Unmarshal(got["slug"], &slug); err != nil || slug != "fruits-vegetables" {
		t.Fatalf("slug: got %s, want fruits-vegetables", got["slug"])
	}
	if _, ok := got["imageUrl"]; ok {
		t.Fatalf("category without an image has imageUrl: %s", body)
	}
}

func TestCategorySlugClashGetsSuffix(t *testing.T) {
	token := adminToken(t)
	first := createCategory(t, token, map[string]any{"name": "Clash Category"})
	second := createCategory(t, token, map[string]any{"name": "Clash Category"})
	if first.Slug != "clash-category" || !strings.HasPrefix(second.Slug, "clash-category-") || len(second.Slug) != len("clash-category-")+6 {
		t.Fatalf("slugs %q and %q: want clash-category and clash-category-<6 hex>", first.Slug, second.Slug)
	}
}

func TestCategoryRenameKeepsSlug(t *testing.T) {
	token := adminToken(t)
	c := createCategory(t, token, map[string]any{"name": "Rename Dairy"})
	status, body := call(t, http.MethodPatch, categoriesPath+"/"+c.ID, token, map[string]any{"name": "Rename Fresh Dairy"})
	var got categoryView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil {
		t.Fatalf("rename: got %d %s, want 200", status, body)
	}
	if got.Name != "Rename Fresh Dairy" || got.Slug != c.Slug {
		t.Fatalf("rename: got name %q slug %q, want the new name and slug %q", got.Name, got.Slug, c.Slug)
	}
}

func TestPatchCategory(t *testing.T) {
	token := adminToken(t)
	c := createCategory(t, token, map[string]any{"name": "Patch Me", "sortOrder": 1})
	status, body := call(t, http.MethodPatch, categoriesPath+"/"+c.ID, token, map[string]any{"name": "Patch Renamed", "sortOrder": 5})
	var got categoryView
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil || got.Name != "Patch Renamed" || got.SortOrder != 5 {
		t.Fatalf("patch: got %d %s, want 200 with name Patch Renamed and sortOrder 5", status, body)
	}
	// An absent member is left unchanged.
	status, body = call(t, http.MethodPatch, categoriesPath+"/"+c.ID, token, map[string]any{"sortOrder": 7})
	if status != http.StatusOK || json.Unmarshal(body, &got) != nil || got.Name != "Patch Renamed" || got.SortOrder != 7 {
		t.Fatalf("patch sortOrder only: got %d %s, want the name kept and sortOrder 7", status, body)
	}
}

func TestPatchUnknownCategory(t *testing.T) {
	token := adminToken(t)
	status, body := call(t, http.MethodPatch, categoriesPath+"/"+missingCategoryID, token, map[string]any{"name": "Nobody"})
	expectError(t, "patch unknown", status, body, http.StatusNotFound, "not_found", "", "")
}

func TestDeleteEmptyCategory(t *testing.T) {
	token := adminToken(t)
	c := createCategory(t, token, map[string]any{"name": "Delete Me"})
	if status, body := call(t, http.MethodDelete, categoriesPath+"/"+c.ID, token, nil); status != http.StatusNoContent {
		t.Fatalf("delete: got %d %s, want 204", status, body)
	}
	if treeHas(listTree(t, token), c.ID) {
		t.Fatal("deleted category is still in the tree")
	}
	status, body := call(t, http.MethodDelete, categoriesPath+"/"+c.ID, token, nil)
	expectError(t, "delete twice", status, body, http.StatusNotFound, "not_found", "", "")
}

func TestDeleteCategoryInUse(t *testing.T) {
	token := adminToken(t)
	parent := createCategory(t, token, map[string]any{"name": "In Use Parent"})
	createCategory(t, token, map[string]any{"name": "In Use Child", "parentId": parent.ID})
	stocked := createCategory(t, token, map[string]any{"name": "In Use Stocked"})
	if _, err := testPool.Exec(context.Background(),
		"insert into products (category_id, name, slug, unit_label, mrp_cents, price_cents) values ($1, 'In Use Item', 'in-use-item', '1 pc', 10, 10)",
		stocked.ID); err != nil {
		t.Fatal(err)
	}
	for _, c := range []categoryView{parent, stocked} {
		status, body := call(t, http.MethodDelete, categoriesPath+"/"+c.ID, token, nil)
		expectError(t, "delete in use "+c.Name, status, body, http.StatusConflict, "conflict", "", "category has products or subcategories")
	}
	items := listTree(t, token)
	if !treeHas(items, parent.ID) || !treeHas(items, stocked.ID) {
		t.Fatal("a refused delete removed its category")
	}
}
