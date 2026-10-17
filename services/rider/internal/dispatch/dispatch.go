// Package dispatch offers ready orders to online riders (rider-dispatch, D57):
// Uber's dispatch reduced to a dark store, where every trip starts at the store.
// Tick expires open offers that ran out, then offers each free ready order,
// oldest first, to the best free candidate of its store for a short time.
// The rider answers through internal/delivery; the hand claim stays the fallback.
//
// ponytail ceilings (D57): one order per offer (batching needs drop coordinates,
// which addresses lack); no forward dispatch to a rider still on a delivery; no
// windowed global assignment; the tick polls core's ready list per store every
// interval (core's events feed when it hurts); the rider app polls, no push.
package dispatch

import (
	"context"
	"log/slog"
	"slices"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/dispatch/db"
)

// refusalRest is how long a rider who declined an order, or let its offer
// expire, is not offered that order again.
const refusalRest = 2 * time.Minute

// Config is the dispatcher's part of config.Config.
type Config struct {
	Enabled     bool          // the loop runs: SHOPPERSTOP_RIDER_DISPATCH_INTERVAL > 0
	OfferTTL    time.Duration // how long an offer stays open
	LocationTTL time.Duration // how old a rider's position may be
	SpeedKMH    float64       // the one speed every ETA assumes
}

// Dispatcher runs ticks and serves the staff dispatch read. It is safe for concurrent use.
type Dispatcher struct {
	pool *pgxpool.Pool
	q    *db.Queries
	core *core.Client
	cfg  Config
}

// New returns a dispatcher over pool; c reads core's ready orders and stores.
func New(pool *pgxpool.Pool, c *core.Client, cfg Config) *Dispatcher {
	return &Dispatcher{pool: pool, q: db.New(pool), core: c, cfg: cfg}
}

// Run calls Tick every interval until ctx ends. A failed tick is logged and the next one runs.
func (d *Dispatcher) Run(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := d.Tick(ctx, time.Now()); err != nil && ctx.Err() == nil {
				slog.ErrorContext(ctx, "dispatch tick failed", "err", err)
			}
		}
	}
}

// Tick runs one dispatch round at now, in one transaction holding the tick
// lock; when another transaction holds it, Tick returns nil having done
// nothing. now is the only clock Tick reads, so tests pass their own.
// ponytail: the lock is held across core calls (up to two 5 s calls per store
// with work), so a rider going offline can wait that long; commit per store if it bites.
func (d *Dispatcher) Tick(ctx context.Context, now time.Time) error {
	return pgx.BeginFunc(ctx, d.pool, func(tx pgx.Tx) error {
		q := d.q.WithTx(tx)
		locked, err := q.TryTickLock(ctx)
		if err != nil || !locked {
			return err
		}
		expired, err := q.ExpireOffers(ctx, ts(now))
		if err != nil {
			return err
		}
		for _, o := range expired {
			slog.InfoContext(ctx, "offer expired", "offerId", o.ID, "orderId", o.OrderID, "number", o.OrderNumber, "riderId", o.RiderID)
		}
		stores, err := q.OnlineStores(ctx)
		if err != nil {
			return err
		}
		for _, store := range stores {
			if err := d.dispatchStore(ctx, q, store, now); err != nil {
				return err
			}
		}
		return nil
	})
}

// candidate is one rider a tick may offer an order to.
type candidate struct {
	id         string
	lat, lng   float64
	idleSince  time.Time
	etaSeconds int32
}

