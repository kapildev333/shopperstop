// Package migrate applies numbered SQL files to the database once, in order.
package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// lockKey is the session advisory lock every Apply holds on its database.
const lockKey = 727001

var fileName = regexp.MustCompile(`^(\d{4})_[a-z0-9_]+\.sql$`)

const bookkeeping = `create table if not exists schema_migrations (
    version    text primary key,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
)`

// Apply runs every *.sql file in the root of fsys that the database has not
// recorded, in file-name order. Each file runs in its own transaction with
// its version insert, so a failure leaves no trace of that file and stops the
// run. Apply returns the versions applied by this call. Two files sharing a
// number are refused before anything runs. The whole run holds a session
// advisory lock on its own connection, so a second runner on the same
// database waits for the first and then applies only what is still pending.
func Apply(ctx context.Context, pool *pgxpool.Pool, fsys fs.FS) ([]string, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("migrate: read files: %w", err)
	}
	var files []string
	numbers := map[string]string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		m := fileName.FindStringSubmatch(e.Name())
		if m == nil {
			return nil, fmt.Errorf("migrate %s: name must match NNNN_name.sql", e.Name())
		}
		if other, dup := numbers[m[1]]; dup {
			return nil, fmt.Errorf("migrate %s: version %s already used by %s", e.Name(), m[1], other)
		}
		numbers[m[1]] = e.Name()
		files = append(files, e.Name())
	}

	// The connection leaves the pool and is closed at the end: closing the
	// session releases the lock even when ctx is already cancelled.
	pc, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("migrate: connect: %w", err)
	}
	conn := pc.Hijack()
	defer conn.Close(context.Background())
	if _, err := conn.Exec(ctx, "select pg_advisory_lock($1)", lockKey); err != nil {
		return nil, fmt.Errorf("migrate: lock: %w", err)
	}

	if _, err := conn.Exec(ctx, bookkeeping); err != nil {
		return nil, fmt.Errorf("migrate: create schema_migrations: %w", err)
	}
	rows, err := conn.Query(ctx, "select version from schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("migrate: read schema_migrations: %w", err)
	}
	done := map[string]bool{}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			rows.Close()
			return nil, fmt.Errorf("migrate: read schema_migrations: %w", err)
		}
		done[v] = true
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("migrate: read schema_migrations: %w", err)
	}

	var applied []string
	for _, name := range files {
		version := strings.TrimSuffix(name, ".sql")
		if done[version] {
			continue
		}
		body, err := fs.ReadFile(fsys, name)
		if err != nil {
			return applied, fmt.Errorf("migrate %s: read: %w", name, err)
		}
		err = pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
			if _, err := tx.Exec(ctx, string(body)); err != nil {
				return err
			}
			_, err := tx.Exec(ctx, "insert into schema_migrations (version) values ($1)", version)
			return err
		})
		if err != nil {
			return applied, fmt.Errorf("migrate %s: %w", name, err)
		}
		applied = append(applied, version)
	}
	return applied, nil
}
