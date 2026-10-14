# Proposal

## Why
core-P2-L1 to L5 each seeded their own demo data (PLAN.md D22), so most of Spec 2 §11 is on `main`. This change, core-P2-L6 and the last core lane of Phase 2 (Spec 2 §11, §13; PLAN.md D19, D20, D22, D23, D26), closes what is left: the fixed demo ids are seeded but documented nowhere a developer reads, `core-admin seed-demo` still reports "demo accounts loaded" and names two of the four accounts, nothing ties `docs/postman/local.postman_environment.json` to the seeded rows, the admin stock page has no product image to show (admin-P2-L4's request), and three tests deferred from core-P2-L5's acceptance assert less than their scenarios say.

## What Changes
- Audit of Spec 2 §11 against the landed seed (design.md "Audit"): no demo row is missing and no seed data changes. Two under-asserted points get assertions (store names, all four pincodes and `is_open`; the demo orders' Home address).
- `internal/seed/summary.go`: `seed.Summary`, the one documented list of the four demo sign-ins and the twelve fixed ids (D20). `core-admin seed-demo` prints it after a successful load instead of the stale three lines.
- `TestSummaryMatchesSeed`: every printed sign-in works, every printed id is one row of the table printed beside it, and the four ids marked `Postman` equal `storeId`, `productId`, `addressId`, `orderId` in `docs/postman/local.postman_environment.json` (read only).
- `StockRow` gains optional `imageUrl` on `GET /admin/stores/{id}/stock`: omitted when the product has no image, the same value as `StoreProduct.imageUrl`. `openapi.json`, regenerated `packages/ui/src/api/core.d.ts` (D19) and the Postman collection (D23) in the same commit.
- Three test-only tightenings from core-P2-L5's acceptance: `TestOrderSnapshotsSurviveProductChange` changes the product through `PATCH /admin/products/{id}`; `TestStoreStaffOwnOrder` asserts the body of `GET /admin/orders/{id}`; `TestResetLoadsDemoOrders` asserts the demo orders' address.

Area: core. Capabilities: `stock` (MODIFIED "Staff list a store's stock", ADDED "Stock rows carry the product image"), `platform` (MODIFIED "Local Postman environment", whose text still said the four id variables are empty; ADDED "Seed-demo prints the demo sign-ins and fixed ids").

Out of scope: new routes; any migration; any change to the seeded rows (148 products and 12 shared placeholder images are recorded decisions, not gaps); `README.md` (platform's file: a request, see the lane log); a guard that refuses `seed-demo` on a non-local database (Spec 2 §11 "for local databases only" is documentation today; deferred to the first deploy off a laptop); listing the category ids; images on any other admin shape.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `stock`: MODIFIED "Staff list a store's stock" (the row shape names `imageUrl`); ADDED "Stock rows carry the product image".
- `platform`: MODIFIED "Local Postman environment" (the four id variables hold the fixed demo ids); ADDED "Seed-demo prints the demo sign-ins and fixed ids".

## Impact
- Files: `services/core/` (`queries/stock.sql`, generated `internal/stock/db/stock.sql.go`, `internal/stock/handlers.go`, `internal/catalog/catalog.go` (one function exported), `internal/seed/summary.go` (new), `internal/seed/seed.go` (package comment), `internal/seed/seed_test.go`, `cmd/core-admin/main.go`, `cmd/core-admin/main_test.go`, `internal/app/stock_test.go`, `internal/app/orders_test.go`, `internal/app/orders_staff_test.go`, `openapi.json`), `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json` (generated, D19, D23), this change folder, `.claude/lanes/core-P2-L6.md`.
- Cross-area contract produced: `openapi.json` schema `StockRow` gains optional `imageUrl` (additive; admin-P2-L4 reads it).
- Cross-area contracts relied on: `docs/postman/local.postman_environment.json` (platform's file, read by one core test, never written); the `platform` spec (paging, envelope, bearer security).
- Core contracts relied on (earlier lanes): the seeded rows and their ids (L1 to L5), `catalog`'s image URL rule (L3), `PATCH /admin/products/{id}` (L3), `GET /admin/orders/{id}` (L5).
- Dependencies: none new. Migrations: none.
