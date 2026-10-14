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
	"github.com/kapildev333/shopperstop/services/core/internal/blob"
	"github.com/kapildev333/shopperstop/services/core/internal/cart"
	"github.com/kapildev333/shopperstop/services/core/internal/catalog"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// New returns the core router. Routes are registered with their full path
// so chi.Walk yields the paths openapi.json documents.
// Uploaded files go to files.
func New(pool *pgxpool.Pool, origins []string, a *auth.Auth, files blob.Store) chi.Router {
	r := httpx.NewRouter(origins)
	r.Get("/api/core/v1/healthz", healthz)
	r.Get("/api/core/v1/readyz", readyz(pool))
	r.Get("/api/core/v1/serviceability", store.Serviceability(pool))
	r.Get("/api/core/v1/stores/{id}", store.PublicGet(pool))
	r.Get("/api/core/v1/stores/{id}/categories", catalog.StoreCategories(pool))
	r.Get("/api/core/v1/stores/{id}/products", catalog.StoreProducts(pool))
	r.Get("/api/core/v1/stores/{id}/products/{slug}", catalog.StoreProductBySlug(pool))
	r.Post("/api/core/v1/auth/register", a.Register)
	r.Post("/api/core/v1/auth/sign-in", a.SignIn)
	r.With(a.RequireCustomer).Post("/api/core/v1/auth/sign-out", a.SignOut)
	r.With(a.RequireCustomer).Get("/api/core/v1/me", a.Me)
	r.With(a.RequireCustomer).Patch("/api/core/v1/me", a.UpdateMe)
	r.With(a.RequireCustomer).Get("/api/core/v1/me/addresses", address.List(pool))
	r.With(a.RequireCustomer).Post("/api/core/v1/me/addresses", address.Create(pool))
	r.With(a.RequireCustomer).Patch("/api/core/v1/me/addresses/{id}", address.Update(pool))
	r.With(a.RequireCustomer).Delete("/api/core/v1/me/addresses/{id}", address.Delete(pool))
	r.With(a.RequireCustomer).Get("/api/core/v1/me/cart", cart.Get(pool))
	r.With(a.RequireCustomer).Put("/api/core/v1/me/cart/items", cart.PutItem(pool))
	r.With(a.RequireCustomer).Delete("/api/core/v1/me/cart", cart.Delete(pool))
	r.Post("/api/core/v1/admin/auth/sign-in", a.StaffSignIn)
	r.With(a.RequireStaff).Post("/api/core/v1/admin/auth/sign-out", a.StaffSignOut)
	r.With(a.RequireStaff).Get("/api/core/v1/admin/me", a.StaffMe)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/staff-users", a.ListStaff)
	r.With(a.RequireAdmin).Post("/api/core/v1/admin/staff-users", a.CreateStaffUser)
	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/staff-users/{id}", a.UpdateStaffUser)
	c := catalog.New(pool, files)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/categories", c.ListCategories)
	r.With(a.RequireAdmin).Post("/api/core/v1/admin/categories", c.CreateCategory)
	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/categories/{id}", c.UpdateCategory)
	r.With(a.RequireAdmin).Delete("/api/core/v1/admin/categories/{id}", c.DeleteCategory)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/products", c.ListProducts)
	r.With(a.RequireAdmin).Post("/api/core/v1/admin/products", c.CreateProduct)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/products/{id}", c.GetProduct)
	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/products/{id}", c.UpdateProduct)
	r.With(a.RequireAdmin).Delete("/api/core/v1/admin/products/{id}", c.DeleteProduct)
	r.With(a.RequireAdmin).Put("/api/core/v1/admin/categories/{id}/image", c.PutCategoryImage)
	r.With(a.RequireAdmin).Put("/api/core/v1/admin/products/{id}/image", c.PutProductImage)
	r.Get("/api/core/v1/files/{kind}/{name}", c.File)
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/stores", store.List(pool))
	r.With(a.RequireAdmin).Post("/api/core/v1/admin/stores", store.Create(pool))
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/stores/{id}", store.AdminGet(pool))
	r.With(a.RequireAdmin).Patch("/api/core/v1/admin/stores/{id}", store.Update(pool))
	r.With(a.RequireAdmin).Delete("/api/core/v1/admin/stores/{id}", store.Delete(pool))
	r.With(a.RequireAdmin).Get("/api/core/v1/admin/stores/{id}/service-areas", store.ServiceAreas(pool))
	r.With(a.RequireAdmin).Put("/api/core/v1/admin/stores/{id}/service-areas", store.ReplaceServiceAreas(pool))
	r.With(a.RequireStaff).Get("/api/core/v1/admin/stores/{id}/stock", stock.List(pool))
	r.With(a.RequireStaff).Put("/api/core/v1/admin/stores/{id}/stock", stock.Put(pool))
	r.With(a.RequireCustomer).Post("/api/core/v1/orders", order.Create(pool))
	r.With(a.RequireCustomer).Get("/api/core/v1/orders", order.List(pool))
	r.With(a.RequireCustomer).Get("/api/core/v1/orders/{id}", order.Get(pool))
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
