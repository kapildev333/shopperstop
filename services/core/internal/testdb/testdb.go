// Package testdb gives each test package its own schema in the shared core
// test database, so packages can run in parallel without seeing each other.
package testdb

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const defaultURL = "postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable"

// Open returns a pool whose connections search the schema test_<name>_<pid>,
// created fresh. The cleanup drops that schema and closes the pool. Open
// panics when the database is unreachable: a missing database is a failure,
// never a skip.
// ponytail: a crashed run leaves its schema behind; sweep test_% schemas older than a day if they pile up.
func Open(name string) (*pgxpool.Pool, func()) {
	url := os.Getenv("SHOPPERSTOP_CORE_TEST_DATABASE_URL")
	if url == "" {
		url = defaultURL
	}
	schema := fmt.Sprintf("test_%s_%d", name, os.Getpid())
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		panic(fmt.Sprintf("testdb: parse SHOPPERSTOP_CORE_TEST_DATABASE_URL: %v", err))
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
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
