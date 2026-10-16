// Command core serves the core API over HTTP on SHOPPERSTOP_CORE_ADDR.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/app"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/config"
)

const shutdownGrace = 10 * time.Second

func main() {
	cfg, err := config.Load(os.Getenv)
	if err != nil {
		fmt.Fprintf(os.Stderr, "core: %v\n", err)
		os.Exit(1)
	}
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: cfg.LogLevel})))
	if err := run(cfg); err != nil {
		slog.Error("core: stopped with error", "err", err)
		os.Exit(1)
	}
}

// run opens the pool and the listener, serves until SIGINT or SIGTERM, then
// drains and closes the pool.
func run(cfg config.Config) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer pool.Close()

	ln, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", cfg.Addr, err)
	}
	slog.Info("core listening", "addr", ln.Addr().String())
	// Sign-in, registration and staff sign-in share one limiter: 10 attempts per email and 100 per IP per hour.
	limit := auth.NewLimiter(10, 100, time.Hour, time.Now)
	limit.TrustProxy = cfg.TrustProxy
	a := auth.New(pool, cfg.SessionPepper, limit, cfg.ServiceTokens)
	// Password reset requests have their own budget, with the same numbers.
	resetLimit := auth.NewLimiter(10, 100, time.Hour, time.Now)
	resetLimit.TrustProxy = cfg.TrustProxy
	a.ResetLimit = resetLimit
	srv := newHTTPServer(app.New(pool, cfg.WebOrigins, a, blob.Disk{Dir: cfg.FilesDir}))
	if err := serve(ctx, srv, ln, shutdownGrace); err != nil {
		return err
	}
	slog.Info("core stopped")
	return nil
}

// newHTTPServer bounds how long a client may take to send request headers,
// so a trickling client cannot hold a graceful shutdown for the whole grace.
func newHTTPServer(h http.Handler) *http.Server {
	return &http.Server{Handler: h, ReadHeaderTimeout: 5 * time.Second}
}

// serve accepts on ln until ctx is done, then stops accepting and waits up
// to grace for in-flight requests to finish. A clean stop returns nil.
func serve(ctx context.Context, srv *http.Server, ln net.Listener, grace time.Duration) error {
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()

	select {
	case err := <-errc:
		return err // the listener failed before any stop was asked
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), grace)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	if err := <-errc; err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
