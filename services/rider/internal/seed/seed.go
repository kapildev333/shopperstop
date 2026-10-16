// Package seed loads the rider service's demo riders: four active riders at
// core's two demo stores, with fixed ids (PLAN.md D20). It never calls core;
// the store ids are core's fixed demo ids, and Summary documents the sign-ins.
//
// Later lanes extend it in two places: add the table to truncateTables, and add
// its rows to load after the rows they reference.
package seed

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
)

// truncateTables is every table Reset empties, in one statement. Later lanes add theirs here.
var truncateTables = []string{"sessions", "riders"}

const (
	storeKoramangala = "00000000-0000-4000-8000-000000000401"
	storeIndiranagar = "00000000-0000-4000-8000-000000000402"
	demoPassword     = "rider12345"
)

type demoRider struct{ id, email, name, phone, store string }

// demoRiders are in id order; Summary lists them the same way.
var demoRiders = []demoRider{
	{"00000000-0000-4000-8000-000000000801", "rider1-koramangala@shopperstop.local", "Arjun Rao", "+919000000001", storeKoramangala},
	{"00000000-0000-4000-8000-000000000802", "rider2-koramangala@shopperstop.local", "Meera Iyer", "+919000000002", storeKoramangala},
	{"00000000-0000-4000-8000-000000000803", "rider1-indiranagar@shopperstop.local", "Kabir Shah", "+919000000003", storeIndiranagar},
	{"00000000-0000-4000-8000-000000000804", "rider2-indiranagar@shopperstop.local", "Divya Nair", "+919000000004", storeIndiranagar},
}

// hashDemo is computed once per process, before any transaction opens: the
// demo password is a public constant, so caching across resets is correct.
var hashDemo = sync.OnceValues(func() (string, error) {
	h, err := auth.HashPassword(demoPassword)
	if err != nil {
		return "", fmt.Errorf("hash demo rider password: %w", err)
	}
	return h, nil
})

// Reset empties the rider tables (sessions go with their riders) and loads the
// demo riders, in one transaction.
func Reset(ctx context.Context, pool *pgxpool.Pool) error {
	hash, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "truncate "+strings.Join(truncateTables, ", ")); err != nil {
			return fmt.Errorf("truncate demo tables: %w", err)
		}
		return load(ctx, tx, hash)
	})
}

// Load inserts the demo riders into a database that holds none of them. A rider
// that already exists is a duplicate key error, and the transaction rolls back.
func Load(ctx context.Context, pool *pgxpool.Pool) error {
	hash, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		return load(ctx, tx, hash)
	})
}

func load(ctx context.Context, tx pgx.Tx, hash string) error {
	for _, r := range demoRiders {
		if _, err := tx.Exec(ctx,
			"insert into riders (id, store_id, email, name, phone, password_hash) values ($1, $2, $3, $4, $5, $6)",
			r.id, r.store, r.email, r.name, r.phone, hash); err != nil {
			return fmt.Errorf("insert demo rider %s: %w", r.email, err)
		}
	}
	return nil
}
