// Command core-admin runs the core service's operator tasks: schema
// migrations, demo data and the first admin.
package main

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/config"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/migrate"
	"github.com/kapildev333/shopperstop/services/core/internal/seed"
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
		reset, force, ok := seedFlags(args[1:])
		if !ok {
			return usage(stderr)
		}
		return seedDemoCmd(reset, force, stdout, stderr)
	case "create-admin":
		if len(args) != 2 {
			return usage(stderr)
		}
		return createAdminCmd(args[1], os.Stdin, stdout, stderr)
	default:
		return usage(stderr)
	}
}

func usage(stderr io.Writer) int {
	fmt.Fprintln(stderr, "usage: core-admin migrate | seed-demo [--reset] [--force] | create-admin <email>")
	return 2
}

// seedFlags reads seed-demo's flags: --reset and --force, each at most once, in any order.
func seedFlags(args []string) (reset, force, ok bool) {
	for _, a := range args {
		switch {
		case a == "--reset" && !reset:
			reset = true
		case a == "--force" && !force:
			force = true
		default:
			return false, false, false
		}
	}
	return reset, force, true
}

// localDatabase refuses a database URL naming any host but this machine
// (localhost, 127.0.0.1, ::1 or a Unix socket directory), so the demo rows and
// their public passwords never land on a shared database by mistake.
func localDatabase(databaseURL string) error {
	cfg, err := pgconn.ParseConfig(databaseURL)
	if err != nil {
		return fmt.Errorf("parse SHOPPERSTOP_CORE_DATABASE_URL: %w", err)
	}
	hosts := []string{cfg.Host}
	for _, f := range cfg.Fallbacks {
		hosts = append(hosts, f.Host)
	}
	for _, h := range hosts {
		if h != "localhost" && h != "127.0.0.1" && h != "::1" && !strings.HasPrefix(h, "/") {
			return fmt.Errorf("refusing to load demo data into a database on %s, not this machine; add --force to load it anyway", h)
		}
	}
	return nil
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

// seedDemoCmd loads the demo data, clearing it first when reset is set, and
// prints seed.Summary. Without force it refuses a database on another host.
func seedDemoCmd(reset, force bool, stdout, stderr io.Writer) int {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		fmt.Fprintf(stderr, "core-admin: %v\n", err)
		return 1
	}
	if !force {
		if err := localDatabase(cfg.DatabaseURL); err != nil {
			fmt.Fprintf(stderr, "core-admin: seed-demo: %v\n", err)
			return 1
		}
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(stderr, "core-admin: open database: %v\n", err)
		return 1
	}
	defer pool.Close()
	load := seed.Load
	if reset {
		load = seed.Reset
	}
	if err := load(ctx, pool); err != nil {
		fmt.Fprintf(stderr, "core-admin: seed-demo: %v\n", err)
		return 1
	}
	// catalog (core-P2-L3)
	if err := seed.Files(ctx, blob.Disk{Dir: cfg.FilesDir}); err != nil {
		fmt.Fprintf(stderr, "core-admin: seed-demo images: %v\n", err)
		return 1
	}
	fmt.Fprint(stdout, seed.Summary)
	return 0
}

func createAdminCmd(email string, stdin io.Reader, stdout, stderr io.Writer) int {
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
	if err := createAdmin(ctx, pool, email, stdin, stdout); err != nil {
		fmt.Fprintf(stderr, "core-admin: %v\n", err)
		return 1
	}
	return 0
}

// createAdmin reads the password from the first line of stdin (the password
// never appears in the shell history or the process list) and creates an
// active admin named Admin under the API's rules. Refusals name the field.
func createAdmin(ctx context.Context, pool *pgxpool.Pool, email string, stdin io.Reader, stdout io.Writer) error {
	line, err := bufio.NewReader(stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return fmt.Errorf("read password from stdin: %w", err)
	}
	password := strings.TrimRight(line, "\r\n")
	if password == "" {
		return errors.New("password is required on stdin")
	}
	_, err = auth.CreateStaff(ctx, pool, auth.NewStaff{Email: email, Password: password, Name: "Admin", Role: "admin"})
	var apiErr *httpx.Error
	if errors.As(err, &apiErr) && apiErr.Field != "" {
		return fmt.Errorf("%s: %s", apiErr.Field, apiErr.Message)
	}
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "created admin %s\n", email)
	return nil
}
