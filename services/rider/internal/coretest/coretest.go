// Package coretest is a fake of core's HTTP API for the rider's tests. It
// serves the routes the rider calls, with core's bodies and error envelope,
// through httptest: the process boundary where the rider's tests fake core (D31).
// Nothing else is faked.
package coretest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// ServiceToken is the bearer the service routes admit; any other bearer there is core's 401.
const ServiceToken = "service-token"

// StatusChange is one move the fake accepted, with the rider named as actor.
type StatusChange struct {
	Status string
	Actor  core.Actor
}

type order struct {
	core.Order
	customerToken string // the bearer that reads the order as its customer; "" for none
}

// Fake is a running core stand-in. Its methods are safe for concurrent use.
type Fake struct {
	srv *httptest.Server

	mu        sync.Mutex
	staff     map[string]core.Staff // by bearer token
	stores    map[string]core.Store // by id
	orders    map[string]*order     // by id
	sequence  []string              // order ids in AddOrder order
	changes   map[string][]StatusChange
	calls     map[string]int // by route pattern
	fail      int            // non-zero: every route answers this status
	failRoute map[string]int // by route pattern
}

// New starts a fake core with no staff, stores or orders. Close it when done.
func New() *Fake {
	f := &Fake{
		staff:     map[string]core.Staff{},
		stores:    map[string]core.Store{},
		orders:    map[string]*order{},
		changes:   map[string][]StatusChange{},
		calls:     map[string]int{},
		failRoute: map[string]int{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/core/v1/admin/me", f.route(f.adminMe))
	mux.HandleFunc("GET /api/core/v1/stores/{id}", f.route(f.store))
	mux.HandleFunc("GET /api/core/v1/admin/stores/{id}/orders", f.route(f.storeOrders))
	mux.HandleFunc("GET /api/core/v1/admin/orders/{id}", f.route(f.adminOrder))
	mux.HandleFunc("POST /api/core/v1/admin/orders/{id}/status", f.route(f.setStatus))
	mux.HandleFunc("GET /api/core/v1/orders/{id}", f.route(f.customerOrder))
	f.srv = httptest.NewServer(mux)
	return f
}

// URL is the base URL to pass to core.New.
func (f *Fake) URL() string { return f.srv.URL }

// Close shuts the fake down.
func (f *Fake) Close() { f.srv.Close() }

// AddStaff makes token answer s; any other bearer, or none, answers core's 401.
func (f *Fake) AddStaff(token string, s core.Staff) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.staff[token] = s
}

// AddStore makes s.ID answer 200; other ids answer core's 404.
func (f *Fake) AddStore(s core.Store) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.stores[s.ID] = s
}

// AddOrder makes o answer the service routes and, with customerToken as the
// bearer, the customer route. customerToken "" means no customer reads it.
func (f *Fake) AddOrder(o core.Order, customerToken string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.orders[o.ID] = &order{Order: o, customerToken: customerToken}
	f.sequence = append(f.sequence, o.ID)
}

// SetOrderStatus sets the status of order id, as staff or a test would in core.
func (f *Fake) SetOrderStatus(id, status string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if o, ok := f.orders[id]; ok {
		o.Status = status
	}
}

// OrderStatus returns the status of order id, or "" for an unknown order.
func (f *Fake) OrderStatus(id string) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if o, ok := f.orders[id]; ok {
		return o.Status
	}
	return ""
}

// StatusChanges returns every move the fake accepted for order id, in order.
func (f *Fake) StatusChanges(id string) []StatusChange {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]StatusChange(nil), f.changes[id]...)
}

// Calls returns how many requests reached a route, keyed by its pattern,
// for example "GET /api/core/v1/admin/me".
func (f *Fake) Calls(route string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[route]
}

// Fail makes every route answer status with core's error envelope; 0 restores.
func (f *Fake) Fail(status int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.fail = status
}

// FailRoute makes one route pattern answer status with core's error envelope;
// 0 restores it.
func (f *Fake) FailRoute(route string, status int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if status == 0 {
		delete(f.failRoute, route)
		return
	}
	f.failRoute[route] = status
}

// route counts the request under its pattern and applies the failure set for
// it before the handler runs.
func (f *Fake) route(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.calls[r.Pattern]++
		fail := f.fail
		if s, ok := f.failRoute[r.Pattern]; ok {
			fail = s
		}
		f.mu.Unlock()
		if fail != 0 {
			httpx.WriteError(w, r, &httpx.Error{Status: fail, Code: "internal", Message: "internal error"})
			return
		}
		h(w, r)
	}
}

// bearer returns the token after "Bearer ", or "" when there is none.
func bearer(r *http.Request) string {
	token, _ := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	return token
}

