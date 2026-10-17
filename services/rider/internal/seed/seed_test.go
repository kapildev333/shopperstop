package seed_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/app"
	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery"
	"github.com/kapildev333/shopperstop/services/rider/internal/seed"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

const testPepper = "test-pepper-test-pepper-test-pepper-00"

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("seed")
	code := m.Run()
	cleanup()
	os.Exit(code)
}

// server serves the rider router over the test pool. Core is never reached:
// the client points at a closed port, so a seeded sign-in cannot need core.
func server(t *testing.T) string {
	t.Helper()
	c := core.New("http://127.0.0.1:1", "unused", time.Now)
	srv := httptest.NewServer(app.New(testPool, nil, auth.New(testPool, testPepper, nil, c), delivery.New(testPool, c), nil))
	t.Cleanup(srv.Close)
	return srv.URL
}

// signIn posts a sign-in and returns the status and body.
func signIn(t *testing.T, base, email, password string) (int, []byte) {
	t.Helper()
	body, err := json.Marshal(map[string]string{"email": email, "password": password})
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.Post(base+"/api/rider/v1/auth/sign-in", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp.StatusCode, out
}

func countRows(t *testing.T, query string) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), query).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

// TestResetTwiceLeavesDemoRiders: a rider and a session the demo does not own
// are removed by reset, and the four demo riders sign in with rider12345.
func TestResetTwiceLeavesDemoRiders(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if _, err := testPool.Exec(ctx, `insert into riders (store_id, email, name, password_hash)
		values ('00000000-0000-4000-8000-000000000401', 'other@example.com', 'Other', 'x')`); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into sessions (rider_id, token_hash, expires_at)
		select id, decode('00', 'hex'), now() + interval '1 day' from riders where email = 'other@example.com'`); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into deliveries (order_id, order_number, store_id, rider_id, customer_name,
		address_line1, address_pincode, total_cents, payment_method, item_count, items)
		select '00000000-0000-4000-9000-000000000001', 'SS-OTHER', '00000000-0000-4000-8000-000000000401', id, 'Other',
		'1 Other Rd', '560001', 100, 'cod', 1, '[]' from riders where email = 'other@example.com'`); err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, `insert into rider_locations (rider_id, lat, lng)
		select id, 12.9, 77.6 from riders where email = 'other@example.com'`); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err := seed.Reset(ctx, testPool); err != nil {
			t.Fatalf("reset %d: %v", i+1, err)
		}
	}
	if n := countRows(t, "select count(*) from riders"); n != 4 {
		t.Fatalf("riders after two resets: %d, want 4", n)
	}
	if n := countRows(t, "select count(*) from riders where email = 'other@example.com'"); n != 0 {
		t.Fatalf("other rider survived reset: %d rows", n)
	}
	if n := countRows(t, "select count(*) from sessions"); n != 0 {
		t.Fatalf("sessions after reset: %d, want 0", n)
	}
	if n := countRows(t, "select count(*) from deliveries"); n != 1 {
		t.Fatalf("deliveries after two resets: %d, want 1 (the demo delivery)", n)
	}
	if n := countRows(t, "select count(*) from deliveries where order_number = 'SS-OTHER'"); n != 0 {
		t.Fatalf("other delivery survived reset: %d rows", n)
	}
	if n := countRows(t, "select count(*) from rider_locations"); n != 0 {
		t.Fatalf("rider locations after reset: %d, want 0", n)
	}
	base := server(t)
	for _, email := range []string{"rider1-koramangala@shopperstop.local", "rider2-koramangala@shopperstop.local",
		"rider1-indiranagar@shopperstop.local", "rider2-indiranagar@shopperstop.local"} {
		if status, body := signIn(t, base, email, "rider12345"); status != http.StatusOK {
			t.Errorf("sign-in %s: %d %s, want 200", email, status, body)
		}
	}
}

