# Design

## Context
Lane admin-P2-L6, area `admin`, branch `lane/admin-P2-L6-admin-staff-e2e` in `.worktrees/admin-P2-L6`, cut from main at 04e68ca (core Phase 2 complete, admin-catalog #112, admin-stock #147; admin suite `160 passed`). While this was written admin-P2-L7 merged (#163, on main at 28b9137; admin suite `180 passed`): the manager rebases this branch onto main before task 1 (the branch holds only documents, so nothing can conflict). admin-P2-L5 (`admin-orders-dashboard`) is under way in `.worktrees/admin-P2-L5` and merges before or after this lane; see "Rebase".

No `docs/design/admin-P2-L6.md`: this file is enough. Everything under "Code and tests per task" was built on this branch, measured and removed again; the tree holds only the change documents and the lane log.

Measured (2026-10-13, Node 22.23.3, `npm ci` at the root):
- On 04e68ca: base `160 passed (160)`; the final tree `192 passed (192)` in 18 files with the refetch test without its three notice lines (the root notice does not exist there); lint, typecheck and `vite build` clean; `make test-web` exit 0 (ui 54, admin 192, web 101); `src/routeTree.gen.ts` unchanged.
- On main's `apps/admin/src` (1699afa, with L7) laid under the same spike: base 180; the final tree `212 passed (212)` in 19 files with the refetch test as written below; lint and typecheck clean. The two edits to `src/routes/_staff/stock.tsx` applied to main's file with `git apply --check` clean.
- Stage by stage (on 04e68ca): task 1 tests alone `7 failed | 161 passed (168)`, with its code `168 passed`; task 2 tests `23 failed | 168 passed (191)`, with its code `191 passed`; task 3 test `1 failed | 191 passed (192)`, with its code `192 passed`.
- 32 mutation guards (below), each applied to the final tree, run and restored.
- e2e: `e2e/staff.spec.ts` as written, and the stretch added to `e2e/catalog.spec.ts` (the lines of the edit plus the delete steps after them, on a product the fake already held), each passed once, axe clean, in Chromium against a scratch `vite preview` on port 25174 with a `page.route` fake of core. Nothing has run against the real core: that is task 4, the manager's e2e slot.

## Assumptions (read in the code on 04e68ca)
| # | Assumption | Result |
|---|---|---|
| A1 | `GET /admin/staff-users` is admin only (403 `forbidden` for store staff), paged (`page`, `pageSize` 1 to 100, default 24), ordered by `email`, and answers `StaffList {items, page, pageSize, total}` of `Staff {id, email, name, role, storeId?, isActive}` | holds: `services/core/internal/auth/staff.go` `ListStaff`, `queries/auth.sql` `ListStaff` (`order by email`), `httpx/page.go`; the spike typechecks against `core.d.ts` |
| A2 | `POST /admin/staff-users` takes `StaffCreate {email, password, name, role, storeId?}` and answers 201 with the `Staff`, active. Checks in this order, first problem wins, each 400 `validation` naming the field: `email` (one address, at most 254 bytes, trimmed), `password` (8 to 72 bytes, not trimmed), `name` (1 to 100 characters, trimmed), `role` (`admin` or `store_staff`), `storeId` (a uuid for store staff, absent for an admin; a uuid that is no store is 400 `storeId` "no such store"). An email taken in any letter case is 409 `conflict` with field `email` | holds: `staff.go` `CreateStaff`, `checkRole`; `customer.go` `checkEmail`, `checkPasswordLength`, `checkName` |
| A3 | `PATCH /admin/staff-users/{id}` takes any of `name`, `password`, `isActive` and answers 200 with the `Staff`. Email, role and store cannot change. A `null` member is 400 naming it; an id that is not a staff user is 404 `not_found`. A new password replaces the old one at once | holds: `staff.go` `UpdateStaffUser`, `staffPatch`; `httpx/patch.go` |
| A4 | Core does NOT refuse an admin who deactivates their own account, and does not protect the last active admin: the `PATCH` answers 200 and the admin's next request is 401 | holds: `UpdateStaffUser` has no such check; the operation's description in `core.d.ts` says so ("An admin may deactivate their own account; core-admin create-admin with another email makes a new admin") |
| A5 | There is no `GET /admin/staff-users/{id}` and no `DELETE` | holds: `services/core/internal/app/app.go` lines 52 to 54 mount three routes. (The lane's brief named a `GET` by id: it does not exist, and the dialog does not need it) |
| A6 | A store that a staff user refers to cannot be deleted (409 `conflict`), so a staff row's store always exists | holds: `migrations/0003_stores.sql` (the foreign key has no cascade), the `deleteStore` description in `core.d.ts` |
| A7 | Deactivating a staff user ends their sessions at their next request (401) | holds: `openspec/specs/admin-staff` "Staff sessions" › "Deactivated while signed in" |
| A8 | Sign-ins are limited to 10 per email and 100 per client IP per hour, per core process, counted in memory | holds: `cmd/core/main.go` line 57 `auth.NewLimiter(10, 100, time.Hour, time.Now)` |
| A9 | `StockRow.imageUrl` is optional, omitted when the product has no image, the path `/api/core/v1/files/<key>` | holds: `core.d.ts` `StockRow`; `.claude/lanes/core-P2-L6.md` |
| A10 | Deleting a product deletes its stock rows (`store_stock.product_id … on delete cascade`); a product on an order line is 409 | holds: `migrations/0005_stock_cart.sql`, `0006_orders.sql`. The e2e product is never ordered |
| A11 | Seed: staff `admin@shopperstop.local` (`…0101`), `koramangala@…` (`…0102`, store `…0401`), `indiranagar@…` (`…0103`, store `…0402`), and no other staff user after a reset; stores Koramangala `…0401` and Indiranagar `…0402` | holds: `services/core/internal/seed/summary.go`, `openspec/specs/admin-staff` "Demo admin", "Demo store staff". Not run against the database |
| A12 | A mutation's options (and so the closure that holds the request body) stay in TanStack Query's mutation cache for `gcTime` (5 minutes by default) after its observer is gone; `gcTime: 0` removes it one timer turn after the dialog unmounts | holds: mutation guard 10 (the cache test is red without `gcTime: 0`) |
| A13 | `useMutation`'s own `onSuccess` runs when the component has unmounted; `router.invalidate()` re-runs the `_staff` guard, whose `ensureQueryData(meQuery)` returns what `setQueryData` wrote, without a request | holds: the own-account test (`GET /admin/me` requested once; guards 21 and 22) |
| A14 | `src/image.tsx` exports `ImageTile({src?, alt = '', className?})`, used with `className="w-10"` by the products and categories tables | holds on 04e68ca |
| A15 | L7's rule as landed: `data === undefined ? (isError ? alert : skeleton) : content`; `RefetchNotice` in `src/refetch-notice.tsx`, mounted in `routes/__root.tsx` above the `Outlet`, shows "Could not refresh. Showing what was loaded last." while a query on screen holds data and failed last | holds: read on main at 1699afa; the spike ran with it |

## Goals / Non-Goals
Goals: the page, the column and the two e2e additions of the proposal, composed only from `@shopperstop/ui` components and semantic tokens, every delta scenario mapped to a named test, and edits to shared files small enough to rebase without a hand merge. Non-goals: everything under the proposal's "Out of scope"; any change outside `apps/admin/`; any new dependency.

## Decisions
Decisions 2 to 5 are the ones the manager asked to be decided and recorded (D13: recommended and proceeded on).
1. **Capability `admin-app`, ADDED requirements only.** `admin-staff` holds core's side (routes, sessions, seed) and is not changed; a page is behaviour of the app, as every admin page lane decided. The column and the e2e flow are ADDED too ("Stock product image", "Product and stock against core"), not MODIFIED "Stock table" or "Catalog against core": both stay true as written, and an ADDED requirement cannot collide with another lane's delta at archive time.
2. **A dialog, not a page** (the work package and Spec 2 §8 say dialog). Reason: core has no read of one staff user (A5), so a page at `/staff/{id}` would have nothing to load on a reload; the dialog is fed from the row.
3. **No pager, no filter: one request of 100, and a message when the list is cut.** Reason: staff are a handful per store (two stores in the seed, three users), and 100 is the most core gives in one page. Unlike the stores table, a cut list here would hide who has access, so `total > items.length` shows "Showing the first 100 of <total> staff users, by email.". Ceiling: the 101st user cannot be edited from the panel; add a pager (the stock page's) when a panel passes 100.
4. **The admin's own row: no "Status" field, and the line "You cannot deactivate your own account."** Core would answer 200 and end the admin's own session at the next request (A4); demoting is not possible for anyone (the role cannot change, A3). Reason: with this one rule the admin at the screen stays active, so the panel can never deactivate the last active admin, without counting admins (a count on a cut list would be wrong). The row carries a "You" badge. Name and password of the own account can be changed; a saved name is written to the session entry and the guard is re-run, so the banner shows it (A13). Ceiling: two admins can still deactivate each other in two browsers at the same moment; `core-admin create-admin` is the way back, as core's description says.
5. **A deleted store on a staff row cannot happen** (A6: core refuses the delete with 409). The store cell falls back to "Unknown store" only for a store beyond the first 100 by name (`storesQuery`'s ceiling). No link from the row to the store.
6. **Two reads, one gate.** The page needs the staff users and the stores (the names in the rows, the choices in the dialog). L7's rule with both: `list === undefined || storeItems === undefined` → the skeleton while neither failed, else the one alert "Could not load the staff users." whose "Try again" reads both (the product page's shape, L7 Decision 6). "New staff user" is in the header only once both are held, so the dialog always has its stores. No empty state: the signed-in admin is always in the list.
7. **No notice in the page.** A failed later read keeps the table (the gate asks `=== undefined`); `RefetchNotice` at the root says so. The dialog holds its own form state and makes no read, so it needs none.
8. **After a save, core's answer is written into the list** (`withStaff`: replace by id or add, sorted by email as core orders, `total` moved by what was added) with `setQueryData`; no invalidation and no second read, so no reload can fail under a closed dialog. The list is one exact key (`['admin', 'staff-users']`): there are no other list queries to remove by prefix. Ceiling: `<` on the email strings is code-unit order, the database's `order by email` follows its collation; a row may sit one place off until the next read (every mount reads again).
9. **What is sent.** Create: the values as typed (core trims name and email, never the password); `storeId` only for `store_staff` with a store chosen. Change: only what differs from the row; an empty "New password" is not sent; nothing changed closes without a request. There is no client-side validation: every rule is core's (A2, A3), and its 400 lands on the field in the page's words (`messages`), because core's own speak of bytes and ids. Store staff with no store chosen therefore costs one round trip and reads "Choose a store.". Ceiling: "Enter 8 to 72 characters." is core's 8 to 72 bytes; a password of 30 emoji is refused with that sentence.
10. **Errors.** `validation` naming a form field → that field; `conflict` on `email` → "A staff user with this email already exists." on "Email"; everything else (404, 5xx, a 400 without a field, a conflict on another field, an answer without core's error body, which `src/api.ts` hands on as `internal`) → one alert in the dialog. All of them are core's answer, so one rule clears them: the next edit of any field (`save.reset()`), never while a save runs.
11. **A save in progress.** The submit button is `aria-disabled` with the label "Saving…", never `disabled` or `loading` (it has focus); `submit` returns while a save is pending, so a second press and Enter send nothing. `edit()` calls `save.reset()` only when no save is pending (`reset()` would detach it: the dialog would never close). Cancel and Escape do nothing while a save runs: the answer closes the dialog, and a late answer must not close a dialog opened since. Ceiling: text typed during the save is dropped when the dialog closes; a save that never answers keeps the dialog until the request fails.
12. **Passwords.** `type="password"`, `autoComplete="new-password"` (a browser must not fill the admin's own password into another account), state of the dialog only, read by the mutation function from that state and never passed as mutation variables, `gcTime: 0` so the finished mutation and its closure leave the cache at once (A12). The password stays in the field after a refused save (the taken email is fixed without typing it again) and is gone when the dialog closes. Nothing logs: the app has no `console` call. "Name" and "Email" are `autoComplete="off"`.
13. **`idle` is a local constant in `src/staff-dialog.tsx`**, as in `stock.tsx`. admin-P2-L5 adds `src/idle.ts` with the same string; creating the same file here would be an add/add conflict. Follow-up when both are on main: import it (one line here, one in `stock.tsx`).
14. **Fixtures in `src/staff-fake.ts` (test-only), not in `src/fake-core.ts`**: two test files share them, and no shared file is edited (L5 and L7 do not touch it either).
15. **The "Edit" buttons are named by email** (`aria-label="Edit <email>"`): two staff users may share a name, never an email. The dialog's title uses the name.
16. **No URL state**: no filter, no page, and the dialog is page state. Nothing to validate or clamp. **No text is cut** by the page (core checks lengths), so the code-point rule has no site here.
17. **Stock image column**: first column, `<ImageTile src={row.imageUrl} className="w-10" />`, the products table's exact recipe. Two inserted lines in `stock.tsx`, both at anchors L7 did not touch.
18. **e2e: "admin creates a product and sets stock" is a stretch inside `catalog.spec.ts` › "admin runs the catalog", not a test of its own.** That test already creates "E2E Curd Cup", uploads the PNG and deletes it; the stock step goes between upload and delete. Reasons: no extra admin sign-in (A8); and no second e2e product alive at the same time, which the other specs could not take (`stock.spec.ts` matches `14[78] products`, the catalog test itself expects exactly 148 before it creates its own; Playwright runs the spec files in parallel). Cleanup: the product is deleted (A10 takes the stock row with it), so the flow does not lean on the reseed. The stretch reads the store by the seeded id `…0401`.
19. **e2e: the staff flow uses a second browser context for the new user, with one admin sign-in.** The brief's wording was "signs out, signs in as that user"; with a second context the admin stays signed in, so the same test can then deactivate the user and see their session end, and the admin signs in once instead of twice. The admin signs out at the end. Cleanup: core cannot delete a staff user, so the created one is left inactive and goes with the next reset (`seed-demo --reset` deletes every staff user it does not define); the email is fixed (`e2e-staff@shopperstop.local`), which is safe because global setup resets before every Playwright run and the config has no retries.
20. **Sign-ins per admin e2e run** (A8). On main today: admin 4 (`auth`, `catalog`, `stock`, `stores`), `koramangala@` 3, `nobody@` 1. This change adds admin 1 and `e2e-staff@` 1 (`staff.spec.ts`); the catalog stretch adds none. Total: admin 5, `koramangala@` 3, `nobody@` 1, `e2e-staff@` 1, ten in all from one IP. With admin-P2-L5 as designed (admin 2, `koramangala@` 1): admin 7, `koramangala@` 4, thirteen in all. One run fits the 10 per email; a second run against the same core process does not (admin 14), as today. Upgrade path if a lane needs more: one signed-in `storageState` shared by the admin specs.

## Files (all under `apps/admin/`)
| File | Task | Change |
|---|---|---|
| `e2e/staff.spec.ts` (new) | 1 | the staff flow, run in task 4 |
| `e2e/catalog.spec.ts` | 1 | two insertions (a constant, the stock stretch), run in task 4 |
| `src/staff-fake.ts` (new, test-only) | 1 | fixtures `indu`, `kiran`, `createdId`, the stateful `staffCore` |
| `src/staff.test.tsx` (new) | 1 | 8 tests |
| `src/staff.ts` (new) | 1 | `staffUsersQuery`, `pageSize`, `roleNames`, `withStaff` |
| `src/routes/_staff/_admin/staff.tsx` | 1, 2 | the placeholder replaced by the table (task 1), then replaced whole with the button, the "Actions" column and the dialog (task 2) |
| `src/staff-dialog.test.tsx` (new) | 2 | 23 tests |
| `src/staff-dialog.tsx` (new) | 2 | `StaffDialog` |
| `src/stock.test.tsx` | 3 | one test appended |
| `src/routes/_staff/stock.tsx` | 3 | two inserted lines |

`src/routeTree.gen.ts`, `src/fake-core.ts`, `src/api.ts`, `package.json` and every existing test are unchanged.

## Rebase
The branch holds only documents until task 1. Step 0 for the manager: rebase onto main (L7 is there); brief 1 checks `src/refetch-notice.tsx` exists and stops if not.

| File | Other lane | Conflict | Resolve |
|---|---|---|---|
| `src/routes/_staff/stock.tsx` | L7 (landed): the save's `onSuccess`, the two gates | none: this lane inserts one import line after `import { api, type ApiError } from '../../api'` and one line after `const columns: Column<StockRow>[] = [`, neither inside L7's hunks; applied to main's file cleanly | if an anchor is not found exactly once, stop and report |
| `src/routes/_staff/stock.tsx` | L5: not edited (its design, "Rebase") | none | nothing |
| `src/stock.test.tsx` | L7, L5: not edited | none: one test appended at the end | nothing |
| `e2e/catalog.spec.ts` | L5 appends a third test at the end of the file | none textually: this lane inserts one constant after the `png` line and the stretch inside the first test | keep both. If git reports a conflict at the end of the file, keep L5's test whole and this lane's lines where they are |
| `src/routes/__root.tsx`, `src/refetch-notice.tsx` | L7 | not edited here | one test asserts L7's wording "Could not refresh. Showing what was loaded last."; it is on main with those words |
| `src/routes/_staff/_admin/staff.tsx` | L7 and L5 leave the placeholder alone | none | replaced whole |
| `src/idle.ts` | L5 adds it | none: not created here (Decision 13) | follow-up import, not part of this change |
| `src/fake-core.ts`, `src/routeTree.gen.ts` | nobody | none | nothing |
| `openspec/specs/admin-app/spec.md` | L5 and L7 deltas | none: ADDED only; no requirement name here starts with "Order", "Orders", "Dashboard" or "Ordered product", or equals one of L7's four | nothing |
| Behaviour with L5 on the branch | the Dashboard and Orders pages are real | the e2e helper `signIn` waits for the heading "Dashboard", which both the placeholder and L5's page have; the new store-staff user's dashboard asks core for one store | nothing. Playwright count: main 10, this lane + 1 (11); with L5's three, 14 |

Counts: every count in tasks.md is "base + n". Base is 180 on main with L7 (160 on 04e68ca; 180 + L5's tests if L5 lands first). Only the base moves.

## Tests (scenario -> test)
Files: T `src/staff.test.tsx`, D `src/staff-dialog.test.tsx`, K `src/stock.test.tsx`, E `e2e/staff.spec.ts`, C `e2e/catalog.spec.ts`.

| Requirement › Scenario | Test |
|---|---|
| Staff users table › Staff users listed | T "the staff table lists every staff user by email with role, store and status" |
| Staff users table › Store not among the stores read | T "a staff user whose store is not among the stores read shows as an unknown store" |
| Staff users table states › Staff users loading | T "the staff table shows a skeleton while loading" |
| Staff users table states › First load failure | T "a first load in which %s fails shows a retry that reloads" (2 runs: the staff users, the stores) |
| Staff users table states › Failed refetch keeps the table | T "a failed refetch keeps the staff table, with the one notice from the root" |
| Staff users list beyond one page › More than 100 staff users | T "more staff users than one page says the list is cut" |
| Staff users list beyond one page › Whole list shown | T "the staff table lists every staff user by email with role, store and status" (no "Showing the first") |
| Staff users only for admins › Store staff open /staff | T "store staff who open /staff see not found, and core is not asked for the staff users" (green when written: admin-P2-L1's route folder does it); E |
| Staff user create › Create a store-staff user | D "create a store-staff user: core gets what was typed and the row appears in email order without a second read" |
| Staff user create › Create an admin | D "create an admin: no Store field and no store in the request" |
| Staff user create › Created user changed at once | D "a staff user just created can be changed at once: the row is replaced, not added again" |
| Staff user change › Change the name | D "edit shows what cannot change as text, sends only the changed name and shows core's answer in the row" |
| Staff user change › Deactivate and activate | D "deactivate and activate: Status is sent alone and the row follows core's answer" |
| Staff user change › Nothing changed | D "Save changes with nothing changed closes the dialog without a request" |
| Staff user own account › Own dialog | D "an admin's own dialog has no Status field, and a saved name shows in the row and the banner" |
| Staff user own account › Another user's dialog | D "another staff user's dialog has the Status field and no own-account line" |
| Staff user form errors › Validation error on a field | D "a validation error from core on %s is shown on its field" (4 runs) |
| Staff user form errors › Store staff without a store | D "store staff created without a store: core is asked without one and its refusal shows on Store" |
| Staff user form errors › Taken email | D "a taken email is said on the Email field, and the next edit clears it" |
| Staff user form errors › Other failure | D "when %s the dialog stays with an alert, and the next edit clears it" (4 runs) |
| Staff user form errors › Unknown staff user on save | D "an unknown staff user on save shows the alert and leaves the row as it was" |
| Staff user save in progress › Second press during a save | D "while a save runs the button reads "Saving…", keeps focus, is never disabled, and a second press or Enter sends nothing" |
| Staff user save in progress › Edit typed during a save | D "an edit typed while a save runs leaves the save attached: it still closes the dialog" |
| Staff user save in progress › Cancel and Escape | D "Cancel and Escape close the dialog without a request, but not while a save runs" |
| Staff user passwords › Password field on create | D "create a store-staff user: …" (the two attributes) |
| Staff user passwords › New password sent alone and not kept | D "a new password is sent alone, and no password is left in the page or the mutation cache" |
| Stock product image › Product image tile | K "each stock row starts with the product's image as a tile, a placeholder when it has none" |
| Staff users against core › Admin creates store staff who see their store only until deactivated | E "admin creates store staff, who see their store only until the admin deactivates them" (task 4) |
| Product and stock against core › Admin creates a product and sets its stock | C "admin runs the catalog" (the stretch from `./stock?store=` to the delete; task 4) |

Spec 2 §13, admin side, where each flow lives: "sign in as store staff, see the order on the board, advance it to delivered" → admin-P2-L5 `e2e/orders.spec.ts` (not here); "admin creates a product and sets stock" → C above; the staff flow (not named in §13, asked by the work package) → E. "Customer finds it by search" is the customer site's suite.

## Test strategy
Vitest and Testing Library through `renderApp` (the real router, guard, shell and `QueryClient`), core faked at `fetch` with `fakeCore`, as every admin test. No HTTP mock library, no `vi.mock`, no timers, no `vi.useFakeTimers`. `staffCore()` keeps the rows like core (POST adds, PATCH merges, names trimmed, no password in any answer) and can hold its writes (`hold()`, `release()`), so a test looks at the moment before an answer and releases it itself. The refetch test uses L7's recipe: `refetchQueries({ type: 'active' })`, then `notifyManager.schedule` inside `act`, because TanStack Query tells its observers one turn after the answers; without that line the assertions would run against the page as it was before.

Test names say behaviour. Rows are found through their "Edit <email>" button; fields by label inside the dialog.

## Mutation guards (for the reviewer; each applied to the final tree of the spike, the two staff test files or `stock.test.tsx` run, only the named tests red, then restored)
| # | File | Mutation | Red |
|---|---|---|---|
| 1 | `routes/_staff/_admin/staff.tsx` | the gate also asks `users.isError \|\| stores.isError` first | T "a failed refetch keeps the staff table…" |
| 2 | same | no "You" badge | T "the staff table lists…"; D "an admin's own dialog…" |
| 3 | same | `'All stores'` → `''` | T "the staff table lists…"; D "create an admin…" |
| 4 | same | never the cut message | T "more staff users than one page…" |
| 5 | `staff.ts` | `pageSize` 24 | T "the staff table lists…", "more staff users than one page…" |
| 6 | `routes/…/staff.tsx` | "Try again" reads only the staff users | T "a first load in which GET /admin/stores fails…" |
| 7 | same | `self={false}` | D "an admin's own dialog…" |
| 8 | `staff.ts` | `withStaff` without the sort | D "create a store-staff user…" |
| 9 | `staff.ts` | `withStaff` without the filter by id | D five tests that change a row ("edit shows…", "a new password…", "deactivate and activate…", "an admin's own dialog…", "a staff user just created…") |
| 10 | `staff-dialog.tsx` | no `gcTime: 0` | D "a new password is sent alone…" |
| 11 | same | `submit` without `if (save.isPending) return` | D "while a save runs…" |
| 12 | same | the button with `loading={save.isPending}` | D "while a save runs…" |
| 13 | same | `close` without the pending check | D "Cancel and Escape…" |
| 14 | same | `edit` resets also while pending | D "an edit typed while a save runs…" |
| 15 | same | `edit` never resets | D "a taken email…", "when %s the dialog stays…" (4) |
| 16 | same | the password always in the `PATCH` | D "edit shows…", "deactivate and activate…", "Save changes with nothing changed…", "an admin's own dialog…" |
| 17 | same | `storeId` always in the `POST` | D "create an admin…", "store staff created without a store…" |
| 18 | same | no early close when nothing changed | D "Save changes with nothing changed…" |
| 19 | same | no taken-email message | D "a taken email…" |
| 20 | same | "Status" also on the own row | D "an admin's own dialog…" |
| 21 | same | the session entry not written for the own row | D "an admin's own dialog…" |
| 22 | same | no `router.invalidate()` | D "an admin's own dialog…" |
| 23 | same | the list not written after a save | D nine tests that look at the table after a save |
| 24 | same | `type="text"` on the password | D "create a store-staff user…", "a new password is sent alone…" |
| 25 | same | `autoComplete="off"` on the password | the same two |
| 26 | same | a field message for any code naming a field | D "a taken email…", "when core names a conflict that is not the email…" |
| 27 | same | `onSuccess` without `onClose()` | D ten tests that wait for the dialog to close |
| 28 | same | `isActive` always in the `PATCH` | D "edit shows…", "a new password…", "Save changes with nothing changed…", "an admin's own dialog…" |
| 29 | same | the own-account line on every edit dialog | D "another staff user's dialog…" |
| 30 | `routes/…/staff.tsx` | `'Unknown store'` → `''` | T "a staff user whose store is not among the stores read…" |
| 31 | `routes/_staff/stock.tsx` | the "Image" column removed | K "each stock row starts with…" |
| 32 | same | the tile without `src` | K "each stock row starts with…" |

## Code and tests per task (spiked; workers copy it byte for byte)
Paths are under `apps/admin/`. A block marked NEW FILE or REPLACE WHOLE is the whole file. An EDIT is one insertion: the "after" text occurs exactly once in the file; put the "insert" lines directly after it and change nothing else.

### Task 1: the e2e written first, then the staff users table

#### NEW FILE `e2e/staff.spec.ts` (step 1, `test: staff users and product stock against core`)
```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); ids as `core-admin seed-demo --reset` prints
// them (services/core/internal/seed/summary.go). Core has no route that deletes a staff user: the one created here is
// left inactive and goes with the next reset.
const indiranagar = '00000000-0000-4000-8000-000000000402'
const created = { name: 'E2E Store Staff', email: 'e2e-staff@shopperstop.local', password: 'e2e-staff-12345' }

async function signIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

test('admin creates store staff, who see their store only until the admin deactivates them', async ({ page, browser }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Staff' }).click()
  const staff = page.getByRole('table', { name: 'Staff users' })
  await expect(staff.getByRole('button')).toHaveText(['Edit', 'Edit', 'Edit'])
  const adminRow = staff.getByRole('row').filter({ hasText: 'admin@shopperstop.local' })
  await expect(adminRow).toContainText('You')
  await expect(adminRow).toContainText('All stores')
  await expect(staff.getByRole('row').filter({ hasText: 'koramangala@shopperstop.local' })).toContainText('Koramangala')
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'New staff user' }).click()
  const dialog = page.getByRole('dialog', { name: 'New staff user' })
  await dialog.getByLabel('Name').fill(created.name)
  await dialog.getByLabel('Email').fill(created.email)
  await dialog.getByLabel('Password').fill(created.password)
  await dialog.getByLabel('Store').selectOption(indiranagar)
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Create staff user' }).click()
  await expect(dialog).toHaveCount(0)
  const row = staff.getByRole('row').filter({ hasText: created.email })
  await expect(row).toContainText('Store staff')
  await expect(row).toContainText('Indiranagar')
  await expect(row).toContainText('Active')
  await page.reload()
  await expect(row).toContainText(created.name)

  // The new staff member signs in in a browser of their own, so the admin signs in once (core limits sign-ins per email).
  const context = await browser.newContext()
  const theirs = await context.newPage()
  await signIn(theirs, created.email, created.password)
  await expect(theirs.getByRole('banner')).toContainText(created.name)
  await expect(theirs.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Dashboard', 'Orders', 'Stock'])
  await theirs.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  await expect(theirs.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(theirs.getByText('Store: Indiranagar')).toBeVisible()
  await expect(theirs.getByLabel('Store', { exact: true })).toHaveCount(0)
  await theirs.goto('./staff')
  await expect(theirs.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(theirs).toHaveURL(/\/admin\/staff$/)
  await expectNoAxeViolations(theirs)

  await page.getByRole('button', { name: `Edit ${created.email}` }).click()
  const edit = page.getByRole('dialog', { name: `Edit ${created.name}` })
  await expect(edit.getByLabel('New password')).toHaveValue('')
  await edit.getByLabel('Status').selectOption('inactive')
  await expectNoAxeViolations(page)
  await edit.getByRole('button', { name: 'Save changes' }).click()
  await expect(edit).toHaveCount(0)
  await expect(row).toContainText('Inactive')

  // Their session ended with the save: the next page they open asks them to sign in.
  await theirs.goto('./stock')
  await expect(theirs).toHaveURL(/\/admin\/sign-in\?redirect=%2Fstock$/)
  await context.close()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/admin\/sign-in$/)
})
```

#### EDIT 1 `e2e/catalog.spec.ts`: the store's seeded id (same commit)
After:
```ts
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
```
insert:
```ts
// The Koramangala store, by the id `core-admin seed-demo --reset` prints (services/core/internal/seed/summary.go).
const koramangala = '00000000-0000-4000-8000-000000000401'
```

#### EDIT 2 `e2e/catalog.spec.ts`: the stock stretch, between the upload and the delete (same commit)
After (these three lines, the third is empty; they stand directly before `  await page.getByRole('button', { name: 'Delete product' }).click()`):
```ts
  await expect.poll(() => tile.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
  await expectNoAxeViolations(page)

```
insert:
```ts
  // Spec 2 §13, "admin creates a product and sets stock": the new product has no stock at Koramangala until it is set here.
  await page.goto(`./stock?store=${koramangala}`)
  await expect(page.getByLabel('Store', { exact: true }).locator('option:checked')).toHaveText('Koramangala')
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e curd cup')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const stock = page.getByRole('table', { name: 'Stock' })
  const quantity = page.getByRole('textbox', { name: 'Quantity of E2E Curd Cup' })
  await expect(stock.getByRole('textbox')).toHaveCount(1)
  await expect(quantity).toHaveValue('0')
  await expect(stock.getByText('Low stock', { exact: true })).toBeVisible()
  await expect(stock.getByRole('row').nth(1).locator('img')).toHaveAttribute('src', /^\/api\/core\/v1\/files\/products\/[0-9a-f-]{36}\.png$/)
  await expectNoAxeViolations(page)
  await quantity.fill('12')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Stock saved.' })).toBeVisible()
  await page.reload()
  await expect(quantity).toHaveValue('12')
  await expect(stock.getByText('Low stock', { exact: true })).toHaveCount(0)

  // Deleting the product takes its stock with it.
  await nav.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e curd cup')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await products.getByRole('link', { name: 'E2E Curd Cup' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Curd Cup' })).toBeVisible()
```
The next line is then the existing `  await page.getByRole('button', { name: 'Delete product' }).click()`, unchanged.

#### NEW FILE `src/staff-fake.ts` (step 2, `test: staff users table`)
```ts
import type { Staff } from './api'
import { admin, indiranagar, json, koramangala, storeList } from './fake-core'

type Handler = (request: Request) => Response | Promise<Response>

// Test-only. Three staff users in core's order (by email): the signed-in admin, an inactive and an active store-staff user.
export const indu: Staff = { id: '00000000-0000-4000-8000-000000000103', email: 'indiranagar@example.test', name: 'Indu Nair', role: 'store_staff', storeId: indiranagar.id, isActive: false }
export const kiran: Staff = { id: '00000000-0000-4000-8000-000000000102', email: 'koramangala@example.test', name: 'Kiran Rao', role: 'store_staff', storeId: koramangala.id, isActive: true }
export const createdId = '00000000-0000-4000-8000-000000000199'

// Core's staff routes with the rows kept: GET lists them by email, POST adds an active user, PATCH changes the name and
// the status. Names and emails come back trimmed and no answer carries a password, as in core. `hold()` makes the
// writes wait until `release()`.
export function staffCore(start: Staff[] = [admin, indu, kiran]) {
  let users = start
  let gate = Promise.resolve()
  let release = () => {}
  const routes: Record<string, Handler> = {
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => storeList([indiranagar, koramangala]),
    'GET /admin/staff-users': () => {
      const items = [...users].sort((a, b) => (a.email < b.email ? -1 : 1))
      return json(200, { items, page: 1, pageSize: 100, total: items.length })
    },
    'POST /admin/staff-users': async (request) => {
      const body = (await request.clone().json()) as { name: string; email: string; role: Staff['role']; storeId?: string }
      await gate
      const created: Staff = { id: createdId, email: body.email.trim(), name: body.name.trim(), role: body.role, ...(body.storeId && { storeId: body.storeId }), isActive: true }
      users = [...users, created]
      return json(201, created)
    },
  }
  for (const { id } of start) {
    routes[`PATCH /admin/staff-users/${id}`] = async (request) => {
      const body = (await request.clone().json()) as { name?: string; isActive?: boolean }
      await gate
      const user = users.find((other) => other.id === id)!
      const saved = { ...user, ...(body.name !== undefined && { name: body.name.trim() }), ...(body.isActive !== undefined && { isActive: body.isActive }) }
      users = users.map((other) => (other.id === id ? saved : other))
      return json(200, saved)
    }
  }
  return {
    routes,
    hold: () => {
      gate = new Promise<void>((resolve) => (release = resolve))
    },
    release: () => release(),
  }
}
```

#### NEW FILE `src/staff.test.tsx` (step 2, same commit)
```tsx
import { notifyManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala, storeStaff } from './fake-core'
import { renderApp } from './render-app'
import { indu, kiran, staffCore } from './staff-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const paths = (calls: Request[]) => calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))

test('the staff table lists every staff user by email with role, store and status', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')

  const table = await screen.findByRole('table', { name: 'Staff users' })
  expect(screen.getByRole('heading', { level: 1, name: 'Staff' })).toBeInTheDocument()
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(3)
  for (const text of ['Asha Admin', 'admin@example.test', 'Admin', 'All stores', 'Active']) expect(within(rows[0]).getByText(text)).toBeInTheDocument()
  expect(within(rows[0]).getByText('You')).toBeInTheDocument()
  for (const text of ['Indu Nair', 'indiranagar@example.test', 'Store staff', 'Indiranagar', 'Inactive']) expect(within(rows[1]).getByText(text)).toBeInTheDocument()
  for (const text of ['Kiran Rao', 'koramangala@example.test', 'Store staff', 'Koramangala', 'Active']) expect(within(rows[2]).getByText(text)).toBeInTheDocument()
  expect(within(rows[1]).queryByText('You')).not.toBeInTheDocument()
  expect(within(rows[2]).queryByText('You')).not.toBeInTheDocument()
  expect(screen.queryByText(/Showing the first/)).not.toBeInTheDocument()
  const list = calls.find((call) => new URL(call.url).pathname.endsWith('/admin/staff-users'))!
  expect(Object.fromEntries(new URL(list.url).searchParams)).toEqual({ pageSize: '100' })
})

test('the staff table shows a skeleton while loading', async () => {
  setToken('tok')
  const core = staffCore()
  let answer = () => {}
  const held = new Promise<void>((resolve) => (answer = resolve))
  fakeCore({
    ...core.routes,
    'GET /admin/staff-users': async (request) => {
      await held
      return core.routes['GET /admin/staff-users'](request)
    },
  })

  renderApp('/staff')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  answer()
  expect(await screen.findByRole('table', { name: 'Staff users' })).toBeInTheDocument()
  expect(screen.queryByRole('status', { name: 'Loading' })).not.toBeInTheDocument()
})

test.each(['GET /admin/staff-users', 'GET /admin/stores'])('a first load in which %s fails shows a retry that reloads', async (route) => {
  setToken('tok')
  const core = staffCore()
  let fail = true
  fakeCore({ ...core.routes, [route]: (request) => (fail ? apiError(500, 'internal') : core.routes[route](request)) })

  renderApp('/staff')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the staff users.')
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Staff users' })).toHaveTextContent('Kiran Rao')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('a failed refetch keeps the staff table, with the one notice from the root', async () => {
  setToken('tok')
  const core = staffCore()
  let down = false
  const read = (route: string) => (request: Request) => (down ? json(502) : core.routes[route](request))
  fakeCore({ ...core.routes, 'GET /admin/staff-users': read('GET /admin/staff-users'), 'GET /admin/stores': read('GET /admin/stores') })
  const router = renderApp('/staff')
  await screen.findByRole('table', { name: 'Staff users' })
  // Every read on screen is made again, as on a window focus; TanStack Query tells the page one turn after the answers,
  // and `schedule` queues behind that. Without it the assertions would run against the page as it was before.
  const refetch = () =>
    act(async () => {
      await router.options.context.queryClient.refetchQueries({ type: 'active' })
      await new Promise<void>((told) => notifyManager.schedule(told))
    })

  down = true
  await refetch()

  const table = screen.getByRole('table', { name: 'Staff users' })
  expect(table).toHaveTextContent('Kiran Rao')
  expect(table).toHaveTextContent('Koramangala')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  // The one notice is the root layout's (admin-keep-data-on-refetch-error); the page shows none of its own.
  expect(screen.getAllByText('Could not refresh. Showing what was loaded last.')).toHaveLength(1)
  expect(screen.getByText('Could not refresh. Showing what was loaded last.')).toHaveAttribute('role', 'status')
  down = false
  await refetch()
  expect(screen.getByRole('table', { name: 'Staff users' })).toHaveTextContent('Kiran Rao')
  expect(screen.queryByText('Could not refresh. Showing what was loaded last.')).not.toBeInTheDocument()
})

test('more staff users than one page says the list is cut', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'GET /admin/staff-users': () => json(200, { items: [admin, indu, kiran], page: 1, pageSize: 100, total: 101 }) })

  renderApp('/staff')

  await screen.findByRole('table', { name: 'Staff users' })
  expect(screen.getByText('Showing the first 100 of 101 staff users, by email.')).toHaveAttribute('role', 'status')
})

test('a staff user whose store is not among the stores read shows as an unknown store', async () => {
  setToken('tok')
  const elsewhere = { ...kiran, storeId: '00000000-0000-4000-8000-0000000004ff' }
  fakeCore(staffCore([admin, elsewhere]).routes)

  renderApp('/staff')

  const table = await screen.findByRole('table', { name: 'Staff users' })
  expect(within(within(table).getAllByRole('row')[2]).getByText('Unknown store')).toBeInTheDocument()
  expect(table).not.toHaveTextContent(koramangala.name)
})

test('store staff who open /staff see not found, and core is not asked for the staff users', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, storeStaff) })

  const router = renderApp('/staff')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/staff')
  expect(paths(calls)).toEqual(['/admin/me'])
})
```

#### NEW FILE `src/staff.ts` (step 3, `feat: staff users table`)
```ts
import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api, type Staff } from './api'

export type StaffList = components['schemas']['StaffList']

// Core takes at most 100 a page.
export const pageSize = 100

export const roleNames: Record<Staff['role'], string> = { admin: 'Admin', store_staff: 'Store staff' }

// Key: the list is ['admin', 'staff-users'] (exact); there is no read of one staff user in core.
// ponytail: the first 100 staff users by email, no pager; the page says so when core holds more. Add a pager when a panel passes 100.
export const staffUsersQuery = queryOptions({
  queryKey: ['admin', 'staff-users'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/staff-users', { params: { query: { pageSize } } })
    if (error) throw error.error
    return data
  },
})

// The list with core's answer to a create or a change written into it, in core's order (by email), with no second read.
export function withStaff(list: StaffList, saved: Staff): StaffList {
  const others = list.items.filter((user) => user.id !== saved.id)
  const items = [...others, saved].sort((a, b) => (a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
  return { ...list, items, total: list.total + items.length - list.items.length }
}
```

#### REPLACE WHOLE `src/routes/_staff/_admin/staff.tsx` (step 3, same commit; task 2 replaces it again)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Badge, Card, ErrorBanner, PageHeader, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import type { Staff } from '../../../api'
import { pageSize, roleNames, staffUsersQuery } from '../../../staff'
import { storesQuery } from '../../../stores'

function StaffUsers() {
  const { staff: me } = Route.useRouteContext()
  const users = useQuery(staffUsersQuery)
  // The stores name each store-staff row.
  const stores = useQuery(storesQuery)
  const list = users.data
  const storeItems = stores.data?.items
  const storeName = new Map(storeItems?.map((store) => [store.id, store.name]))

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{user.name}</span>
          {user.id === me.id && <Badge variant="accent">You</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', cell: (user) => user.email },
    { key: 'role', header: 'Role', cell: (user) => roleNames[user.role] },
    {
      key: 'store',
      header: 'Store',
      // ponytail: a store beyond the first 100 by name has no name here; core never deletes a store that staff refer to.
      cell: (user) => (user.storeId ? (storeName.get(user.storeId) ?? 'Unknown store') : 'All stores'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => <Badge variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" />
      {list === undefined || storeItems === undefined ? (
        users.isError || stores.isError ? (
          <ErrorBanner message="Could not load the staff users." onRetry={() => void Promise.all([users.refetch(), stores.refetch()])} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : (
        <>
          {list.total > list.items.length && (
            <StatusMessage>Showing the first {pageSize} of {list.total} staff users, by email.</StatusMessage>
          )}
          <Card className="overflow-hidden">
            <Table stack caption="Staff users" columns={columns} rows={list.items} rowKey={(user) => user.id} />
          </Card>
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/staff')({ component: StaffUsers })
```

### Task 2: the create and edit dialog

#### NEW FILE `src/staff-dialog.test.tsx` (step 1, `test: staff user dialog`)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json } from './fake-core'
import { renderApp } from './render-app'
import { createdId, indu, kiran, staffCore } from './staff-fake'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const sent = (calls: Request[], method: string) => calls.filter((call) => call.method === method)
const listReads = (calls: Request[]) => calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/admin/staff-users'))
const emails = () =>
  within(screen.getByRole('table', { name: 'Staff users' }))
    .getAllByRole('button')
    .map((button) => button.getAttribute('aria-label'))
const row = (email: string) => screen.getByRole('button', { name: `Edit ${email}` }).closest('tr')!

async function openNew() {
  await userEvent.click(await screen.findByRole('button', { name: 'New staff user' }))
  return screen.getByRole('dialog', { name: 'New staff user' })
}

async function openEdit(email: string, name: string) {
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${email}` }))
  return screen.getByRole('dialog', { name: `Edit ${name}` })
}

// Fills the create form for a store-staff user at Indiranagar.
async function fillNew(dialog: HTMLElement) {
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Jaya Menon')
  await userEvent.type(within(dialog).getByLabelText('Email'), 'jaya@example.test')
  await userEvent.type(within(dialog).getByLabelText('Password'), 'staff12345')
  await userEvent.selectOptions(within(dialog).getByLabelText('Store'), indiranagar.id)
}

test('create a store-staff user: core gets what was typed and the row appears in email order without a second read', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openNew()
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Create staff user'])
  expect(within(dialog).getByLabelText('Name')).toHaveFocus()
  expect(within(dialog).getByLabelText('Role')).toHaveValue('store_staff')
  expect(within(dialog).getByLabelText('Password')).toHaveAttribute('type', 'password')
  expect(within(dialog).getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: 'jaya@example.test', password: 'staff12345', role: 'store_staff', storeId: indiranagar.id })
  expect(emails()).toEqual(['Edit admin@example.test', 'Edit indiranagar@example.test', 'Edit jaya@example.test', 'Edit koramangala@example.test'])
  for (const text of ['Jaya Menon', 'Store staff', 'Indiranagar', 'Active']) expect(within(row('jaya@example.test')).getByText(text)).toBeInTheDocument()
  expect(listReads(calls)).toHaveLength(1)
})

test('create an admin: no Store field and no store in the request', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.selectOptions(within(dialog).getByLabelText('Role'), 'admin')
  expect(within(dialog).queryByLabelText('Store')).not.toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: 'jaya@example.test', password: 'staff12345', role: 'admin' })
  expect(within(row('jaya@example.test')).getByText('All stores')).toBeInTheDocument()
})

test('store staff created without a store: core is asked without one and its refusal shows on Store', async () => {
  setToken('tok')
  const calls = fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(400, 'validation', 'must be a store id for store staff', 'storeId') })

  renderApp('/staff')
  const dialog = await openNew()
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Jaya Menon')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(within(dialog).getByLabelText('Store')).toHaveAccessibleDescription('Store staff see this store only. Choose a store.'))
  expect(await sent(calls, 'POST')[0].json()).toEqual({ name: 'Jaya Menon', email: '', password: '', role: 'store_staff' })
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['name', 'Name', 'Enter 1 to 100 characters.'],
  ['email', 'Email', 'Enter a valid email address.'],
  ['password', 'Password', '8 to 72 characters. Enter 8 to 72 characters.'],
  ['role', 'Role', 'Choose a role.'],
])('a validation error from core on %s is shown on its field', async (field, label, description) => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(400, 'validation', 'core says no', field) })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  await waitFor(() => expect(within(dialog).getByLabelText(label)).toHaveAccessibleDescription(description))
  expect(within(dialog).getByLabelText(label)).toBeInvalid()
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(dialog).not.toHaveTextContent('core says no')
})

test('a taken email is said on the Email field, and the next edit clears it', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': () => apiError(409, 'conflict', 'email already registered', 'email') })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  const email = within(dialog).getByLabelText('Email')
  await waitFor(() => expect(email).toHaveAccessibleDescription('A staff user with this email already exists.'))
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Password')).toHaveValue('staff12345')
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')
  expect(email).toHaveAccessibleDescription('')
  expect(email).not.toBeInvalid()
})

