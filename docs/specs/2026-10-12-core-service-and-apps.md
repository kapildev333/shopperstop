# Spec 2: Core service, customer site and admin panel

Status: draft for the owner's review, 2026-10-12. Depends on Spec 1 (`2026-10-12-foundation-and-design-system.md`) for layout, stack, orchestration, design tokens and the shared UI package. Decided in brainstorming on 2026-10-12.

## 1. Intent

The first working slice of ShopperStop: a customer enters a pincode, sees the nearest store's catalog and stock, fills a cart, signs in, places a cash-on-delivery order, and watches it move from placed to delivered; store staff pack and hand it over from the admin panel; an admin runs stores, catalog, stock and staff. Everything later services need (orders with frozen prices and address snapshots, per-store stock, a status machine with explicit transitions, bearer sessions that a mobile app can use) exists here in the shape it will keep.

Success: the Playwright flow in §13 passes end to end; the demo seed makes the product usable in two minutes; the API is fully described in `openapi.json`; no screen in the Figma file is missing from the apps.

## 2. Out of scope

Online payment (payment service). Rider assignment, live location, delivery proof (rider service). Receipts, email or SMS (receipt service). Email verification and password reset. Coupons, offers, search ranking, recommendations, wishlists, ratings. Radius-based serviceability. Multiple carts per customer. Scheduled delivery slots. Returns and refunds. Inventory purchasing. Analytics beyond the dashboard counts.

## 3. Domain model

One database, `shopperstop_core`, owned by `shopperstop_core`. Every table has `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` maintained by one trigger. Money is `bigint` cents in INR, never floats. Migration 0001 enables the `citext` extension (emails) and creates the enums and the `updated_at` trigger function. All `slug` columns are unique, lowercase kebab-case, derived server-side from the name on create and never changed on rename (URLs stay stable; a rename only changes `name`).

| Table | Columns beyond the common ones | Rules |
|---|---|---|
| `stores` | `name`, `slug`, `address_line text`, `pincode text`, `lat double precision`, `lng double precision`, `is_open bool`, `delivery_fee_cents`, `free_delivery_above_cents`, `min_order_cents`, `promised_minutes int` | `is_open=false` makes the store non-serviceable (customers see "closed"), existing orders continue |
| `store_service_areas` | `store_id`, `pincode text` | unique `(pincode)`: one pincode maps to exactly one store, so serviceability is a single lookup. Deleting a store cascades |
| `categories` | `name`, `slug`, `image_key text`, `sort_order int`, `parent_id uuid null` | two levels only (a parent has no parent); a category with products or children cannot be deleted (409) |
| `products` | `name`, `slug`, `description text`, `brand text`, `unit_label text` ("500 g", "1 pc"), `mrp_cents`, `price_cents`, `image_key text`, `category_id` (leaf or parent), `is_active bool` | `price_cents <= mrp_cents` check; inactive products are hidden from customers but keep their order history |
| `store_stock` | `store_id`, `product_id`, `quantity int check >= 0` | unique `(store_id, product_id)`; a product with no row at a store is treated as quantity 0 |
| `customers` | `email citext unique`, `password_hash text`, `name text`, `phone text` | `phone` optional, shown to the store on the order |
| `addresses` | `customer_id`, `label text` ("Home"), `line1`, `line2`, `pincode`, `lat null`, `lng null`, `is_default bool` | at most one default per customer (partial unique index); deleting the last address is allowed |
| `carts` | `customer_id`, `store_id` | unique `(customer_id)`: one open cart; changing store replaces it |
| `cart_items` | `cart_id`, `product_id`, `quantity int check > 0` | unique `(cart_id, product_id)`; prices are not stored here |
| `orders` | `number text unique` (`SS-` + 8 upper base32 chars), `customer_id`, `store_id`, `status order_status`, `address jsonb` (label, line1, line2, pincode), `customer_phone text`, `subtotal_cents`, `delivery_fee_cents`, `total_cents`, `payment_method text` (`cod` only), `placed_at`, `delivered_at null`, `cancelled_at null`, `cancel_reason text null` | address and phone are snapshots; totals are computed and stored at placement |
| `order_items` | `order_id`, `product_id`, `name`, `unit_label`, `image_key`, `price_cents`, `mrp_cents`, `quantity` | product fields are snapshots so later product edits never change an order; FK `on delete restrict` (a product that was ever ordered is deactivated, not deleted, see §6) |
| `order_events` | `order_id`, `from_status null`, `to_status`, `actor_type` (`customer`, `staff`, `system`), `actor_id null`, `note text null` | the audit trail shown on tracking and in admin |
| `staff_users` | `email citext unique`, `password_hash`, `name`, `role staff_role` (`admin`, `store_staff`), `store_id uuid null`, `is_active bool` | check `(role = 'admin') = (store_id is null)` |
| `sessions` | `token_hash bytea unique`, `subject_type` (`customer`, `staff`), `subject_id uuid`, `expires_at`, `last_seen_at` | token is 32 random bytes, base64url to the client, `sha256(token || pepper)` stored |

