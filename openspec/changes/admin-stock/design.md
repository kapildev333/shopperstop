# Design

## Context
Lane admin-P2-L4, area `admin`, branch `lane/admin-P2-L4-admin-stock` in `.worktrees/admin-P2-L4`, cut from origin/main at 503e1ba: admin-stores (#91) and core-P2-L4 (#106: the staff stock routes and the regenerated `packages/ui/src/api/core.d.ts`) are on main; admin-catalog (admin-P2-L3) is not. `/stock` is a `PageHeader` placeholder from admin-P2-L1.

The whole change was spiked on this branch on 2026-10-13 (Node 22.23.3, `npm ci` at the root) and removed again; the tree holds only these documents. Measured on the spike: the three task shapes built in order, tests first, with the red and green Vitest counts in tasks.md; lint, typecheck and `vite build` green after every task; `make test-web` exit 0 on the final tree (ui 54, admin 86, web 20); `src/routeTree.gen.ts` unchanged by the build; the twenty mutation guards below, each run and restored. `e2e/stock.spec.ts` passed 2 of 2 with axe clean on a scratch preview (port 25174) against a stateful `page.route` fake of core. It has not run against the real core: that is task 4, the manager's e2e slot.

The code below is that spike, byte for byte. Workers copy it; a worker who finds a block that does not compile, a count that differs, or a choice this file leaves open stops and reports.

## Assumptions (verified on 503e1ba)
| # | Assumption | Result |
|---|---|---|
| A1 | `GET /admin/stores/{id}/stock` takes `q`, `lowStock` (boolean), `page`, `pageSize` (default 24, max 100) and answers `StockList {items, page, pageSize, total}` of `StockRow {productId, name, brand?, unitLabel, priceCents, quantity}`, sorted by name | holds: `core.d.ts`, `services/core/internal/stock/handlers.go` `List`; the spike typechecks against it |
| A2 | `lowStock=true` keeps quantities below 5, zero included; a product with no stock row is listed with 0; inactive products are never listed | holds: `handlers.go`, the operation's description |
| A3 | `PUT /admin/stores/{id}/stock` takes `StockUpdate {rows:[{productId, quantity}]}` and answers 204 with no body | holds; openapi-fetch gives `error: undefined` on the 204 (the save tests are green) |
| A4 | PUT validation, first problem wins, all 400 `validation`: `rows` "1 to 500 rows"; `productId` "must be a uuid"; `quantity` "quantity is required" or "0 to 100000"; `rows` "product listed twice"; `rows` "unknown product" (foreign key) | holds: `handlers.go` `checkRows`, `Put`. The page can only meet the last one: it sends 1 to 500 rows, ids core gave it, each once, quantities it checked |
| A5 | another store's staff and an unknown store answer 404 `not_found` on both routes | holds: `storeFor`. The page never asks for another store as store staff, and an admin's store comes from the stores list |
| A6 | `GET /admin/stores` and `GET /admin/stores/{id}` are admin only (store staff get 403), so store staff cannot read their store's name | holds: `core.d.ts` descriptions. The page shows no store name to store staff |
| A7 | `Staff.storeId` is present for store staff and absent for admins | holds: `core.d.ts`, the fixtures `admin` and `storeStaff` in `src/fake-core.ts` |
| A8 | The router keeps the route component mounted across search changes and reads search values as JSON (`page=2` a number, `lowStock=true` a boolean, a uuid a string) | holds: the URL tests are green |
| A9 | `keepPreviousData` passed through a `placeholderData` function keeps the page on screen within one store and nothing across stores | holds: mutation guards "drop placeholderData", "placeholder across stores" |
| A10 | Tailwind 4 builds `aria-disabled:opacity-50` and `aria-disabled:cursor-not-allowed` for `[aria-disabled=true]` | holds: both rules are in the built CSS |
| A11 | seed: stores Indiranagar (`…0402`) and Koramangala (`…0401`), listed in that order (by name); 148 products with one inactive; per store a zero and a 1 to 4 every 15 products, the rest 10 to 49; "Sunny Fields Toned Milk" exists; staff `koramangala@shopperstop.local` | read in `services/core/internal/seed/seed.go`; not run against the database. The e2e therefore accepts 147 or 148 products, reads the milk's quantity instead of assuming it, and counts the low rows instead of naming a number |
| A12 | `src/fake-core.ts` exports `admin`, `storeStaff` (with `storeId`), `apiError`, `fakeCore`, `json`, `indiranagar`, `koramangala`, `storeList`; `src/stores.ts` exports `storesQuery` (first 100 by name) and `AdminStore`; `renderApp` returns the router | holds on main |

## Goals / Non-Goals
Goals: the page in the proposal, composed only from `@shopperstop/ui` components, every delta scenario mapped to a named test, and nothing that makes the rebase against admin-catalog a merge by hand. Non-goals: everything under the proposal's "Out of scope"; any change outside `apps/admin/`; any new dependency.

## Decisions
Decisions 2, 5, 6, 7 and 8 are the ones the manager asked to be decided and recorded (D13: recommended and proceeded on).
1. Capability `admin-app`, ADDED requirements, every name starting with "Stock" (as admin-auth-nav, admin-stores and admin-catalog did for their pages).
2. The selected store lives in the URL as `store`, and so do the search (`q`), the filter (`lowStock`) and the page (`page`): one `validateSearch` on the route, one `go(change)` that navigates and drops `page`. Reason: a reload and a shared link show the same list, and admin-P2-L5's dashboard can link a store's low-stock count to `/stock?store=<id>&lowStock=true` with a typed `Link`. Only the text being typed in the search field is component state, started from `q`. Ceiling: the router reads a hand-typed `?q=1e3` as the number 1000 (it quotes such strings itself when it writes the URL, so its own links are safe).
3. A `store` in the URL that is not in the stores list falls back to the first store, without a message. So an admin never asks core for an unknown store and there is no 404 branch to build. Ceiling: a stale shared link silently shows another store; the selector says which.
4. Store staff: the store is `staff.storeId` from `GET /admin/me`; the stores query is disabled for them (it would answer 403, which the app turns into the not-found page). The page shows them no store name (A6). Ceiling: a store name for store staff needs a core route they may read; noted as a request.
5. Unsaved edits are one map keyed by `productId` (`Edits`: the typed text and the product's name), kept across pages, search and filter of one store and sent in one `PUT`. The map is tagged with its store (`draft = {store, edits}`) and read as empty for any other store, so no path can send one store's edits to another: not the selector, not the browser's Back button, not a link. Not a `key={storeId}` remount: that would drop keyboard focus from the selector on every change.
6. Switching store with unsaved edits asks first in a ui `Dialog` ("Discard unsaved changes?", "Cancel" then "Discard and switch"); with none it switches at once. A store changed through the URL (Back, a link) cannot be asked: the edits are then hidden, not sent, and are back when the admin returns to their store; "Discard and switch" really drops them. Ceiling: no warning on leaving `/stock` or closing the tab; the edits are lost.
7. Low-stock badge: `quantity < 5` on the quantity core holds, zero included (`lowStockBelow`, core's threshold, checked by the e2e against core's own filter). It does not follow the typed value: it says what customers get now and changes with the save. One badge, no separate "Out of stock" (status colours: `warning` is caution; an empty shelf is not an error of the page). An edited row carries an `accent` "Unsaved" badge.
8. The 500-row limit: `toRows` cuts a save to the first 500 edits in the order they were made; the rest stay unsaved and the count shows them, so pressing "Save changes" again sends them. One press is always one `PUT`. Not a refusal (a dead end with no partial save) and not several `PUT`s in one press (loses the one-transaction guarantee per press and the "one `PUT`" rule). Ceiling: 501 hand-typed edits need two presses; nobody types that many.
9. A quantity is checked as it is typed (`parseQuantity`: whole, 0 to 100000, spaces ignored) and the mark on the field (`aria-invalid`, the ui `Input`'s `danger` border) is derived from the value, so it cannot go stale. The message is one alert on save, naming the products, because the row may be on another page; it is cleared by the next edit. A row field has no visible label or error line (dense table): `aria-label` names it. Ceiling: the reason is in the alert, not next to the field.
10. After a save: `removeQueries` on the store's stock pages that are not on screen, then `await invalidateQueries` for the one that is, then the edits go. So a page visited before the save is never shown with the old quantity (it loads afresh), and the field never flashes the old value between "edit gone" and "new quantity here". Only rows that were sent, and whose field still holds the sent value, stop being edits: an edit typed while the `PUT` ran, or beyond row 500, stays.
11. The page on screen stays while the next page, search or filter loads (`placeholderData`, same store only), so the pressed pager button or toggle is not unmounted and keeps focus. Ceiling: for that moment the pager text already names the new page above the old rows.
12. "Previous", "Next", "Discard changes" and "Save changes" are `aria-disabled` when they cannot act, never `disabled`, and their handlers do nothing then: `disabled` drops keyboard focus from the button just pressed (admin-catalog review 4). The look comes from two state utilities on the page (`idle`); asked of ui as a `Button` feature. "Save changes" still uses `Button`'s `loading`, which disables it for the length of the `PUT`: the design-system pattern every form here uses; the button is enabled again when the answer is in.
13. Page size 24 (core's default, as the products table). A page beyond the last (a save emptied it under the filter, or a typed URL) is replaced by the last page with rows, in one effect.
14. No product image in the table: `@shopperstop/ui` has no `ImageTile`, and admin-catalog's app-level copy is not on main. Ceiling: add the column when ui ships `ImageTile` (core's `StockRow` would also need `imageUrl`).
15. Nothing shared is edited: the stock fixtures and the stateful fake of the two routes live in `src/stock.test.tsx`, not in `src/fake-core.ts`; the pure rules live in `src/stock.ts` with their own `src/stock-rules.test.ts`. So the rebase against admin-catalog has no textual conflict (see "Rebase against admin-catalog").
16. Save failures: 400 `validation` can only mean a changed product was deleted meanwhile (A4), so it gets its own sentence; everything else (404, 500, network) is "Could not save the stock. Try again.". Edits stay; the alert goes with the next edit (`save.reset()`). Status and alert are shown only for a save of the store on screen.
17. The save bar is a `Card` above the table, not sticky. Ceiling: on a long page the admin scrolls up to save; a sticky bar is a ui pattern to ask for if staff want it. Enter in a quantity field does not save.
18. e2e: one admin and one store-staff sign-in (core's sign-in rate limit); the quantity is read, raised by one, checked after a reload and saved back; every count the seed decides is read from the page, not written in the spec (A11).
19. Test notes: quantity fields are found by `role="textbox"` and their `aria-label`; `type()` clears and types as a user would; the fake `stockCore` filters and pages like core and can hold its `GET`s (`hold`/`release`) so a test can look at the moment before an answer.

## Files (all under `apps/admin/`)
| Task | Test files (committed first) | Code files |
|---|---|---|
| 1 | `e2e/stock.spec.ts` (new, not run), `src/stock.test.tsx` (new, 13 tests) | `src/stock.ts` (new), `src/routes/_staff/stock.tsx` (replaces the placeholder; quantity fields read-only) |
| 2 | `src/stock.test.tsx` (7 tests appended), `src/stock-rules.test.ts` (new, 2 tests, 10 runs) | `src/stock.ts` and `src/routes/_staff/stock.tsx` (both replaced by their task-2 shape) |
| 3 | `src/stock.test.tsx` (3 tests appended), `src/stock-rules.test.ts` (1 test appended) | `src/stock.ts` and `src/routes/_staff/stock.tsx` (both replaced by their final shape) |
| 4 | none new: runs `e2e/stock.spec.ts` | fixes only, after a recorded failure |

Nothing else: no `src/fake-core.ts`, `src/routeTree.gen.ts`, `package.json`, `package-lock.json`, vite, Playwright or eslint config change; nothing in `packages/ui` or `services/core`.

## Rebase against admin-catalog (whichever lane merges second rebases)
admin-catalog (branch `lane/admin-P2-L3-admin-catalog`) touches, under `apps/admin/`: `e2e/catalog.spec.ts`, `src/catalog.ts`, `src/categories.tsx`, `src/image.tsx`, `src/product-form.tsx`, their five test files, `src/fake-core.ts` (two type aliases at the top, fixtures appended), `src/routeTree.gen.ts` (two product routes), `src/routes/_staff/_admin/categories.tsx` and `src/routes/_staff/_admin/products/*`. This change touches `e2e/stock.spec.ts`, `src/stock.ts`, `src/stock.test.tsx`, `src/stock-rules.test.ts` and `src/routes/_staff/stock.tsx`. The two sets are disjoint, so `git rebase` is expected to report no conflict in `apps/`. What to check after it, in this order:
| File | Expected | If not |
|---|---|---|
| `apps/admin/src/routeTree.gen.ts` | no conflict: this change does not alter it (the `/stock` route exists; `validateSearch` is not in the generated file). After the rebase run `npm run build --workspace apps/admin`; `git status` must show it unchanged | take the generated file as the build writes it; never merge it by hand |
| `apps/admin/src/fake-core.ts` | no conflict: this change does not edit it. `src/stock.test.tsx` imports only `admin`, `apiError`, `fakeCore`, `indiranagar`, `json`, `koramangala`, `storeList`, `storeStaff`, which admin-catalog leaves as they are; its own `banana` and `milk` are local constants and do not meet admin-catalog's exported `banana` and `tonedMilk` | keep admin-catalog's file whole |
| `openspec/specs/admin-app/spec.md` | not touched by either feature PR; each archive PR appends its ADDED requirements. Names are disjoint (all of this change's start with "Stock") | archive one change after the other, never both in one PR |
| `.claude/areas/admin.md` | the manager's file, edited by both chore PRs | the manager merges it |
| counts | Vitest: this change adds 34 to whatever the base has (52 on main: 86; on admin-catalog with its task 5b: 95 + 34 = 129). Playwright admin: base + 2 (6 on main: 8; with admin-catalog: 10) | a different sum means a test was lost in the rebase |
tasks.md gives every count as measured on 503e1ba (base 52); on a rebased branch a worker first runs the suite and adds the difference.

## Tests (scenario -> test)
| Requirement › Scenario | File | Test name | Task |
|---|---|---|---|
| Stock table › Stock listed | `src/stock.test.tsx` | "the stock table lists a page of the first store and badges quantities below 5" | 1 |
| Stock store for admins › Choose a store | same | "choosing a store puts it in the URL and loads its stock, never under the other store's rows" | 1 |
| Stock store for admins › Store in the URL | same | "a store in the URL is the one shown" | 1 |
| Stock store for admins › Unknown store in the URL | same | "a store in the URL that is not a store shows the first store" | 1 |
| Stock store for store staff › Store staff see their own store | same | "store staff see their own store and no store selector" | 1 |
| Stock search and low-stock filter › Search and filter from the first page | same | "search and the low-stock filter ask core again from the first page" | 1 |
| Stock pager › Pager | same | "the pager moves between pages and the pressed button keeps focus" | 1 |
| Stock pager › Page past the end | same | "a page past the end shows the last page" | 1 |
| Stock table states › Search without a match | same | "a search that matches nothing shows the empty state" | 1 |
| Stock table states › Stock loading | same | "the stock table shows a skeleton while loading" | 1 |
| Stock table states › Stock load failure | same | "stock load failure shows a retry that reloads" | 1 |
| Stock table states › No stores | same | "an admin with no stores is told to create one" | 1 |
| Stock table states › Stores load failure | same | "stores load failure shows a retry that reloads" | 1 |
| Stock edits › Edit typed back | same | "an edit typed back to the saved quantity is no change, and nothing is sent" | 2 |
| Stock edits › Discard | same | "discard puts every quantity back to what core holds" | 2 |
| Stock save › Edits on two pages saved with one PUT | same | "edits made on two pages and under a filter are saved with one PUT" | 2 |
| Stock save › Kept page read again | same | "a page kept from before a save is read again, never shown with the old quantity" | 2 |
| Stock save › Edit typed during a save | same | "an edit typed while a save is in flight stays unsaved" | 2 |
| Stock save › More than 500 edits | `src/stock-rules.test.ts` | "one save takes the first 500 edits, in the order they were made" | 3 |
| Stock quantity the page cannot send › Unsendable quantity | `src/stock.test.tsx` | "a quantity the page cannot send is marked, named on save and not sent" | 2 |
| Stock quantity the page cannot send › Quantity as typed | `src/stock-rules.test.ts` | "quantity %j is read as %j" (one `test.each`, 9 runs), "a value that is not a quantity is never sent as a number" | 2 |
| Stock save failures › Save refused for a deleted product | `src/stock.test.tsx` | "a save refused for a deleted product says so and keeps the edits" | 3 |
| Stock save failures › Other save failure | same | "any other save failure shows a banner, keeps the edits and can be retried" | 3 |
| Stock store switch with unsaved edits › Switch asks first | same | "switching store with unsaved edits asks first" | 3 |
| Stock store switch with unsaved edits › Store changed in the URL | same | "unsaved edits never follow a store changed in the URL" | 2 |
| Stock against core › Admin sets stock at a store | `e2e/stock.spec.ts` | "admin sets stock at a store" | 1 (written), 4 (run) |
| Stock against core › Store staff set stock at their own store only | same | "store staff set stock at their own store only" | 1 (written), 4 (run) |

12 requirements, 27 scenarios: 25 on Vitest (26 tests, 34 runs: `src/stock.test.tsx` 23, `src/stock-rules.test.ts` 3 tests / 11 runs) and 2 on Playwright. With main's 52 the admin suite ends at 86 (measured). "Store changed in the URL" is built in task 2 because the store tag on the edits is part of how task 2 holds them; task 3 adds the dialog on top.

## Mutation guards (for the reviewer; each run on the final spike tree on 2026-10-13, 86 tests, only the named tests red, then restored)
| Mutation | Test that turns red |
|---|---|
| drop `removeQueries` from the save's `onSuccess` | "a page kept from before a save is read again, never shown with the old quantity" |
| drop the `await invalidateQueries` from the save's `onSuccess` | "edits made on two pages and under a filter are saved with one PUT", "an edit typed while a save is in flight stays unsaved" |
| clear every edit on success instead of the rows sent | "an edit typed while a save is in flight stays unsaved" |
| read `draft.edits` without the store check | "unsaved edits never follow a store changed in the URL" |
| drop `page: undefined` from `go` | "search and the low-stock filter ask core again from the first page" |
| drop `placeholderData` from `stockQuery` | "the pager moves between pages and the pressed button keeps focus", "a page kept from before a save is read again, never shown with the old quantity" |
| keep the previous page across stores (`keepPreviousData` alone) | "choosing a store puts it in the URL and loads its stock, never under the other store's rows" |
| drop `discard()` from "Discard and switch" | "switching store with unsaved edits asks first" |
| always switch store without the dialog | "switching store with unsaved edits asks first" |
| drop `setRefused(false)` from `edit` | "a quantity the page cannot send is marked, named on save and not sent" |
| drop the `invalid.length` check from `submitSave` | "a quantity the page cannot send is marked, named on save and not sent" |
| drop `save.reset()` from `edit` | "a save refused for a deleted product says so and keeps the edits" |
| never run the past-the-end effect | "a page past the end shows the last page" |
| `disabled` instead of `aria-disabled` on "Next" | "the pager moves between pages and the pressed button keeps focus" |
| `disabled` instead of `aria-disabled` on "Save changes" | "an edit typed back to the saved quantity is no change, and nothing is sent" |
| ask for the stores as store staff (`enabled: true`) | "store staff see their own store and no store selector" |
| keep an edit typed back to core's quantity | "an edit typed back to the saved quantity is no change, and nothing is sent" |
| drop `.slice(0, maxRows)` from `toRows` | "one save takes the first 500 edits, in the order they were made" |
| send a value that is not a quantity as 0 | "a value that is not a quantity is never sent as a number" |
| `lowStockBelow = 6` | "the stock table lists a page of the first store and badges quantities below 5" |

## Code and tests per task (spiked; workers copy it byte for byte)
Every block below was built in this order on 503e1ba on 2026-10-13, tests first, with the red and green counts in tasks.md. Paths are under `apps/admin/`. A block is the whole file unless its heading says "append".

### Task 1: the stock table, the store, search, filter and pager, and the e2e spec

#### `e2e/stock.spec.ts` (new; written and committed first, run in task 4)
```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back the quantity it changes.
const koramangala = '00000000-0000-4000-8000-000000000401'
const indiranagar = '00000000-0000-4000-8000-000000000402'

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

async function saveQuantity(page: Page, value: string) {
  await page.getByRole('textbox', { name: 'Quantity of Sunny Fields Toned Milk' }).fill(value)
  await expect(page.getByText('1 unsaved change')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Stock saved.' })).toBeVisible()
  await expect(page.getByText('No unsaved changes')).toBeVisible()
}

test('admin sets stock at a store', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  const store = page.getByLabel('Store', { exact: true })
  const stock = page.getByRole('table', { name: 'Stock' })
  await expect(store.locator('option:checked')).toHaveText('Indiranagar')
  await expect(page.getByText(/^Page 1 of 7, 14[78] products$/)).toBeVisible()
  await expectNoAxeViolations(page)

  await store.selectOption({ label: 'Koramangala' })
  await expect(page).toHaveURL(new RegExp(`/admin/stock\\?store=${koramangala}$`))
  await expect(page.getByText(/^Page 1 of 7, 14[78] products$/)).toBeVisible()

  // Every row under the low-stock filter carries the badge: the page's threshold is core's.
  const lowOnly = page.getByRole('button', { name: 'Low stock only' })
  await lowOnly.click()
  await expect(page.getByText(/^Page 1 of 1, \d+ products$/)).toBeVisible()
  const low = (await stock.getByRole('row').count()) - 1
  expect(low).toBeGreaterThan(0)
  await expect(stock.getByText('Low stock', { exact: true })).toHaveCount(low)
  await expectNoAxeViolations(page)
  await lowOnly.click()

  await page.getByRole('searchbox', { name: 'Search' }).fill('sunny fields toned')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(stock.getByRole('textbox')).toHaveCount(1)
  const milk = page.getByRole('textbox', { name: 'Quantity of Sunny Fields Toned Milk' })
  const before = await milk.inputValue()
  const changed = String(Number(before) + 1)

  // An unsaved edit: the row is marked, and switching store asks first.
  await milk.fill(changed)
  await expect(stock.getByText('Unsaved', { exact: true })).toBeVisible()
  await expectNoAxeViolations(page)
  await store.selectOption({ label: 'Indiranagar' })
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
  await expect(dialog).toBeVisible()
  await expectNoAxeViolations(page)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(milk).toHaveValue(changed)

  await saveQuantity(page, changed)
  await page.reload()
  await expect(milk).toHaveValue(changed)
  await expect(store.locator('option:checked')).toHaveText('Koramangala')
  await saveQuantity(page, before)
})

test('store staff set stock at their own store only', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stock' }).click()
  await expect(page.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)
  await expectNoAxeViolations(page)

  // Another store in the URL changes nothing: core is asked for the staff member's own store.
  const asked = page.waitForRequest((request) => request.method() === 'GET' && /\/admin\/stores\/[^/]+\/stock/.test(request.url()))
  await page.goto(`./stock?store=${indiranagar}`)
  expect(new URL((await asked).url()).pathname).toBe(`/api/core/v1/admin/stores/${koramangala}/stock`)
  await expect(page.getByRole('table', { name: 'Stock' })).toBeVisible()
  await expect(page.getByLabel('Store', { exact: true })).toHaveCount(0)
})
```

#### `src/stock.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockRow } from './stock'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList, storeStaff } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const banana: StockRow = { productId: '00000000-0000-4000-8000-000000000601', name: 'Banana Robusta', unitLabel: '1 kg', priceCents: 7000, quantity: 0 }
const bread: StockRow = { productId: '00000000-0000-4000-8000-000000000620', name: 'Brown Bread', unitLabel: '400 g', priceCents: 4500, quantity: 5 }
const curd: StockRow = { productId: '00000000-0000-4000-8000-000000000630', name: 'Fresh Curd', unitLabel: '400 g', priceCents: 3550, quantity: 4 }
const milk: StockRow = { productId: '00000000-0000-4000-8000-000000000612', name: 'Sunny Fields Toned Milk', brand: 'Sunny Fields', unitLabel: '500 ml', priceCents: 2799, quantity: 17 }
// Thirty products, "Product 01" to "Product 30", holding 0 to 29: two pages of 24, the first five low.
const thirty: StockRow[] = Array.from({ length: 30 }, (_, i) => ({
  productId: `00000000-0000-4000-8000-0000000007${String(i + 1).padStart(2, '0')}`,
  name: `Product ${String(i + 1).padStart(2, '0')}`,
  unitLabel: '1 unit',
  priceCents: 1000,
  quantity: i,
}))

const asAdmin = { 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) }

// One store's stock as core serves it: q on name or brand, lowStock below 5, pages of 24, and a PUT that sets quantities.
// `puts` holds every PUT body; `hold` makes the GETs wait until `release()`.
function stockCore(storeId: string, rows: StockRow[]) {
  const held = rows.map((row) => ({ ...row }))
  const puts: unknown[] = []
  let gate = Promise.resolve()
  let release = () => {}
  return {
    puts,
    hold: () => {
      gate = new Promise<void>((resolve) => (release = resolve))
    },
    release: () => release(),
    routes: {
      [`GET /admin/stores/${storeId}/stock`]: async (request: Request) => {
        await gate
        const query = new URL(request.url).searchParams
        const q = (query.get('q') ?? '').toLowerCase()
        const page = Number(query.get('page') ?? 1)
        const match = held.filter(
          (row) => `${row.name} ${row.brand ?? ''}`.toLowerCase().includes(q) && (query.get('lowStock') !== 'true' || row.quantity < 5),
        )
        return json(200, { items: match.slice((page - 1) * 24, page * 24), page, pageSize: 24, total: match.length })
      },
      [`PUT /admin/stores/${storeId}/stock`]: async (request: Request) => {
        const body = (await request.json()) as { rows: { productId: string; quantity: number }[] }
        puts.push(body)
        for (const { productId, quantity } of body.rows) held.find((row) => row.productId === productId)!.quantity = quantity
        return json(204)
      },
    },
  }
}

// The query of the last stock list request.
function lastListQuery(calls: Request[]) {
  const list = calls.filter((call) => call.method === 'GET' && new URL(call.url).pathname.endsWith('/stock'))
  return Object.fromEntries(new URL(list[list.length - 1].url).searchParams)
}

const quantity = (name: string) => screen.getByRole('textbox', { name: `Quantity of ${name}` })
const findQuantity = (name: string) => screen.findByRole('textbox', { name: `Quantity of ${name}` })

test('the stock table lists a page of the first store and badges quantities below 5', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana, bread, curd, milk]).routes })

  renderApp('/stock')

  const table = await screen.findByRole('table', { name: 'Stock' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('textbox').map((input) => input.getAttribute('aria-label'))).toEqual([
    'Quantity of Banana Robusta',
    'Quantity of Brown Bread',
    'Quantity of Fresh Curd',
    'Quantity of Sunny Fields Toned Milk',
  ])
  expect(rows[3]).toHaveTextContent('Sunny Fields Toned Milk')
  expect(within(rows[3]).getByText('Sunny Fields')).toBeInTheDocument()
  expect(rows[3]).toHaveTextContent('500 ml')
  expect(rows[3]).toHaveTextContent('₹27.99')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(quantity('Banana Robusta')).toHaveValue('0')
  expect(within(rows[0]).getByText('Low stock')).toBeInTheDocument()
  expect(within(rows[2]).getByText('Low stock')).toBeInTheDocument()
  expect(within(rows[1]).queryByText('Low stock')).not.toBeInTheDocument()
  expect(within(rows[3]).queryByText('Low stock')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  expect(within(screen.getByLabelText('Store')).getAllByRole('option').map((option) => option.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(screen.getByText('Page 1 of 1, 4 products')).toBeInTheDocument()
  expect(new URL(calls[calls.length - 1].url).pathname).toBe(`/api/core/v1/admin/stores/${indiranagar.id}/stock`)
  expect(lastListQuery(calls)).toEqual({ page: '1', pageSize: '24' })
})

test('store staff see their own store and no store selector', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, storeStaff), ...stockCore(storeStaff.storeId!, [milk]).routes })

  renderApp(`/stock?store=${koramangala.id}`)

  expect(await findQuantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
  expect(calls.map((call) => new URL(call.url).pathname.replace('/api/core/v1', ''))).toEqual(['/admin/me', `/admin/stores/${storeStaff.storeId}/stock`])
})