// TestSeededDeliveryInHistory: after a reset the first demo rider's delivered
// history holds the seeded delivery for core's delivered demo order.
func TestSeededDeliveryInHistory(t *testing.T) {
	if err := seed.Reset(context.Background(), testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	status, body := signIn(t, base, "rider1-koramangala@shopperstop.local", "rider12345")
	var s struct {
		Token string `json:"token"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Token == "" {
		t.Fatalf("sign-in: %d %s, want 200 with a token", status, body)
	}
	req, err := http.NewRequest(http.MethodGet, base+"/api/rider/v1/me/deliveries?status=delivered", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+s.Token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list delivered: %d %s, want 200", resp.StatusCode, out)
	}
	var list struct {
		Items []struct {
			ID          string `json:"id"`
			OrderNumber string `json:"orderNumber"`
			Status      string `json:"status"`
			ItemCount   int    `json:"itemCount"`
			TotalCents  int64  `json:"totalCents"`
		} `json:"items"`
	}
	if err := json.Unmarshal(out, &list); err != nil {
		t.Fatalf("list body: %v: %s", err, out)
	}
	if len(list.Items) != 1 {
		t.Fatalf("delivered list holds %d items, want 1: %s", len(list.Items), out)
	}
	got := list.Items[0]
	if got.ID != "00000000-0000-4000-8000-000000000901" || got.OrderNumber != "SS-DEMOAAAB" ||
		got.Status != "delivered" || got.ItemCount != 3 || got.TotalCents != 33900 {
		t.Fatalf("seeded delivery: %+v, want ...0901 SS-DEMOAAAB delivered 3 items 33900", got)
	}
}

// TestLoadTwiceFails: load into an empty table works; the second load hits
// the duplicate keys, fails, and leaves the four riders alone.
func TestLoadTwiceFails(t *testing.T) {
	ctx := context.Background()
	if _, err := testPool.Exec(ctx, "truncate offers, rider_locations, deliveries, sessions, riders"); err != nil {
		t.Fatal(err)
	}
	if err := seed.Load(ctx, testPool); err != nil {
		t.Fatalf("first load: %v", err)
	}
	if err := seed.Load(ctx, testPool); err == nil {
		t.Fatal("second load succeeded, want a duplicate key error")
	}
	if n := countRows(t, "select count(*) from riders"); n != 4 {
		t.Fatalf("riders after failed load: %d, want 4", n)
	}
}

// TestSummaryMatchesSeed: every sign-in seed.Summary prints works and names
// the printed store, every id it prints is one row of the table on its line,
// and the ids marked Postman are the riderId, deliveryId and offerId of
// docs/postman/local.postman_environment.json.
func TestSummaryMatchesSeed(t *testing.T) {
	ctx := context.Background()
	if err := seed.Reset(ctx, testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	base := server(t)
	stores := map[string]string{"Koramangala": "00000000-0000-4000-8000-000000000401", "Indiranagar": "00000000-0000-4000-8000-000000000402"}
	summaryID := regexp.MustCompile(`^00000000-0000-4000-8000-000000000[89][0-9a-f]{2}$`)
	summaryPostman := regexp.MustCompile(`\(Postman (riderId|deliveryId|offerId)\)`)
	postman := map[string]string{}
	seenID := map[string]bool{}
	signIns, ids := 0, 0
	for _, line := range strings.Split(seed.Summary, "\n") {
		f := strings.Fields(line)
		switch {
		case len(f) == 3 && strings.Contains(f[0], "@"):
			signIns++
			status, body := signIn(t, base, f[0], f[1])
			var s struct {
				Rider struct {
					Email   string `json:"email"`
					StoreID string `json:"storeId"`
				} `json:"rider"`
			}
			if status != http.StatusOK || json.Unmarshal(body, &s) != nil || s.Rider.Email != f[0] || s.Rider.StoreID != stores[f[2]] {
				t.Errorf("sign-in %q: got %d %s, want 200 for %s at store %s", line, status, body, f[0], stores[f[2]])
			}
		case len(f) >= 2 && summaryID.MatchString(f[0]):
			ids++
			if seenID[f[0]] {
				t.Errorf("line %q repeats id %s from an earlier line", line, f[0])
			}
			seenID[f[0]] = true
			if f[1] != "riders" && f[1] != "deliveries" && f[1] != "offers" {
				t.Errorf("line %q names table %q, want riders, deliveries or offers", line, f[1])
				continue
			}
			if n := countRows(t, "select count(*) from "+f[1]+" where id = '"+f[0]+"'"); n != 1 {
				t.Errorf("line %q: %d rows with that id in %s, want 1", line, n, f[1])
			}
			if m := summaryPostman.FindStringSubmatch(line); m != nil {
				postman[m[1]] = f[0]
			}
		}
	}
	if signIns != 4 || ids != 6 {
		t.Fatalf("summary holds %d sign-ins and %d ids, want 4 and 6", signIns, ids)
	}
	want := map[string]string{"riderId": "00000000-0000-4000-8000-000000000801", "deliveryId": "00000000-0000-4000-8000-000000000901",
		"offerId": "00000000-0000-4000-8000-000000000902"}
	for key, id := range want {
		if postman[key] != id {
			t.Errorf("summary marks %q as Postman %s, want %s", postman[key], key, id)
		}
	}

	raw, err := os.ReadFile("../../../../docs/postman/local.postman_environment.json")
	if err != nil {
		t.Fatal(err)
	}
	var env struct {
		Values []struct{ Key, Value string } `json:"values"`
	}
	if err := json.Unmarshal(raw, &env); err != nil {
		t.Fatal(err)
	}
	envValue := map[string]string{}
	for _, v := range env.Values {
		envValue[v.Key] = v.Value
	}
	for key := range want {
		v, ok := envValue[key]
		if !ok {
			t.Errorf("Postman environment has no %s", key)
			continue
		}
		if v != postman[key] {
			t.Errorf("Postman %s is %q, the summary marks %q", key, v, postman[key])
		}
	}
}

// TestSeededOffer: after a reset the first demo rider holds an expired offer of
// core's delivered demo order, has no open offer, and no rider is online.
func TestSeededOffer(t *testing.T) {
	if err := seed.Reset(context.Background(), testPool); err != nil {
		t.Fatalf("reset: %v", err)
	}
	if n := countRows(t, `select count(*) from offers where id = '00000000-0000-4000-8000-000000000902' and status = 'expired'
		and rider_id = '00000000-0000-4000-8000-000000000801' and order_number = 'SS-DEMOAAAB' and answered_at is not null`); n != 1 {
		t.Fatalf("seeded expired offer rows: %d, want 1", n)
	}
	if n := countRows(t, "select count(*) from riders where is_online"); n != 0 {
		t.Fatalf("online riders after the seed: %d, want 0", n)
	}
	base := server(t)
	status, body := signIn(t, base, "rider1-koramangala@shopperstop.local", "rider12345")
	var s struct {
		Token string `json:"token"`
	}
	if status != http.StatusOK || json.Unmarshal(body, &s) != nil {
		t.Fatalf("sign-in: %d %s, want 200", status, body)
	}
	req, err := http.NewRequest(http.MethodGet, base+"/api/rider/v1/me/offer", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+s.Token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("GET /me/offer for the demo rider: %d, want 204", resp.StatusCode)
	}
}
