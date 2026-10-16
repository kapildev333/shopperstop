// Package staff serves the staff dashboard.
package staff

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
	"github.com/kapildev333/shopperstop/services/core/internal/httpx"
	"github.com/kapildev333/shopperstop/services/core/internal/order"
	"github.com/kapildev333/shopperstop/services/core/internal/stock"
	"github.com/kapildev333/shopperstop/services/core/internal/store"
)

// DashboardStore is one store's line of the dashboard: whether it is open, today's
// orders by status, the low-stock count and today's delivered revenue.
type DashboardStore struct {
	StoreID           string           `json:"storeId"`
	StoreName         string           `json:"storeName"`
	IsOpen            bool             `json:"isOpen"`
	OrdersToday       map[string]int64 `json:"ordersToday"` // seven keys
	LowStockCount     int64            `json:"lowStockCount"`
	RevenueTodayCents int64            `json:"revenueTodayCents"`
}

// dashboard is the GET /admin/dashboard body.
type dashboard struct {
	Items []DashboardStore `json:"items"` // never nil
}

// Dashboard answers 200 with one line per store. An admin gets every store, by
// name; any other staff role gets only its own store.
func Dashboard(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		s := auth.CurrentStaff(ctx)
		var stores []store.Store
		if s.Role == "admin" {
			all, err := store.All(ctx, pool)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			stores = all
		} else {
			one, err := store.Get(ctx, pool, s.StoreID)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			stores = []store.Store{one}
		}
		items := make([]DashboardStore, 0, len(stores))
		for _, st := range stores {
			byStatus, revenue, err := order.Today(ctx, pool, st.ID)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			low, err := stock.LowCount(ctx, pool, st.ID)
			if err != nil {
				httpx.WriteError(w, r, err)
				return
			}
			items = append(items, DashboardStore{
				StoreID: st.ID, StoreName: st.Name, IsOpen: st.IsOpen, OrdersToday: byStatus,
				LowStockCount: low, RevenueTodayCents: revenue,
			})
		}
		httpx.WriteJSON(w, http.StatusOK, dashboard{Items: items})
	}
}