test('choosing a store puts it in the URL and loads its stock, never under the other store\'s rows', async () => {
  setToken('tok')
  const other = stockCore(koramangala.id, [milk])
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...other.routes })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  other.hold()
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Quantity of Banana Robusta' })).not.toBeInTheDocument()
  other.release()
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
  expect(screen.getByLabelText('Store')).toHaveFocus()
  expect(router.state.location.search).toEqual({ store: koramangala.id })
})

test('a store in the URL is the one shown', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })

  renderApp(`/stock?store=${koramangala.id}`)

  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
})

test('a store in the URL that is not a store shows the first store', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes })

  renderApp('/stock?store=00000000-0000-4000-8000-000000000499')

  expect(await findQuantity('Banana Robusta')).toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
})

test('search and the low-stock filter ask core again from the first page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [...thirty, milk]).routes })

  const router = renderApp('/stock')
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), ' product ')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', page: '1', pageSize: '24' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))
  const chip = screen.getByRole('button', { name: 'Low stock only' })
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(chip)
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', lowStock: 'true', page: '1', pageSize: '24' }))
  expect(await screen.findByText('Page 1 of 1, 5 products')).toBeInTheDocument()
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  expect(chip).toHaveFocus()
  expect(router.state.location.search).toEqual({ q: 'product', lowStock: true })

  await userEvent.click(chip)
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'product', page: '1', pageSize: '24' }))
})

