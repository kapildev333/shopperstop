package app

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/coretest"
)

const (
	testStoreB  = "00000000-0000-4000-8000-000000000402"
	testStoreC  = "00000000-0000-4000-8000-000000000403" // no core store: riders of it are inserted by SQL only
	unknownUUID = "00000000-0000-4000-8000-0000000009ff"
	adminToken  = "admin-token"
	staffAToken = "store-a-staff-token"
	staffBToken = "store-b-staff-token"
	ridersPath  = "/api/rider/v1/admin/riders"
	meAdminRead = "GET /api/core/v1/admin/me"
)

var (
	coreFake   *coretest.Fake
	coreClient *core.Client
)

// startCore starts the core fake the admin routes call: stores A and B are
// known, and each staff token answers one staff user. It returns the stop function.
func startCore() func() {
	coreFake = coretest.New()
	coreFake.AddStore(core.Store{ID: testStore, Name: "Koramangala", IsOpen: true})
	coreFake.AddStore(core.Store{ID: testStoreB, Name: "Indiranagar", IsOpen: true})
	coreFake.AddStaff(adminToken, core.Staff{ID: "00000000-0000-4000-8000-000000000501", Email: "admin@shopperstop.local", Name: "Admin", Role: "admin", IsActive: true})
	coreFake.AddStaff(staffAToken, core.Staff{ID: "00000000-0000-4000-8000-000000000502", Email: "staff-a@shopperstop.local", Name: "Store A staff", Role: "store_staff", StoreID: testStore, IsActive: true})
	coreFake.AddStaff(staffBToken, core.Staff{ID: "00000000-0000-4000-8000-000000000503", Email: "staff-b@shopperstop.local", Name: "Store B staff", Role: "store_staff", StoreID: testStoreB, IsActive: true})
	coreClient = core.New(coreFake.URL(), "service-token", time.Now)
	return coreFake.Close
}

