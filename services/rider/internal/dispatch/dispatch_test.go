package dispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/coretest"
	"github.com/kapildev333/shopperstop/services/rider/internal/testdb"
)

// The store every test rider stands at; core-P5-L2 seeds Koramangala here.
const (
	storeLat = 12.9352
	storeLng = 77.6245
	// lockTick takes the advisory lock of a tick (queries/dispatch.sql TryTickLock).
	lockTick    = "select pg_advisory_xact_lock(727102, hashtext(current_schema()))"
	ordersRoute = "GET /api/core/v1/admin/stores/{id}/orders"
)

var (
	testPool *pgxpool.Pool
	coreFake *coretest.Fake
	dsp      *Dispatcher
	idSeq    atomic.Int64
)

func TestMain(m *testing.M) {
	var cleanup func()
	testPool, cleanup = testdb.Migrated("dispatch")
	coreFake = coretest.New()
	c := core.New(coreFake.URL(), coretest.ServiceToken, time.Now)
	dsp = New(testPool, c, Config{Enabled: true, OfferTTL: 30 * time.Second, LocationTTL: 2 * time.Minute, SpeedKMH: 20})
	code := m.Run()
	coreFake.Close()
	cleanup()
	os.Exit(code)
}

// newID returns a canonical uuid unique within this test process.
func newID() string {
	return fmt.Sprintf("00000000-0000-4000-8000-%012d", 200000+idSeq.Add(1))
}

// reset empties the rider tables, so a tick sees only the test's own riders.
func reset(t *testing.T) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(), "truncate offers, rider_locations, deliveries, sessions, riders"); err != nil {
		t.Fatal(err)
	}
}

// newStore registers a store at storeLat, storeLng with the fake core and returns its id.
func newStore(t *testing.T) string {
	t.Helper()
	id := newID()
	coreFake.AddStore(core.Store{ID: id, Name: "Test store", IsOpen: true, Location: &core.StoreLocation{Lat: storeLat, Lng: storeLng}})
	return id
}

// bareStore registers a store core holds without a location and returns its id.
func bareStore(t *testing.T) string {
	t.Helper()
	id := newID()
	coreFake.AddStore(core.Store{ID: id, Name: "Store without a location", IsOpen: true})
	return id
}

// metresNorth is the latitude metres north of the store: along a meridian the
// haversine distance is exactly the arc.
func metresNorth(metres float64) float64 {
	return storeLat + metres/(earthRadiusMetres*math.Pi/180)
}

// etaOf returns the eta_seconds of riderID's offer of orderID.
func etaOf(t *testing.T, orderID, riderID string) int {
	t.Helper()
	var eta int
	if err := testPool.QueryRow(context.Background(),
		"select eta_seconds from offers where order_id = $1 and rider_id = $2", orderID, riderID).Scan(&eta); err != nil {
		t.Fatal(err)
	}
	return eta
}

// rider inserts a rider of store, online for onlineFor when online, with a
// position at lat, lng recorded locatedAgo ago, and returns its id.
func rider(t *testing.T, store string, online bool, onlineFor time.Duration, lat, lng float64, locatedAgo time.Duration) string {
	t.Helper()
	ctx := context.Background()
	var since *time.Time
	if online {
		s := time.Now().Add(-onlineFor)
		since = &s
	}
	var id string
	err := testPool.QueryRow(ctx,
		`insert into riders (store_id, email, name, password_hash, is_online, online_since)
		 values ($1, $2, 'Test Rider', 'x', $3, $4) returning id`,
		store, newID()+"@example.com", online, since).Scan(&id)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := testPool.Exec(ctx, "insert into rider_locations (rider_id, lat, lng, recorded_at) values ($1, $2, $3, $4)",
		id, lat, lng, time.Now().Add(-locatedAgo)); err != nil {
		t.Fatal(err)
	}
	return id
}

// freeRider is an online rider at the store, online for onlineFor, located just now.
func freeRider(t *testing.T, store string, onlineFor time.Duration) string {
	t.Helper()
	return rider(t, store, true, onlineFor, storeLat, storeLng, 0)
}

// readyOrder adds a ready cash order of store with two lines (3 units) to the fake core.
func readyOrder(t *testing.T, store string, placed time.Time) core.Order {
	t.Helper()
	o := order(store, placed)
	coreFake.AddOrder(o, "")
	return o
}