Enum `order_status`: `placed`, `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered`, `cancelled`.

## 4. Order placement, status machine and stock

Placement (`POST /orders`) is one transaction:

1. Load the cart; empty cart is `validation`.
2. Load the address; its pincode must map to the cart's store (`not_serviceable` otherwise) and the store must be open.
3. Lock the `store_stock` rows for the cart's products (`for update`, ordered by product id to avoid deadlocks). Any product inactive or with quantity below the cart quantity fails the whole order with `out_of_stock` and a list of the offending product ids; nothing is partially placed.
4. Subtotal from current `price_cents`; `min_order_cents` violation is `validation` with field `subtotal`; delivery fee is the store's fee, or 0 when subtotal is at or above `free_delivery_above_cents`.
5. Decrement stock, insert order, items (snapshots) and the first `order_events` row, delete the cart.

Transitions, enforced by one table in `internal/order`:

| From | To | Who |
|---|---|---|
| placed | accepted, cancelled | staff; customer may cancel |
| accepted | packing, cancelled | staff; customer may cancel |
| packing | ready | staff |
| ready | out_for_delivery | staff |
| out_for_delivery | delivered | staff |

Anything else is `conflict`. A cancel restores stock in the same transaction and records `cancel_reason`. `delivered` sets `delivered_at`. Every transition writes an `order_events` row. The rider service will later own `out_for_delivery` to `delivered`; the table makes that a one-line change in who, not what.

## 5. Authentication and authorization

- Customers register with `email`, `password` (8 to 72 bytes), `name`. Passwords are bcrypt cost 12 via `x/crypto/bcrypt`. Sign-in returns `{token, customer}`; the token is sent as `Authorization: Bearer <token>` and lives 30 days from last use (`last_seen_at` refreshed at most once an hour). Sign-out deletes the session. Signing in does not revoke other sessions (a phone and a laptop may both be signed in).
- Staff sign in at `POST /admin/auth/sign-in` against `staff_users`, same session table, 12-hour expiry from creation, no sliding. Inactive staff cannot sign in and existing sessions are rejected.
- Middleware: `RequireCustomer`, `RequireStaff`, `RequireAdmin`. Store staff hitting a store or order of another store get `not_found`, never `forbidden`, so store existence does not leak.
- Rate limits, in memory, per process: register and sign-in 10 per email per hour and 100 per IP per hour; `429 rate_limited`.
- Web apps keep the token in memory and `localStorage` (`shopperstop:customer-token`, `shopperstop:staff-token`) and attach it in the generated client. CORS allows `SHOPPERSTOP_CORE_WEB_ORIGINS` only. No cookies anywhere, so the mobile app is the same client with no new auth work.
- Request bodies are limited to 1 MiB (16 MiB on image upload); text fields reject NUL bytes; PATCH bodies reject explicit `null`.

## 6. API, `/api/core/v1`

Public:

