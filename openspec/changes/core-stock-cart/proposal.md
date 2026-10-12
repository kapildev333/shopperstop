# Proposal

## Why
A customer cannot fill a cart and a store cannot be packed from until core knows how many of each product a store holds. Spec 2 §3, §4, §6, §9, §11 and §13 put per-store stock, the stock screens for staff, the customer's one open cart with live totals, and the all-or-nothing stock reservation that order placement (core-P2-L5) runs inside its transaction into this lane (core-P2-L4). The three store-facing catalog reads (`GET /stores/{id}/categories`, `/stores/{id}/products`, `/stores/{id}/products/{slug}`) need the `store_stock` table this change creates for `inStock`, `quantity` (capped at 10 for display, D7) and the "only categories with something in stock" rule; PLAN.md D24 gives them to this lane end to end (core-P2-L3 ships none of them), so they are specified, queried and built here.

## What Changes
- Migration `0005_stock_cart.sql`: `store_stock` (quantity per store and product, at least 0, one row per pair), `carts` (one per customer, pointing at one store), `cart_items` (1 to 20 per product per cart). A product with no stock row at a store has quantity 0.
- `queries/stock.sql` and `queries/cart.sql` with sqlc output in `internal/stock/db` and `internal/cart/db`.
- `internal/stock`: the staff stock list and upsert handlers; `Quantity` (the cart's clamp) and `LowCount` (L5's dashboard); `Reserve(ctx, tx, storeID, lines)` (locks the rows `for update` in product id order, all or nothing, `*OutOfStockError` with the sorted product ids) and `Release` for order placement and cancel.
- `internal/cart`: `GET /me/cart` (live totals from current prices and the store's fees), `PUT /me/cart/items` (set one line; 0 removes; at most 20; clamped to stock with `clamped: true`; a different store replaces the cart with `replaced: true`), `DELETE /me/cart`; `Lines` and `Clear` for order placement.
- `internal/catalog/store.go` (new, owned here per D24): the three customer-facing routes, products carrying `inStock` and `quantity` (capped at 10), categories listed only with an active product in stock at the store, read-only joins on `store_stock` (D24); `ProductsByID` for the cart.
- Routes under `/api/core/v1`: public `GET /stores/{id}/categories`, `GET /stores/{id}/products`, `GET /stores/{id}/products/{slug}`; `GET|PUT /admin/stores/{id}/stock` (admin, or store staff of that store; other store's staff 404), `GET /me/cart`, `PUT /me/cart/items`, `DELETE /me/cart`.
- `core-admin seed-demo --reset` adds stock for every demo product at both demo stores, with deliberate zeros and low counts, identical on every reset (D22).
- `openapi.json`: tags `stock` and `cart` (the store-facing reads go under L3's `catalog` tag, public), every stock and cart operation with `security: [{bearer: []}]`, typed schemas, every error code, examples using the fixed demo ids (D20); new `StoreProduct` (L3's `Product` plus `inStock`, `quantity`) and `StoreProductList`.
- `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` regenerated (D19, D23, mechanical).

Area: core. Capabilities: `stock` (new), `cart` (new), `catalog` (ADDED requirements on top of core-P2-L3's).

Out of scope: order placement, cancel and the dashboard (core-P2-L5 calls `Reserve`, `Release`, `Lines`, `Clear`, `LowCount`); stock history or audit; reservations that outlive a transaction (a cart holds no stock); guest carts (the web app keeps them in `localStorage` and pushes them line by line at sign-in, Spec 2 §7); a configurable low-stock threshold (fixed at 5, Spec 2 §6); stock for inactive products in any customer-facing answer.

## Capabilities

### New Capabilities
- `stock`: per-store stock, the staff stock list and bulk upsert, all-or-nothing reservation and release, demo stock.
- `cart`: one open cart per customer at one store, live totals, set-line semantics with clamping and store replacement, clearing.

### Modified Capabilities
- `catalog`: ADDED requirements: store categories list only what is in stock; store products are listed and searched; store products carry their stock; one store product by slug.

## Impact
- Files: `services/core/` (`migrations/0005_stock_cart.sql`, `sqlc.yaml` two entries, `queries/stock.sql`, `queries/cart.sql`, five queries appended to `queries/catalog.sql`, `internal/{stock,cart}` with `db/`, `internal/catalog/store.go`, `internal/seed`, `internal/app` routes and tests, `openapi.json`), `packages/ui/src/api/core.d.ts` (D19), `docs/postman/shopperstop-core.postman_collection.json` (D23), this change folder, `.claude/lanes/core-P2-L4.md`.
- Cross-area contracts produced: `openapi.json` operations and schemas `StockRow`, `StockList`, `StockUpdate`, `Cart`, `CartLine`, `CartItemSet`, `CartUpdate`, `StoreProduct`, `StoreProductList` (read by web's browsing pages, cart drawer and checkout, admin's Stock page, Postman).
- Cross-area contracts relied on: the `platform` spec (paging, path ids, bearer security), core-P2-L1's `auth`, `httpx`, `pg`, `testdb`, `seed`; core-P2-L2's `stores` table and `store` Go API; core-P2-L3's `products` and `categories` tables, `CategoryNode` with its tree assembly, `pattern`, `imageURL` and the `CategoryTree` schema; the fixed demo ids of L2 and L3 (D20).
- Dependencies: none new.