test.each([
  ['core fails', () => apiError(500, 'internal')],
  ['the answer has no error body', () => json(502)],
  ['core refuses without naming a field of the form', () => apiError(400, 'validation', 'invalid JSON')],
  ['core names a conflict that is not the email', () => apiError(409, 'conflict', 'no', 'name')],
])('when %s the dialog stays with an alert, and the next edit clears it', async (_, answer) => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, 'POST /admin/staff-users': answer })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the staff user. Try again.')
  expect(within(dialog).getByLabelText('Name')).toHaveValue('Jaya Menon')
  expect(emails()).toHaveLength(3)
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('edit shows what cannot change as text, sends only the changed name and shows core\'s answer in the row', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Save changes'])
  expect(dialog).toHaveTextContent('koramangala@example.test, Store staff. The email, the role and the store cannot be changed: create a new staff user instead.')
  for (const label of ['Email', 'Role', 'Store']) expect(within(dialog).queryByLabelText(label)).not.toBeInTheDocument()
  expect(within(dialog).getByLabelText('Status')).toHaveValue('active')
  expect(within(dialog).getByLabelText('New password')).toHaveValue('')
  const name = within(dialog).getByLabelText('Name')
  await userEvent.clear(name)
  await userEvent.type(name, ' Kiran R ')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ name: ' Kiran R ' })
  expect(new URL(sent(calls, 'PATCH')[0].url).pathname).toBe(`/api/core/v1/admin/staff-users/${kiran.id}`)
  expect(within(row(kiran.email)).getByText('Kiran R')).toBeInTheDocument()
  expect(listReads(calls)).toHaveLength(1)
})