test('the pager moves between pages and the pressed button keeps focus', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, thirty).routes })

  const router = renderApp('/stock')
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  const next = screen.getByRole('button', { name: 'Next' })
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveAttribute('aria-disabled', 'true')
  expect(next).toHaveAttribute('aria-disabled', 'false')
  await userEvent.click(next)

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 25')).toHaveValue('24')
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()
  expect(lastListQuery(calls).page).toBe('2')
  expect(next).toHaveAttribute('aria-disabled', 'true')
  expect(next).not.toBeDisabled()
  expect(next).toHaveFocus()
  const requests = calls.length
  await userEvent.click(next)
  expect(router.state.location.search).toEqual({ page: 2 })
  expect(calls).toHaveLength(requests)

  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 01')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({})
  expect(screen.getByRole('button', { name: 'Previous' })).toHaveFocus()
})

test('a page past the end shows the last page', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, thirty).routes })

  const router = renderApp('/stock?page=9')

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await findQuantity('Product 25')).toBeInTheDocument()
  expect(router.state.location.search).toEqual({ page: 2 })
})

test('a search that matches nothing shows the empty state', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [milk]).routes })

  renderApp('/stock?q=ghee')

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveValue('ghee')
  expect(lastListQuery(calls).q).toBe('ghee')
})

