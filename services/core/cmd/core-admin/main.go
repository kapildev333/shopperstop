// Command core-admin runs the core service's operator tasks: schema
// migrations and demo data.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/config"
	"github.com/kapildev333/shopperstop/services/core/internal/migrate"
	"github.com/kapildev333/shopperstop/services/core/migrations"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		return usage(stderr)
	}
	switch args[0] {
	case "migrate":
		if len(args) != 1 {
			return usage(stderr)
		}
		return migrateDB(stdout, stderr)
	case "seed-demo":
		if len(args) > 2 || (len(args) == 2 && args[1] != "--reset") {
			return usage(stderr)
		}
		// ponytail: stub until Phase 2 adds demo data; it loads no config and opens no pool.
		fmt.Fprintln(stdout, "seed-demo: no demo data yet")
		return 0
	default:
		return usage(stderr)
	}
}

func usage(stderr io.Writer) int {
	fmt.Fprintln(stderr, "usage: core-admin migrate | seed-demo [--reset]")
	return 2
}

func migrateDB(stdout, stderr io.Writer) int {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		fmt.Fprintf(stderr, "core-admin: %v\n", err)
		return 1
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(stderr, "core-admin: open database: %v\n", err)
		return 1
	}
	defer pool.Close()

	applied, err := migrate.Apply(ctx, pool, migrations.FS)
	for _, v := range applied {
		fmt.Fprintf(stdout, "applied %s\n", v)
	}
	if err != nil {
		fmt.Fprintf(stderr, "core-admin: %v\n", err)
		return 1
	}
	if len(applied) == 0 {
		fmt.Fprintln(stdout, "nothing to apply")
	}
	return 0
}
