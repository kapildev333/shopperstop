# Design

## Context
`apps/admin` on main (56aacc6) has the Orders board polling five per-status lists, an order sheet that hides while its cancel dialog is open, app-level copies of ui patterns (`ImageTile` in `src/image.tsx`, `idle` classes in `src/idle.ts`, `stock.tsx` and `staff-dialog.tsx`, a hand-made `sr-only` live region), and no riders page. On main since then: ui-P3-L1 (#199: `ImageTile`, `VisuallyHidden`, `Button` `size="compact"` and `aria-disabled` styling, stacking modals), core-P3-L1 (#203: `Order.riderName`, `OrderEvent.actorName`, `actorType` `rider`), rider-P3-L1 (#207: `/api/rider/v1/admin/riders*` for staff tokens), core-P3-L2 (#215: `active=true` on `listStoreOrders` with `total`, typed `active?: "true"`; `DashboardStore.isOpen`; `Order.storeName` and `promisedMinutes` required, which #211 already put in the fixtures). Still pending: ui-P3-L2 (`packages/ui/src/api/rider.d.ts`, exported as `@shopperstop/ui/api/rider`).

## Gates per task
| Task | Waits on | Why |
|---|---|---|
| 1 ui swaps (+ e2e written) | nothing, main | ui-P3-L1 is on main |
| 2 rider name on card and sheet | task 1 | core-P3-L1 is on main |
| 3 one active-orders poll, dashboard Open/Closed | task 2 | core-P3-L2 is on main (#215) |
| 4 riders page | task 3 and **ui-P3-L2 on main** (branch rebased) | needs `@shopperstop/ui/api/rider` |
| 5 e2e run and walk | tasks 1 to 4, the e2e slot, **core's seed request below** | the admin e2e asserts SS-DEMOAAAB's rider |

Tasks 1 to 3 can run now, one after another on the branch. Task 4 starts the tick ui-P3-L2 merges.

## How the code is handed over
Every line was built and measured in a spike on this branch (base 295 admin Vitest tests after #211 and #215), then reverted. The exact changes are in `patches/`, applied with `git apply` from the worktree root, in this order:

| Patch | Task, commit | Files |
|---|---|---|
| `1.1-e2e-specs.diff` | 1, `test:` (e2e written, not run) | `e2e/riders.spec.ts` (new), `e2e/orders.spec.ts`, `e2e/auth.spec.ts`, `e2e/staff.spec.ts`, `e2e/stores.spec.ts` |
| `1.2-sheet-tests.diff` | 1, `test:` | `src/order-sheet.test.tsx` |
| `1.3-sheet-code.diff` | 1, `feat:` | `src/order-sheet.tsx` |
| `1.4-ui-swaps.diff` | 1, `refactor:` | `src/image.tsx`, `src/idle.ts` (deleted), `src/order-board.tsx`, `src/order-history.tsx`, `src/order-sheet.tsx`, `src/staff-dialog.tsx`, `src/routes/_staff/stock.tsx`, `src/routes/_staff/_admin/categories.tsx`, `src/routes/_staff/_admin/products/index.tsx` |
| `2.1-rider-name-tests.diff` | 2, `test:` | `src/orders-board.test.tsx`, `src/order-sheet.test.tsx` (one test appended to each) |
| `2.2-rider-name-code.diff` | 2, `feat:` | `src/order-board.tsx`, `src/order-sheet.tsx` |
| `3.1-board-dashboard-tests.diff` | 3, `test:` | `src/orders-fake.ts`, `src/orders-board.test.tsx`, `src/orders-status.test.tsx`, `src/order-sheet.test.tsx`, `src/dashboard.test.tsx` |
| `3.2-board-dashboard-code.diff` | 3, `feat:` | `src/orders.ts`, `src/order-board.tsx`, `src/routes/_staff/index.tsx` |
| `4.1-riders-tests.diff` | 4, `test:` | `src/riders-fake.ts` (new), `src/riders.test.tsx` (new), `src/rider-dialog.test.tsx` (new), `src/shell.test.tsx` |
| `4.2-rider-service-config.diff` | 4, `feat:` | `vite.config.ts`, `playwright.config.ts`, `e2e/global-setup.ts` |
| `4.3-riders-code.diff` | 4, `feat:` | `src/api.ts`, `src/nav.ts`, `src/riders.ts` (new), `src/rider-dialog.tsx` (new), `src/routes/_staff/riders.tsx` (new), `src/routeTree.gen.ts` (generated) |

Measured counts (admin Vitest, `Tests` line):
| After | Count |
|---|---|
| base | `295 passed (295)` |
| 1.2 | `3 failed \| 292 passed (295)` |
| 1.3, 1.4 | `295 passed (295)` |
| 2.1 | `2 failed \| 295 passed (297)` |
| 2.2 | `297 passed (297)` |
| 3.1 | `9 failed \| 290 passed (299)` (9 = 7 board/status/sheet tests on the request count, "more active orders", "open or closed") |
| 3.2 | `299 passed (299)` |
| 4.1 | `25 failed \| 297 passed (322)` (23 new runs + the 2 shell nav tests) |
| 4.2, 4.3 | `322 passed (322)` |

Lint, typecheck and build pass after every `feat:`/`refactor:` patch. After 1.2, 2.1 and 3.1 they pass too; after 4.1 typecheck fails by design (`Rider` is exported from `src/api.ts` by 4.3). `routeTree.gen.ts` changes only in task 4 (the `/riders` route): after applying 4.3, `npm run build --workspace apps/admin` regenerates it, and it must then show no further diff.

## Decisions (D13)
1. **Second client, shared middleware.** `src/api.ts` turns the core client's middleware object into one named `staffSession` (`Middleware` from `openapi-fetch`) used by both `api` and a new `riderApi` (`createClient<riderPaths>`, base `${location.origin}/api/rider/v1`). Same token, same 401 rule (only a 401 to the current token ends the session), same envelope rule. The rider service answers with core's envelope and codes, so no second rule is needed. `Rider` is exported from `src/api.ts` beside `Staff`.
2. **Proxy order.** Vite proxies with the first key that matches, so `'/api/rider'` comes before `'/api'` in `server.proxy` (8081) and `preview.proxy` (18081). Caddy already routes `/api/rider/*` (platform-P3-L1).
3. **Riders query key** `['rider', 'riders', store ?? 'all']`. A save invalidates `['rider', 'riders']` (one GET) rather than writing the answer into the list; staff's `withStaff` sort is not copied. Ceiling: one extra read per save.
4. **Store choice for admins**: "All stores" (default, nothing in the URL) or one store (`?store=<id>`); a `store` that is not among core's stores is "All stores" and never sent (the service answers 400 to a non-uuid). It differs from `/orders` (first store by default) because a rider list over every store is useful and costs one request.
5. **Store staff** send no `store`: the service scopes to their store (D32). They see "Store: <name>" from `storeNameQuery` (`src/stock.ts`, reused), no selector, no Store column.
6. **Dialog fields.** Create: Name, Email, Phone (optional, omitted from the body when empty), Password, Store (admins; preselected to the page's store). Edit: Name, Phone (empty sends `""`, which clears it), New password (empty keeps it), Status as a `Select` Active/Inactive, the same control as the staff dialog (admin-P2-L2's decision; ceiling: a switch). Email and store are fixed by the service. PATCH carries only what differs; no change closes without a request.
7. **Errors.** Field messages for 400 on `name`, `email`, `phone`, `password`, `storeId` and 409 on `email`; anything else is the banner "Could not save the rider. Try again." (403 included: a store staff member cannot reach another store's rider through this page).
8. **Board: one request** `{ active: 'true', pageSize: 100 }` (core types `active` as the string `"true"`). The query's data is now core's `OrderList`; the board reads `items` and `total`; a status change writes `{ ...list, items }` into it. The announcement baseline compares `data.items` (structural sharing keeps the same array for an equal answer). "Showing the newest <n> of <total> active orders." when `total > items.length`.
9. **The two "one of the five lists fails" tests** become "the one list failing …" with `core.fail('lists')`. The scenarios keep their names, because a MODIFIED requirement cannot drop a scenario. Their oneStatusFails helper goes.
10. **Rider on card and sheet**: "Rider: <name>" when `riderName` is present; events read `event.actorName ?? actor[event.actorType]`. No History column (out of scope).
11. **Dashboard**: a `Badge` "Open" (`success`) or "Closed" (`neutral`) beside the store heading, outside the `h2`, so the region keeps the store's name as its name.
12. **Stacked cancel dialog**: `<Sheet open …>` stays open under the `Dialog` (ui's layer stack closes the top one on Escape and returns focus to "Cancel order"). A finished cancel removes that button, so the keyboard would land on `body`: the sheet's result is wrapped in a `div role="group" aria-label="Cancel result" tabIndex={-1} className="empty:hidden"` that takes focus when focus is on `body` after the dialog closed (the board's "Status change" group already does the same).
13. **ui swaps keep behaviour**: `ImageTile` from ui with `alt` (`""` in table cells, "Image of <name>" in the upload) and `border border-line` added (ui's tile has no border); the placeholder now shows ui's icon. `idle` classes dropped (ui's `Button` styles `aria-disabled`); `src/idle.ts` deleted. The "New orders" region is `<VisuallyHidden live role="status" aria-label="New orders">`. Order-number buttons in cards and History rows are `size="compact"`. These are `refactor:` with no new test, because the existing tests already pin the behaviour (`aria-disabled`, `sr-only`, the placeholder, the image `alt`).
14. **e2e infra** lives in task 4 (the task that needs the rider service): Playwright starts `go run ./cmd/rider` from `services/rider` (health `:18081/api/rider/v1/healthz`, `reuseExistingServer` as for core), and global setup runs `rider-admin migrate` and `seed-demo --reset` after core's. The e2e specs are written in task 1 and run in task 5.

## Ceilings
- `/riders` lists the first 100 riders by email and says so beyond that; no pager, search or sort.
- A save re-reads the list (decision 3).
- The board shows the newest 100 active orders (core's largest page) and says so beyond; a status change does not adjust `total` until the next poll.
- No rider column or filter in History; the rider shows in the sheet.
- The rider service's `502` (core unreachable) is the generic alert or banner, not a distinct message.
- Status is a `Select`, not a switch (same as staff).

## Tests: scenario to test
`admin-app` delta:
- Core reached through a same-origin proxy › Preview proxies to core: unchanged, `e2e/smoke.spec.ts`. › Preview proxies to the rider service: task 5, manager's `curl http://localhost:15174/api/rider/v1/healthz`, plus every request `e2e/riders.spec.ts` makes. › Client calls the page's origin: `src/api.test.ts` "client attaches the bearer token". › Rider client calls the page's origin: `src/riders.test.tsx` "an admin sees every store's riders by email with phone, store and status".
- End-to-end suite with axe › Smoke pages pass axe: `e2e/smoke.spec.ts`. › Suite seeds its own data: `e2e/riders.spec.ts` (four seeded riders), task 5.
- Role-based navigation › both: `src/shell.test.tsx` "admin sees every section", "store staff see dashboard, orders and stock" (arrays updated in 4.1).
- Orders board › Board listed: `src/orders-board.test.tsx` "the board shows a column per active status …". › More active orders than one page: "a store with more active orders than one page says how many the board shows". › Rider on the card: "a card taken out by a rider names the rider; a card without one does not". › Orders placed in the same second, Column name: unchanged tests.
- Orders board polling › Poll: "the board asks core again every 10 seconds …"; › Hidden tab: "a hidden tab is not polled …"; › Board left: "the poll stops when the board is left".
- Orders board states › One list fails on the first load: "the one list failing on the first load is a board that could not be loaded"; the others unchanged.
- Orders kept on a failed refresh › One list fails on a later poll: "the one list failing on a later poll keeps the whole board, with the notice that it could not refresh"; the others unchanged.
- Order detail sheet › Rider and rider events: `src/order-sheet.test.tsx` "the sheet names the order's rider, and the rider on the events the rider made"; the others unchanged.
- Order cancel with a reason › Order cancelled: "a cancel sends the reason as the note once …"; › Reason missing: "a cancel needs a reason …"; › Keep order: "Keep order and Escape close only the dialog, without sending, and the keyboard is back on the sheet"; › Cancel offered: "only a placed or an accepted order can be cancelled from the sheet".
- Dashboard › Open or closed: `src/dashboard.test.tsx` "each card says whether its store is open"; the others unchanged.
- Orders against core › both: `e2e/orders.spec.ts`, task 5.

`admin-riders` delta (all in `src/riders.test.tsx` or `src/rider-dialog.test.tsx`, except the last):
- Riders table › Admin sees every store's riders: "an admin sees every store's riders by email with phone, store and status".
- Riders store for admins › Choose a store: "choosing a store lists only its riders and puts it in the URL; a store in the URL that is not one lists every store".
- Riders for store staff › Store staff see their store: "store staff see their store's riders with no store selector, no store column and no stores request".
- Riders table states › Riders loading: "the riders table shows a skeleton while loading"; › Riders load failure: "a first load in which %s fails shows a retry that reloads" (2 runs); › No riders: "a store with no riders shows the empty state".
- Riders list beyond one page › More than 100 riders: "more riders than one page says how many are shown".
- Rider create › Admin creates a rider: "an admin creates a rider at a store; the new rider is listed and the dialog closes"; › Store chosen on the page: "an admin who chose a store creates the rider there by default"; › Store staff create at their store: "store staff create a rider at their own store, with no store field".
- Rider change › Only what changed is sent: "an edit sends only what changed: a new name, the phone removed, a new password and the rider deactivated"; › Nothing changed: "an edit that changes nothing closes without a request".
- Rider form errors › Refusal on a field: "a refusal naming %s goes to its field and clears on the next edit" (5 runs); › Other failures: "%s is a banner in the dialog, which stays with what was typed" (3 runs).
- Rider save in progress › Second press during a save: "while a save runs the button reads Saving…, keeps focus and is never disabled; a second press, Cancel and Escape do nothing".
- Rider service session › 401 from the rider service: "a 401 from the rider service ends the session like one from core".
- Riders against the rider service: `e2e/riders.spec.ts` "an admin lists, filters, creates and deactivates riders; store staff see only their store's", task 5.

## Requests to other areas
- **core (blocks task 5's run):** the demo seed's delivered order `…0701` SS-DEMOAAAB gets `rider_name` "Arjun Rao" (rider `…0801`, the rider the rider service's seed names for that order's delivery `…0901`), and its `ready → out_for_delivery` and `out_for_delivery → delivered` events `actor_type` `rider`, `actor_id` `…0801`, `actor_name` "Arjun Rao". This also makes the two seeds tell one story for web's tracking. If core declines, the fallback is the owner's call, not a worker's: drop the two "Rider: Arjun Rao" lines from `e2e/orders.spec.ts` and leave the rider-in-History scenario to Vitest.
- **ui (ui-P3-L2):** export the rider types as `@shopperstop/ui/api/rider` (`package.json` `exports["./api/rider"] = { "types": "./src/api/rider.d.ts" }`), generated by `openapi-typescript` from `services/rider/openapi.json` with `paths` and `components` as in `core.d.ts`. Patch 4.3 imports `components` and `paths` from that path and uses `components['schemas']['Rider']`, `paths['/admin/riders']` and `paths['/admin/riders/{id}']`. The spike generated the file that way and typecheck passed.
- **platform (low):** `openspec/config.yaml`'s `context` lists the capabilities; `rider-service` and, after archive, `admin-riders` are missing.

## Risks
- e2e sign-in budget: core limits 10 sign-ins per email per hour per process. `riders.spec.ts` adds one admin@ and one koramangala@ sign-in, about 8 and 5 per run, so a retried or reused-core run can hit the limit (restart core to clear).
- `riders.spec.ts` leaves an inactive "E2E Rider", which the next run's rider reseed removes. Running the spec twice without the global setup fails on the taken email.
- Patch 4.3 assumes ui-P3-L2's export path and type names. If they differ, the worker stops and the team lead re-cuts 4.3.
- The e2e specs were not run (no slot during the spike). The selectors are the ones the Vitest tests prove, and the seed values come from `services/rider/internal/seed/seed.go` and core's seed.
