# Design (draft, incomplete: resume per `.claude/lanes/admin-P2-L3.md`)

## Context
Base: origin/main 99195d9 (core-P2-L3 catalog merged) plus admin-P2-L2 `admin-stores` (not yet merged; read from `.worktrees/admin-P2-L2` at 9f65c7d). Spike 2026-10-12: scratch tree = main + L2's `apps/admin`, Node 22.23.3, `npm ci`; every file in `spike.patch` (this folder, a `git diff` against main + admin-stores, `routeTree.gen.ts` excluded: regenerate with `vite build`). Gates on the spike: `tsc` clean, `eslint .` clean, Vitest 14 files / 84 tests (L2's 52 + 32 here) three runs green, `vite build` ok; `e2e/catalog.spec.ts` 2 passed on a scratch preview port (25174) against a stateful `page.route` fake core with axe clean on every page and dialog. The real-core e2e is the last task's. `spike.patch` is a design input: it is folded into this file (or applied by workers per task) and deleted before the PR.

## Assumptions (to recheck in task 0 after the rebase)
| # | Assumption | Status on 99195d9 |
|---|---|---|
| A1 | paths `/admin/categories` (get, post), `/admin/categories/{id}` (patch, delete), `/admin/categories/{id}/image` (put), `/admin/products` (get, post), `/admin/products/{id}` (get, patch, delete), `/admin/products/{id}/image` (put) | matches core.d.ts |
| A2 | schemas Category, CategoryNode (+ `children`), CategoryTree `{items}`, Product (`imageUrl?`, `brand?`, `description?`), ProductList `{items,page,pageSize,total}` | matches |
| A3 | list query `q`, `categoryId`, `isActive` `'true'|'false'`, `page`, `pageSize` (default 24, max 100), ordered by name | matches |
| A4 | ProductCreate: core accepts `brand`/`description` `""` (checkText min 0); `isActive` default true; limits name 1-100, brand 0-60, description 0-2000, unit 1-30, mrp 1-100000000 cents, price 1..mrp | matches `internal/catalog/products.go` |
| A5 | PATCH members optional, `null` refused, `""` clears brand/description; category PATCH only name/sortOrder (0-9999) | matches |
| A6 | 409 `conflict`: category with children/products; product referenced by an order line | matches |
| A7 | image PUT: multipart part `file`, 200 answers the row, `imageUrl` = `/api/core/v1/files/<kind>/<id>.<ext>`; 400 `validation` field `file` | matches; `/files` sits under `/api`, so the existing dev/preview `/api` proxies serve it: no vite or Playwright config change |
| A8 | 403 `forbidden` to store staff on every catalog route (L1's `_admin` layout already shows not found) | matches |
| A9 | seed: parents sortOrder 10,20,..; first Fruits & Vegetables / Fresh Fruits; Dairy, Bread & Eggs has Milk (10) and Paneer & Curd; 148 products incl. one inactive; Sunny Fields Toned Milk 500 ml MRP 3000 price 2799; `--reset` truncates; `seed.Files` writes seed PNGs to FILES_DIR; uploads write `<kind>/<id>.<ext>` and change `image_key`, product delete leaves the file (gitignored e2e-files dir) | matches seed.go, catalog.go |
| A10 | FILES_DIR: `make e2e` exports it in E2E_ENV; Playwright webServer and global setup inherit the env | matches Makefile, playwright.config.ts |
| A11 | openapi-fetch 0.17.0 passes a FormData from `bodySerializer` untouched with no Content-Type; jsdom FormData reaches the fake readable by `request.formData()` (name becomes `blob`, type and size kept) | spiked |
| A12 | admin-stores base: `src/stores.ts` `toCents`/`toRupees`, fake-core `json`/`apiError`/`fakeCore`, `renderApp`, `_admin` layout, placeholders `categories.tsx`, `products/index.tsx` | from L2 9f65c7d; recheck after merge |

## Decisions (made)
1. Capability `admin-app` ADDED (as admin-auth-nav, admin-stores).
2. Modules: `catalog.ts` (queries, types, `categoryOptions` "Parent › Child"), `image.tsx` (`ImageTile`, `ImageUpload`), `categories.tsx` (`CategoryDialog`, `DeleteCategory`), `product-form.tsx`; routes `categories.tsx`, `products/index.tsx`, `products/new.tsx`, `products/$productId.tsx` (with `DeleteProduct`).
3. Cache: every category mutation invalidates the tree (page stays mounted); product save `setQueryData` (base of the next diff), list refetches on mount (staleTime 0); upload invalidates `['admin', kind]`.
4. Categories: one flattened `Table` (parent column, children indented); sort order is a numeric field in the edit dialog (no up/down: two PATCHes and a race). Parent chosen on create only.
5. Products: pageSize 24, Previous/Next pager; filters in page state, reset to page 1 (ceiling: lost on leaving the page; URL search later).
6. Product form = StoreForm shape; PATCH diff against `parse(initial(product))`, so absent brand vs `""` is no change; no client price<=MRP rule (core's 400 `priceCents` mapped to the field).
7. Description is a single-line `Input` (no Textarea in ui); Status a `Select` Active/Inactive.
8. Product page waits for product and tree (controlled select needs its options).
9. Delete 409 -> "Deactivate instead" -> PATCH `{isActive:false}` -> `/products` (keeps the form from going stale).
10. Upload: native `input type=file` inside `FormField`, uploads on pick; client type/size check; one cast (`File as unknown as string`) because openapi-typescript types binary as string; `?v=n` cache-buster for a same-URL re-upload.
11. `ImageTile` app-level, same recipe as web's (`web-serviceability-catalog`); escalated: move to `packages/ui`.
12. e2e uploads only to a product it creates and deletes; price restored; one admin sign-in (rate limit).
13. Test notes: user-event `selectOptions` matches value or innerHTML (`&` escaped), so tests select categories by id; `userEvent.setup({ applyAccept: false })` for refused-type tests.

## Still to write (next session)
Files table per task, scenario-to-test table (tests in `spike.patch`: products 6, categories 10, product-form 8, product-delete 2, image 6 runs/5 names; e2e 2), mutation guards (spiked red: drop tree invalidation; drop product `setQueryData`; diff against `product` instead of `base`; drop upload invalidation; drop `?v=`), risks, `tasks.md`, worker briefs.
