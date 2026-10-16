Every task runs in the worktree `.worktrees/rider-P3-L3` on branch `lane/rider-P3-L3-app`. Order: 1, then 2, 3, 4 and 5 in parallel (disjoint files, design.md Files; task 2 should land its `test:` commit first so the e2e specs precede the pages), then 6 (the manager's). Each worker keeps its log in `.claude/lanes/rider-P3-L3-T<n>.md`, ticks its own boxes here, never runs `make db`, `make dev`, `make prod-local`, `make seed` or `make e2e` (only `make -n`), nor `docker` anything. Node: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`. Single test: `npm run test --workspace apps/rider -- --run src/<file>`.

Gates for every task, from the worktree root: `make test-web` (lint, typecheck, test, build of every workspace, rider included; `src/no-literal-colors.test.ts` green); `openspec validate --all --strict` (read the totals line); `git status --short` clean after the commit. Everything follows design.md; a choice design.md does not make is a stop-and-ask, not a decision. Components only from `@shopperstop/ui`; a missing one is a stop-and-ask.

## 1. Workspace, shell, session and sign-in (worker)

Scope: `apps/rider/` (task 1 files in design.md Files), root `package-lock.json` (only the entries `npm install` writes for the new workspace).
Scenarios: "Rider shell" (both), "Store name in the banner" (both), "Rider unknown paths show not found", "Rider and core reached through same-origin proxies" ("Clients call the page's origin"), "Rider sign-in" (all four), "Rider sign-in errors" (all four), "Rider session" (all three), "Rider lost session" (all three), "Rider protected routes", "Rider sign-out". The pages' own content is tasks 3 to 5; here `/`, `/history` and `/deliveries/{id}` render only their `PageHeader` ("Ready to pick up", "History", "Order <number>" after `GET /me/deliveries/{id}`, not found on 404).
Starts from: `apps/rider/src/shell.test.tsx` `pick up page in the shell`, `history marked on its page`, `store name shown`, `store read fails`, `unknown path signed out`, `signed-out deep link`, `sign out ends the session`; `apps/rider/src/sign-in.test.tsx` `empty fields are flagged`, `submit disabled while pending`, `return to the page after sign-in`, `outside redirect ignored`, `wrong credentials or inactive rider`, `rate limited`, `service unreachable or failing`, `field validation from the service`; `apps/rider/src/session.test.ts` `token survives a reload`, `blocked storage keeps the token in memory`; `apps/rider/src/api.test.ts` `clients call the page's origin`, `core never gets the rider token`, `401 to a replaced token keeps the new session`, `expired session on load`, `service unreachable on load`; `apps/rider/src/format.test.ts` `since and itemCount wording`. To make the tests compile red, the `test:` commit carries `package.json`, the configs, `src/test-setup.ts`, `src/fake-api.ts` and the tests; `npm install` at the root adds the workspace.
Commits: `test: rider shell, session and sign-in`, then `feat: rider app workspace, shell, session and sign-in`.

- [x] 1.1 `package.json` (admin's pinned versions, name `@shopperstop/rider`, scripts `dev`, `build`, `typecheck`, `lint`, `test`, `e2e`), `tsconfig.json`, `eslint.config.js`, `index.html` (title "ShopperStop Rider"), `vite.config.ts` (design Decision 3, `base: '/rider/'`, test block as admin's), `src/test-setup.ts`, `src/fake-api.ts` (Decision 16); `npm install` at the worktree root
- [x] 1.2 Write the tests; red run pasted into the log; commit `test: ...` with the files of 1.1
- [x] 1.3 `session.ts`, `api.ts` (Decisions 1, 2; Interfaces), `format.ts` (Decision 14), `router.ts`, `render-app.tsx`, `main.tsx`, `index.css`, `nav.ts`, `not-found.tsx` ("Go to Pick up"), `route-error.tsx`, the six route files (Decisions 4, 5, 15), `src/no-literal-colors.test.ts`
- [x] 1.4 Gates green; `routeTree.gen.ts` committed; commit `feat: ...`

## 2. e2e suite: config, smoke, rider flow, cross-app flow, phone layout (worker, after 1)

Scope: `apps/rider/playwright.config.ts`, `apps/rider/e2e/` only.
Scenarios: "Served under /rider/", "Rider and core reached through same-origin proxies" ("Preview proxies both services"), "Rider end-to-end suite with axe" (both), "Rider flow against core and rider", "Cross-app delivery flow", "Phone width layout"; the e2e halves of "Rider sign-in" and "Rider sign-out".
Starts from: `apps/rider/e2e/smoke.spec.ts` `built app opens under the prefix`, `preview proxies both services`, `smoke pages pass axe`, `suite seeds its own data`; `apps/rider/e2e/deliveries.spec.ts` `ready order to delivered`; `apps/rider/e2e/flow.spec.ts` `customer to rider to delivered`; `apps/rider/e2e/phone-layout.spec.ts` `pages fit a phone`. Workers cannot run `make e2e`: the red run is the manager's (task 6.1), which must fail on missing page content, not on config or setup.
Commits: `test: rider e2e suite with the cross-app flow` (all of it; this task has no `feat:` because the pages it covers are tasks 3 to 5).

- [x] 2.1 `playwright.config.ts` (Decisions 17, 18; `testDir: 'e2e'`, `globalSetup`, `forbidOnly: !!process.env.CI`), `e2e/global-setup.ts` (both services, Decision 18), `e2e/helpers.ts` (Decision 19)
- [x] 2.2 The four spec files, axe after every navigation and every dialog opened; cards and rows found by order number; location asserted with `expect.poll` (20 s) on `GET /api/rider/v1/orders/{orderId}/delivery` with the shopper's core token: `status` `assigned`, `location.lat` 12.9352 and `location.lng` 77.6245; the cross-app flow per Decision 10 (contexts for web at `http://localhost:15173/`, admin at `http://localhost:15174/admin/`, rider at `http://localhost:15175/rider/` with the geolocation options)
- [x] 2.3 `npm run lint --workspace apps/rider` and `npm run typecheck --workspace apps/rider` clean; gates green; commit `test: ...`

## 3. Ready to pick up (worker, after 1; parallel with 2, 4, 5)

Scope: `apps/rider/src/routes/_rider/index.tsx`, `apps/rider/src/ready.tsx`, `apps/rider/src/ready.test.tsx`.
Scenarios: "Ready orders list" (both), "Ready orders states" (both), "The rider's assigned deliveries" (both), "Pick up with confirmation" (both), "Pick up refused" (both).
Starts from: `apps/rider/src/ready.test.tsx` `ready orders listed`, `new order appears without a reload`, `no ready orders`, `read fails`, `assigned delivery linked`, `none assigned`, `pick up succeeds`, `cancel sends nothing`, `claimed by someone else`, `service fails`.
Commits: `test: ready orders and pick up`, then `feat: ready orders and pick up`.

- [x] 3.1 Write the tests; red run pasted into the log; commit `test: ...`
- [x] 3.2 `ready.tsx` (`ReadyPage`: the "Your deliveries" section, the ready list, the claim dialog; design Decisions 6 to 9, 15) and the route file rendering it
- [x] 3.3 Gates green; commit `feat: ...`

## 4. Delivery page, delivered and location (worker, after 1; parallel with 2, 3, 5)

Scope: `apps/rider/src/routes/_rider/deliveries/$deliveryId.tsx`, `apps/rider/src/delivery.tsx`, `apps/rider/src/location.ts`, `apps/rider/src/fake-geolocation.ts`, `apps/rider/src/delivery.test.tsx`, `apps/rider/src/location.test.tsx`.
Scenarios: "Delivery page" (both), "Cash to collect" (both), "Mark delivered with confirmation", "Mark delivered refused", "Location reported while on the way" (both), "Location problems never block".
Starts from: `apps/rider/src/delivery.test.tsx` `assigned delivery shown`, `unknown delivery`, `cash on delivery`, `delivered shows no collection`, `delivered`, `core fails`; `apps/rider/src/location.test.tsx` `first fix sent, then every 15 seconds`, `stops after delivered`, `permission denied` (plus `no geolocation api` for the missing-API branch of the same requirement).
Commits: `test: delivery page, delivered and location`, then `feat: delivery page, delivered and location`.

- [x] 4.1 `fake-geolocation.ts` (Decision 16) and the tests; red run pasted into the log; commit `test: ...`
- [x] 4.2 `location.ts` (Decision 12), `delivery.tsx` (`DeliveryPage`, Decisions 6, 11, 15) and the route file rendering it
- [x] 4.3 Gates green; commit `feat: ...`

## 5. History (worker, after 1; parallel with 2, 3, 4)

Scope: `apps/rider/src/routes/_rider/history.tsx`, `apps/rider/src/history.test.tsx`.
Scenarios: "Delivery history" (both, plus the "Showing the latest 50 of <total>." line).
Starts from: `apps/rider/src/history.test.tsx` `delivered deliveries listed`, `no history`, `more than one page` (total 51, 50 rows: the line shows; the request carried `status=delivered` and `pageSize=50`).
Commits: `test: delivery history`, then `feat: delivery history`.

- [x] 5.1 Write the tests; red run pasted into the log; commit `test: ...`
- [x] 5.2 The history page (Decision 13) in the route file
- [x] 5.3 Gates green; commit `feat: ...`

## 6. Verification (manager)

- [ ] 6.1 After task 2's commit: one `make e2e` (slot taken per D35) to see the rider suite red on missing page content only; note the failures in the area plan
- [ ] 6.2 After tasks 1 to 5: `make test-web`, `make e2e` (admin, rider and web suites green), `openspec validate --all --strict`
- [ ] 6.3 Phone-width walk (390 px) against core and rider with the demo seed on the dev servers: sign in as `rider1-koramangala@shopperstop.local`, see the banner store name, pick up an order made ready on the admin board, call link, cash line, location reaching the customer read, Mark delivered, History; compare with the Figma `Rider web` section
