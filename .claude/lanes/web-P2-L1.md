# web-P2-L1 - web-serviceability-catalog: pincode, serviceability, Home, Category, Product, Search (team lead)
Status: started
## Doing
2026-10-12 task 1 (worker, Haiku): feat committed (pincode, store resolution, banner, store gate); gates green, task 2 next.
Change proposed and valid (`openspec validate web-serviceability-catalog --strict`; `--all --strict` 8 passed). Waiting for core-P2-L2 on main (task 1) and core-P2-L3, core-P2-L4 on main (tasks 2 to 4); the manager launches workers.
## Found
- Change: `openspec/changes/web-serviceability-catalog/` (proposal; `web-app` delta: MODIFIED "Customer site shell", 10 ADDED requirements, 30 scenarios; design with the scenario → test map; tasks 1 to 4). No `docs/design/web-P2-L1.md`: design.md is enough.
- Reuses `src/api.ts` (`api`, `queryClient`) and the `session.ts` storage-guard pattern from web-P2-L2; neither file changes.
- New shared web pieces later lanes use: `src/pincode.ts` (`setPincode` is the single place a pincode changes; web-P2-L3 wraps it for the store-change confirm), `src/catalog.ts` (`keys`, `useServiceability`, ...), `StoreGate`, `ProductCard` / `ProductGrid`, and `src/cart.ts` `useCartQuantity(product)`: a local-count stub web-P2-L3 replaces, signature kept.
- Vitest seeds TanStack Query's cache (`staleTime` 60 s, no refetch) instead of mocking HTTP; the error-path test relies on the relative `baseUrl` failing under jsdom (admin's finding) as "core unreachable".
- E2e uses the D22 demo seed; only the closed store is created (seeded admin, pincode 560076, created only when serviceability answers 404).
- The first-visit sheet opens on `/` for a fresh browser: task 1 adds a `beforeEach` init script storing `560034` to web-P2-L2's `e2e/auth.spec.ts` and `e2e/account.spec.ts`.
- For ui (finding, no request): `IconButton` spreads props and then forces `type="button"`, so it cannot be a submit button; the search form submits on Enter instead.
- 2026-10-12 task 1 (worker, Haiku): red `test: pincode, store resolution and notices`. `npm run test --workspace apps/web -- --run src/pincode.test.ts src/pincode-sheet.test.tsx src/store-gate.test.tsx src/shell.test.tsx`:
  ```
  FAIL  src/pincode-sheet.test.tsx [ src/pincode-sheet.test.tsx ]
  Error: Failed to resolve import "./catalog" from "src/pincode-sheet.test.tsx". Does the file exist?
  FAIL  src/pincode.test.ts [ src/pincode.test.ts ]
  Error: Failed to resolve import "./pincode" from "src/pincode.test.ts". Does the file exist?
  FAIL  src/shell.test.tsx [ src/shell.test.tsx ]
  Error: Failed to resolve import "./pincode" from "src/shell.test.tsx". Does the file exist?
  FAIL  src/store-gate.test.tsx [ src/store-gate.test.tsx ]
  Error: Failed to resolve import "./catalog" from "src/store-gate.test.tsx". Does the file exist?
  Test Files  4 failed (4)
       Tests  no tests
  ```

  The e2e `browse.spec.ts` red run (before the feat) failed on the sheet and the pincode field, as expected: "pincode resolves against core" (`Element(s) not found` for the dialog) and "notices against core" (timeout waiting for the "Pincode" field).
- 2026-10-12 task 1 feat (worker, Haiku): green. Vitest 11 files, 32 tests passed. `npm run typecheck`, `npm run lint`, `npm run build --workspace apps/web` clean; `routeTree.gen.ts` unchanged (no new route in task 1). `openspec validate web-serviceability-catalog --strict`: valid. e2e `CI=1 npm run e2e --workspace apps/web`: 13 passed (smoke 4, auth 3, account 4, browse 2); global setup ran migrate and `seed-demo --reset` on `shopperstop_core_e2e`; "notices against core" created "E2E Closed" (560076) through the seeded admin, since core answered 404 first.
- Core types on main (`packages/ui/src/api/core.d.ts`) match design.md: `Store`, `Serviceability {store}`, `getServiceability` 200/400/404. No deviation.
- Test noise: the "Not implemented: Window's scrollTo()" jsdom lines now appear more often: the router scrolls on navigation (search-from-banner and not-found tests). Not failures.
- `SearchForm` reads `q` with a cast (`(search as { q?: unknown })`) because no route declares `q` until task 3 adds `validateSearch`; drop the cast then.
- `useServiceability` returns `Store | null`; the 404 check is on the status, not on the `not_serviceable` code (core's 404 for the pincode is the only 404 this query can see).

## Requests
- to core (via the web area plan): confirm generated schema names `Serviceability`, `Store`, `CategoryTree`, `CategoryNode`, `StoreProduct`, `StoreProductList`; `pageSize` default 24, max 100 on `GET /stores/{id}/products`; the 404s of `/serviceability` and `/stores/{id}/products/{slug}` documented in `openapi.json`.
## Blockers
- Workers wait on core: task 1 on core-P2-L2 on main with regenerated `packages/ui/src/api/core.d.ts`; tasks 2 to 4 on core-P2-L3 and core-P2-L4.
