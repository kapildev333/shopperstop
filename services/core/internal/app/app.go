// Package app wires the core service's routes onto the shared httpx router.
package app

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/address"
	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// New returns the core router. Routes are registered with their full path
// so chi.Walk yields the paths openapi.json documents.
func New(pool *pgxpool.Pool, origins []string, a *auth.Auth) chi.Router {
	r := httpx.NewRouter(origins)
	r.Get("/api/core/v1/healthz", healthz)
	r.Get("/api/core/v1/readyz", readyz(pool))
	r.Get("/api/core/v1/serviceability", store.Serviceability(pool))
	r.Get("/api/core/v1/stores/{id}", store.PublicGet(pool))
	r.Post("/api/core/v1/auth/register", a.Register)
	r.Post("/api/core/v1/auth/sign-in", a.SignIn)
	r.With(a.RequireCustomer).Post("/api/core/v1/auth/sign-out", a.SignOut)
	r.With(a.RequireCustomer).Get("/api/core/v1/me", a.Me)
	r.With(a.RequireCustomer).Patch("/api/core/v1/me", a.UpdateMe)
	r.With(a.RequireCustomer).Get("/api/core/v1/me/addresses", address.List(pool))
	r.With(a.RequireCustomer).Post("/api/core/v1/me/addresses", address.Create(pool))
	r.With(a.RequireCustomer).Patch("/api/core/v1/me/addresses/{id}", address.Update(pool))
	r.With(a.RequireCustomer).Delete("/api/core/v1/me/addresses/{id}", address.Delete(pool))
	r.Post("/api/core/v1/admin/auth/sign-in", a.StaffSignIn)
	r.With(a.RequireStaff).Post("/api/core/v1/admin/auth/sign-out", a.StaffSignOut)
	r.With(a.RequireStaff).Get("/api/core/v1/admin/me", a.StaffMe)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/staff-users", a.ListStaff)
	r.With(a.RequireAdmin).Post("/api/core/v1/admin/staff-users", a.CreateStaffUser)
	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/staff-users/{id}", a.UpdateStaffUser)
	return r
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// readyz answers 200 when the database answers a ping within 2 seconds, else 503.
func readyz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := pool.Ping(ctx); err != nil {
			slog.WarnContext(r.Context(), "readyz: database ping failed", "err", err, "requestId", httpx.RequestID(r.Context()))
			httpx.WriteError(w, r, &httpx.Error{Status: http.StatusServiceUnavailable, Code: "internal", Message: "database not ready"})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