| Route | Notes |
|---|---|
| `GET /healthz`, `GET /readyz` | outside the contract; `readyz` pings the database |
| `GET /serviceability?pincode=` | `{store}` or 404 `not_serviceable`; a closed store is 200 with `store.isOpen=false` |
| `GET /stores/{id}` | public store fields only (no fee internals beyond what checkout shows) |
| `GET /stores/{id}/categories` | parents with `children[]`, sorted by `sortOrder`; a category is listed only when it, or one of its children, has at least one active product in stock at that store |
| `GET /stores/{id}/products?categoryId=&q=&page=&pageSize=` | active products; `q` is case-insensitive substring on name and brand (`ilike`), `categoryId` includes children; each product carries `inStock`, `quantity` capped at 10 for display, `priceCents`, `mrpCents`; default sort `name`, `pageSize` 24, max 100 |
| `GET /stores/{id}/products/{slug}` | one product with stock at that store |
| `POST /auth/register`, `POST /auth/sign-in`, `POST /auth/sign-out` | |

Customer session:

| Route | Notes |
|---|---|
| `GET /me`, `PATCH /me` | name, phone |
| `GET /me/addresses`, `POST`, `PATCH /me/addresses/{id}`, `DELETE /me/addresses/{id}` | setting `isDefault` clears the previous default |
| `GET /me/cart` | `{storeId, items[{product, quantity}], subtotalCents, deliveryFeeCents, totalCents, minOrderCents, shortfallCents}` computed live; absent cart is an empty one |
| `PUT /me/cart/items` | `{storeId, productId, quantity}`; `quantity` 0 removes; a different `storeId` from the open cart replaces the cart (`replaced: true` in the response); quantity above stock is clamped and reported `clamped: true`; max 20 per line |
| `DELETE /me/cart` | |
| `POST /orders` | `{addressId}`; see §4; returns the order |
| `GET /orders?page=`, `GET /orders/{id}` | own orders, newest first, with items and events |
| `POST /orders/{id}/cancel` | `{reason}` optional; only while `placed` or `accepted` |

Staff session, under `/admin`:

| Route | Who | Notes |
|---|---|---|
| `POST /admin/auth/sign-in`, `POST /admin/auth/sign-out`, `GET /admin/me` | any staff | |
| `GET /admin/dashboard` | any staff | per visible store: orders today by status, low-stock count (quantity below 5), revenue today in cents (delivered orders) |
| `GET|POST /admin/stores`, `GET|PATCH|DELETE /admin/stores/{id}` | admin | delete only with no orders (409) |
| `GET|PUT /admin/stores/{id}/service-areas` | admin | `PUT` replaces the pincode list; a pincode held by another store is `conflict` with the other store's id |
| `GET|POST /admin/categories`, `PATCH|DELETE /admin/categories/{id}` | admin | |
| `GET|POST /admin/products`, `GET|PATCH|DELETE /admin/products/{id}` | admin | list has `q`, `categoryId`, `isActive`; delete only when never ordered, otherwise deactivate (409 with hint) |
| `PUT /admin/products/{id}/image`, `PUT /admin/categories/{id}/image` | admin | multipart, png/jpeg/webp, 5 MiB, stored under `FILES_DIR/<kind>/<id>.<ext>`, served at `GET /files/{kind}/{name}` |
| `GET|POST /admin/staff-users`, `PATCH /admin/staff-users/{id}` | admin | create takes a password; patch may reset it or set `isActive` |
| `GET /admin/stores/{id}/stock?q=&lowStock=` | admin, own-store staff | every active product with its quantity (0 when no row) |
| `PUT /admin/stores/{id}/stock` | admin, own-store staff | `{rows[{productId, quantity}]}` upsert, max 500 rows |
| `GET /admin/stores/{id}/orders?status=&page=` | admin, own-store staff | with items, customer name and phone, address, events |
| `GET /admin/orders/{id}` | admin, own-store staff | |
| `POST /admin/orders/{id}/status` | admin, own-store staff | `{status, note?}`; §4 table |

Errors: one envelope `{"error": {"code", "message", "field"?}}`, codes `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock` (with `productIds[]`), `not_serviceable`, `rate_limited`, `internal`. Lists return `{items, page, pageSize, total}`. Ids are uuids in paths. `openapi.json` describes every route; a test fails if the router and the contract disagree.

