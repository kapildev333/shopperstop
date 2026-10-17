// Package app wires the rider service's routes onto the shared httpx router.
package app

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/rider/internal/auth"
	"github.com/kapildev333/shopperstop/services/rider/internal/delivery"
	"github.com/kapildev333/shopperstop/services/rider/internal/httpx"
)

// New returns the rider router. Routes are registered with their full path
// so chi.Walk yields the paths openapi.json documents.
func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, d *delivery.Deliveries) chi.Router {
	r := httpx.NewRouter(origins)
	r.Get("/api/rider/v1/healthz", healthz)
	r.Get("/api/rider/v1/readyz", readyz(pool))
	r.Post("/api/rider/v1/auth/sign-in", a.SignIn)
	r.With(a.RequireRider).Post("/api/rider/v1/auth/sign-out", a.SignOut)
	r.With(a.RequireRider).Get("/api/rider/v1/me", a.Me)
	r.With(a.RequireRider).Put("/api/rider/v1/me/availability", a.PutAvailability)
	r.With(a.RequireStaff).Get("/api/rider/v1/admin/riders", a.ListRiders)
	r.With(a.RequireStaff).Post("/api/rider/v1/admin/riders", a.AdminCreateRider)
	r.With(a.RequireStaff).Get("/api/rider/v1/admin/riders/{id}", a.AdminGetRider)
	r.With(a.RequireStaff).Patch("/api/rider/v1/admin/riders/{id}", a.AdminUpdateRider)
	r.With(a.RequireRider).Get("/api/rider/v1/me/ready-orders", d.ReadyOrders)
	r.With(a.RequireRider).Post("/api/rider/v1/me/deliveries", d.Claim)
	r.With(a.RequireRider).Get("/api/rider/v1/me/deliveries", d.List)
	r.With(a.RequireRider).Get("/api/rider/v1/me/deliveries/{id}", d.Get)
	r.With(a.RequireRider).Post("/api/rider/v1/me/deliveries/{id}/delivered", d.Delivered)
	r.With(a.RequireRider).Put("/api/rider/v1/me/location", d.PutLocation)
	r.With(a.RequireRider).Get("/api/rider/v1/me/offer", d.MyOffer)
	r.With(a.RequireRider).Post("/api/rider/v1/me/offers/{id}/accept", d.AcceptOffer)
	r.With(a.RequireRider).Post("/api/rider/v1/me/offers/{id}/decline", d.DeclineOffer)
	r.Get("/api/rider/v1/orders/{orderId}/delivery", d.OrderDelivery)
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