test('the stock table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ ...asAdmin, [`GET /admin/stores/${indiranagar.id}/stock`]: () => new Promise<Response>(() => {}) })

  renderApp('/stock')

  expect(await screen.findByLabelText('Store')).toBeInTheDocument()
  expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Stock' })).toBeInTheDocument()
})

test('stock load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  const core = stockCore(indiranagar.id, [milk])
  const path = `GET /admin/stores/${indiranagar.id}/stock`
  fakeCore({ ...asAdmin, [path]: (request) => (fail ? apiError(500, 'internal') : core.routes[path](request)) })

  renderApp('/stock')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stock.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('an admin with no stores is told to create one', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/stock')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Store')).not.toBeInTheDocument()
})

test('stores load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([indiranagar])),
    ...stockCore(indiranagar.id, [milk]).routes,
  })

  renderApp('/stock')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
})
```

#### `src/stock.ts` (new)
```ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type StockRow = components['schemas']['StockRow']
// What the URL of /stock holds. Absent means: the first store (admins), no search, every quantity, page 1.
export type StockSearch = { store?: string; q?: string; lowStock?: true; page?: number }

export const pageSize = 24
// Core's rule (services/core/internal/stock): low stock is below 5, zero included.
export const lowStockBelow = 5

// Keys: one page of a store's stock is ['admin', 'stock', storeId, filters].
export const stockQuery = (storeId: string, filters: { q?: string; lowStock?: true; page: number }) =>
  queryOptions({
    queryKey: ['admin', 'stock', storeId, filters],
    queryFn: async () => {
      const query = { q: filters.q, lowStock: filters.lowStock, page: filters.page, pageSize }
      const { data, error } = await api.GET('/admin/stores/{id}/stock', { params: { path: { id: storeId }, query } })
      if (error) throw error.error
      return data
    },
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never another store's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === storeId ? keepPreviousData(previous) : undefined),
  })
