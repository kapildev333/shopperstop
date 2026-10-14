package order

import (
	"testing"

	"github.com/kapildev333/shopperstop/services/core/internal/order/db"
)

// TestAllowed: over every ordered pair of statuses, staff may make exactly the
// seven moves of the table and customers only the two cancels.
func TestAllowed(t *testing.T) {
	staff := map[[2]db.OrderStatus]bool{
		{db.OrderStatusPlaced, db.OrderStatusAccepted}:          true,
		{db.OrderStatusPlaced, db.OrderStatusCancelled}:         true,
		{db.OrderStatusAccepted, db.OrderStatusPacking}:         true,
		{db.OrderStatusAccepted, db.OrderStatusCancelled}:       true,
		{db.OrderStatusPacking, db.OrderStatusReady}:            true,
		{db.OrderStatusReady, db.OrderStatusOutForDelivery}:     true,
		{db.OrderStatusOutForDelivery, db.OrderStatusDelivered}: true,
	}
	customer := map[[2]db.OrderStatus]bool{
		{db.OrderStatusPlaced, db.OrderStatusCancelled}:   true,
		{db.OrderStatusAccepted, db.OrderStatusCancelled}: true,
	}
	all := db.AllOrderStatusValues()
	if len(all) != 7 {
		t.Fatalf("%d statuses, want 7", len(all))
	}
	for _, from := range all {
		for _, to := range all {
			pair := [2]db.OrderStatus{from, to}
			if got := allowed(from, to, "staff"); got != staff[pair] {
				t.Errorf("staff %s to %s: allowed %v, want %v", from, to, got, staff[pair])
			}
			if got := allowed(from, to, "customer"); got != customer[pair] {
				t.Errorf("customer %s to %s: allowed %v, want %v", from, to, got, customer[pair])
			}
		}
	}
}