test('a new password is sent alone, and no password is left in the page or the mutation cache', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  const router = renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  const password = within(dialog).getByLabelText('New password')
  expect(password).toHaveAttribute('type', 'password')
  expect(password).toHaveAttribute('autocomplete', 'new-password')
  await userEvent.type(password, 'newpass123')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ password: 'newpass123' })
  await waitFor(() => expect(router.options.context.queryClient.getMutationCache().getAll()).toHaveLength(0))
  expect(JSON.stringify(router.options.context.queryClient.getQueryCache().getAll().map((query) => query.state.data))).not.toContain('newpass123')
  expect(document.body).not.toHaveTextContent('newpass123')
  expect(within(await openEdit(kiran.email, kiran.name)).getByLabelText('New password')).toHaveValue('')
})

test('deactivate and activate: Status is sent alone and the row follows core\'s answer', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  let dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'inactive')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ isActive: false })
  expect(within(row(kiran.email)).getByText('Inactive')).toBeInTheDocument()

  dialog = await openEdit(indu.email, indu.name)
  expect(within(dialog).getByLabelText('Status')).toHaveValue('inactive')
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'active')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[1].json()).toEqual({ isActive: true })
  expect(within(row(indu.email)).getByText('Active')).toBeInTheDocument()
})

test('Save changes with nothing changed closes the dialog without a request', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'inactive')
  await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'active')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(sent(calls, 'PATCH')).toHaveLength(0)
})