```

#### `src/routes/_staff/stock.tsx` (replace the whole placeholder file)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, Table, type Column } from '@shopperstop/ui'
import { lowStockBelow, pageSize, stockQuery, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

const columns: Column<StockRow>[] = [
  {
    key: 'product',
    header: 'Product',
    cell: (row) => (
      <span className="flex flex-col">
        <span className="font-semibold text-ink">{row.name}</span>
        {row.brand && <span className="text-small text-ink-muted">{row.brand}</span>}
      </span>
    ),
  },
  { key: 'unit', header: 'Unit', cell: (row) => row.unitLabel },
  { key: 'price', header: 'Price', cell: (row) => <Price cents={row.priceCents} /> },
  {
    key: 'quantity',
    header: 'Quantity',
    // Read-only until the next task makes it editable.
    cell: (row) => (
      <span className="block w-28">
        <Input aria-label={`Quantity of ${row.name}`} inputMode="numeric" className="tabular-nums" readOnly value={String(row.quantity)} />
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <span className="flex flex-wrap gap-2">{row.quantity < lowStockBelow && <Badge variant="warning">Low stock</Badge>}</span>,
  },
]

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  const [text, setText] = useState(search.q ?? '')

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stock.isPlaceholderData && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        {stores && (
          <FormField label="Store">
            <Select value={storeId} onChange={(event) => go({ store: event.target.value })}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <form role="search" aria-label="Stock" noValidate onSubmit={submitSearch} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Chip selected={search.lowStock === true} onClick={() => go({ lowStock: search.lowStock ? undefined : true })}>
          Low stock only
        </Chip>
      </Card>
      {stock.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stock.isError ? (
        <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filter. Only active products are listed." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Stock" columns={columns} rows={stock.data.items} rowKey={(row) => row.productId} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {page} of {pages}, {total} products
            </p>
            <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
    </>
  )
}

function Stock() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock" />
      {staff.storeId ? (
        <StoreStock storeId={staff.storeId} />
      ) : stores.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : storeId ? (
        <StoreStock storeId={storeId} stores={items} />
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then set its stock here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/stock')({
  // The router reads search values as JSON: `page=2` is a number, `lowStock=true` a boolean, a search of digits a number.
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    q: search.q === undefined || search.q === '' ? undefined : String(search.q),
    lowStock: search.lowStock === true ? true : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? search.page : undefined,
  }),
  component: Stock,
})
```

### Task 2: edits and the batched save

#### `src/stock.test.tsx` (append at the end of the file; change nothing above)
The block starts with one empty line, then the comment line. Keep both.
```tsx

// Replaces what a quantity field holds, as a user selecting it and typing would.
async function type(name: string, value: string) {
  await userEvent.clear(quantity(name))
  if (value) await userEvent.type(quantity(name), value)
}

test('edits made on two pages and under a filter are saved with one PUT', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  const calls = fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Product 01')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  await type('Product 01', '40')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(within(quantity('Product 01').closest('tr')!).getByText('Unsaved')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await findQuantity('Product 25')
  await type('Product 25', '7')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Low stock only' }))
  expect(await screen.findByText('Page 1 of 1, 5 products')).toBeInTheDocument()
  expect(quantity('Product 01')).toHaveValue('40')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: thirty[0].productId, quantity: 40 }, { productId: thirty[24].productId, quantity: 7 }] }])
  expect(calls.filter((call) => call.method === 'PUT').map((call) => new URL(call.url).pathname)).toEqual([`/api/core/v1/admin/stores/${indiranagar.id}/stock`])
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getByText('Page 1 of 1, 4 products')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Low stock only' }))
  expect(await findQuantity('Product 01')).toHaveValue('40')
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
})

test('a page kept from before a save is read again, never shown with the old quantity', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, thirty)
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Product 01')
  await type('Product 01', '40')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await findQuantity('Product 25')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()

  core.hold()
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Quantity of Product 01' })).not.toBeInTheDocument()
  core.release()
  expect(await findQuantity('Product 01')).toHaveValue('40')
})

test('an edit typed back to the saved quantity is no change, and nothing is sent', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Sunny Fields Toned Milk')
  const save = screen.getByRole('button', { name: 'Save changes' })
  expect(save).toHaveAttribute('aria-disabled', 'true')
  await type('Sunny Fields Toned Milk', '18')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(save).toHaveAttribute('aria-disabled', 'false')
  await type('Sunny Fields Toned Milk', '17')

  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  await userEvent.click(save)
  expect(save).not.toBeDisabled()
  expect(core.puts).toEqual([])
})

test('discard puts every quantity back to what core holds', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await type('Sunny Fields Toned Milk', '')
  expect(screen.getByText('2 unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

  expect(quantity('Banana Robusta')).toHaveValue('0')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('17')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Discard changes' })).toHaveFocus()
  expect(core.puts).toEqual([])
})

test('a quantity the page cannot send is marked, named on save and not sent', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  fakeCore({ ...asAdmin, ...core.routes })

  renderApp('/stock')
  await findQuantity('Sunny Fields Toned Milk')
  await type('Sunny Fields Toned Milk', '12.5')
  await type('Banana Robusta', '9')
  expect(quantity('Sunny Fields Toned Milk')).toHaveAttribute('aria-invalid', 'true')
  expect(quantity('Banana Robusta')).not.toHaveAttribute('aria-invalid')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByRole('alert')).toHaveTextContent('Enter a whole number from 0 to 100000 for: Sunny Fields Toned Milk.')
  expect(core.puts).toEqual([])

  await type('Sunny Fields Toned Milk', '100001')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(quantity('Sunny Fields Toned Milk')).toHaveAttribute('aria-invalid', 'true')
  await type('Sunny Fields Toned Milk', '12')
  expect(quantity('Sunny Fields Toned Milk')).not.toHaveAttribute('aria-invalid')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: milk.productId, quantity: 12 }, { productId: banana.productId, quantity: 9 }] }])
})

test('an edit typed while a save is in flight stays unsaved', async () => {
  setToken('tok')
  const core = stockCore(indiranagar.id, [banana, milk])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  let answer = () => {}
  fakeCore({
    ...asAdmin,
    ...core.routes,
    [put]: async (request) => {
      const response = await core.routes[put](request)
      await new Promise<void>((resolve) => (answer = resolve))
      return response
    },
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await waitFor(() => expect(core.puts).toHaveLength(1))
  await type('Sunny Fields Toned Milk', '20')
  answer()

  expect(await screen.findByText('1 unsaved change')).toBeInTheDocument()
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(quantity('Sunny Fields Toned Milk')).toHaveValue('20')
  expect(within(quantity('Sunny Fields Toned Milk').closest('tr')!).getByText('Unsaved')).toBeInTheDocument()
})

test('unsaved edits never follow a store changed in the URL', async () => {
  setToken('tok')
  const other = stockCore(koramangala.id, [banana])
  fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...other.routes })

  const router = renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await router.navigate({ to: '/stock', search: { store: koramangala.id } })

  await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id))
  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(other.puts).toEqual([])
})
```