## 7. Customer site, `apps/web`

Routes and what each does; every page has loading, empty and error states from `packages/ui`:

| Route | Page |
|---|---|
| `/` | Home: on first visit a pincode sheet (also reachable from the header pin); then the brand header with search, the category rail, a tile per parent category, and "Picked for you" (first 12 in-stock products). A closed or non-serviceable store shows a full-page notice with the pincode control |
| `/c/{slug}` | Category: child tabs on top, product grid, infinite scroll by page |
| `/p/{slug}` | Product: image, name, unit, price and MRP with savings, description, Stepper; out of stock disables it |
| `/search?q=` | Results grid; empty state suggests categories |
| cart drawer | From the sticky bottom bar (item count, total, "View cart") on phone and the header cart button on desktop: lines with Steppers, fee line, free-delivery nudge (`shortfallCents`), min-order notice, "Proceed to checkout" (sends to sign-in if signed out) |
| `/checkout` | Address list with default selected and an add-address dialog, order summary, "Place order (COD)"; `out_of_stock` highlights the lines and offers to remove them |
| `/orders/{id}` | Tracking: status timeline from events, promised minutes countdown while active, items, address, cancel button while allowed; polls every 10 s while not terminal |
| `/orders` | History, newest first |
| `/account` | Name and phone, addresses, sign out |
| `/sign-in`, `/register` | Email and password forms; after sign-in, return to where the user was |

Store choice: pincode in `localStorage` (`shopperstop:pincode`), resolved to a store on load. Changing pincode to another store clears the local or server cart after a confirm dialog. Guests keep a cart in `localStorage`; at sign-in it is pushed to the server with `PUT /me/cart/items` per line and then discarded. Prices are formatted by `Price` from cents.

## 8. Admin panel, `apps/admin`

| Route | Who | Page |
|---|---|---|
| `/sign-in` | | Email and password |
| `/` | all | Dashboard: a card per visible store with today's counts by status, low-stock count linking to the stock page, revenue today |
| `/orders` | all | Orders board: a column per active status (placed, accepted, packing, ready, out for delivery) with cards (number, time since placed, item count, total, address pincode) and one "next status" button per card; a store selector for admins; delivered and cancelled in a "History" tab as a table; a card opens a detail sheet with items, customer, address, events, cancel with reason |
| `/stock` | all | Stock table (product, unit, price, quantity inline-editable, low-stock badge), search, low-stock filter, store selector for admins; edits are batched and saved with one `PUT` |
| `/stores`, `/stores/{id}` | admin | Table and a form with fees, minimums, promised minutes, open toggle, and the pincode list editor |
| `/categories` | admin | Tree of parents and children with sort order and image upload |
| `/products`, `/products/{id}` | admin | Table with search and filters; form with category, unit, MRP, price, active toggle, image upload |
| `/staff` | admin | Table and create or edit dialog |

The Orders board polls every 10 s and announces new placed orders with `aria-live`. Nav shows only what the role can reach; an unauthorised deep link shows the `not_found` empty state.

## 9. Internal layout, `services/core`

```
cmd/core/main.go            config, pool, router, serve, graceful shutdown
cmd/core-admin/             migrate | seed-demo [--reset] | create-admin <email>
internal/config             env parsing into one struct, fails fast with every missing variable named
internal/pg                 pool, WithTx, error mapping (unique -> conflict, FK restrict -> conflict, not found)
internal/httpx              chi router setup, JSON encode/decode with limits, error envelope, request log (route pattern, not raw path), CORS, rate limiter
internal/auth               passwords, sessions, the three Require middlewares, register and sign-in handlers for both subject types
internal/store              stores, service areas, serviceability
internal/catalog            categories, products, images
internal/stock              store_stock read and upsert; a Reserve(tx, storeID, lines) used only by order
internal/cart               carts and live totals (calls stock and store for prices and fees)
internal/order              placement, transitions table, events, customer and staff handlers
internal/staff              staff users and dashboard
internal/blob               files on disk under FILES_DIR; one interface so S3 is a later package
internal/app                route registration, the contract test, the shared test server
internal/seed               demo data
internal/testdb             per-package test schema on the _test database
```

