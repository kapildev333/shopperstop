# admin-P2-L3-T1 - products table (worker, task 1 of admin-catalog)
Status: started
## Doing
Commit 1 (`test: catalog pages against core`) done. Commit 2 (`test: products table`) red. Next: the code (`feat: products table with search, filters and pager`).
## Found
- Red run (`npm run test --workspace apps/admin -- --run`, before the code): `Tests  6 failed | 52 passed (58)`, `Test Files  1 failed | 9 passed (10)`. Failing: "products table lists a page of products", "search and filters ask core again from the first page", "the pager moves between pages", "no products shows the empty state", "products table shows a skeleton while loading", "products load failure shows a retry that reloads". Each fails on the missing page (no table "Products", no role="alert", no role="status" "Loading", no "No products found" heading), not on a compile error.
## Requests
None.
## Blockers
None.