#### `src/stock-rules.test.ts` (new)
```ts
import { expect, test } from 'vitest'
import { parseQuantity, toRows, type Edits } from './stock'

test.each([
  ['0', 0],
  ['100000', 100000],
  [' 7 ', 7],
  ['007', 7],
  ['100001', undefined],
  ['-1', undefined],
  ['1.5', undefined],
  ['1e3', undefined],
  ['', undefined],
])('quantity %j is read as %j', (typed, quantity) => {
  expect(parseQuantity(typed)).toBe(quantity)
})

test('a value that is not a quantity is never sent as a number', () => {
  const edits: Edits = { a: { name: 'A', value: '12' }, b: { name: 'B', value: 'twelve' } }

  expect(toRows(edits)).toEqual([{ productId: 'a', quantity: 12 }])
})
```

#### `src/stock.ts` (replace the whole file)
```ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type StockRow = components['schemas']['StockRow']
// What the URL of /stock holds. Absent means: the first store (admins), no search, every quantity, page 1.
export type StockSearch = { store?: string; q?: string; lowStock?: true; page?: number }
// Unsaved quantities as typed, by product id, with the product's name for messages about rows on another page.
export type Edits = Record<string, { name: string; value: string }>

export const pageSize = 24
// Core's rules (services/core/internal/stock): low stock is below 5, a quantity is 0 to 100000.
export const lowStockBelow = 5
export const maxQuantity = 100000

// Keys: one page of a store's stock is ['admin', 'stock', storeId, filters].
export const stockQuery = (storeId: string, filters: { q?: string; lowStock?: true; page: number }) =>
  queryOptions({
    queryKey: ['admin', 'stock', storeId, filters],
    queryFn: async () => {
      const query = { q: filters.q, lowStock: filters.lowStock, page: filters.page, pageSize }
      const { data, error } = await api.GET('/admin/stores/{id}/stock', { params: { path: { id: storeId }, query } })
      if (error) throw error.error
      return data
    },
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never another store's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === storeId ? keepPreviousData(previous) : undefined),
  })

// A quantity as typed to the number core takes; anything else is not sendable.
export function parseQuantity(value: string) {
  const text = value.trim()
  return /^\d{1,6}$/.test(text) && Number(text) <= maxQuantity ? Number(text) : undefined
}

// The rows of one PUT, in the order the edits were made. A value that is not a quantity is left out, never sent as a made-up
// number; the page refuses to save before that.
export function toRows(edits: Edits) {
  return Object.entries(edits).flatMap(([productId, edit]) => {
    const quantity = parseQuantity(edit.value)
    return quantity === undefined ? [] : [{ productId, quantity }]
  })
}
```

#### `src/routes/_staff/stock.tsx` (replace the whole file)
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import { api } from '../../api'
import { lowStockBelow, maxQuantity, pageSize, parseQuantity, stockQuery, toRows, type Edits, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  const [text, setText] = useState(search.q ?? '')
  // Unsaved edits belong to one store: read for any other store they are empty, so they can never be saved to it.
  const [draft, setDraft] = useState<{ store: string; edits: Edits }>({ store: storeId, edits: {} })
  const [refused, setRefused] = useState(false)
  const edits = draft.store === storeId ? draft.edits : {}
  const count = Object.keys(edits).length
  const invalid = Object.values(edits).filter((edit) => parseQuantity(edit.value) === undefined)

  const save = useMutation({
    mutationFn: async (sent: { store: string; edits: Edits }) => {
      const rows = toRows(sent.edits)
      const { error } = await api.PUT('/admin/stores/{id}/stock', { params: { path: { id: sent.store } }, body: { rows } })
      if (error) throw error.error
      return rows
    },
    onSuccess: async (rows, sent) => {
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since stays unsaved.
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      setDraft((current) =>
        current.store === sent.store
          ? { store: current.store, edits: Object.fromEntries(Object.entries(current.edits).filter(([id, edit]) => !done.has(id) || done.get(id) !== parseQuantity(edit.value))) }
          : current,
      )
    },
  })
  const saved = save.variables?.store === storeId

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stock.isPlaceholderData && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  function edit(row: StockRow, value: string) {
    save.reset()
    setRefused(false)
    const next = { ...edits, [row.productId]: { name: row.name, value } }
    // Typed back to what core holds is no edit.
    if (value.trim() === String(row.quantity)) delete next[row.productId]
    setDraft({ store: storeId, edits: next })
  }

  function discard() {
    save.reset()
    setRefused(false)
    setDraft({ store: storeId, edits: {} })
  }

  function submitSave() {
    if (count === 0 || save.isPending) return
    if (invalid.length > 0) return setRefused(true)
    save.mutate({ store: storeId, edits })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          {row.brand && <span className="text-small text-ink-muted">{row.brand}</span>}
        </span>
      ),
    },
    { key: 'unit', header: 'Unit', cell: (row) => row.unitLabel },
    { key: 'price', header: 'Price', cell: (row) => <Price cents={row.priceCents} /> },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (row) => {
        const value = edits[row.productId]?.value
        return (
          <span className="block w-28">
            <Input
              aria-label={`Quantity of ${row.name}`}
              aria-invalid={value !== undefined && parseQuantity(value) === undefined ? true : undefined}
              inputMode="numeric"
              className="tabular-nums"
              value={value ?? String(row.quantity)}
              onChange={(event) => edit(row, event.target.value)}
            />
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="flex flex-wrap gap-2">
          {row.quantity < lowStockBelow && <Badge variant="warning">Low stock</Badge>}
          {edits[row.productId] && <Badge variant="accent">Unsaved</Badge>}
        </span>
      ),
    },
  ]

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        {stores && (
          <FormField label="Store">
            <Select value={storeId} onChange={(event) => go({ store: event.target.value })}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <form role="search" aria-label="Stock" noValidate onSubmit={submitSearch} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Chip selected={search.lowStock === true} onClick={() => go({ lowStock: search.lowStock ? undefined : true })}>
          Low stock only
        </Chip>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <p className="text-body text-ink tabular-nums">
          {count === 0 ? 'No unsaved changes' : count === 1 ? '1 unsaved change' : `${count} unsaved changes`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" aria-disabled={count === 0} className={idle} onClick={discard}>Discard changes</Button>
          <Button aria-disabled={count === 0} className={idle} loading={save.isPending} onClick={submitSave}>Save changes</Button>
        </div>
      </Card>
      {refused && invalid.length > 0 && (
        <ErrorBanner message={`Enter a whole number from 0 to ${maxQuantity} for: ${invalid.map((edit) => edit.name).join(', ')}.`} />
      )}
      {saved && save.isSuccess && <StatusMessage tone="success">Stock saved.</StatusMessage>}
      {stock.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stock.isError ? (
        <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filter. Only active products are listed." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Stock" columns={columns} rows={stock.data.items} rowKey={(row) => row.productId} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {page} of {pages}, {total} products
            </p>
            <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
    </>
  )
}

function Stock() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock" />
      {staff.storeId ? (
        <StoreStock storeId={staff.storeId} />
      ) : stores.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : storeId ? (
        <StoreStock storeId={storeId} stores={items} />
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then set its stock here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/stock')({
  // The router reads search values as JSON: `page=2` is a number, `lowStock=true` a boolean, a search of digits a number.
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    q: search.q === undefined || search.q === '' ? undefined : String(search.q),
    lowStock: search.lowStock === true ? true : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? search.page : undefined,
  }),
  component: Stock,
})
```

### Task 3: the store switch dialog, save failures and the 500-row limit

#### `src/stock.test.tsx` (append at the end of the file; change nothing above)
The block starts with one empty line, which separates it from the test before. Keep it.
```tsx

test('switching store with unsaved edits asks first', async () => {
  setToken('tok')
  const calls = fakeCore({ ...asAdmin, ...stockCore(indiranagar.id, [banana]).routes, ...stockCore(koramangala.id, [milk]).routes })
  const toKoramangala = () => calls.filter((call) => call.url.includes(koramangala.id))

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)

  const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' })
  expect(dialog).toHaveTextContent("Switching store discards the unsaved change to this store's stock.")
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Discard and switch'])
  expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(toKoramangala()).toEqual([])

  await userEvent.selectOptions(screen.getByLabelText('Store'), koramangala.id)
  await userEvent.click(screen.getByRole('button', { name: 'Discard and switch' }))
  expect(await findQuantity('Sunny Fields Toned Milk')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Store')).toHaveValue(koramangala.id)
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()

  await userEvent.selectOptions(screen.getByLabelText('Store'), indiranagar.id)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await findQuantity('Banana Robusta')).toHaveValue('0')
})

