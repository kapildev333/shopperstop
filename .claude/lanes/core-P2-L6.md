# core-P2-L6 - demo seed closed out (OpenSpec change core-seed-demo)
Status: started
## Doing
2026-10-13: `core-seed-demo` proposed and validated (`openspec validate --all --strict`); three worker briefs in `tasks.md`; waiting for the manager to launch task 1.
## Found
- Change: `openspec/changes/core-seed-demo/` (proposal; deltas `stock` MODIFIED "Staff list a store's stock" and ADDED "Stock rows carry the product image", `platform` MODIFIED "Local Postman environment" and ADDED "Seed-demo prints the demo sign-ins and fixed ids"; design; tasks). No migration, no new route, no seed row added or changed.
- Audit of Spec 2 §11 (design.md "Audit"): every row is on `main`. Gaps are assertions only (store names, pincodes 560034 and 560038, `is_open`; the demo orders' Home address) and the documentation of the ids (D20).
- Spiked 2026-10-13 on this branch at 4871da1, per-run schemas of `shopperstop_core_test` only (D26), sqlc v1.31.1: all three tasks' code and tests in place, `GOFLAGS=-count=1 make test-core` exit 0; `sqlc generate` rewrote only `internal/stock/db/stock.sql.go`. The tree was restored (`git checkout -- services/ packages/ docs/`, the new `summary.go` removed) before the proposal commit; nothing from the spike is committed.
- Fixed ids, documented from task 2 on in `services/core/internal/seed/summary.go` (`seed.Summary`, printed by `core-admin seed-demo`): staff `...0101` admin, `...0102` Koramangala, `...0103` Indiranagar; customer `...0201`; addresses `...0301` Home, `...0302` Work; stores `...0401` Koramangala, `...0402` Indiranagar; products `...0601` to `...0694` (hex, 148); orders `...0701` delivered, `...0702` cancelled, `...0703` placed. Postman: `storeId` `...0401`, `productId` `...0601`, `addressId` `...0301`, `orderId` `...0703`.
- For admin-P2-L4: `StockRow.imageUrl` is optional, omitted when the product has no image, the same string as `StoreProduct.imageUrl` (`/api/core/v1/files/<key>`); it lands with task 1 together with the regenerated `core.d.ts`.
- Living-spec drift, fixed by this change's platform delta: "Local Postman environment" said `storeId`, `productId`, `addressId`, `orderId` are empty, while the file has carried the fixed ids since #78 and `scripts/postman.test.mjs` requires them.
- Not a defect today, for the manager: Spec 2 §11 says "for local databases only", but `seed-demo --reset` truncates whatever `SHOPPERSTOP_CORE_DATABASE_URL` names. No guard exists and none is added here (design.md Ceilings).
- `catalog.imageURL` becomes exported `catalog.ImageURL` (task 1); `internal/stock` imports `internal/catalog` for it. No import cycle.
## Requests
- to platform (README.md, through the core area plan): the README still calls `seed-demo` "a Phase 1 stub" and says the demo accounts "do not exist" until Phase 2 (lines 9, 16, 48, 58). After this lane merges: drop that wording, and under "Demo sign-ins" say that `core-admin seed-demo --reset` prints the sign-ins and the fixed ids and that they are defined in `services/core/internal/seed/summary.go`. The platform scenario "README lists the demo sign-ins" ends "from Phase 2", which stays true.
- to platform (information): this change MODIFIES the platform requirement "Local Postman environment" (ids no longer "empty") and ADDS "Seed-demo prints the demo sign-ins and fixed ids". A core test reads `docs/postman/local.postman_environment.json` and fails when `storeId`, `productId`, `addressId` or `orderId` changes without the seed.
- to admin (information, through the core area plan): `StockRow.imageUrl` as above; no other shape changes.
## Blockers
None.
