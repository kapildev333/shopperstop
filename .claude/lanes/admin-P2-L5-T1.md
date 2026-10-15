# admin-P2-L5-T1 - admin-orders-dashboard task 1: the board, read-only, and the e2e specs written first (worker)
Status: done

## Doing
Task 1 landed on `lane/admin-P2-L5-admin-orders-dashboard`: `test: orders, dashboard and the ordered product against core` (`3dd1f34`), `test: orders board` (`6a2407d`, red), `feat: orders board with store, polling and new-order announcements` (`2e737e1`, green), this `docs:` log. Nothing pushed. `make test-web` exit 0: ui 54, admin 204, web 101. Nothing running.

## Found
- Base before any change (step 0): `apps/admin/src/stock.ts` and `refetch-notice.tsx` present, `storeNameQuery` matched once. Admin Vitest `Test Files 17 passed (17)`, `Tests 180 passed (180)`. Matches the brief.
- `1.1` (`3dd1f34`): `e2e/orders.spec.ts` (new, 102 lines, byte-equal to design.md) and the catalog test appended after one empty line (18 insertions, 0 deletions, nothing above changed). `npm run lint --workspace apps/admin` exit 0; `npm run typecheck --workspace apps/admin` exit 0. Specs not run.
- Process note: the first extraction wrote every Task 1 file at once, ahead of its step. Before any commit I removed the five files of steps 2 and 3 (`src/orders-fake.ts`, `src/orders-board.test.tsx`, `src/orders-rules.test.ts`, `src/orders.ts`, `src/order-board.tsx`) and re-extracted them with a script that writes only the named paths. No commit contains a file of a later step; the red commit holds exactly the three test files, the green one exactly the three code files.
- `1.2` red (`6a2407d`): `src/orders-fake.ts`, `src/orders-board.test.tsx`, `src/orders-rules.test.ts`, tick 1.2. Vitest: `Test Files 2 failed | 17 passed (19)`, `Tests 15 failed | 180 passed (195)`. Failing, exactly the brief's fifteen: "the board shows a column per active status with each order's number, time since placed, item count, total and pincode"; "store staff see the board of their own store by name, with no store selector and no stores request"; "store staff get the board without a store name when the name cannot be read"; "a store in the URL is the one shown, and one that is not a store shows the first store"; "choosing a store puts it in the URL and never shows or announces the other store's orders"; "the board asks core again every 10 seconds and shows an order where it now stands"; "a newly placed order is announced once; the first load, an unchanged answer and an order in another status announce nothing"; "a hidden tab is not polled, and showing it again asks core at once"; "a failed poll keeps the board and announces nothing; the next good answer shows and announces what is new"; "the time since placed moves on without core being asked"; "the board shows a skeleton while loading"; "a board that cannot be loaded offers a retry that reloads"; "a store with no active orders shows the empty state"; "an admin with no stores is told to create one"; "stores that cannot be loaded offer a retry that reloads". `src/orders-rules.test.ts` fails to load: `Error: Failed to resolve import "./orders" from "src/orders-rules.test.ts"`. Typecheck on the red commit exits 2 with the two expected `TS2307 Cannot find module './orders'` errors (`src/orders-fake.ts`, `src/orders-rules.test.ts`), by design.
- `1.3` green (`2e737e1`): `src/orders.ts` (new), `src/order-board.tsx` (new), `src/routes/_staff/orders.tsx` (placeholder replaced whole), tick 1.3. Vitest `Test Files 19 passed (19)`, `Tests 204 passed (204)`, which is base + 24 (the 15 plus the 9 of `orders-rules.test.ts`).
- `make test-web` exit 0: ui `Test Files 25 passed (25)`, `Tests 54 passed (54)`; admin `Test Files 19 passed (19)`, `Tests 204 passed (204)`; web `Test Files 21 passed (21)`, `Tests 101 passed (101)`. Web is 101, the same as on the rebased base; this lane touches nothing under `apps/web`.
- Gates on the green tree: `npm run lint --workspace apps/admin` and `npm run typecheck --workspace apps/admin` are inside `make test-web` and exit 0 there.
- `openspec validate admin-orders-dashboard --type change --strict`: `Change 'admin-orders-dashboard' is valid`.
- `apps/admin/src/routeTree.gen.ts`: unchanged (`git diff --quiet` on it passes; not in `git status`).
- `git status --short` after the feat commit: clean. No file outside scope touched.
- No docker, no `make e2e`, no Playwright run.

## Requests
None.

## Blockers
None. Every count, name and block matched the brief.