test('a save refused for a deleted product says so and keeps the edits', async () => {
  setToken('tok')
  fakeCore({
    ...asAdmin,
    ...stockCore(indiranagar.id, [banana, milk]).routes,
    [`PUT /admin/stores/${indiranagar.id}/stock`]: () => apiError(400, 'validation', 'unknown product', 'rows'),
  })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('These changes were refused: a changed product may have been deleted. Discard the changes and try again.')
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(screen.queryByText('Stock saved.')).not.toBeInTheDocument()

  await type('Sunny Fields Toned Milk', '20')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('any other save failure shows a banner, keeps the edits and can be retried', async () => {
  setToken('tok')
  let fail = true
  const core = stockCore(indiranagar.id, [banana])
  const put = `PUT /admin/stores/${indiranagar.id}/stock`
  fakeCore({ ...asAdmin, ...core.routes, [put]: (request) => (fail ? apiError(500, 'internal') : core.routes[put](request)) })

  renderApp('/stock')
  await findQuantity('Banana Robusta')
  await type('Banana Robusta', '30')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the stock. Try again.')
  expect(quantity('Banana Robusta')).toHaveValue('30')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()

  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(core.puts).toEqual([{ rows: [{ productId: banana.productId, quantity: 30 }] }])
})
```

#### `src/stock-rules.test.ts` (append at the end of the file; change nothing above)
The block starts with one empty line, which separates it from the test before. Keep it.
```ts

test('one save takes the first 500 edits, in the order they were made', () => {
  const edits: Edits = Object.fromEntries(Array.from({ length: 501 }, (_, i) => [`product-${i}`, { name: `Product ${i}`, value: String(i) }]))

  const rows = toRows(edits)

  expect(rows).toHaveLength(500)
  expect(rows[0]).toEqual({ productId: 'product-0', quantity: 0 })
  expect(rows[499]).toEqual({ productId: 'product-499', quantity: 499 })
})
```

#### `src/stock.ts` (replace the whole file)
```ts
import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type StockRow = components['schemas']['StockRow']
// What the URL of /stock holds. Absent means: the first store (admins), no search, every quantity, page 1.
export type StockSearch = { store?: string; q?: string; lowStock?: true; page?: number }
// Unsaved quantities as typed, by product id, with the product's name for messages about rows on another page.
export type Edits = Record<string, { name: string; value: string }>

export const pageSize = 24
// Core's rules (services/core/internal/stock): low stock is below 5, a quantity is 0 to 100000, one PUT takes 1 to 500 rows.
export const lowStockBelow = 5
export const maxQuantity = 100000
export const maxRows = 500

// Keys: one page of a store's stock is ['admin', 'stock', storeId, filters].
export const stockQuery = (storeId: string, filters: { q?: string; lowStock?: true; page: number }) =>
  queryOptions({
    queryKey: ['admin', 'stock', storeId, filters],
    queryFn: async () => {
      const query = { q: filters.q, lowStock: filters.lowStock, page: filters.page, pageSize }
      const { data, error } = await api.GET('/admin/stores/{id}/stock', { params: { path: { id: storeId }, query } })
      if (error) throw error.error
      return data
    },
    // The page on screen stays while the next one loads, so the pager keeps keyboard focus; never another store's rows.
    placeholderData: (previous, previousQuery) => (previousQuery?.queryKey[2] === storeId ? keepPreviousData(previous) : undefined),
  })

// A quantity as typed to the number core takes; anything else is not sendable.
export function parseQuantity(value: string) {
  const text = value.trim()
  return /^\d{1,6}$/.test(text) && Number(text) <= maxQuantity ? Number(text) : undefined
}

// The rows of one PUT, in the order the edits were made. A value that is not a quantity is left out, never sent as a made-up
// number; the page refuses to save before that.
// ponytail: one save sends the first 500 rows (core's limit) and the rest stay unsaved for the next press; send several PUTs if anyone ever types that many.
export function toRows(edits: Edits) {
  return Object.entries(edits)
    .flatMap(([productId, edit]) => {
      const quantity = parseQuantity(edit.value)
      return quantity === undefined ? [] : [{ productId, quantity }]
    })
    .slice(0, maxRows)
}
```

#### `src/routes/_staff/stock.tsx` (replace the whole file)
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge, Button, Card, Chip, Dialog, DialogFooter, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, StatusMessage, Table, type Column } from '@shopperstop/ui'
import { api, type ApiError } from '../../api'
import { lowStockBelow, maxQuantity, pageSize, parseQuantity, stockQuery, toRows, type Edits, type StockRow, type StockSearch } from '../../stock'
import { storesQuery, type AdminStore } from '../../stores'

// A button that cannot act now stays focusable: `disabled` would drop keyboard focus from the button just pressed.
const idle = 'aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

function StoreStock({ storeId, stores }: { storeId: string; stores?: AdminStore[] }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const page = search.page ?? 1
  const stock = useQuery(stockQuery(storeId, { q: search.q, lowStock: search.lowStock, page }))
  const [text, setText] = useState(search.q ?? '')
  // Unsaved edits belong to one store: read for any other store they are empty, so they can never be saved to it.
  const [draft, setDraft] = useState<{ store: string; edits: Edits }>({ store: storeId, edits: {} })
  const [refused, setRefused] = useState(false)
  const [switchTo, setSwitchTo] = useState<string>()
  const edits = draft.store === storeId ? draft.edits : {}
  const count = Object.keys(edits).length
  const invalid = Object.values(edits).filter((edit) => parseQuantity(edit.value) === undefined)

  const save = useMutation({
    mutationFn: async (sent: { store: string; edits: Edits }) => {
      const rows = toRows(sent.edits)
      const { error } = await api.PUT('/admin/stores/{id}/stock', { params: { path: { id: sent.store } }, body: { rows } })
      if (error) throw error.error
      return rows
    },
    onSuccess: async (rows, sent) => {
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since, or beyond the 500 rows of one PUT, stays unsaved.
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      setDraft((current) =>
        current.store === sent.store
          ? { store: current.store, edits: Object.fromEntries(Object.entries(current.edits).filter(([id, edit]) => !done.has(id) || done.get(id) !== parseQuantity(edit.value))) }
          : current,
      )
    },
  })
  const saved = save.variables?.store === storeId
  const saveError = saved && save.error ? (save.error as Partial<ApiError>) : undefined

  // Filters and the store live in the URL; any change of them starts again at page 1.
  const go = (change: StockSearch) => void navigate({ search: (current) => ({ ...current, page: undefined, ...change }) })

  // A page past the end (a save emptied it, or a typed URL) moves to the last page that has rows.
  const total = stock.data?.total ?? 0
  const pastEnd = page > 1 && !stock.isPlaceholderData && stock.data?.items.length === 0
  useEffect(() => {
    const last = Math.ceil(total / pageSize)
    if (pastEnd) void navigate({ search: (current) => ({ ...current, page: last > 1 ? last : undefined }), replace: true })
  }, [pastEnd, total, navigate])

  function edit(row: StockRow, value: string) {
    save.reset()
    setRefused(false)
    const next = { ...edits, [row.productId]: { name: row.name, value } }
    // Typed back to what core holds is no edit.
    if (value.trim() === String(row.quantity)) delete next[row.productId]
    setDraft({ store: storeId, edits: next })
  }

  function discard() {
    save.reset()
    setRefused(false)
    setDraft({ store: storeId, edits: {} })
  }

  function submitSave() {
    if (count === 0 || save.isPending) return
    if (invalid.length > 0) return setRefused(true)
    save.mutate({ store: storeId, edits })
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    go({ q: text.trim() || undefined })
  }

  const columns: Column<StockRow>[] = [
    {
      key: 'product',
      header: 'Product',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="font-semibold text-ink">{row.name}</span>
          {row.brand && <span className="text-small text-ink-muted">{row.brand}</span>}
        </span>
      ),
    },
    { key: 'unit', header: 'Unit', cell: (row) => row.unitLabel },
    { key: 'price', header: 'Price', cell: (row) => <Price cents={row.priceCents} /> },
    {
      key: 'quantity',
      header: 'Quantity',
      cell: (row) => {
        const value = edits[row.productId]?.value
        return (
          <span className="block w-28">
            <Input
              aria-label={`Quantity of ${row.name}`}
              aria-invalid={value !== undefined && parseQuantity(value) === undefined ? true : undefined}
              inputMode="numeric"
              className="tabular-nums"
              value={value ?? String(row.quantity)}
              onChange={(event) => edit(row, event.target.value)}
            />
          </span>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <span className="flex flex-wrap gap-2">
          {row.quantity < lowStockBelow && <Badge variant="warning">Low stock</Badge>}
          {edits[row.productId] && <Badge variant="accent">Unsaved</Badge>}
        </span>
      ),
    },
  ]

  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        {stores && (
          <FormField label="Store">
            <Select value={storeId} onChange={(event) => (count > 0 ? setSwitchTo(event.target.value) : go({ store: event.target.value }))}>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <form role="search" aria-label="Stock" noValidate onSubmit={submitSearch} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={text} onChange={(event) => setText(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <Chip selected={search.lowStock === true} onClick={() => go({ lowStock: search.lowStock ? undefined : true })}>
          Low stock only
        </Chip>
      </Card>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
        <p className="text-body text-ink tabular-nums">
          {count === 0 ? 'No unsaved changes' : count === 1 ? '1 unsaved change' : `${count} unsaved changes`}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" aria-disabled={count === 0} className={idle} onClick={discard}>Discard changes</Button>
          <Button aria-disabled={count === 0} className={idle} loading={save.isPending} onClick={submitSave}>Save changes</Button>
        </div>
      </Card>
      {refused && invalid.length > 0 && (
        <ErrorBanner message={`Enter a whole number from 0 to ${maxQuantity} for: ${invalid.map((edit) => edit.name).join(', ')}.`} />
      )}
      {saveError && (
        <ErrorBanner
          message={
            saveError.code === 'validation'
              ? 'These changes were refused: a changed product may have been deleted. Discard the changes and try again.'
              : 'Could not save the stock. Try again.'
          }
        />
      )}
      {saved && save.isSuccess && <StatusMessage tone="success">Stock saved.</StatusMessage>}
      {stock.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stock.isError ? (
        <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filter. Only active products are listed." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Stock" columns={columns} rows={stock.data.items} rowKey={(row) => row.productId} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" aria-disabled={page <= 1} className={idle} onClick={() => page > 1 && go({ page: page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {page} of {pages}, {total} products
            </p>
            <Button variant="secondary" aria-disabled={page >= pages} className={idle} onClick={() => page < pages && go({ page: page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
      <Dialog open={switchTo !== undefined} onClose={() => setSwitchTo(undefined)} title="Discard unsaved changes?">
        <p className="mt-2 text-body text-ink">
          Switching store discards {count === 1 ? 'the unsaved change' : `the ${count} unsaved changes`} to this store's stock.
        </p>
        <DialogFooter onCancel={() => setSwitchTo(undefined)}>
          <Button
            onClick={() => {
              discard()
              setSwitchTo(undefined)
              go({ store: switchTo })
            }}
          >
            Discard and switch
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

function Stock() {
  const { staff } = Route.useRouteContext()
  const search = Route.useSearch()
  // Store staff carry their store and may not list stores (403); an admin has none and picks one.
  const stores = useQuery({ ...storesQuery, enabled: !staff.storeId })
  const items = stores.data?.items ?? []
  // ponytail: a `store` in the URL that is not in the list falls back to the first store, without a message.
  const storeId = items.find((store) => store.id === search.store)?.id ?? items[0]?.id

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stock" />
      {staff.storeId ? (
        <StoreStock storeId={staff.storeId} />
      ) : stores.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : storeId ? (
        <StoreStock storeId={storeId} stores={items} />
      ) : (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then set its stock here." />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/stock')({
  // The router reads search values as JSON: `page=2` is a number, `lowStock=true` a boolean, a search of digits a number.
  validateSearch: (search: Record<string, unknown>): StockSearch => ({
    store: typeof search.store === 'string' ? search.store : undefined,
    q: search.q === undefined || search.q === '' ? undefined : String(search.q),
    lowStock: search.lowStock === true ? true : undefined,
    page: typeof search.page === 'number' && Number.isInteger(search.page) && search.page > 1 ? search.page : undefined,
  }),
  component: Stock,
})
```

## Risks / Trade-offs
- The e2e has run only against a `page.route` fake. Risks in task 4: the seed facts of A11 (the store order, the product count, the milk's name), the real 204, and core's rate limit. A failure is recorded first, then fixed with `fix:`; an assertion is never weakened.
- Core's sign-in rate limit (10 per email per hour per process): the stock spec adds one admin and one store-staff sign-in per run. A reused local core reaches the limit after a few full admin runs; restarting core is the manager's call.
- The e2e changes Koramangala's Sunny Fields Toned Milk by one and saves it back. A run that dies in between leaves it one higher; the next `make e2e` reseeds. web's e2e must not depend on that product's exact quantity at Koramangala while admin's runs (they run one after the other in `make e2e`).
- The router's JSON reading of search values (Decision 2) is the router's default; a later global change of the search serializer would change `/stock`'s URLs, and the URL tests would say so.
- `aria-disabled` styling lives on the page until ui's `Button` carries it (request to ui). axe leaves `aria-disabled` controls out of its contrast rule, as it does `disabled` ones; the faked e2e run was clean.
- Tasks 2 and 3 replace `src/stock.ts` and `src/routes/_staff/stock.tsx` whole, so they run in order on the one worktree.

## Accepted ceilings
- No product image, category filter or sorting in the table (Decision 14).
- No warning on leaving the page with unsaved edits; edits hidden, not dropped, when the store changes through the URL (Decision 6).
- A save sends at most 500 edits; the rest need a second press (Decision 8).
- A field's error reason is in the alert on save, not next to the field (Decision 9).
- An unknown `store` in the URL shows the first store without a message (Decision 3); store staff see no store name (Decision 4).
- First 100 stores in the selector (`storesQuery`'s ceiling from admin-stores).
- The pager text names the new page a moment before its rows arrive (Decision 11); "Save changes" is `disabled` while its `PUT` runs (Decision 12).
- The save bar is not sticky and Enter does not save (Decision 17).
- A hand-typed `?q=` that reads as JSON (a number, `true`) is searched as its JSON reading (Decision 2).
- Two admins editing one store: the last save wins per product, and a quantity changed by an order between load and save is overwritten by the typed number (core's `PUT` sets, it does not add). The page reloads the list after every save, not while it is open.

## Migration Plan
None: no data, config or dependency change. Rollback is reverting the PR; `/stock` falls back to L1's placeholder.