test('an admin\'s own dialog has no Status field, and a saved name shows in the row and the banner', async () => {
  setToken('tok')
  const calls = fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(admin.email, admin.name)
  expect(within(dialog).queryByLabelText('Status')).not.toBeInTheDocument()
  expect(within(dialog).getByText('You cannot deactivate your own account.')).toBeInTheDocument()
  const name = within(dialog).getByLabelText('Name')
  await userEvent.clear(name)
  await userEvent.type(name, 'Asha A')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await sent(calls, 'PATCH')[0].json()).toEqual({ name: 'Asha A' })
  expect(within(row(admin.email)).getByText('Asha A')).toBeInTheDocument()
  expect(within(row(admin.email)).getByText('You')).toBeInTheDocument()
  await waitFor(() => expect(within(screen.getByRole('banner')).getByText('Asha A')).toBeInTheDocument())
  expect(calls.filter((call) => new URL(call.url).pathname.endsWith('/admin/me'))).toHaveLength(1)
})

test('another staff user\'s dialog has the Status field and no own-account line', async () => {
  setToken('tok')
  fakeCore(staffCore().routes)

  renderApp('/staff')
  const dialog = await openEdit(indu.email, indu.name)

  expect(within(dialog).getByLabelText('Status')).toBeInTheDocument()
  expect(within(dialog).queryByText('You cannot deactivate your own account.')).not.toBeInTheDocument()
})

