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

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/config"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
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
	fmt.Fprintln(stderr, "usage: core-admin migrate | seed-demo [--reset] | create-admin <email>")
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