// order is a ready cash order of store with two lines (3 units), not yet in the fake core.
func order(store string, placed time.Time) core.Order {
	id := newID()
	o := core.Order{
		ID: id, Number: "SS-" + strings.ToUpper(id[len(id)-6:]), StoreID: store, Status: "ready",
		CustomerName: "Demo Customer", Address: core.OrderAddress{Line1: "12 80 Feet Rd", Pincode: "560034"},
		TotalCents: 33900, PaymentMethod: "cod", PlacedAt: placed,
		Items: []core.OrderItem{{Name: "Banana Robusta", UnitLabel: "1 kg", Quantity: 2}, {Name: "Shimla Apple", UnitLabel: "1 kg", Quantity: 1}},
	}
	return o
}

// tick runs one tick at now and fails the test on an error.
func tick(t *testing.T, now time.Time) {
	t.Helper()
	if err := dsp.Tick(context.Background(), now); err != nil {
		t.Fatalf("tick: %v", err)
	}
}

type offerRow struct {
	ID, RiderID, Status string
}

// offersOf returns the offers of orderID, newest first.
func offersOf(t *testing.T, orderID string) []offerRow {
	t.Helper()
	rows, err := testPool.Query(context.Background(),
		"select id, rider_id, status::text from offers where order_id = $1 order by offered_at desc, created_at desc", orderID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	var out []offerRow
	for rows.Next() {
		var o offerRow
		if err := rows.Scan(&o.ID, &o.RiderID, &o.Status); err != nil {
			t.Fatal(err)
		}
		out = append(out, o)
	}
	return out
}

// openOffer returns the rider of orderID's open offer, or "".
func openOffer(t *testing.T, orderID string) string {
	t.Helper()
	for _, o := range offersOf(t, orderID) {
		if o.Status == "offered" {
			return o.RiderID
		}
	}
	return ""
}

// answer marks the open offer of orderID declined at answeredAt, as the decline route does.
func decline(t *testing.T, orderID string, answeredAt time.Time) {
	t.Helper()
	if _, err := testPool.Exec(context.Background(),
		"update offers set status = 'declined', answered_at = $2 where order_id = $1 and status = 'offered'", orderID, answeredAt); err != nil {
		t.Fatal(err)
	}
}

func countOffers(t *testing.T) int {
	t.Helper()
	var n int
	if err := testPool.QueryRow(context.Background(), "select count(*) from offers").Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

var t0 = time.Date(2026, 10, 16, 9, 0, 0, 0, time.UTC)

func TestTickTwoOrdersTwoRiders(t *testing.T) {
	reset(t)
	store := newStore(t)
	longer := freeRider(t, store, 10*time.Minute)
	shorter := freeRider(t, store, 5*time.Minute)
	newer := readyOrder(t, store, t0.Add(time.Minute))
	older := readyOrder(t, store, t0)

	tick(t, time.Now())
	if got := openOffer(t, older.ID); got != longer {
		t.Fatalf("older order offered to %q, want the longer idle rider %s", got, longer)
	}
	if got := openOffer(t, newer.ID); got != shorter {
		t.Fatalf("newer order offered to %q, want %s", got, shorter)
	}
}

func TestTickSkipsRidersWhoCannotTakeIt(t *testing.T) {
	reset(t)
	store := newStore(t)
	rider(t, store, false, 0, storeLat, storeLng, 0)                      // offline
	rider(t, store, true, time.Minute, storeLat, storeLng, 3*time.Minute) // stale position
	busy := freeRider(t, store, time.Minute)                              // on a delivery
	if _, err := testPool.Exec(context.Background(),
		`insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, address_line1, address_pincode,
			total_cents, payment_method, item_count, items) values ($1, 'SS-BUSY', $2, $3, 'C', 'L', '560034', 1, 'cod', 1, '[]')`,
		newID(), store, busy); err != nil {
		t.Fatal(err)
	}
	o := readyOrder(t, store, t0)

	tick(t, time.Now())
	if offers := offersOf(t, o.ID); len(offers) != 0 {
		t.Fatalf("offers %+v, want none", offers)
	}
}

func TestTickDeclineMovesOnThenRests(t *testing.T) {
	reset(t)
	store := newStore(t)
	a := freeRider(t, store, 10*time.Minute)
	b := freeRider(t, store, 5*time.Minute)
	o := readyOrder(t, store, t0)
	now := time.Now()

	tick(t, now)
	if got := openOffer(t, o.ID); got != a {
		t.Fatalf("first offer to %q, want %s", got, a)
	}
	decline(t, o.ID, now)
	tick(t, now)
	if got := openOffer(t, o.ID); got != b {
		t.Fatalf("after A declined, offer to %q, want %s", got, b)
	}
	decline(t, o.ID, now)
	tick(t, now)
	if got := openOffer(t, o.ID); got != "" {
		t.Fatalf("after both declined, offer to %q, want none", got)
	}
	later := now.Add(2*time.Minute + time.Second)
	if _, err := testPool.Exec(context.Background(), "update rider_locations set recorded_at = $1", later); err != nil {
		t.Fatal(err)
	}
	tick(t, later)
	if got := openOffer(t, o.ID); got == "" {
		t.Fatal("2 minutes after the last decline, no offer; want the order offered again")
	}
}

func TestTickExpiresAndCascades(t *testing.T) {
	reset(t)
	store := newStore(t)
	a := freeRider(t, store, 10*time.Minute)
	b := freeRider(t, store, 5*time.Minute)
	o := readyOrder(t, store, t0)
	now := time.Now()

	tick(t, now)
	tick(t, now.Add(31*time.Second))
	offers := offersOf(t, o.ID)
	if len(offers) != 2 || offers[1].RiderID != a || offers[1].Status != "expired" || offers[0].RiderID != b || offers[0].Status != "offered" {
		t.Fatalf("offers %+v, want A's expired and B's open", offers)
	}
}

func TestTickExpiresOfferOfClaimedOrder(t *testing.T) {
	reset(t)
	store := newStore(t)
	a := freeRider(t, store, time.Minute)
	b := freeRider(t, store, 0)
	o := readyOrder(t, store, t0)
	tick(t, time.Now())
	if openOffer(t, o.ID) != a {
		t.Fatal("no offer to A to start from")
	}
	if _, err := testPool.Exec(context.Background(),
		`insert into deliveries (order_id, order_number, store_id, rider_id, customer_name, address_line1, address_pincode,
			total_cents, payment_method, item_count, items) values ($1, $2, $3, $4, 'C', 'L', '560034', 1, 'cod', 1, '[]')`,
		o.ID, o.Number, store, b); err != nil {
		t.Fatal(err)
	}
	tick(t, time.Now())
	if offers := offersOf(t, o.ID); len(offers) != 1 || offers[0].Status != "expired" {
		t.Fatalf("offers %+v, want A's offer expired and no new one", offers)
	}
}

func TestTickSkipsWhileLocked(t *testing.T) {
	reset(t)
	store := newStore(t)
	freeRider(t, store, time.Minute)
	readyOrder(t, store, t0)
	ctx := context.Background()
	tx, err := testPool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, lockTick); err != nil {
		t.Fatal(err)
	}

	tick(t, time.Now())
	if n := countOffers(t); n != 0 {
		t.Fatalf("offers while another transaction holds the key: %d, want 0", n)
	}
	if err := tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	tick(t, time.Now())
	if n := countOffers(t); n != 1 {
		t.Fatalf("offers after the key is released: %d, want 1", n)
	}
}

func TestConcurrentTicksOneOffer(t *testing.T) {
	reset(t)
	store := newStore(t)
	freeRider(t, store, 2*time.Minute)
	freeRider(t, store, time.Minute)
	readyOrder(t, store, t0)

	errs := make([]error, 2)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range errs {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			errs[i] = dsp.Tick(context.Background(), time.Now())
		}()
	}
	close(start)
	wg.Wait()
	if errs[0] != nil || errs[1] != nil {
		t.Fatalf("concurrent ticks: %v", errs)
	}
	if n := countOffers(t); n != 1 {
		t.Fatalf("offers after two concurrent ticks: %d, want 1", n)
	}
}

