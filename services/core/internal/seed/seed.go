// Package seed loads the demo accounts of design Decision 22 for
// `core-admin seed-demo`. It is the one package allowed to write other
// packages' tables.
//
// Later lanes extend it in two places: add the table to truncateTables, and
// add its rows to load after the rows they reference.
package seed

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
)

// truncateTables is every table Reset empties, in one statement. Later lanes add theirs here.
var truncateTables = []string{
	"sessions", "addresses", "customers", "staff_users",
	// catalog (core-P2-L3)
	"products", "categories",
}

// Fixed ids and values of design Decision 22. Later lanes take their ids from
// the ranges Decision 22 reserves.
const (
	adminID       = "00000000-0000-4000-8000-000000000101"
	customerID    = "00000000-0000-4000-8000-000000000201"
	homeID        = "00000000-0000-4000-8000-000000000301"
	workID        = "00000000-0000-4000-8000-000000000302"
	adminEmail    = "admin@shopperstop.local"
	adminPass     = "admin12345"
	customerEmail = "demo@shopperstop.local"
	customerPass  = "demo12345"
)

// hashes are the bcrypt hashes of the demo passwords, computed before any
// transaction opens so the truncate lock is not held during the hashing.
type hashes struct {
	admin, customer string
}

func hashDemo() (hashes, error) {
	admin, err := auth.HashPassword(adminPass)
	if err != nil {
		return hashes{}, fmt.Errorf("hash demo admin password: %w", err)
	}
	customer, err := auth.HashPassword(customerPass)
	if err != nil {
		return hashes{}, fmt.Errorf("hash demo customer password: %w", err)
	}
	return hashes{admin: admin, customer: customer}, nil
}

// Reset empties the demo tables and loads the demo rows, in one transaction.
// Sessions go with the accounts they belong to.
func Reset(ctx context.Context, pool *pgxpool.Pool) error {
	h, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "truncate "+strings.Join(truncateTables, ", ")); err != nil {
			return fmt.Errorf("truncate demo tables: %w", err)
		}
		return load(ctx, tx, h)
	})
}

// Load inserts the demo rows into a database that holds none of them. A row
// that already exists is an error (duplicate key), and the transaction rolls
// back, so nothing is left half-loaded.
func Load(ctx context.Context, pool *pgxpool.Pool) error {
	h, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		return load(ctx, tx, h)
	})
}

// load inserts every demo row in dependency order. Later lanes add their
// inserts here, after the rows they reference.
func load(ctx context.Context, tx pgx.Tx, h hashes) error {
	if _, err := tx.Exec(ctx,
		"insert into staff_users (id, email, password_hash, name, role) values ($1, $2, $3, 'Admin', 'admin')",
		adminID, adminEmail, h.admin); err != nil {
		return fmt.Errorf("insert demo admin: %w", err)
	}
	if _, err := tx.Exec(ctx,
		"insert into customers (id, email, password_hash, name, phone) values ($1, $2, $3, 'Demo Customer', '+919800000000')",
		customerID, customerEmail, h.customer); err != nil {
		return fmt.Errorf("insert demo customer: %w", err)
	}
	if _, err := tx.Exec(ctx, `insert into addresses (id, customer_id, label, line1, pincode, is_default) values
		($1, $3, 'Home', '12 80 Feet Rd, Koramangala', '560034', true),
		($2, $3, 'Work', '100 Feet Rd, Indiranagar', '560038', false)`,
		homeID, workID, customerID); err != nil {
		return fmt.Errorf("insert demo addresses: %w", err)
	}
	// catalog (core-P2-L3)
	return loadCatalog(ctx, tx)
}