// seedRiderAt inserts an active or inactive rider of store with the fixture
// password and returns its id.
func seedRiderAt(t *testing.T, store, email string, active bool) string {
	t.Helper()
	var id string
	err := testPool.QueryRow(context.Background(),
		"insert into riders (store_id, email, name, password_hash, is_active) values ($1, $2, 'Asha Rao', $3, $4) returning id",
		store, email, cheapHash(), active).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func countRiders(t *testing.T, store string) int64 {
	t.Helper()
	var n int64
	q := "select count(*) from riders"
	args := []any{}
	if store != "" {
		q += " where store_id = $1"
		args = append(args, store)
	}
	if err := testPool.QueryRow(context.Background(), q, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func countSessions(t *testing.T, riderID string) int64 {
	t.Helper()
	var n int64
	if err := testPool.QueryRow(context.Background(), "select count(*) from sessions where rider_id = $1", riderID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func riderName(t *testing.T, riderID string) string {
	t.Helper()
	var name string
	if err := testPool.QueryRow(context.Background(), "select name from riders where id = $1", riderID).Scan(&name); err != nil {
		t.Fatal(err)
	}
	return name
}

// listBody is the 200 body of the rider list.
type listBody struct {
	Items    []riderJSON `json:"items"`
	Page     int         `json:"page"`
	PageSize int         `json:"pageSize"`
	Total    int64       `json:"total"`
}

func decodeList(t *testing.T, body []byte) listBody {
	t.Helper()
	var l listBody
	if err := json.Unmarshal(body, &l); err != nil {
		t.Fatalf("body %s is not a list: %v", body, err)
	}
	return l
}

func decodeRider(t *testing.T, body []byte) riderJSON {
	t.Helper()
	var r riderJSON
	if err := json.Unmarshal(body, &r); err != nil {
		t.Fatalf("body %s is not a rider: %v", body, err)
	}
	return r
}

// expectError asserts the status and error code of one answer.
func expectError(t *testing.T, what string, status int, body []byte, wantStatus int, wantCode string) envelope {
	t.Helper()
	e := decodeError(t, body)
	if status != wantStatus || e.Error.Code != wantCode {
		t.Fatalf("%s: got %d %s, want %d %s", what, status, body, wantStatus, wantCode)
	}
	return e
}

func TestStaffAdmittedThroughCore(t *testing.T) {
	email := uniqueEmail(t)
	seedRiderAt(t, testStore, email, true)
	s := signInAs(t, email, testPassword)
	cases := []struct {
		name, token string
		status      int
		code        string
	}{
		{"core staff token", adminToken, http.StatusOK, ""},
		{"rider token", s.Token, http.StatusUnauthorized, "unauthorized"},
		{"no token", "", http.StatusUnauthorized, "unauthorized"},
	}
	for _, c := range cases {
		before := coreFake.Calls(meAdminRead)
		status, body := callAt(t, srv.URL, http.MethodGet, ridersPath, c.token, nil)
		if c.code == "" {
			if status != c.status {
				t.Fatalf("%s: got %d %s, want %d", c.name, status, body, c.status)
			}
			continue
		}
		expectError(t, c.name, status, body, c.status, c.code)
		if c.token == "" && coreFake.Calls(meAdminRead) != before {
			t.Fatalf("%s reached core; a missing bearer must be refused before any core call", c.name)
		}
	}
}

// TestStaffRouteCoreFailureIs502 uses a token no other test sends, so the
// staff cache cannot answer for it while core is failing.
func TestStaffRouteCoreFailureIs502(t *testing.T) {
	const token = "core-failure-token"
	coreFake.AddStaff(token, core.Staff{ID: "00000000-0000-4000-8000-000000000504", Email: "failing@shopperstop.local", Name: "Failing", Role: "admin", IsActive: true})
	coreFake.Fail(http.StatusInternalServerError)
	t.Cleanup(func() { coreFake.Fail(0) })
	status, body := callAt(t, srv.URL, http.MethodGet, ridersPath, token, nil)
	expectError(t, "core 500", status, body, http.StatusBadGateway, "internal")
}

func TestAdminListsAndFiltersRiders(t *testing.T) {
	c1 := seedRiderAt(t, testStoreC, uniqueEmail(t), true)
	c2 := seedRiderAt(t, testStoreC, uniqueEmail(t), true)
	seedRiderAt(t, testStoreB, uniqueEmail(t), true)

	status, body := callAt(t, srv.URL, http.MethodGet, ridersPath, adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("admin list: got %d %s", status, body)
	}
	if all := decodeList(t, body); all.Total != countRiders(t, "") {
		t.Fatalf("admin list total %d, want every rider %d", all.Total, countRiders(t, ""))
	}

	status, body = callAt(t, srv.URL, http.MethodGet, ridersPath+"?store="+testStoreC, adminToken, nil)
	if status != http.StatusOK {
		t.Fatalf("admin list of store C: got %d %s", status, body)
	}
	list := decodeList(t, body)
	if list.Total != 2 || len(list.Items) != 2 {
		t.Fatalf("store C list total %d with %d items, want 2 and 2: %s", list.Total, len(list.Items), body)
	}
	for _, it := range list.Items {
		if it.StoreID != testStoreC || (it.ID != c1 && it.ID != c2) {
			t.Fatalf("store C list holds %+v, want only the two riders of store C", it)
		}
	}
}

func TestStoreStaffListsOwnStore(t *testing.T) {
	seedRiderAt(t, testStore, uniqueEmail(t), true)
	seedRiderAt(t, testStoreB, uniqueEmail(t), true)

	status, body := callAt(t, srv.URL, http.MethodGet, ridersPath, staffAToken, nil)
	if status != http.StatusOK {
		t.Fatalf("store A staff list: got %d %s", status, body)
	}
	list := decodeList(t, body)
	if list.Total != countRiders(t, testStore) || len(list.Items) == 0 {
		t.Fatalf("store A staff list total %d, want the %d riders of store A", list.Total, countRiders(t, testStore))
	}
	for _, it := range list.Items {
		if it.StoreID != testStore {
			t.Fatalf("store A staff saw %+v", it)
		}
	}

	status, body = callAt(t, srv.URL, http.MethodGet, ridersPath+"?store="+testStoreB, staffAToken, nil)
	expectError(t, "store A staff listing store B", status, body, http.StatusForbidden, "forbidden")
}

func TestListRidersRefusesBadStore(t *testing.T) {
	status, body := callAt(t, srv.URL, http.MethodGet, ridersPath+"?store=abc", adminToken, nil)
	e := expectError(t, "store=abc", status, body, http.StatusBadRequest, "validation")
	if e.Error.Field != "store" {
		t.Fatalf("store=abc names field %q, want store", e.Error.Field)
	}
}

func TestAdminCreatesRider(t *testing.T) {
	email := uniqueEmail(t)
	status, body := callAt(t, srv.URL, http.MethodPost, ridersPath, adminToken, map[string]string{
		"storeId": testStore, "email": email, "name": "Ravi Kumar", "password": testPassword, "phone": "+919000000099",
	})
	if status != http.StatusCreated {
		t.Fatalf("create: got %d %s, want 201", status, body)
	}
	got := decodeRider(t, body)
	if got.StoreID != testStore || got.Email != email || got.Name != "Ravi Kumar" || got.Phone != "+919000000099" || !got.IsActive {
		t.Fatalf("created rider %+v", got)
	}
	signInAs(t, email, testPassword)
}

func TestCreateRiderRefusalsNameTheField(t *testing.T) {
	taken := uniqueEmail(t)
	seedRiderAt(t, testStore, taken, true)
	valid := func() map[string]string {
		return map[string]string{"storeId": testStore, "email": uniqueEmail(t), "name": "Ravi", "password": testPassword}
	}
	cases := []struct {
		name   string
		mutate func(map[string]string)
		status int
		code   string
		field  string
	}{
		{"seven-byte password", func(b map[string]string) { b["password"] = "1234567" }, 400, "validation", "password"},
		{"store core does not know", func(b map[string]string) { b["storeId"] = unknownUUID }, 400, "validation", "storeId"},
		{"store id not a uuid", func(b map[string]string) { b["storeId"] = "abc" }, 400, "validation", "storeId"},
		{"blank name", func(b map[string]string) { b["name"] = "   " }, 400, "validation", "name"},
		{"malformed phone", func(b map[string]string) { b["phone"] = "12345" }, 400, "validation", "phone"},
		{"email taken in another case", func(b map[string]string) { b["email"] = strings.ToUpper(taken) }, 409, "conflict", "email"},
	}
	for _, c := range cases {
		b := valid()
		c.mutate(b)
		status, body := callAt(t, srv.URL, http.MethodPost, ridersPath, adminToken, b)
		e := expectError(t, c.name, status, body, c.status, c.code)
		if e.Error.Field != c.field {
			t.Fatalf("%s names field %q, want %q", c.name, e.Error.Field, c.field)
		}
	}
}

func TestStoreStaffCreatesOnlyForOwnStore(t *testing.T) {
	email := uniqueEmail(t)
	status, body := callAt(t, srv.URL, http.MethodPost, ridersPath, staffAToken, map[string]string{
		"storeId": testStoreB, "email": email, "name": "Ravi", "password": testPassword,
	})
	expectError(t, "store A staff creating at store B", status, body, http.StatusForbidden, "forbidden")
	if n := countEmail(t, email); n != 0 {
		t.Fatalf("a refused create left %d riders with that email", n)
	}

	status, body = callAt(t, srv.URL, http.MethodPost, ridersPath, staffAToken, map[string]string{
		"storeId": testStore, "email": email, "name": "Ravi", "password": testPassword,
	})
	if status != http.StatusCreated {
		t.Fatalf("store A staff creating at store A: got %d %s, want 201", status, body)
	}
}

func countEmail(t *testing.T, email string) int64 {
	t.Helper()
	var n int64
	if err := testPool.QueryRow(context.Background(), "select count(*) from riders where email = $1", email).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func TestRiderOfAnotherStoreNotFound(t *testing.T) {
	other := seedRiderAt(t, testStoreB, uniqueEmail(t), true)
	own := seedRiderAt(t, testStore, uniqueEmail(t), true)
	path := ridersPath + "/" + other

	status, body := callAt(t, srv.URL, http.MethodGet, path, staffAToken, nil)
	expectError(t, "store A staff reads store B rider", status, body, http.StatusNotFound, "not_found")
	status, body = callAt(t, srv.URL, http.MethodPatch, path, staffAToken, map[string]string{"name": "Changed"})
	expectError(t, "store A staff patches store B rider", status, body, http.StatusNotFound, "not_found")
	if name := riderName(t, other); name != "Asha Rao" {
		t.Fatalf("refused patch changed the rider to %q", name)
	}

	status, body = callAt(t, srv.URL, http.MethodGet, ridersPath+"/"+own, staffAToken, nil)
	if status != http.StatusOK || decodeRider(t, body).StoreID != testStore {
		t.Fatalf("store A staff reads own rider: got %d %s, want 200", status, body)
	}
	status, body = callAt(t, srv.URL, http.MethodGet, path, adminToken, nil)
	if status != http.StatusOK || decodeRider(t, body).StoreID != testStoreB {
		t.Fatalf("admin reads store B rider: got %d %s, want 200", status, body)
	}
}

func TestDeactivationEndsSessions(t *testing.T) {
	email := uniqueEmail(t)
	id := seedRiderAt(t, testStore, email, true)
	s := signInAs(t, email, testPassword)

	status, body := callAt(t, srv.URL, http.MethodPatch, ridersPath+"/"+id, adminToken, map[string]bool{"isActive": false})
	if status != http.StatusOK || decodeRider(t, body).IsActive {
		t.Fatalf("deactivate: got %d %s, want 200 with isActive false", status, body)
	}
	if status, body := callAt(t, srv.URL, http.MethodGet, "/api/rider/v1/me", s.Token, nil); status != http.StatusUnauthorized {
		t.Fatalf("deactivated rider's token: got %d %s, want 401", status, body)
	}
	if status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": testPassword}); status != http.StatusUnauthorized {
		t.Fatalf("deactivated rider sign-in: got %d %s, want 401", status, body)
	}
	if n := countSessions(t, id); n != 0 {
		t.Fatalf("%d sessions left after deactivation, want 0", n)
	}
}

func TestPatchResetsPassword(t *testing.T) {
	email := uniqueEmail(t)
	id := seedRiderAt(t, testStore, email, true)
	status, body := callAt(t, srv.URL, http.MethodPatch, ridersPath+"/"+id, adminToken, map[string]string{"password": "newpass12"})
	if status != http.StatusOK {
		t.Fatalf("reset: got %d %s, want 200", status, body)
	}
	if status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": "newpass12"}); status != http.StatusOK {
		t.Fatalf("sign-in with new password: got %d %s, want 200", status, body)
	}
	if status, body := callAt(t, srv.URL, http.MethodPost, signInPath, "", map[string]string{"email": email, "password": testPassword}); status != http.StatusUnauthorized {
		t.Fatalf("sign-in with old password: got %d %s, want 401", status, body)
	}
}

func TestPatchEditsNameAndClearsPhone(t *testing.T) {
	id := seedRiderAt(t, testStore, uniqueEmail(t), true)
	path := ridersPath + "/" + id
	status, body := callAt(t, srv.URL, http.MethodPatch, path, adminToken, map[string]string{"name": " Meera Iyer ", "phone": "+919000000098"})
	got := decodeRider(t, body)
	if status != http.StatusOK || got.Name != "Meera Iyer" || got.Phone != "+919000000098" {
		t.Fatalf("edit: got %d %s, want 200 with the trimmed name and the phone", status, body)
	}
	status, body = callAt(t, srv.URL, http.MethodPatch, path, adminToken, map[string]string{"phone": ""})
	if status != http.StatusOK || decodeRider(t, body).Phone != "" || strings.Contains(string(body), `"phone"`) {
		t.Fatalf("clear phone: got %d %s, want 200 with the phone omitted", status, body)
	}
}

func TestPatchRefusesNull(t *testing.T) {
	id := seedRiderAt(t, testStore, uniqueEmail(t), true)
	for _, field := range []string{"name", "phone", "isActive", "password"} {
		status, body := callAt(t, srv.URL, http.MethodPatch, ridersPath+"/"+id, adminToken, map[string]any{field: nil})
		e := expectError(t, "null "+field, status, body, http.StatusBadRequest, "validation")
		if e.Error.Field != field {
			t.Fatalf("null %s names field %q", field, e.Error.Field)
		}
	}
}