func TestTickCoreFailureSkipsStore(t *testing.T) {
	reset(t)
	store := newStore(t)
	freeRider(t, store, time.Minute)
	readyOrder(t, store, t0)
	coreFake.FailRoute(ordersRoute, http.StatusInternalServerError)
	t.Cleanup(func() { coreFake.FailRoute(ordersRoute, 0) })

	tick(t, time.Now())
	if n := countOffers(t); n != 0 {
		t.Fatalf("offers with core failing: %d, want 0", n)
	}
}

func TestTickSnapshot(t *testing.T) {
	reset(t)
	store := newStore(t)
	freeRider(t, store, time.Minute)
	o := order(store, t0)
	o.PaymentMethod, o.PaymentStatus = "online", "paid"
	coreFake.AddOrder(o, "")
	now := time.Now().Truncate(time.Microsecond)

	tick(t, now)
	var number, method, status, pincode string
	var items, eta int
	var total int64
	var placed, offered, expires time.Time
	err := testPool.QueryRow(context.Background(),
		`select order_number, item_count, total_cents, payment_method, payment_status, pincode, eta_seconds, placed_at, offered_at, expires_at
		 from offers where order_id = $1`, o.ID).Scan(&number, &items, &total, &method, &status, &pincode, &eta, &placed, &offered, &expires)
	if err != nil {
		t.Fatal(err)
	}
	if number != o.Number || items != 3 || total != 33900 || method != "online" || status != "paid" || pincode != "560034" ||
		eta != 0 || !placed.Equal(t0) || !offered.Equal(now) || !expires.Equal(now.Add(30*time.Second)) {
		t.Fatalf("offer row %s %d %d %s %s %s %d %v %v %v does not hold the order's snapshot", number, items, total, method, status, pincode, eta, placed, offered, expires)
	}
}

