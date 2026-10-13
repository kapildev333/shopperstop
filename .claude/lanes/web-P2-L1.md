# web-P2-L1 - web-serviceability-catalog: pincode, serviceability, Home, Category, Product, Search (team lead)
Status: blocked
## Doing
Task 2: 2.1 red committed (`1f3f7a5 test: home and product card`). 2.2 implemented in the worktree but NOT committed: typecheck fails on the Link typing (see Blockers). Task 2 waits for the manager's decision.

## Found
- Change: `openspec/changes/web-serviceability-catalog/` (proposal; `web-app` delta: MODIFIED "Customer site shell", 10 ADDED requirements, 30 scenarios; design with the scenario → test map; tasks 1 to 4). No `docs/design/web-P2-L1.md`: design.md is enough.
- Reuses `src/api.ts` (`api`, `queryClient`) and the `session.ts` storage-guard pattern from web-P2-L2; neither file changes.
- New shared web pieces later lanes use: `src/pincode.ts` (`setPincode` is the single place a pincode changes; web-P2-L3 wraps it for the store-change confirm), `src/catalog.ts` (`keys`, `useServiceability`, ...), `StoreGate`, `ProductCard` / `ProductGrid` / `ImageTile` in `src/product-card.tsx`, and `src/cart.ts` `useCartQuantity(product)`: a local-count stub web-P2-L3 replaces, signature kept.
- Vitest seeds TanStack Query's cache (`staleTime` 60 s, no refetch) instead of mocking HTTP; the error-path test relies on the relative `baseUrl` failing under jsdom (admin's finding) as "core unreachable".
- E2e uses the D22 demo seed; only the closed store is created (seeded admin, pincode 560076, created only when serviceability answers 404).
- The first-visit sheet opens on `/` for a fresh browser: task 1 adds a `beforeEach` init script storing `560034` to web-P2-L2's `e2e/auth.spec.ts` and `e2e/account.spec.ts`.
- For ui (finding, no request): `IconButton` spreads props and then forces `type="button"`, so it cannot be a submit button; the search form submits on Enter instead.
- 2026-10-12 task 1 (worker, Haiku): red `test: pincode, store resolution and notices`, then green `feat: pincode sheet, store resolution and notices`. Vitest 11 files, 32 tests passed; typecheck, lint, build clean; e2e `CI=1 npm run e2e --workspace apps/web`: 13 passed (smoke 4, auth 3, account 4, browse 2).
- Core types on main (`packages/ui/src/api/core.d.ts`) match design.md for task 2: `Category`, `CategoryNode` (children array), `CategoryTree {items}`, `StoreProduct` (no `isActive`, `quantity` capped at 10), `StoreProductList`; `GET /stores/{id}/categories` answers `CategoryTree`; `GET /stores/{id}/products` `pageSize` default 24, max 100. No deviation.
- Task 2 red (`test: home and product card`, worker, Haiku): `src/product-card.test.tsx` fails on the missing `./product-card` module; `src/home.test.tsx` fails with `TypeError: keys.categories is not a function`. e2e "home against core" written, not run (manager runs it).
- Task 2 green state (uncommitted, saved in the scratchpad as `feat.patch` plus `cart.ts` and `product-card.tsx`): vitest 13 files, 35 tests passed; lint clean; typecheck fails (below).
- Test noise: the "Not implemented: Window's scrollTo()" jsdom lines now appear more often: the router scrolls on navigation (search-from-banner and not-found tests). Not failures.
- `SearchForm` reads `q` with a cast (`(search as { q?: unknown })`) because no route declares `q` until task 3 adds `validateSearch`; drop the cast then.
- `useServiceability` returns `Store | null`; the 404 check is on the status, not on the `not_serviceable` code (core's 404 for the pincode is the only 404 this query can see).
- Deviation from design.md (task 2): Categories shows one `Skeleton` while loading, not one in each of the two places; the nav and the section share one query and one error banner.

## Requests
- to core (via the web area plan): confirm generated schema names `Serviceability`, `Store`, `CategoryTree`, `CategoryNode`, `StoreProduct`, `StoreProductList`; `pageSize` default 24, max 100 on `GET /stores/{id}/products`; the 404s of `/serviceability` and `/stores/{id}/products/{slug}` documented in `openapi.json`.
- to web-P2-L1 manager (decisions needed):
  1. Typecheck blocker, task 2. `Link` from TanStack Router types `to` as required and only for registered routes. The design's `Link to="/p/$slug"` (card) and `Link to="/c/$slug"` (Home) point at routes that tasks 3 and 4 add. `href` alone also fails the types (`to` is still required). Options: (a) a `to` cast on the two links, with a `ponytail:` comment, removed when tasks 3 and 4 land; (b) move the product card's link and the category links to tasks 3 and 4; (c) add the two route files in task 2 (out of this task's scope). Recommendation: (a).
  2. Store-gate 404 fold-in (`not_serviceable` only): not done. A red test needs a 404 whose code is not `not_serviceable`. Any real way to make one needs HTTP mocking (forbidden) or a real server (the `api` base URL is relative and fails under jsdom). Options: (a) move the decision into a pure function, `serviceabilityMissing(status, error)`, unit-tested with hand-built values; (b) a Playwright `page.route` 404 in an e2e test (mocks HTTP in the browser); (c) defer the fold-in to task 3 or 4. Recommendation: (a).

## Blockers
- Task 2 (2.2 commit): typecheck blocked on the Link typing (Requests 1).
- Fold-in 404 narrowing: test method undecided (Requests 2).
- Workers wait on core: task 1 on core-P2-L2 on main with regenerated `packages/ui/src/api/core.d.ts`; tasks 2 to 4 on core-P2-L3 and core-P2-L4 (both now on main).