// dispatchStore offers the store's free ready orders, oldest first, each to
// the best candidate that has not refused it lately; a rider gets at most one.
// A core failure skips the store (the core client logged it); only database
// errors are returned.
func (d *Dispatcher) dispatchStore(ctx context.Context, q *db.Queries, store string, now time.Time) error {
	// Candidates first: a store whose online riders are all busy, stale or offered costs no core call.
	rows, err := q.Candidates(ctx, db.CandidatesParams{StoreID: store, LocatedAfter: ts(now.Add(-d.cfg.LocationTTL))})
	if err != nil || len(rows) == 0 {
		return err
	}
	// ponytail: core's first page of 100 ready orders, newest first; beyond 100 the oldest wait for the hand claim. Page through core then.
	orders, err := d.core.StoreOrders(ctx, store, "ready")
	if err != nil || len(orders) == 0 {
		return nil
	}
	ids := make([]string, len(orders))
	for i, o := range orders {
		ids[i] = o.ID
	}
	busy, err := q.BusyOrders(ctx, ids)
	if err != nil {
		return err
	}
	loc, err := d.storeLocation(ctx, store)
	if err != nil || loc == nil {
		return nil // core failed (logged by the client), or the store has no location: dispatch is off there
	}
	cands := make([]candidate, len(rows))
	for i, r := range rows {
		cands[i] = candidate{id: r.ID, lat: r.Lat, lng: r.Lng, idleSince: r.IdleSince.Time,
			etaSeconds: etaSeconds(distance(r.Lat, r.Lng, loc.Lat, loc.Lng), d.cfg.SpeedKMH)}
	}
	rank(cands)
	sort.SliceStable(orders, func(i, j int) bool { return orders[i].PlacedAt.Before(orders[j].PlacedAt) })
	for _, o := range orders {
		if slices.Contains(busy, o.ID) || len(cands) == 0 {
			continue
		}
		refused, err := q.RecentlyRefused(ctx, db.RecentlyRefusedParams{OrderID: o.ID, AnsweredAfter: ts(now.Add(-refusalRest))})
		if err != nil {
			return err
		}
		i := slices.IndexFunc(cands, func(c candidate) bool { return !slices.Contains(refused, c.id) })
		if i < 0 {
			continue
		}
		c := cands[i]
		units := 0
		for _, l := range o.Items {
			units += l.Quantity
		}
		id, err := q.CreateOffer(ctx, db.CreateOfferParams{
			OrderID: o.ID, OrderNumber: o.Number, StoreID: store, RiderID: c.id, EtaSeconds: c.etaSeconds,
			ItemCount: int32(units), TotalCents: o.TotalCents, PaymentMethod: o.PaymentMethod,
			PaymentStatus: o.PaymentStatus, Pincode: o.Address.Pincode, PlacedAt: ts(o.PlacedAt),
			OfferedAt: ts(now), ExpiresAt: ts(now.Add(d.cfg.OfferTTL)),
		})
		if err != nil {
			return err
		}
		slog.InfoContext(ctx, "offer made", "offerId", id, "orderId", o.ID, "number", o.Number, "riderId", c.id, "etaSeconds", c.etaSeconds)
		cands = slices.Delete(cands, i, i+1)
	}
	return nil
}

// rank sorts candidates best first: ETA floored to the minute, then the
// longest idle (earliest idleSince), then rider id.
func rank(cs []candidate) {
	sort.Slice(cs, func(i, j int) bool {
		a, b := cs[i], cs[j]
		if a.etaSeconds/60 != b.etaSeconds/60 {
			return a.etaSeconds/60 < b.etaSeconds/60
		}
		if !a.idleSince.Equal(b.idleSince) {
			return a.idleSince.Before(b.idleSince)
		}
		return a.id < b.id
	})
}

// storeLocation reads the store's location from core's public store read; nil
// when the store has none. ponytail: one core read per store per tick that has
// an order and a candidate; cache it for 30 s if core feels it.
func (d *Dispatcher) storeLocation(ctx context.Context, store string) (*core.StoreLocation, error) {
	s, err := d.core.Store(ctx, store)
	if err != nil {
		return nil, err
	}
	if s.Location == nil {
		slog.DebugContext(ctx, "dispatch skips a store without a location", "storeId", store)
	}
	return s.Location, nil
}

func ts(t time.Time) pgtype.Timestamptz { return pgtype.Timestamptz{Time: t, Valid: true} }