func TestTickLogs(t *testing.T) {
	reset(t)
	var buf bytes.Buffer
	prev := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(prev) })
	store := newStore(t)
	a := freeRider(t, store, 10*time.Minute)
	b := freeRider(t, store, 5*time.Minute)
	o := readyOrder(t, store, t0)
	now := time.Now()

	tick(t, now)
	tick(t, now.Add(31*time.Second))
	offers := offersOf(t, o.ID) // B's open, A's expired
	want := []map[string]any{
		{"msg": "offer made", "offerId": offers[1].ID, "orderId": o.ID, "number": o.Number, "riderId": a, "etaSeconds": float64(0)},
		{"msg": "offer expired", "offerId": offers[1].ID, "orderId": o.ID, "number": o.Number, "riderId": a},
		{"msg": "offer made", "offerId": offers[0].ID, "orderId": o.ID, "number": o.Number, "riderId": b, "etaSeconds": float64(0)},
	}
	var got []map[string]any
	for _, l := range strings.Split(strings.TrimSpace(buf.String()), "\n") {
		var m map[string]any
		if json.Unmarshal([]byte(l), &m) == nil && strings.HasPrefix(m["msg"].(string), "offer ") {
			got = append(got, m)
		}
	}
	if len(got) != len(want) {
		t.Fatalf("offer log lines %v, want %v", got, want)
	}
	for i, w := range want {
		if got[i]["level"] != "INFO" {
			t.Fatalf("line %v: want level INFO", got[i])
		}
		for k, v := range w {
			if got[i][k] != v {
				t.Fatalf("line %d %v: %s is %v, want %v", i, got[i], k, got[i][k], v)
			}
		}
	}
}

