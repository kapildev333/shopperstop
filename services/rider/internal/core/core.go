// Package core is the rider's client for core's HTTP API: staff introspection
// for the admin routes, the public store read, and the order calls the
// rider makes with its service token or a customer's bearer. Errors are
// *httpx.Error values the handlers pass through: core's 401 is the caller's
// 401 (except on service calls, which are a 502), a core 404 is ErrNotFound,
// a core 409 is ErrConflict, and any other core failure is logged and becomes a 502.
package core

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// Staff is core's Staff, as GET /api/core/v1/admin/me answers it.
type Staff struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`              // admin | store_staff
	StoreID  string `json:"storeId,omitempty"` // store staff only
	IsActive bool   `json:"isActive"`
}

// Store is the part of core's public Store the rider reads.
type Store struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	IsOpen bool   `json:"isOpen"`
}

// OrderAddress is the part of core's OrderAddress the rider keeps.
type OrderAddress struct {
	Line1   string `json:"line1"`
	Line2   string `json:"line2,omitempty"`
	Pincode string `json:"pincode"`
}

// OrderItem is the part of core's OrderItem the rider keeps.
type OrderItem struct {
	Name      string `json:"name"`
	UnitLabel string `json:"unitLabel"`
	Quantity  int    `json:"quantity"`
}

// Order is the part of core's Order the rider reads.
type Order struct {
	ID            string       `json:"id"`
	Number        string       `json:"number"`
	StoreID       string       `json:"storeId"`
	Status        string       `json:"status"`
	CustomerName  string       `json:"customerName"`
	CustomerPhone string       `json:"customerPhone,omitempty"`
	Address       OrderAddress `json:"address"`
	TotalCents    int64        `json:"totalCents"`
	PaymentMethod string       `json:"paymentMethod"`
	PlacedAt      time.Time    `json:"placedAt"`
	Items         []OrderItem  `json:"items"`
}

// Actor is the rider named as the actor of a status change core records.
type Actor struct {
	Type string `json:"type"` // always "rider"
	ID   string `json:"id"`
	Name string `json:"name"`
}

var ErrUnauthorized = &httpx.Error{Status: http.StatusUnauthorized, Code: "unauthorized", Message: "sign in required"}
var ErrNotFound = &httpx.Error{Status: http.StatusNotFound, Code: "not_found", Message: "not found"}
var ErrConflict = &httpx.Error{Status: http.StatusConflict, Code: "conflict", Message: "core refused the change"}

const staffTTL = 30 * time.Second

type cacheEntry struct {
	staff   Staff
	expires time.Time
}

// Client calls core. It is safe for concurrent use.
type Client struct {
	base         string
	serviceToken string
	http         *http.Client
	now          func() time.Time

	mu    sync.Mutex
	cache map[string]cacheEntry // keyed by sha256 of the bearer token
}

// New returns a client for core at baseURL (no trailing slash), with a 5 s
// timeout per call. now is the clock the staff cache reads.
func New(baseURL, serviceToken string, now func() time.Time) *Client {
	return &Client{
		base:         baseURL,
		serviceToken: serviceToken,
		http:         &http.Client{Timeout: 5 * time.Second},
		now:          now,
		cache:        map[string]cacheEntry{},
	}
}

// StaffFromToken returns the staff user core answers for token, cached for 30
// seconds per token. Refusals and failures are not cached.
func (c *Client) StaffFromToken(ctx context.Context, token string) (Staff, error) {
	key := tokenKey(token)
	if s, ok := c.cached(key); ok {
		return s, nil
	}
	var s Staff
	err := c.do(ctx, http.MethodGet, "/admin/me", token, nil, &s)
	if errors.Is(err, ErrNotFound) {
		// core has no such route; that is core failing, not the caller being refused.
		return Staff{}, c.failure(ctx, http.MethodGet, "/admin/me", http.StatusNotFound, nil)
	}
	if err != nil {
		return Staff{}, err
	}
	c.remember(key, s)
	return s, nil
}

// Store reads core's public store view. It needs no token.
func (c *Client) Store(ctx context.Context, id string) (Store, error) {
	var s Store
	if err := c.do(ctx, http.MethodGet, "/stores/"+url.PathEscape(id), "", nil, &s); err != nil {
		return Store{}, err
	}
	return s, nil
}

// StoreOrders lists the orders of storeID with status, newest first, with the
// service token. A core 404 (no such store) is core failing, so it is a 502.
func (c *Client) StoreOrders(ctx context.Context, storeID, status string) ([]Order, error) {
	q := url.Values{"status": {status}, "pageSize": {"100"}}
	path := "/admin/stores/" + url.PathEscape(storeID) + "/orders?" + q.Encode()
	var page struct {
		Items []Order `json:"items"`
	}
	err := c.service(ctx, http.MethodGet, path, nil, &page)
	if errors.Is(err, ErrNotFound) {
		return nil, c.failure(ctx, http.MethodGet, path, http.StatusNotFound, nil)
	}
	if err != nil {
		return nil, err
	}
	return page.Items, nil
}

// Order reads one order with the service token. An unknown id is ErrNotFound.
func (c *Client) Order(ctx context.Context, id string) (Order, error) {
	var o Order
	err := c.service(ctx, http.MethodGet, "/admin/orders/"+url.PathEscape(id), nil, &o)
	return o, err
}

// ChangeStatus moves order id to status for actor with the service token.
// core refuses a move the order's status does not allow with ErrConflict.
func (c *Client) ChangeStatus(ctx context.Context, id, status string, actor Actor) error {
	body := struct {
		Status string `json:"status"`
		Actor  Actor  `json:"actor"`
	}{status, actor}
	return c.service(ctx, http.MethodPost, "/admin/orders/"+url.PathEscape(id)+"/status", body, nil)
}

// CustomerOrder reads order id with the customer's bearer token, which proves
// the customer owns it: core answers 404 for another customer's order and 401
// for a token it does not know.
func (c *Client) CustomerOrder(ctx context.Context, token, id string) (Order, error) {
	var o Order
	err := c.do(ctx, http.MethodGet, "/orders/"+url.PathEscape(id), token, nil, &o)
	return o, err
}

// service is do with the rider's service token. core refusing that token is a
// misconfigured rider, not a signed-out rider, so its 401 is logged and
// becomes a 502; a 403 already falls into do's default.
func (c *Client) service(ctx context.Context, method, path string, body, out any) error {
	err := c.do(ctx, method, path, c.serviceToken, body, out)
	if errors.Is(err, ErrUnauthorized) {
		return c.failure(ctx, method, path, http.StatusUnauthorized, nil)
	}
	return err
}

// do sends one request to base+"/api/core/v1"+path with bearer (when
// non-empty) and JSON body (when non-nil), decodes a 2xx into out (when
// non-nil), returns ErrUnauthorized on 401, ErrNotFound on 404, ErrConflict on
// 409, and the logged 502 error otherwise.
func (c *Client) do(ctx context.Context, method, path, bearer string, body, out any) error {
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+"/api/core/v1"+path, reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return c.failure(ctx, method, path, 0, err)
	}
	defer resp.Body.Close()
	switch {
	case resp.StatusCode == http.StatusUnauthorized:
		return ErrUnauthorized
	case resp.StatusCode == http.StatusNotFound:
		return ErrNotFound
	case resp.StatusCode == http.StatusConflict:
		return ErrConflict
	case resp.StatusCode < 200 || resp.StatusCode > 299:
		return c.failure(ctx, method, path, resp.StatusCode, nil)
	}
	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return c.failure(ctx, method, path, resp.StatusCode, err)
		}
	}
	return nil
}

// failure logs one failed core call with the request id and returns the 502
// the caller answers with. The client never sees core's body or the transport error.
func (c *Client) failure(ctx context.Context, method, path string, status int, err error) error {
	attrs := []any{"method", method, "path", path, "status", status, "requestId", httpx.RequestID(ctx)}
	if err != nil {
		attrs = append(attrs, "err", err.Error())
	}
	slog.ErrorContext(ctx, "core call failed", attrs...)
	return &httpx.Error{Status: http.StatusBadGateway, Code: "internal", Message: "core unavailable"}
}

func (c *Client) cached(key string) (Staff, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.cache[key]
	if !ok || !c.now().Before(e.expires) {
		return Staff{}, false
	}
	return e.staff, true
}

func (c *Client) remember(key string, s Staff) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	// ponytail: expired entries are pruned by a full scan on each write; a bounded LRU or a sweeper if many distinct tokens churn.
	for k, e := range c.cache {
		if !now.Before(e.expires) {
			delete(c.cache, k)
		}
	}
	c.cache[key] = cacheEntry{staff: s, expires: now.Add(staffTTL)}
}

func tokenKey(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
