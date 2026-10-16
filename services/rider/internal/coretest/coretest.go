// Package coretest is a fake of core's HTTP API for the rider's tests. It
// serves the two routes the rider calls, with core's bodies and error
// envelope, through httptest: the process boundary where the rider's tests
// fake core (D31). Nothing else is faked.
package coretest

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// Fake is a running core stand-in. Its methods are safe for concurrent use.
type Fake struct {
	srv *httptest.Server

	mu     sync.Mutex
	staff  map[string]core.Staff // by bearer token
	stores map[string]core.Store // by id
	calls  map[string]int        // by route pattern
	fail   int                   // non-zero: every route answers this status
}

// New starts a fake core with no staff and no stores. Close it when done.
func New() *Fake {
	f := &Fake{
		staff:  map[string]core.Staff{},
		stores: map[string]core.Store{},
		calls:  map[string]int{},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/core/v1/admin/me", f.route(f.adminMe))
	mux.HandleFunc("GET /api/core/v1/stores/{id}", f.route(f.store))
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

// route counts the request under its pattern and applies Fail before the handler runs.
func (f *Fake) route(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.calls[r.Pattern]++
		fail := f.fail
		f.mu.Unlock()
		if fail != 0 {
			httpx.WriteError(w, r, &httpx.Error{Status: fail, Code: "internal", Message: "internal error"})
			return
		}
		h(w, r)
	}
}

func (f *Fake) adminMe(w http.ResponseWriter, r *http.Request) {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	f.mu.Lock()
	s, found := f.staff[token]
	f.mu.Unlock()
	if !ok || !found {
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
