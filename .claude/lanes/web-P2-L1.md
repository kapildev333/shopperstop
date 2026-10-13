# web-P2-L1 - web-serviceability-catalog: pincode, serviceability, Home, Category, Product, Search (team lead)
Status: started
## Doing
Task 2 done except the e2e, which the manager runs: 2.1 red (`1f3f7a5`), fold-in red and fix (`640caa9`, `2364e79`), 2.2 feat (`7876ff1`). Gates green (see Found). Next: task 3 when the manager starts it.

## Found
- Change: `openspec/changes/web-serviceability-catalog/` (proposal; `web-app` delta: MODIFIED "Customer site shell", 10 ADDED requirements, 30 scenarios; design with the scenario → test map; tasks 1 to 4). No `docs/design/web-P2-L1.md`: design.md is enough.
- Reuses `src/api.ts` (`api`, `queryClient`) and the `session.ts` storage-guard pattern from web-P2-L2; neither file changes.
- New shared web pieces later lanes use: `src/pincode.ts` (`setPincode` is the single place a pincode changes; web-P2-L3 wraps it for the store-change confirm), `src/catalog.ts` (`keys`, `serviceabilityMissing`, `useServiceability`, `useCategories`, `usePicked`), `StoreGate`, `ProductCard` / `ProductGrid` / `ImageTile` in `src/product-card.tsx`, and `src/cart.ts` `useCartQuantity(product)`: a local-count stub web-P2-L3 replaces, signature kept.
- Vitest seeds TanStack Query's cache (`staleTime` 60 s, no refetch) instead of mocking HTTP; the error-path test relies on the relative `baseUrl` failing under jsdom (admin's finding) as "core unreachable".
- E2e uses the D22 demo seed; only the closed store is created (seeded admin, pincode 560076, created only when serviceability answers 404).
- The first-visit sheet opens on `/` for a fresh browser: task 1 adds a `beforeEach` init script storing `560034` to web-P2-L2's `e2e/auth.spec.ts` and `e2e/account.spec.ts`.
- For ui (finding, no request): `IconButton` spreads props and then forces `type="button"`, so it cannot be a submit button; the search form submits on Enter instead.
- Task 1 (worker, Haiku): red `test: pincode, store resolution and notices`, then green `feat: pincode sheet, store resolution and notices`. Vitest 11 files, 32 tests passed; typecheck, lint, build clean; e2e `CI=1 npm run e2e --workspace apps/web`: 13 passed (smoke 4, auth 3, account 4, browse 2).
- Core types on main (`packages/ui/src/api/core.d.ts`) match design.md for tasks 1 and 2: `Store`, `Serviceability`, `Category`, `CategoryNode` (children array), `CategoryTree {items}`, `StoreProduct` (no `isActive`, `quantity` capped at 10), `StoreProductList`; `GET /stores/{id}/categories` answers `CategoryTree`; `GET /stores/{id}/products` `pageSize` default 24, max 100. No deviation.
- Task 2 red (`test: home and product card`): `src/product-card.test.tsx` fails on the missing `./product-card` module; `src/home.test.tsx` fails with `TypeError: keys.categories is not a function`. e2e "home against core" written, not run.
- Fold-in (manager decision, option a): `serviceabilityMissing(status, error)` in `src/catalog.ts`, true only for 404 with code `not_serviceable`; `useServiceability` uses it. Red `test: only not_serviceable means no store delivers` (`src/catalog.test.ts`, 4 expectations: 404 not_serviceable true, 404 other code false, 404 no body false, 200 false) failed on `serviceabilityMissing is not a function`; fix `fix: a 404 without not_serviceable is a lookup failure` green. A 200 without a store body throws "serviceability answered 200 without a store" (an error state, not a notice).
- Link typing (manager decision, option a): design.md gap. The card and the Home category links point at `/p/$slug` and `/c/$slug`, which tasks 4 and 3 add, so the typed `Link to` cannot check them until those routes exist. Two narrow casts `as '/'` carry `ponytail:` comments (`product-card.tsx`: one cast on the card link; `routes/index.tsx`: one `categoryPath(slug)` helper used by both category links). tasks.md 3.2 and 4.2 now say to remove them.
- Deviation (accepted by the manager, no scenario names two skeletons): Categories shows one `Skeleton` while loading, not one in each of the two places; the nav and the section share one query and one error banner.
- Feat gates (`7876ff1`, from the worktree root, Node 22.23.3): `npm run test --workspace apps/web -- --run`: 14 files, 36 tests passed. `npm run lint --workspace apps/web`: exit 0. `npm run typecheck --workspace apps/web`: exit 0, 0 errors. `npm run build --workspace apps/web`: exit 0 (vite build). `git status` after the build: clean (`routeTree.gen.ts` unchanged, no new route in task 2). `openspec validate web-serviceability-catalog --strict`: valid. `npm run build --workspace packages/ui`: exit 0 (earlier). e2e not run (manager).
- Test noise: the "Not implemented: Window's scrollTo()" jsdom lines appear more often: the router scrolls on navigation (search-from-banner and not-found tests). Not failures.
- `SearchForm` reads `q` with a cast (`(search as { q?: unknown })`) because no route declares `q` until task 3 adds `validateSearch`; drop the cast then.
- `useServiceability` returns `Store | null`; the 404 check is now on `not_serviceable` (`serviceabilityMissing`).

## Requests
- to core (via the web area plan): confirm generated schema names `Serviceability`, `Store`, `CategoryTree`, `CategoryNode`, `StoreProduct`, `StoreProductList`; `pageSize` default 24, max 100 on `GET /stores/{id}/products`; the 404s of `/serviceability` and `/stores/{id}/products/{slug}` documented in `openapi.json`.
- to web-P2-L1 manager: the e2e "home against core" (`e2e/browse.spec.ts`) is written and not run; run it with the single e2e slot.

## Blockers
- None for task 2. The e2e "home against core" needs the manager's run before 2.2 is green end to end.
- Workers wait on core: task 1 on core-P2-L2 on main with regenerated `packages/ui/src/api/core.d.ts`; tasks 2 to 4 on core-P2-L3 and core-P2-L4 (both now on main).
