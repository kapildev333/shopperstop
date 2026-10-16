// Package migrate applies numbered SQL files to the database once, in order.
// Copied from services/core at 5335efc (D31).
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
// number are refused before anything runs. Two runners racing fail on the
// primary key instead of waiting.
// ponytail: no advisory lock; add pg_advisory_lock when deploys migrate from more than one process.
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

	if _, err := pool.Exec(ctx, bookkeeping); err != nil {
		return nil, fmt.Errorf("migrate: create schema_migrations: %w", err)
	}
	rows, err := pool.Query(ctx, "select version from schema_migrations")
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
		err = pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
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