test('while a save runs the button reads "Saving…", keeps focus, is never disabled, and a second press or Enter sends nothing', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))

  const button = await within(dialog).findByRole('button', { name: 'Saving…' })
  expect(button).toHaveFocus()
  expect(button).toBeEnabled()
  expect(button).toHaveAttribute('aria-disabled', 'true')
  await userEvent.click(button)
  await userEvent.type(within(dialog).getByLabelText('Name'), '{Enter}')
  expect(sent(calls, 'POST')).toHaveLength(1)
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(emails()).toHaveLength(4)
})

test('an edit typed while a save runs leaves the save attached: it still closes the dialog', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await within(dialog).findByRole('button', { name: 'Saving…' })
  await userEvent.type(within(dialog).getByLabelText('Name'), '!')

  expect(within(dialog).getByRole('button', { name: 'Saving…' })).toBeInTheDocument()
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(within(row('jaya@example.test')).getByText('Jaya Menon')).toBeInTheDocument()
})

test('Cancel and Escape close the dialog without a request, but not while a save runs', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore(core.routes)

  renderApp('/staff')
  await userEvent.click(within(await openNew()).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await openNew()
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New staff user' })).toHaveFocus()

  const dialog = await openNew()
  expect(within(dialog).getByLabelText('Name')).toHaveValue('')
  await fillNew(dialog)
  core.hold()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await within(dialog).findByRole('button', { name: 'Saving…' })
  await userEvent.keyboard('{Escape}')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.getByRole('dialog', { name: 'New staff user' })).toBeInTheDocument()
  core.release()
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(sent(calls, 'POST')).toHaveLength(1)
  expect(row('jaya@example.test')).toBeInTheDocument()
})