// serviceOnly answers core's 401 and reports false unless the bearer is the service token.
func serviceOnly(w http.ResponseWriter, r *http.Request) bool {
	if bearer(r) != ServiceToken {
		httpx.WriteError(w, r, core.ErrUnauthorized)
		return false
	}
	return true
}

func (f *Fake) adminMe(w http.ResponseWriter, r *http.Request) {
	token := bearer(r)
	f.mu.Lock()
	s, found := f.staff[token]
	f.mu.Unlock()
	if token == "" || !found {
		httpx.WriteError(w, r, core.ErrUnauthorized)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, s)
}

func (f *Fake) store(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	s, found := f.stores[r.PathValue("id")]
	f.mu.Unlock()
	if !found {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, s)
}

// storeOrders filters by store and status, newest first. A store is known when
// AddStore registered it or an order names it; any other store is core's 404.
// ponytail: pageSize is not honoured and every match is returned; core pages at 100 and the fake holds a handful of orders.
func (f *Fake) storeOrders(w http.ResponseWriter, r *http.Request) {
	if !serviceOnly(w, r) {
		return
	}
	storeID, status := r.PathValue("id"), r.URL.Query().Get("status")
	f.mu.Lock()
	_, known := f.stores[storeID]
	items := []core.Order{}
	for i := len(f.sequence) - 1; i >= 0; i-- {
		o := f.orders[f.sequence[i]]
		if o.StoreID != storeID {
			continue
		}
		known = true
		if o.Status == status {
			items = append(items, o.Order)
		}
	}
	f.mu.Unlock()
	if !known {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"items": items, "page": 1, "pageSize": 100, "total": len(items)})
}

func (f *Fake) adminOrder(w http.ResponseWriter, r *http.Request) {
	if !serviceOnly(w, r) {
		return
	}
	f.mu.Lock()
	o, found := f.orders[r.PathValue("id")]
	var out core.Order
	if found {
		out = o.Order // copied under the lock: setStatus writes o.Status concurrently
	}
	f.mu.Unlock()
	if !found {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// setStatus applies core's rules for a service move: the actor is required,
// only out_for_delivery and delivered are reachable, and the table allows
// ready to out_for_delivery and out_for_delivery to delivered.
// It checks less than core: no uuid check on the path id or the actor id, no
// actor name length, no status enum. Core answers 400 to those; the rider never sends them.
func (f *Fake) setStatus(w http.ResponseWriter, r *http.Request) {
	if !serviceOnly(w, r) {
		return
	}
	var in struct {
		Status string      `json:"status"`
		Actor  *core.Actor `json:"actor"`
	}
	if err := httpx.ReadJSON(w, r, &in); err != nil {
		httpx.WriteError(w, r, err)
		return
	}
	if in.Actor == nil || in.Actor.Type != "rider" {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusBadRequest, Code: "validation", Message: "actor is required from a service", Field: "actor"})
		return
	}
	if in.Status != "out_for_delivery" && in.Status != "delivered" {
		httpx.WriteError(w, r, &httpx.Error{Status: http.StatusForbidden, Code: "forbidden", Message: "a service may only move an order to out_for_delivery or delivered"})
		return
	}
	id := r.PathValue("id")
	f.mu.Lock()
	defer f.mu.Unlock()
	o, found := f.orders[id]
	if !found {
		httpx.WriteError(w, r, core.ErrNotFound)
		return
	}
	next := map[string]string{"ready": "out_for_delivery", "out_for_delivery": "delivered"}
	if next[o.Status] != in.Status {
		httpx.WriteError(w, r, core.ErrConflict)
		return
	}
	o.Status = in.Status
	f.changes[id] = append(f.changes[id], StatusChange{Status: in.Status, Actor: *in.Actor})
	httpx.WriteJSON(w, http.StatusOK, o.Order)
}

// customerOrder answers the bearer's own order. A bearer that is no order's
// customer token is core's 401; another customer's or an unknown order is 404.
func (f *Fake) customerOrder(w http.ResponseWriter, r *http.Request) {
	token := bearer(r)
	f.mu.Lock()
	known := false
	for _, o := range f.orders {
		if token != "" && o.customerToken == token {
			known = true
		}
	}
	o, found := f.orders[r.PathValue("id")]
	owned := found && token != "" && o.customerToken == token
	var out core.Order
	if owned {
		out = o.Order
	}
	f.mu.Unlock()
	switch {
	case !known:
		httpx.WriteError(w, r, core.ErrUnauthorized)
	case !owned:
		httpx.WriteError(w, r, core.ErrNotFound)
	default:
		httpx.WriteJSON(w, http.StatusOK, out)
	}
}