func TestRunTicks(t *testing.T) {
	reset(t)
	store := newStore(t)
	freeRider(t, store, time.Minute)
	readyOrder(t, store, t0)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { dsp.Run(ctx, 10*time.Millisecond); close(done) }()

	deadline := time.Now().Add(2 * time.Second)
	for countOffers(t) == 0 {
		if time.Now().After(deadline) {
			cancel()
			t.Fatal("no offer within 2 seconds of running the loop")
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("the loop did not stop when its context ended")
	}
}

func TestETA(t *testing.T) {
	koramangala, indiranagar := distance(12.9352, 77.6245, 12.9719, 77.6412), 0.0
	if koramangala < 4400 || koramangala > 4550 {
		t.Fatalf("Koramangala to Indiranagar: %.0f m, want about 4.5 km", koramangala)
	}
	if d := distance(storeLat, storeLng, metresNorth(500), storeLng); math.Abs(d-500) > 0.01 {
		t.Fatalf("500 m north: %.3f m", d)
	}
	for _, c := range []struct {
		metres float64
		want   int32
	}{{indiranagar, 0}, {50, 0}, {100, 0}, {101, 18}, {500, 90}, {2000, 360}} {
		if got := etaSeconds(c.metres, 20); got != c.want {
			t.Errorf("etaSeconds(%v m, 20 km/h) = %d, want %d", c.metres, got, c.want)
		}
	}
}

func TestTickNearerRiderFirst(t *testing.T) {
	reset(t)
	store := newStore(t)
	far := rider(t, store, true, 10*time.Minute, metresNorth(2000), storeLng, 0)
	near := rider(t, store, true, 5*time.Minute, metresNorth(500), storeLng, 0)
	o := readyOrder(t, store, t0)

	tick(t, time.Now())
	if got := openOffer(t, o.ID); got != near {
		t.Fatalf("offer to %q, want the nearer rider %s (not %s)", got, near, far)
	}
	if eta := etaOf(t, o.ID, near); eta != 90 {
		t.Fatalf("ETA %d s, want 90 for 500 m at 20 km/h", eta)
	}
}

func TestTickSameMinuteLongerIdle(t *testing.T) {
	reset(t)
	store := newStore(t)
	longer := rider(t, store, true, 10*time.Minute, metresNorth(300), storeLng, 0)
	rider(t, store, true, 5*time.Minute, metresNorth(150), storeLng, 0)
	o := readyOrder(t, store, t0)

	tick(t, time.Now())
	if got := openOffer(t, o.ID); got != longer {
		t.Fatalf("offer to %q, want the longer idle rider %s in the same minute", got, longer)
	}
	if eta := etaOf(t, o.ID, longer); eta != 54 {
		t.Fatalf("ETA %d s, want 54 for 300 m", eta)
	}
}

func TestTickIdleCountsFromLastDelivery(t *testing.T) {
	reset(t)
	store := newStore(t)
	back := freeRider(t, store, 10*time.Minute) // online longer, but delivered a minute ago
	waiting := freeRider(t, store, 5*time.Minute)
	if _, err := testPool.Exec(context.Background(),
		`insert into deliveries (order_id, order_number, store_id, rider_id, status, customer_name, address_line1, address_pincode,
			total_cents, payment_method, item_count, items, assigned_at, delivered_at)
		 values ($1, 'SS-DONE', $2, $3, 'delivered', 'C', 'L', '560034', 1, 'cod', 1, '[]', now() - interval '9 minutes', now() - interval '1 minute')`,
		newID(), store, back); err != nil {
		t.Fatal(err)
	}
	o := readyOrder(t, store, t0)

	tick(t, time.Now())
	if got := openOffer(t, o.ID); got != waiting {
		t.Fatalf("offer to %q, want %s, idle since going online 5 minutes ago", got, waiting)
	}
}

func TestTickWithin100mIsZero(t *testing.T) {
	reset(t)
	store := newStore(t)
	r := rider(t, store, true, time.Minute, metresNorth(50), storeLng, 0)
	o := readyOrder(t, store, t0)

	tick(t, time.Now())
	if eta := etaOf(t, o.ID, r); eta != 0 {
		t.Fatalf("ETA %d s at 50 m, want 0", eta)
	}
}

func TestTickStoreWithoutLocation(t *testing.T) {
	reset(t)
	store := bareStore(t)
	freeRider(t, store, time.Minute)
	readyOrder(t, store, t0)

	tick(t, time.Now())
	if n := countOffers(t); n != 0 {
		t.Fatalf("offers at a store without a location: %d, want 0", n)
	}
}

// TestTickNoCandidateNoCoreCall: a store whose only online rider cannot take an
// order (a stale position here) costs the tick no core call.
func TestTickNoCandidateNoCoreCall(t *testing.T) {
	reset(t)
	store := newStore(t)
	rider(t, store, true, time.Minute, storeLat, storeLng, 3*time.Minute)
	readyOrder(t, store, t0)
	before := coreFake.Calls(ordersRoute)

	tick(t, time.Now())
	if got := coreFake.Calls(ordersRoute) - before; got != 0 {
		t.Fatalf("core ready-orders calls for a store with no candidate: %d, want 0", got)
	}
}
