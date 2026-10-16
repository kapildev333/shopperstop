// Package seed loads the demo data of Spec 2 §11 for `core-admin seed-demo`:
// accounts, stores, catalog, stock and orders, all with fixed ids (PLAN.md D20,
// D22). Summary documents the sign-ins and the ids. It is the one package
// allowed to write other packages' tables.
//
// Later lanes extend it in two places: add the table to truncateTables, and
// add its rows to load after the rows they reference.
package seed

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kapildev333/shopperstop/services/core/internal/auth"
)

// truncateTables is every table Reset empties, in one statement. Later lanes add theirs here.
var truncateTables = []string{"sessions", "addresses", "customers", "staff_users", "store_service_areas", "stores",
	// catalog (core-P2-L3)
	"products", "categories",
	// stock and cart (core-P2-L4)
	"store_stock", "carts", "cart_items",
	// orders (core-P2-L5)
	"order_events", "order_items", "orders",
}

// Fixed ids and values of design Decision 22. Later lanes take their ids from
// the ranges Decision 22 reserves.
const (
	adminID          = "00000000-0000-4000-8000-000000000101"
	customerID       = "00000000-0000-4000-8000-000000000201"
	homeID           = "00000000-0000-4000-8000-000000000301"
	workID           = "00000000-0000-4000-8000-000000000302"
	storeKoramangala = "00000000-0000-4000-8000-000000000401"
	storeIndiranagar = "00000000-0000-4000-8000-000000000402"
	staffKoramangala = "00000000-0000-4000-8000-000000000102"
	staffIndiranagar = "00000000-0000-4000-8000-000000000103"
	adminEmail       = "admin@shopperstop.local"
	adminPass        = "admin12345"
	customerEmail    = "demo@shopperstop.local"
	customerPass     = "demo12345"
	staffPass        = "staff12345"
)

// hashes are the bcrypt hashes of the demo passwords, computed before any
// transaction opens so the truncate lock is not held during the hashing.
// The two store-staff users share one hash (design Decision 12).
type hashes struct {
	admin, customer, staff string
}

// hashDemo is computed once per process: the demo passwords are public constants, so caching across resets is correct.
var hashDemo = sync.OnceValues(computeHashes)

func computeHashes() (hashes, error) {
	admin, err := auth.HashPassword(adminPass)
	if err != nil {
		return hashes{}, fmt.Errorf("hash demo admin password: %w", err)
	}
	customer, err := auth.HashPassword(customerPass)
	if err != nil {
		return hashes{}, fmt.Errorf("hash demo customer password: %w", err)
	}
	staff, err := auth.HashPassword(staffPass)
	if err != nil {
		return hashes{}, fmt.Errorf("hash demo store staff password: %w", err)
	}
	return hashes{admin: admin, customer: customer, staff: staff}, nil
}

// Reset empties the demo tables and loads the demo rows, in one transaction.
// Sessions go with the accounts they belong to.
func Reset(ctx context.Context, pool *pgxpool.Pool) error {
	h, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, "truncate "+strings.Join(truncateTables, ", ")); err != nil {
			return fmt.Errorf("truncate demo tables: %w", err)
		}
		return load(ctx, tx, h)
	})
}

// Load inserts the demo rows into a database that holds none of them. A row
// that already exists is an error (duplicate key), and the transaction rolls
// back, so nothing is left half-loaded.
func Load(ctx context.Context, pool *pgxpool.Pool) error {
	h, err := hashDemo()
	if err != nil {
		return err
	}
	return pgx.BeginFunc(ctx, pool, func(tx pgx.Tx) error {
		return load(ctx, tx, h)
	})
}