Each domain package exposes a small Go API (functions taking `context.Context` and a `pgx.Tx` or the pool) and its own handlers; packages never run SQL against another package's tables. sqlc output lives in `internal/<pkg>/db`.

## 10. Configuration

`SHOPPERSTOP_CORE_DATABASE_URL`, `SHOPPERSTOP_CORE_ADDR`, `SHOPPERSTOP_CORE_SESSION_PEPPER` (at least 32 bytes), `SHOPPERSTOP_CORE_FILES_DIR`, `SHOPPERSTOP_CORE_WEB_ORIGINS` (comma list), `SHOPPERSTOP_CORE_LOG_LEVEL` (default info). Tests use `SHOPPERSTOP_CORE_TEST_DATABASE_URL`.

## 11. Demo seed

`core-admin seed-demo --reset` loads, for local databases only: two stores, both open ("Koramangala" pincodes 560034 and 560095, "Indiranagar" pincodes 560038 and 560008), 12 parent categories with 2 to 4 children each, about 150 products with committed placeholder images, stock at both stores with a few deliberate zeros and low counts, staff `admin@shopperstop.local` / `admin12345` (admin), `koramangala@shopperstop.local` and `indiranagar@shopperstop.local` / `staff12345` (store staff), customer `demo@shopperstop.local` / `demo12345` with two addresses and three past orders in different states. The README lists these.

## 12. Observability

`log/slog` JSON to stdout: one line per request (method, route pattern, status, duration, subject type and id when signed in), one per order transition, errors with the request id. `X-Request-Id` is accepted or generated and echoed. No metrics endpoint in this phase.

## 13. Testing

- Go: `go test -race` against the `_test` database with a fresh schema per package. Per package: the domain API with real SQL. In `internal/app`: every route through the real router with a test server (status codes, envelopes, auth gates for each of the three subject types), the contract test against `openapi.json`, and the order tests: placement with concurrent orders racing for the last unit (exactly one succeeds), each allowed and forbidden transition, cancel restores stock, store-staff isolation (other store is 404).
- Web: Vitest and Testing Library on components and on the cart reducer (guest merge, clamping, store change); `no-literal-colors.test.ts` in both apps; typecheck and lint.
- e2e, Playwright, against built apps and a real core and database on scratch ports: register, enter pincode, browse a category, add two products, change a quantity, sign out and back in to see the cart merged, checkout with a new address, see the order placed; in the admin app sign in as store staff, see the order on the board, advance it to delivered; back as the customer, tracking shows delivered. A second test: admin creates a product and sets stock, customer finds it by search. `@axe-core/playwright` on each page visited.
- CI runs all three. The e2e database is `shopperstop_core_e2e`.

## 14. Deferred, with triggers

| Item | Trigger |
|---|---|
| Online payment, order `payment_status` | payment service spec |
| Rider assignment, `out_for_delivery` owned by a rider, live location | rider service spec |
| Receipts, email and SMS notifications | receipt service spec |
| Email verification, password reset | with the payment service (money needs a verified account) |
| Coupons, search ranking, recommendations | catalog above 500 products or the owner asks |
| Radius serviceability, multiple stores per pincode | a city with more than three stores |
| Scheduled delivery slots | the owner asks |
| Product variants (sizes) | a product with more than two unit sizes in the seed |
| S3 image storage | first deploy off a laptop (`blob` interface is ready) |
| Metrics endpoint | first deploy |

## 15. Decisions needing the owner's call

1. Cancel window: customers may cancel while `placed` or `accepted`. Should packing also be cancellable by the customer, or only by staff?
2. Display quantity is capped at 10 in customer responses ("10+ left"); exact counts stay in admin. Keep?
3. Demo city is Bengaluru pincodes with INR. Confirm, or name another city.
4. Store staff see the whole order including the customer's phone (they need it for handover). Confirm.
