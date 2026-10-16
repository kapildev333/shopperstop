// Command rider-admin runs the rider service's operator tasks: schema
// migrations, demo riders and creating a rider from the command line.
package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/config"
	"github.com/kapildev333/shopperstop/services/rider/internal/core"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
	"github.com/kapildev333/shopperstop/services/rider/internal/migrate"
	"github.com/kapildev333/shopperstop/services/rider/internal/seed"
	"github.com/kapildev333/shopperstop/services/rider/migrations"
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
		return seedDemoCmd(len(args) == 2, stdout, stderr)
	case "create-rider":
		if len(args) != 4 || args[2] != "--store" {
			return usage(stderr)
		}
		return createRiderCmd(args[1], args[3], os.Stdin, stdout, stderr)
	default:
		return usage(stderr)
	}
}

func usage(stderr io.Writer) int {
	fmt.Fprintln(stderr, "usage: rider-admin migrate | seed-demo [--reset] | create-rider <email> --store <id>")
	return 2
}

// connect loads the configuration and opens the pool; the caller closes it.
func connect() (config.Config, *pgxpool.Pool, error) {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return cfg, nil, err
	}
	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		return cfg, nil, fmt.Errorf("open database: %w", err)
	}
	return cfg, pool, nil
}

func migrateDB(stdout, stderr io.Writer) int {
	_, pool, err := connect()
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	defer pool.Close()

	ctx := context.Background()
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

// seedDemoCmd loads the demo riders, clearing the riders first when reset is set,
// and prints seed.Summary. It never calls core.
func seedDemoCmd(reset bool, stdout, stderr io.Writer) int {
	_, pool, err := connect()
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	defer pool.Close()

	load := seed.Load
	if reset {
		load = seed.Reset
	}
	if err := load(context.Background(), pool); err != nil {
		fmt.Fprintf(stderr, "rider-admin: seed-demo: %v\n", err)
		return 1
	}
	fmt.Fprint(stdout, seed.Summary)
	return 0
}

func createRiderCmd(email, storeID string, stdin io.Reader, stdout, stderr io.Writer) int {
	cfg, pool, err := connect()
	if err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	defer pool.Close()

	c := core.New(cfg.CoreURL, cfg.CoreServiceToken, time.Now)
	if err := createRider(context.Background(), pool, c, email, storeID, stdin, stdout); err != nil {
		fmt.Fprintf(stderr, "rider-admin: %v\n", err)
		return 1
	}
	return 0
}

// createRider reads the password from the first line of stdin (it never appears
// in the shell history or the process list), creates an active rider named Rider
// at storeID under the API's rules, and prints the email. Refusals name the field.
func createRider(ctx context.Context, pool *pgxpool.Pool, c *core.Client, email, storeID string, stdin io.Reader, stdout io.Writer) error {
	line, err := bufio.NewReader(stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("read password from stdin: %w", err)
	}
	password := strings.TrimRight(line, "\r\n")
	if password == "" {
		return errors.New("password is required on stdin")
	}
	r, err := auth.CreateRider(ctx, pool, c, auth.NewRider{StoreID: storeID, Email: email, Name: "Rider", Password: password})
	var apiErr *httpx.Error
	if errors.As(err, &apiErr) && apiErr.Field != "" {
		return fmt.Errorf("%s: %s", apiErr.Field, apiErr.Message)
	}
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "created rider %s\n", r.Email)
	return nil
}
