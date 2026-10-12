# core-P2-L2 - stores and serviceability (OpenSpec change core-stores-serviceability)
Status: started
## Doing
Change proposed and valid (`openspec validate core-stores-serviceability --strict`; `--all --strict` 6 passed). Waiting for core-P2-L1 on main, the rebase, and the manager to launch task 1. Tasks 1 to 5 run in order on this branch.
## Found
- Change: `openspec/changes/core-stores-serviceability/` (proposal; deltas `serviceability` and `admin-stores` new, `admin-staff` ADDED; design; tasks). design.md holds `0003_stores.sql`, the `sqlc.yaml` block and `queries/store.sql` verbatim, spiked 2026-10-12 on a scratch copy of L1's branch (b68fb55) with sqlc v1.31.1 against `shopperstop_core_test`.
- Migration number: this lane owns `0003_stores.sql`.
- Answers to core-P2-L1's requests: (1) `staff_users_store_id_fkey` added in 0003 as `not valid` (old orphan rows in dev/e2e databases cannot fail `migrate`; every new row is checked; design Decision 6); (2) `auth.CreateStaff` maps 23503 to 400 `validation` field `storeId` "no such store" (task 5, one branch in L1's `staff.go`); (3) store staff `...0102` koramangala@ and `...0103` indiranagar@ with `staff12345` seeded (task 5).
- Consequence for L1's tests: after 0003 any fixture inserting store staff with an invented store id fails; task 1 inserts a store first in those fixtures (no assertion changes).
- Fixed demo ids: stores Koramangala `00000000-0000-4000-8000-000000000401` (serves 560034, 560095), Indiranagar `00000000-0000-4000-8000-000000000402` (serves 560038, 560008); both open, fee 2500, free above 19900, min order 9900, 10 and 12 minutes.
- Go API for later core lanes (`internal/store`): `Get(ctx, q db.DBTX, id) (Store, error)` (404 not_found), `ForPincode(ctx, q db.DBTX, pincode) (Store, error)` (404 not_serviceable); `Store` = `{id, name, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`.
- For admin-P2-L2 and web-P2-L1: schemas `Store` (public), `AdminStore` (+ `addressLine`, `pincode`), `StoreCreate`, `StorePatch`, `StoreList`, `Serviceability {store}`, `ServiceAreas {pincodes}`, `PincodeConflict` (409 `{error:{code:"conflict", message, field:"pincodes", pincode, storeId}}`). New stores start closed. Store staff get 403 on every `/admin/stores*` route. A store with staff users cannot be deleted (409).
- No store `slug`, `lat`, `lng` (design Decision 2; escalated in the report).
## Requests
- to core-P2-L5: declare `orders.store_id references stores (id)` with no `on delete` clause; the store delete then answers 409 for a store with orders with no code change (design Decision 5). Add a scenario for it to your delta (an ADDED `admin-stores` requirement such as "Stores with orders are kept"). For placement use `store.ForPincode(ctx, tx, address.pincode)`, compare its id with the cart's store and check `IsOpen`.
- to core-P2-L4: recommend `store_stock.store_id` and `carts.store_id` `references stores (id) on delete cascade`; cart totals read fees from `store.Get(ctx, q, storeID)`.
- to platform (via the core area plan): `docs/postman/local.postman_environment.json` `storeId` = `00000000-0000-4000-8000-000000000401` (D20). Same `make postman` dependency as core-P2-L1's escalation (folder-count assertion; committing the collection from a core PR).
## Blockers
- Workers wait for core-P2-L1 on main and the rebase of this branch.
