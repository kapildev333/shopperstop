// Command rider-admin runs the rider service's operator tasks. Task 1 has
// only schema migrations; the demo seed and create-rider come with later tasks.
package main

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/config"
	"github.com/kapildev333/shopperstop/services/rider/internal/migrate"
	"github.com/kapildev333/shopperstop/services/rider/migrations"
)

func main() {
	os.Exit(run(os.Args[1:], os.Stdout, os.Stderr))
}

func run(args []string, stdout, stderr io.Writer) int {
	if len(args) != 1 || args[0] != "migrate" {
		fmt.Fprintln(stderr, "usage: rider-admin migrate")
		return 2
	}
	return migrateDB(stdout, stderr)
}

func migrateDB(stdout, stderr io.Writer) int {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: open database: %v\n", err)
		return 1
	}
	defer pool.Close()

	applied, err := migrate.Apply(ctx, pool, migrations.FS)
	for _, v := range applied {
		fmt.Fprintf(stdout, "applied %s\n", v)
	}
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	if len(applied) == 0 {
		fmt.Fprintln(stdout, "nothing to apply")
	}
	return 0
}
