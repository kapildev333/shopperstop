// Package testdb gives each test package its own schema in the shared rider
// test database, so packages can run in parallel without seeing each other.
// Copied from services/core at 5335efc (D31).
package testdb

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/migrate"
	"github.com/kapildev333/shopperstop/services/rider/migrations"
)

const defaultURL = "postgres://shopperstop_rider:shopperstop_rider@localhost:5432/shopperstop_rider_test?sslmode=disable"

// migrationLock serialises migrations across test packages: two packages
// creating the citext extension at once race on pg_extension.
const migrationLock = 727101

// Open returns a pool whose connections search the schema test_<name>_<pid>,
// created fresh, then public (the citext type lives there). The cleanup drops
// that schema and closes the pool. Open panics when the database is
// unreachable: a missing database is a failure, never a skip.
// ponytail: a crashed run leaves its schema behind; sweep test_% schemas older than a day if they pile up.
func Open(name string) (*pgxpool.Pool, func()) {
	url := os.Getenv("SHOPPERSTOP_RIDER_TEST_DATABASE_URL")
	if url == "" {
		url = defaultURL
	}
	schema := fmt.Sprintf("test_%s_%d", name, os.Getpid())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		panic(fmt.Sprintf("testdb: parse SHOPPERSTOP_RIDER_TEST_DATABASE_URL: %v", err))
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = pgx.Identifier{schema}.Sanitize() + ", public"
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		panic(fmt.Sprintf("testdb: connect: %v", err))
	}
	if _, err := pool.Exec(ctx, "drop schema if exists "+pgx.Identifier{schema}.Sanitize()+" cascade"); err != nil {
		pool.Close()
		panic(fmt.Sprintf("testdb: reset schema %s: %v", schema, err))
	}
	if _, err := pool.Exec(ctx, "create schema "+pgx.Identifier{schema}.Sanitize()); err != nil {
		pool.Close()
		panic(fmt.Sprintf("testdb: create schema %s: %v", schema, err))
	}
	cleanup := func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_, _ = pool.Exec(ctx, "drop schema if exists "+pgx.Identifier{schema}.Sanitize()+" cascade")
		pool.Close()
	}
	return pool, cleanup
}

// Migrated is Open followed by every embedded migration applied to the test
// schema, under a database-wide advisory lock. It panics on any error.
func Migrated(name string) (*pgxpool.Pool, func()) {
	pool, cleanup := Open(name)
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	conn, err := pool.Acquire(ctx)
	if err != nil {
		cleanup()
		panic(fmt.Sprintf("testdb: acquire migration connection: %v", err))
	}
	defer conn.Release()
	if _, err := conn.Exec(ctx, "select pg_advisory_lock($1)", migrationLock); err != nil {
		cleanup()
		panic(fmt.Sprintf("testdb: lock migrations: %v", err))
	}
	_, err = migrate.Apply(ctx, pool, migrations.FS)
	if _, uerr := conn.Exec(ctx, "select pg_advisory_unlock($1)", migrationLock); err == nil {
		err = uerr
	}
	if err != nil {
		cleanup()
		panic(fmt.Sprintf("testdb: migrate %s: %v", name, err))
	}
	return pool, cleanup
}