test('an unknown staff user on save shows the alert and leaves the row as it was', async () => {
  setToken('tok')
  fakeCore({ ...staffCore().routes, [`PATCH /admin/staff-users/${kiran.id}`]: () => apiError(404, 'not_found') })

  renderApp('/staff')
  const dialog = await openEdit(kiran.email, kiran.name)
  await userEvent.type(within(dialog).getByLabelText('Name'), ' Jr')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not save the staff user. Try again.')
  expect(within(row(kiran.email)).getByText('Kiran Rao')).toBeInTheDocument()
})

test('a staff user just created can be changed at once: the row is replaced, not added again', async () => {
  setToken('tok')
  const core = staffCore()
  const calls = fakeCore({ ...core.routes, [`PATCH /admin/staff-users/${createdId}`]: () => json(200, { id: createdId, email: 'jaya@example.test', name: 'Jaya M', role: 'store_staff', storeId: indiranagar.id, isActive: true }) })

  renderApp('/staff')
  const dialog = await openNew()
  await fillNew(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create staff user' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const edit = await openEdit('jaya@example.test', 'Jaya Menon')
  await userEvent.type(within(edit).getByLabelText('Name'), '!')
  await userEvent.click(within(edit).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(new URL(sent(calls, 'PATCH')[0].url).pathname).toBe(`/api/core/v1/admin/staff-users/${createdId}`)
  expect(within(row('jaya@example.test')).getByText('Jaya M')).toBeInTheDocument()
  expect(emails()).toHaveLength(4)
})
```

#### NEW FILE `src/staff-dialog.tsx` (step 2, `feat: staff user create and edit dialog`)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { api, meQuery, type ApiError, type Staff } from './api'
import { roleNames, staffUsersQuery, withStaff } from './staff'
import type { AdminStore } from './stores'

type Field = 'name' | 'email' | 'password' | 'role' | 'storeId'

// One message per field for core's 400 naming it (core's own messages speak of bytes and ids).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  email: 'Enter a valid email address.',
  password: 'Enter 8 to 72 characters.',
  role: 'Choose a role.',
  storeId: 'Choose a store.',
}
const taken = 'A staff user with this email already exists.'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

// Create (no user) or change a staff user in a dialog. Core changes only the name, the password and the status; `self`
// is the signed-in admin's own row, which cannot be deactivated here. The password lives in this component only: it is
// never shown, and it is gone when the dialog closes.
export function StaffDialog({ user, self, stores, onClose }: { user?: Staff; self: boolean; stores: AdminStore[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Staff['role']>('store_staff')
  const [storeId, setStoreId] = useState('')
  const [status, setStatus] = useState(user && !user.isActive ? 'inactive' : 'active')

  // PATCH sends only what differs from the row; an empty password field keeps the password.
  const changes = (from: Staff) => ({
    ...(name !== from.name && { name }),
    ...(password && { password }),
    ...((status === 'active') !== from.isActive && { isActive: status === 'active' }),
  })

  const save = useMutation({
    // The request body holds the password: a finished save is dropped from the mutation cache at once, not kept for five minutes.
    gcTime: 0,
    mutationFn: async () => {
      const { data, error } = user
        ? await api.PATCH('/admin/staff-users/{id}', { params: { path: { id: user.id } }, body: changes(user) })
        : await api.POST('/admin/staff-users', { body: { name, email, password, role, ...(role === 'store_staff' && storeId && { storeId }) } })
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(staffUsersQuery.queryKey, (list) => list && withStaff(list, saved))
      if (self) {
        // The banner shows the signed-in admin's name: the guard reads it again from the session entry.
        queryClient.setQueryData(meQuery.queryKey, saved)
        void router.invalidate()
      }
      onClose()
    },
  })

  // While a save runs the dialog stays: its answer closes it, and must not close a dialog opened since.
  function close() {
    if (!save.isPending) onClose()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (save.isPending) return
    if (user && Object.keys(changes(user)).length === 0) return onClose()
    save.mutate()
  }

  // Any edit clears core's last answer, but never while a save runs: reset() would detach it.
  function edit<Value>(set: (value: Value) => void, value: Value) {
    set(value)
    if (!save.isPending) save.reset()
  }

  // A validation error naming a form field, and the taken email, go to that field; anything else to the banner.
  const apiError = save.error as Partial<ApiError> | null
  const field = apiError?.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const fieldError = field && (apiError?.code === 'validation' ? messages[field] : apiError?.code === 'conflict' && field === 'email' ? taken : undefined)
  const errorFor = (name: Field) => (field === name ? fieldError : undefined)

  return (
    <Dialog open onClose={close} title={user ? `Edit ${user.name}` : 'New staff user'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !fieldError && <ErrorBanner message="Could not save the staff user. Try again." />}
        {user && (
          <p className="text-body text-ink">
            {user.email}, {roleNames[user.role]}. The email, the role and the store cannot be changed: create a new staff user instead.
          </p>
        )}
        <FormField label="Name" error={errorFor('name')}>
          <Input autoComplete="off" value={name} onChange={(event) => edit(setName, event.target.value)} />
        </FormField>
        {!user && (
          <FormField label="Email" error={errorFor('email')}>
            <Input type="email" autoComplete="off" value={email} onChange={(event) => edit(setEmail, event.target.value)} />
          </FormField>
        )}
        <FormField
          label={user ? 'New password' : 'Password'}
          hint={user ? 'Leave empty to keep the current password. 8 to 72 characters.' : '8 to 72 characters.'}
          error={errorFor('password')}
        >
          <Input type="password" autoComplete="new-password" value={password} onChange={(event) => edit(setPassword, event.target.value)} />
        </FormField>
        {!user && (
          <FormField label="Role" error={errorFor('role')}>
            <Select value={role} onChange={(event) => edit(setRole, event.target.value as Staff['role'])}>
              <option value="store_staff">{roleNames.store_staff}</option>
              <option value="admin">{roleNames.admin}</option>
            </Select>
          </FormField>
        )}
        {!user && role === 'store_staff' && (
          <FormField label="Store" hint="Store staff see this store only." error={errorFor('storeId')}>
            <Select value={storeId} onChange={(event) => edit(setStoreId, event.target.value)}>
              <option value="">Choose a store</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        {user && !self && (
          <FormField label="Status" hint="Inactive staff cannot sign in and are signed out at once.">
            <Select value={status} onChange={(event) => edit(setStatus, event.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </FormField>
        )}
        {self && <p className="text-small text-ink-muted">You cannot deactivate your own account.</p>}
        <DialogFooter onCancel={close} className="mt-2">
          <Button type="submit" aria-disabled={save.isPending} className={idle}>
            {save.isPending ? 'Saving…' : user ? 'Save changes' : 'Create staff user'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
```

#### REPLACE WHOLE `src/routes/_staff/_admin/staff.tsx` (step 2, same commit)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Badge, Button, Card, ErrorBanner, PageHeader, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import type { Staff } from '../../../api'
import { pageSize, roleNames, staffUsersQuery } from '../../../staff'
import { StaffDialog } from '../../../staff-dialog'
import { storesQuery } from '../../../stores'

function StaffUsers() {
  const { staff: me } = Route.useRouteContext()
  const users = useQuery(staffUsersQuery)
  // The stores name each store-staff row and fill the dialog's "Store" choice.
  const stores = useQuery(storesQuery)
  const [editing, setEditing] = useState<Staff | 'new'>()
  const list = users.data
  const storeItems = stores.data?.items
  const storeName = new Map(storeItems?.map((store) => [store.id, store.name]))

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Name',
      cell: (user) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink">{user.name}</span>
          {user.id === me.id && <Badge variant="accent">You</Badge>}
        </span>
      ),
    },
    { key: 'email', header: 'Email', cell: (user) => user.email },
    { key: 'role', header: 'Role', cell: (user) => roleNames[user.role] },
    {
      key: 'store',
      header: 'Store',
      // ponytail: a store beyond the first 100 by name has no name here; core never deletes a store that staff refer to.
      cell: (user) => (user.storeId ? (storeName.get(user.storeId) ?? 'Unknown store') : 'All stores'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (user) => <Badge variant={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      cell: (user) => <Button variant="ghost" aria-label={`Edit ${user.email}`} onClick={() => setEditing(user)}>Edit</Button>,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Staff" actions={list && storeItems && <Button onClick={() => setEditing('new')}>New staff user</Button>} />
      {list === undefined || storeItems === undefined ? (
        users.isError || stores.isError ? (
          <ErrorBanner message="Could not load the staff users." onRetry={() => void Promise.all([users.refetch(), stores.refetch()])} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : (
        <>
          {list.total > list.items.length && (
            <StatusMessage>Showing the first {pageSize} of {list.total} staff users, by email.</StatusMessage>
          )}
          <Card className="overflow-hidden">
            <Table stack caption="Staff users" columns={columns} rows={list.items} rowKey={(user) => user.id} />
          </Card>
        </>
      )}
      {editing && storeItems && (
        <StaffDialog
          user={editing === 'new' ? undefined : editing}
          self={editing !== 'new' && editing.id === me.id}
          stores={storeItems}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/staff')({ component: StaffUsers })
```

### Task 3: the stock table's image column

#### APPEND to `src/stock.test.tsx` (step 1, `test: stock product image`): after the last line of the file, one empty line, then
```tsx
test('each stock row starts with the product\'s image as a tile, a placeholder when it has none', async () => {
  setToken('tok')
  const pictured = { ...banana, imageUrl: '/api/core/v1/files/products/seed-fruits-vegetables.png' }
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [pictured, milk]).routes })

  renderApp('/stock')

  const table = await screen.findByRole('table', { name: 'Stock' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Image', 'Product', 'Unit', 'Price', 'Quantity', 'Status'])
  const [first, second] = within(table).getAllByRole('row').slice(1)
  const image = first.querySelector('td')!.querySelector('img')
  expect(image).toHaveAttribute('src', pictured.imageUrl)
  expect(image).toHaveAttribute('alt', '')
  expect(second.querySelector('img')).toBeNull()
  expect(second.querySelector('td')!.querySelector('[data-placeholder]')).not.toBeNull()
})
```

#### EDIT 1 `src/routes/_staff/stock.tsx`: the import (step 2, `feat: stock table shows the product image`)
After:
```tsx
import { api, type ApiError } from '../../api'
```
insert:
```tsx
import { ImageTile } from '../../image'
```

#### EDIT 2 `src/routes/_staff/stock.tsx`: the column (same commit)
After:
```tsx
  const columns: Column<StockRow>[] = [
```
insert:
```tsx
    { key: 'image', header: 'Image', cell: (row) => <ImageTile src={row.imageUrl} className="w-10" /> },
```

### Task 4
No code: the manager's `make e2e`. See `briefs/task-4.md`.

## Risks / Trade-offs
- The e2e ran only against a fake. The first run against the real core (task 4) may meet a difference: the seeded staff names, the order of the store options, a slower sign-in. The spec reads what the seed decides by email and by id, not by name, except the store names "Indiranagar" and "Koramangala" (pinned by core's seed tests).
- `e2e/staff.spec.ts` creates `e2e-staff@shopperstop.local`. A second Playwright run against a database that was not reset would get 409 on the create; global setup resets before every run, and the config has no retries.
- The catalog test is longer; a failure in the stock stretch leaves "E2E Curd Cup" behind until the next reset, as a failure after its create already did.
- While the catalog test's product has no stock it counts as low stock at both stores, as it did before this change; for a moment it now holds 12 at Koramangala. `stock.spec.ts` reads its counts from the page and still matches `14[78] products`.
- The own-account rule is the panel's, not core's: a `PATCH` sent by hand can still deactivate the caller (A4). Asked of core as information, not as a blocker.

## Accepted ceilings
- First 100 staff users by email, no pager, no search; the page says when the list is cut (Decision 3).
- "Unknown store" for a store beyond the first 100 stores by name (Decision 5).
- A row added or renamed sits where code-unit order puts its email until the next read (Decision 8).
- No client-side validation; "8 to 72 characters" stands for core's bytes (Decision 9).
- A core error clears on any edit of the dialog, not only of its field (Decision 10).
- Text typed during a save is dropped when the dialog closes; Cancel and Escape wait for the answer (Decision 11).
- `idle` exists once more (here, `stock.tsx`, and L5's `src/idle.ts`) until a follow-up or ui's `Button` takes it (Decision 13).
- The created e2e staff user stays, inactive, until the next reset (Decision 19).
- The Edit dialog shows the role but not the store's name next to it (the row behind it does).
- No e2e for the taken email or a refused password: Vitest covers the page's side, core's tests cover core's.

## Migration Plan
None: no data, no config, no route added. Rollback is reverting the PR; the placeholder page returns.