// load inserts every demo row in dependency order. Later lanes add their
// inserts here, after the rows they reference.
func load(ctx context.Context, tx pgx.Tx, h hashes) error {
	if _, err := tx.Exec(ctx,
		"insert into staff_users (id, email, password_hash, name, role) values ($1, $2, $3, 'Admin', 'admin')",
		adminID, adminEmail, h.admin); err != nil {
		return fmt.Errorf("insert demo admin: %w", err)
	}
	if _, err := tx.Exec(ctx,
		"insert into customers (id, email, password_hash, name, phone) values ($1, $2, $3, 'Demo Customer', '+919800000000')",
		customerID, customerEmail, h.customer); err != nil {
		return fmt.Errorf("insert demo customer: %w", err)
	}
	if _, err := tx.Exec(ctx, `insert into addresses (id, customer_id, label, line1, pincode, is_default) values
		($1, $3, 'Home', '12 80 Feet Rd, Koramangala', '560034', true),
		($2, $3, 'Work', '100 Feet Rd, Indiranagar', '560038', false)`,
		homeID, workID, customerID); err != nil {
		return fmt.Errorf("insert demo addresses: %w", err)
	}
	if _, err := tx.Exec(ctx, `insert into stores (id, name, address_line, pincode, is_open, delivery_fee_cents, free_delivery_above_cents, min_order_cents, promised_minutes) values
		($1, 'Koramangala', '80 Feet Rd, Koramangala', '560034', true, 2500, 19900, 9900, 10),
		($2, 'Indiranagar', '100 Feet Rd, Indiranagar', '560038', true, 2500, 19900, 9900, 12)`,
		storeKoramangala, storeIndiranagar); err != nil {
		return fmt.Errorf("insert demo stores: %w", err)
	}
	if _, err := tx.Exec(ctx, `insert into store_service_areas (store_id, pincode) values
		($1, '560034'), ($1, '560095'), ($2, '560038'), ($2, '560008')`,
		storeKoramangala, storeIndiranagar); err != nil {
		return fmt.Errorf("insert demo service areas: %w", err)
	}
	if _, err := tx.Exec(ctx, `insert into staff_users (id, email, password_hash, name, role, store_id) values
		($1, 'koramangala@shopperstop.local', $3, 'Koramangala Staff', 'store_staff', $4),
		($2, 'indiranagar@shopperstop.local', $3, 'Indiranagar Staff', 'store_staff', $5)`,
		staffKoramangala, staffIndiranagar, h.staff, storeKoramangala, storeIndiranagar); err != nil {
		return fmt.Errorf("insert demo store staff: %w", err)
	}
	// catalog (core-P2-L3)
	if err := loadCatalog(ctx, tx); err != nil {
		return err
	}
	// stock (core-P2-L4, design Decision 15): one row per store and product. Fixed
	// ids order the rows, so every reset loads the same quantities: per store a
	// zero and a 1 to 4 every 15 products, the rest 10 to 49.
	if _, err := tx.Exec(ctx, `insert into store_stock (store_id, product_id, quantity)
		select s.id, p.id,
		       case (p.n + 3 * s.k) % 15
		           when 0 then 0
		           when 7 then 1 + p.n % 4
		           else 10 + (7 * p.n + 5 * s.k) % 40
		       end
		from (select id, row_number() over (order by id) - 1 as k from stores) s
		cross join (select id, row_number() over (order by id) as n from products) p`); err != nil {
		return fmt.Errorf("insert demo stock: %w", err)
	}
	// orders (core-P2-L5, design Decision 15): three demo orders of the demo
	// customer at Koramangala, their items, totals and events.
	if _, err := tx.Exec(ctx, `
-- 1. orders ($1 customer ...0201, $2 store ...0401); totals filled by statement 3
insert into orders (id, number, customer_id, store_id, store_name, promised_minutes, status, customer_name, customer_phone,
                    address_label, address_line1, address_pincode,
                    subtotal_cents, delivery_fee_cents, total_cents, placed_at, delivered_at, cancelled_at, cancel_reason)
values
  ('00000000-0000-4000-8000-000000000701', 'SS-DEMOAAAB', $1, $2, 'Koramangala', 10, 'delivered', 'Demo Customer', '+919800000000',
   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '2 days', now() - interval '2 days' + interval '11 minutes', null, ''),
  ('00000000-0000-4000-8000-000000000702', 'SS-DEMOAAAC', $1, $2, 'Koramangala', 10, 'cancelled', 'Demo Customer', '+919800000000',
   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '1 day', null, now() - interval '1 day' + interval '2 minutes', 'Ordered by mistake'),
  ('00000000-0000-4000-8000-000000000703', 'SS-DEMOAAAD', $1, $2, 'Koramangala', 10, 'placed', 'Demo Customer', '+919800000000',
   'Home', '12 80 Feet Rd, Koramangala', '560034', 0, 0, 0, now() - interval '10 minutes', null, null, '');
`, customerID, storeKoramangala); err != nil {
		return fmt.Errorf("insert demo orders: %w", err)
	}
	if _, err := tx.Exec(ctx, `
-- 2. items, snapshots from the demo products
insert into order_items (order_id, product_id, name, unit_label, image_url, price_cents, mrp_cents, quantity)
select l.order_id::uuid, p.id, p.name, p.unit_label,
       case when p.image_key = '' then '' else '/api/core/v1/files/' || p.image_key end,
       p.price_cents, p.mrp_cents, l.quantity
from (values
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000601', 2),
  ('00000000-0000-4000-8000-000000000701', '00000000-0000-4000-8000-000000000602', 1),
  ('00000000-0000-4000-8000-000000000702', '00000000-0000-4000-8000-000000000603', 1),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000601', 1),
  ('00000000-0000-4000-8000-000000000703', '00000000-0000-4000-8000-000000000604', 3)
) as l (order_id, product_id, quantity)
join products p on p.id = l.product_id::uuid;
`); err != nil {
		return fmt.Errorf("insert demo order items: %w", err)
	}
	if _, err := tx.Exec(ctx, `
-- 3. totals from the items and the store's fee rule
update orders o
set subtotal_cents = t.subtotal,
    delivery_fee_cents = case when t.subtotal >= s.free_delivery_above_cents then 0 else s.delivery_fee_cents end,
    total_cents = t.subtotal + case when t.subtotal >= s.free_delivery_above_cents then 0 else s.delivery_fee_cents end
from (select order_id, sum(price_cents * quantity)::bigint as subtotal from order_items group by order_id) t, stores s
where t.order_id = o.id and s.id = o.store_id and o.number like 'SS-DEMO%';
`); err != nil {
		return fmt.Errorf("set demo order totals: %w", err)
	}
	if _, err := tx.Exec(ctx, `
-- 4. events ($1 the Koramangala store staff ...0102 as the staff actor)
insert into order_events (order_id, from_status, to_status, actor_type, actor_id, note, created_at)
select o.id, e.from_status::order_status, e.to_status::order_status, e.actor_type,
       case e.actor_type when 'customer' then o.customer_id when 'staff' then $1::uuid end,
       e.note, o.placed_at + e.after
from (values
  ('00000000-0000-4000-8000-000000000701', null, 'placed', 'customer', '', interval '0'),
  ('00000000-0000-4000-8000-000000000701', 'placed', 'accepted', 'staff', '', interval '1 minute'),
  ('00000000-0000-4000-8000-000000000701', 'accepted', 'packing', 'staff', '', interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000701', 'packing', 'ready', 'staff', '', interval '5 minutes'),
  ('00000000-0000-4000-8000-000000000701', 'ready', 'out_for_delivery', 'staff', '', interval '6 minutes'),
  ('00000000-0000-4000-8000-000000000701', 'out_for_delivery', 'delivered', 'staff', '', interval '11 minutes'),
  ('00000000-0000-4000-8000-000000000702', null, 'placed', 'customer', '', interval '0'),
  ('00000000-0000-4000-8000-000000000702', 'placed', 'cancelled', 'customer', 'Ordered by mistake', interval '2 minutes'),
  ('00000000-0000-4000-8000-000000000703', null, 'placed', 'customer', '', interval '0')
) as e (order_id, from_status, to_status, actor_type, note, after)
join orders o on o.id = e.order_id::uuid;
`, staffKoramangala); err != nil {
		return fmt.Errorf("insert demo order events: %w", err)
	}
	return nil
}
