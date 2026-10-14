# Design

## Context
`apps/admin` on main (6d9f7b3, with admin-catalog #112 and admin-stock #147). Reads go through TanStack Query 5.104.2 with one `QueryClient` per router (`src/router.ts`: `retry: false`, `throwOnError` for `forbidden`). No query sets a `staleTime` except the session read (`Infinity`), so every page read is made again on window focus, on a remount and after an invalidation. A query that holds data and whose next read fails ends with `status: 'error'`, `error` set, `data` still the old answer, `isPending` false. Ten branches read `isPending` then `isError` and so drop what they hold.

No `docs/design/admin-P2-L7.md`: this file is enough. Everything below was built on this branch, measured and removed again (Spike).

## Goals / Non-Goals
**Goals:** the rule holds on every page of `apps/admin/src` that reads from core; one notice with one wording, written once; each of the 17 scenarios has a named Vitest test; one worker task.

**Non-Goals:** retries, `staleTime`, refetch-on-focus settings; a retry button on the notice; the Dashboard and Orders pages (admin-P2-L5); `packages/ui`; e2e.

## The rule, in two parts
1. **Each page asks for data first** (web's pattern from #135, unchanged):
   ```tsx
   query.data === undefined ? (query.isError ? <the alert with Try again> : <the skeleton>) : <the content>
   ```
   `data !== undefined` is the test for "holds data", never `isPending`, `isError` or truthiness. A detail page checks `error.code === 'not_found'` before it, so a row deleted elsewhere still becomes "Page not found".
2. **One notice at the root.** `RefetchNotice` (`src/refetch-notice.tsx`, 19 lines) is mounted once in `routes/__root.tsx`, above the `Outlet`. It reads the query cache: it shows while any query that has an observer (is on screen) holds data and is in `status: 'error'` with a code other than `not_found`. No page renders or knows it.

Wording, one for all pages: **"Could not refresh. Showing what was loaded last."** A `StatusMessage tone="warning"` (`role="status"`), so it is announced politely and is not an alert.

## Audit: every `isError` / `.error` on a query result in `apps/admin/src`
| # | Site | File | Reads | On main | Defect | Change |
|---|---|---|---|---|---|---|
| 1 | Stores table | `src/routes/_staff/_admin/stores/index.tsx` | `storesQuery` | `isPending`, `isError`, data | yes: table replaced by the alert | EDIT 3 |
| 2 | Store page | `src/routes/_staff/_admin/stores/$storeId.tsx` | `storeQuery` | `isPending`, `isError` (404 inside it), data | yes: `StoreForm` and `ServiceAreas` unmount, typed text and the pincode draft are lost | EDIT 4 |
| 3 | Pincode editor | `src/service-areas.tsx` | `serviceAreasQuery` | `isPending`, `isError`, data | yes: table and editor replaced (the draft is state of the component and survives, unseen) | EDIT 9 |
| 4 | Products table | `src/routes/_staff/_admin/products/index.tsx` | `productsQuery` | `isPending`, `isError`, data | yes | EDIT 5 |
| 5 | Products filter options | same | `categoriesQuery` | `categories.data?.items ?? []` only | no; the root notice covers its failed refetch | none |
| 6 | Product page | `src/routes/_staff/_admin/products/$productId.tsx` | `productQuery`, `categoriesQuery` | either `isPending`, 404, either `isError`, data | yes, for both reads: `ProductForm` and `ImageUpload` unmount; also after an image upload, whose `invalidateQueries(['admin', kind])` rereads the product | EDIT 6 |
| 7 | New product | `src/routes/_staff/_admin/products/new.tsx` | `categoriesQuery` | `isPending`, `isError`, data | yes: the form unmounts, typed text lost | EDIT 7 |
| 8 | Categories table | `src/routes/_staff/_admin/categories.tsx` | `categoriesQuery` | `isPending`, `isError`, data | yes; also after a category save or delete, which awaits an invalidation (the dialogs are rendered outside the branch and survive) | EDIT 8 |
| 9 | Stock table | `src/routes/_staff/stock.tsx` `StoreStock` | `stockQuery` (with `placeholderData`) | `isPending`, `isError`, data | yes: table replaced (edits are state of `StoreStock` and survive, unseen); also after a save, which awaits an invalidation | EDIT 11, and EDIT 10 (below) |
| 10 | Stock, the admin's stores | same file, `Stock` | `storesQuery` | `isPending`, `isError`, data | yes, the worst: `StoreStock` unmounts and every unsaved quantity is gone | EDIT 12 |
| 11 | Stock, store staff's store name | same file | `storeNameQuery` | `ownStore.data &&` only | no; the root notice covers its failed refetch | none |
| 12 | Staff session and its retry banner | `src/routes/_staff.tsx`, `src/route-error.tsx`, `src/api.ts` `meQuery` | `ensureQueryData(meQuery)` in `beforeLoad` | error thrown to the route boundary: "Could not reach the server." with "Try again" (`router.invalidate()`) | no: the read has no observer and `staleTime: Infinity`, so nothing refetches it while it holds the staff member (a focus refetch needs an observer; `router.invalidate()` re-runs the guard, and `ensureQueryData` returns what is held). The banner can only arise with nothing held. The spike's probe saw one `GET /admin/me` across a page load and a refetch of everything on screen | none; pinned already by `src/shell.test.tsx` › "core unreachable on load shows a retry" |
| 13 | 403 on any read | `src/router.ts` `throwOnError`, `src/route-error.tsx` | every `useQuery` | thrown to the route boundary, "Page not found" | not a defect: a 403 is an answer about the role (Spec 2 §8), also on a refetch | none; pinned by a new test |
| 14 | Pincode conflict's store name | `src/service-areas.tsx` `problem()` | `queryClient.fetchQuery(storeQuery(other))` with a fallback to the id | not a view | no | none |
| 15 | Mutation results: `save.error`, `remove.error`, `deactivate.error`, `upload.error`, `signIn.error`, `upload.isError` | `store-form.tsx`, `product-form.tsx`, `categories.tsx`, `image.tsx`, `service-areas.tsx`, `stock.tsx`, `routes/sign-in.tsx`, `stores/$storeId.tsx`, `products/$productId.tsx` | mutations | not query results | no | none |
| 16 | Dashboard, Orders, Staff | `routes/_staff/index.tsx`, `orders.tsx`, `_admin/staff.tsx` | nothing yet | placeholders | n/a | admin-P2-L5 / L6 |

Sites 1 to 4 and 6 to 10 had the defect: ten branches, nine files.

## Decisions
1. **`data === undefined`, as web.** Same check, same reason; no admin read answers `null`, so it also equals "has data".
2. **Where this differs from web: there is a notice.** Web's Decision 4 left old data with no hint and named this as the upgrade path. In the panel the old data is what staff act on (prices, stock, a store's open flag), so the manager's rule asks for the notice.
3. **Where this differs from web: the notice is one component at the root, read from the cache, not a helper per page.** A per-page wrapper (`<Loaded query=…>`) was the first design and was dropped before the spike: the store page and `/stock` each hold two reads that fail together while core is down (store and pincodes; stores and stock), so two wrappers show the notice twice; the product page needs two reads in one gate, which makes the wrapper generic over a tuple; and the reads that only use `.data` (sites 5 and 11) would get no notice at all. Reading the cache gives exactly one notice for any number of reads and covers every present and later page without an edit there. Cost: ten small reorders stay in the pages (they would under a wrapper too). The subscription is the one TanStack's own `useIsFetching` uses (`useSyncExternalStore` on the query cache, `notifyManager.batchCalls`).
4. **Only queries on screen count** (`findAll({ type: 'active' })`): an errored query kept in the cache after its page was left must not put the notice on the next page. Guarded by "the notice leaves with the page it was about" and by the 403 test.
5. **A 404 is an answer, not a failed refresh**: the predicate leaves `not_found` out, the detail pages show "Page not found" for it with or without data held. Ceiling: a 404 on a refetch of a read that is not a detail page's own (a store's stock or pincodes after the store was deleted elsewhere) keeps the rows with no notice. In practice the page's other read tells: the store page's `storeQuery` gets the same 404 and shows not found; on `/stock` the stores list comes back without that store and the page moves to the first one.
6. **The product page's two reads share one gate**, as on main: not found first (the product's code only; `fakeCore` and core answer 404 to other things too), then `product.data === undefined || categories.data === undefined` → the skeleton while neither has failed, else the one alert "Could not load the product." whose "Try again" reads both. One difference from main with nothing held: if one read has failed and the other is still loading, the alert shows at once instead of after the other answers.
7. **Stock save guard (EDIT 10).** With the table kept, a save whose reload fails would drop the edits (they were saved) and show the rows' old quantities under "Stock saved.". So `onSuccess` writes the sent quantities into the store's page on screen (`setQueriesData`, after the inactive pages are removed) before `invalidateQueries`. The reload still runs and still wins when it answers. Nothing else in the save changes: the edits go after the reload, as before (admin-stock Decision 10). Ceiling: only `quantity` is patched; under "Low stock only" a row raised to 5 or more stays listed, and the total stays, until a reload answers. The notice says so.
8. **No retry on the notice.** The next focus, remount, save or navigation reads again. Ceiling: an admin who stays on one page with the window focused sees the notice until one of those; upgrade path, an `onRetry` that calls `queryClient.refetchQueries({ type: 'active' })` (needs a `StatusMessage` action in `packages/ui`).
9. **The notice is not sticky.** It sits at the top of `main`; scrolled far down a long table it is out of view (it is still announced). Upgrade path: a sticky bar in `packages/ui` with a Figma frame.
10. **Nothing in `packages/ui`.** The notice is a `StatusMessage`, not a new recipe; it needs the cache of this app's `QueryClient`, which ui does not have.
11. **Requirements ADDED, none MODIFIED**, as web: "… when the request fails, the alert …" in the table-state requirements is the nothing-held case.
12. **Standing rules from the admin reviews** (`.claude/areas/admin.md`, Found): no button gains `disabled` (no button changes at all); no `reset()` is added; tests use no timer and no `vi.useFakeTimers`; answers are switched by the test (`core = 'down'`), never by a delay.

## Mutation flows after the change
| Flow | What happens when its reload fails |
|---|---|
| Store form save (`setQueryData`) | no reload; the write's answer is a good answer for `storeQuery`, so it also clears a notice that query caused |
| Product form save (`setQueryData`, form reset to the answer) | same |
| Pincodes save (`setQueryData`) | same |
| Stock save (`await invalidateQueries`) | Decision 7: saved quantities, "Stock saved.", the notice |
| Category create, change, delete (`await invalidateQueries`, then close) | the dialog closes, the table stays as it was loaded (without the change) under the notice. Ceiling: the notice is the only hint that the row shown is old; the write did happen |
| Image upload (`void invalidateQueries(['admin', kind])`) | the tile shows the new image from the upload's own state and "Image saved."; the page stays under the notice |
| Store or product delete | no reload of the page's own read (`exact` list key; `removeQueries` inactive): unchanged |
| A save sent while the notice shows | the form sends its difference from the data it loaded, as always; that data may be older than usual. Ceiling, unchanged by this lane |

## Files (all under `apps/admin/`)
| File | What |
|---|---|
| `src/refetch.test.tsx` | new, 19 tests |
| `src/refetch-notice.tsx` | new, `RefetchNotice` |
| `src/routes/__root.tsx` | EDIT 1, 2 |
| `src/routes/_staff/_admin/stores/index.tsx` | EDIT 3 |
| `src/routes/_staff/_admin/stores/$storeId.tsx` | EDIT 4 |
| `src/routes/_staff/_admin/products/index.tsx` | EDIT 5 |
| `src/routes/_staff/_admin/products/$productId.tsx` | EDIT 6 |
| `src/routes/_staff/_admin/products/new.tsx` | EDIT 7 |
| `src/routes/_staff/_admin/categories.tsx` | EDIT 8 |
| `src/service-areas.tsx` | EDIT 9 |
| `src/routes/_staff/stock.tsx` | EDIT 10, 11, 12 |

No copy, class, frame or import changes in the pages (every import stays in use; lint and typecheck were clean in the spike). `src/routeTree.gen.ts`, `src/fake-core.ts` and every existing test stay untouched.

## Scenario → test (all in `src/refetch.test.tsx`)
| Requirement › Scenario | Test | On 6d9f7b3 |
|---|---|---|
| Keep data › Table kept | "a failed refetch keeps the table of %s" (3 runs: `/stores`, `/products`, `/categories`) | red ×3: no table |
| Keep data › Store page and its form kept | "a failed refetch keeps the store page, what was typed in its form and the unsaved pincodes" | red: no "Name" field |
| Keep data › Product page and its form kept | "a failed refetch keeps the product page and what was typed in its form" | red: no "Name" field |
| Keep data › New product form kept | "a failed refetch keeps the new product form and what was typed in it" | red: no "Name" field |
| Keep data › Stock and its unsaved quantity kept | "a failed refetch keeps the stock table and the unsaved quantity" | red: no quantity field |
| Keep data › Store staff stock kept | "a failed refetch keeps the stock and the store name of store staff" | red: no quantity field |
| Keep data › Category save whose reload fails | "a category save whose reload fails closes the dialog and keeps the table with the notice" | red: no table |
| Keep data › First load failure still alerts | "a first load of %s that fails shows the alert with "Try again" and no notice" (3 runs: store page, product page, `/products/new`) | pin, green ×3 |
| Keep data › Pincodes fail on the first load | "the pincodes failing on the first load show their own alert inside the store page, which stays" | pin, green |
| Keep data › Next stock page fails on its first load | "a page of stock that fails on its first load shows the alert and no notice, and the unsaved quantity is still counted" | pin, green |
| Notice › Notice shown once and cleared | the store page test above (two reads fail, `getAllByText(notice)` has length 1, then none); every "a failed refetch keeps …" test asserts the same through `keptThroughARefetch` | red |
| Notice › Notice leaves with the page | "the notice leaves with the page it was about" | red: no notice to begin with |
| Notice › No notice on a first load failure | the store-page run of "a first load of %s that fails …" | pin, green |
| Deleted or forbidden › Store deleted elsewhere, Product deleted elsewhere | "a %s deleted elsewhere shows not found on the next refetch, without the notice" (2 runs) | pin, green ×2 |
| Deleted or forbidden › Forbidden on a refetch | "a 403 on a refetch shows not found, without the notice" | pin, green |
| Saved stock › Save, then the reload fails | "a save whose reload fails shows the saved quantity, "Stock saved." and the notice" | red: no quantity field |

19 tests: 11 red and 8 green on the unfixed code. The pins are not idle: each is the only test that turns red under one of the mutations below.

Already on main and untouched, the nothing-held half for the other sites: `src/stores.test.tsx` › "stores load failure shows a retry that reloads"; `src/products.test.tsx` and `src/categories.test.tsx` (their load-failure tests); `src/stock.test.tsx` › "stock load failure shows a retry that reloads", "stores load failure shows a retry that reloads"; `src/shell.test.tsx` › "core unreachable on load shows a retry".

## Mutation guards (each applied to the fixed spike tree, run, restored; 179 green before each)
| Mutation | Tests that turn red |
|---|---|
| remove `<RefetchNotice />` from the root | the 10 "keeps …"/"reload fails" tests and "the notice leaves with the page it was about" (11) |
| `findAll({})` instead of `{ type: 'active' }` | "a 403 on a refetch shows not found, without the notice", "the notice leaves with the page it was about" |
| drop `state.data !== undefined` from the predicate | the 3 runs of "a first load of %s that fails …", "the pincodes failing on the first load …", "a page of stock that fails on its first load …" |
| drop the `not_found` exception from the predicate | both runs of "a %s deleted elsewhere …" |
| store page: not found only while `store.data === undefined` | "a store deleted elsewhere …" |
| product page: not found only while `product.data === undefined` | "a product deleted elsewhere …" |
| stores table back to error first (`stores.data === undefined \|\| stores.isError`) | "a failed refetch keeps the table of /stores" |
| products table back to error first | "a failed refetch keeps the table of /products" |
| categories table back to error first | "a failed refetch keeps the table of /categories", "a category save whose reload fails …" |
| store page back to error first | "a failed refetch keeps the store page …" |
| pincode editor back to error first | "a failed refetch keeps the store page …" |
| product page: the product's error first | "a failed refetch keeps the product page …" |
| product page: the categories' error first | "a failed refetch keeps the product page …" |
| new product back to error first | "a failed refetch keeps the new product form …" |
| stock table back to error first | "a failed refetch keeps the stock table …", "… of store staff", "a save whose reload fails …" |
| stock's stores list back to error first | "a failed refetch keeps the stock table and the unsaved quantity" |
| stock save: no `setQueriesData` | "a save whose reload fails shows the saved quantity, "Stock saved." and the notice" |

## Test strategy
Vitest and Testing Library through `renderApp` (the real router, guard, shell and `QueryClient`), core faked at `fetch` with `fakeCore`, as every admin test. No HTTP mock library, no `vi.mock`, no timers.

- **Where this differs from web's recipe.** Web seeded an answer older than its 60 s `staleTime` and let jsdom's unfetchable relative URL fail the refetch. Admin has no `staleTime` and an absolute base URL with a fake core, so the test loads the page for real, flips a switch (`core = 'down'`: every read behind `read()` answers a bodiless 502, what a proxy answers while core restarts, which also exercises the client's envelope rule from admin-stock 3b), and asks the app's own `QueryClient` to read everything on screen again: `refetchQueries({ type: 'active' })`, what a window focus does.
- **The wait is the test** (web found the same). TanStack tells its observers one turn after the answers, so `refetch()` ends with `await new Promise((told) => notifyManager.schedule(told))`, which queues behind those notifications, all inside `act`. Without that line the assertions run against the page as it was before the answers and pass on the unfixed code: the first version of the spike's tests did exactly that and failed only on the missing notice. With it, each red test is red on its content.
- `keptThroughARefetch(router, shown)`: fail everything, assert the content, exactly one notice with `role="status"`, no alert; answer everything, assert the content again and no notice.
- One file for the whole rule rather than a test per page file: the switchable routes and the two helpers are written once, and no shared file (`fake-core.ts`) is edited.
- `let core` is module state reset in `afterEach`; the tests of one file run in order.

## Spike (2026-10-13, on this branch at 6d9f7b3, Node 22.23.3, `npm ci` at the root; removed again)
- Base: admin Vitest `160 passed (160)`.
- Tests only: `11 failed | 168 passed (179)`, 17 files; lint and typecheck clean.
- With the fix: `179 passed (179)`; `src/refetch.test.tsx` six more times, 19 of 19 each; lint, typecheck and `vite build` clean; `make test-web` exit 0 with ui `54`, admin `179`, web `91`; `src/routeTree.gen.ts` unchanged.
- 17 mutations (table above), each restored.
- The blocks below were written back into files from this document by a script on a clean tree and compared with the spike: same diff, 179 green.

## e2e
None added, none changed, none to run for this lane's worker. Nothing changes while core answers, and the failing state would need the network cut under Playwright, which the suite does nowhere. No existing e2e string changes: the specs filter statuses by text (`getByRole('status').filter({ hasText: 'Stock saved.' })` and the like), so one more possible status region cannot make them ambiguous, and no copy in any page changed. The manager runs `make e2e` before landing as for any admin PR; expected unchanged at admin 10.

## For admin-P2-L5 (`admin-orders-dashboard`, unmerged)
Its change folder appeared while this one was being written (proposal.md and design.md, read on 2026-10-13 at 21:40; no tasks or briefs yet). Its Decision 13 takes the same page rule (`data === undefined ? (isError ? alert : skeleton) : content`) but has **no helper and four wordings**, one `StatusMessage tone="warning"` per view: "Could not refresh. Showing the last orders." (board), "… the last list." (history), "… the last numbers." (dashboard), "… the order as last read." (sheet). So there was no helper name to reuse; the first sentence of this lane's wording matches its family.

By reading (not run together), the two designs do not break each other's tests: both find a notice by its text and neither asks for a lone `status` role. But together an L5 page whose poll fails shows two notices: L5's own and the root one. That needs the manager's call before L5's workers start; this lane's worker is not affected either way.
- **Recommended:** L5 drops the notice lines on the board, the history and the dashboard (three lines and the three strings in its tests become "Could not refresh. Showing what was loaded last.") and keeps the one inside the order sheet, which is a modal over the page where the root notice cannot be seen. One wording for every page, as this lane was asked; L5 gets shorter.
- **Otherwise:** keep L5 as designed and give `RefetchNotice` a way to stay silent for queries whose view speaks for itself (a `meta: { ownNotice: true }` on L5's query options, one more clause in the predicate). Costs a second mechanism; not designed here.
- L5's ceiling "a failed refresh of the stores list shows no notice" no longer holds once the root notice exists: it shows. That is this lane's rule (data on screen may be old), not a regression.
- Helper name and file, for either choice: `RefetchNotice` in `src/refetch-notice.tsx`, mounted in `src/routes/__root.tsx`.
- Both lanes may edit `src/routes/_staff/stock.tsx`; the second to land rebases.

## Code and tests, verbatim
Copy every block byte for byte. Paths are under `apps/admin/`. Blocks marked NEW FILE are whole files; each EDIT block pair is one replacement whose "replace" text occurs exactly once in its file on 6d9f7b3.

### NEW FILE `src/refetch.test.tsx` (step 1, the `test:` commit)
```tsx
import { notifyManager } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { StockRow } from './stock'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, indiranagar, json, koramangala, productList, storeList, storeStaff, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

type Answer = (request: Request) => Response | Promise<Response>
type Router = ReturnType<typeof renderApp>

// What core does to a read once the page shows: 'up' answers, 'down' is a proxy's bodiless 502 while core restarts,
// 'gone' is core's 404 for a row deleted elsewhere, 'forbidden' its 403.
let core: 'up' | 'down' | 'gone' | 'forbidden' = 'up'
const read = (answer: Answer): Answer => (request) =>
  core === 'up' ? answer(request) : core === 'down' ? json(502) : core === 'gone' ? apiError(404, 'not_found') : apiError(403, 'forbidden')

afterEach(() => {
  core = 'up'
  clearToken()
  vi.unstubAllGlobals()
})

const notice = 'Could not refresh. Showing what was loaded last.'
const stockRow: StockRow = { productId: tonedMilk.id, name: tonedMilk.name, unitLabel: '500 ml', priceCents: 2799, quantity: 17 }
const stockPath = `/admin/stores/${indiranagar.id}/stock`
const storePath = `/admin/stores/${koramangala.id}`
const productPath = `/admin/products/${tonedMilk.id}`

// Every read an admin page makes, each behind the switch; the session read always answers.
const routes: Record<string, Answer> = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/stores': read(() => storeList([indiranagar, koramangala])),
  [`GET ${storePath}`]: read(() => json(200, koramangala)),
  [`GET ${storePath}/service-areas`]: read(() => json(200, { pincodes: ['560034', '560095'] })),
  'GET /admin/categories': read(() => categoryTree([fruits, dairy])),
  'GET /admin/products': read(() => productList([tonedMilk])),
  [`GET ${productPath}`]: read(() => json(200, tonedMilk)),
  [`GET ${stockPath}`]: read(() => json(200, { items: [stockRow], page: 1, pageSize: 24, total: 1 })),
}

// Every read on screen is made again, as on a window focus. Resolves when all of them have answered and the pages have
// been told: TanStack Query tells them one turn later, and `schedule` queues behind that. Without it the assertions run
// against the page as it was before the answers and pass on any code.
const refetch = (router: Router) =>
  act(async () => {
    await router.options.context.queryClient.refetchQueries({ type: 'active' })
    await new Promise<void>((told) => notifyManager.schedule(told))
  })

// The page still shows, with the one notice and no alert; the next good answer takes the notice away.
async function keptThroughARefetch(router: Router, shown: () => void) {
  core = 'down'
  await refetch(router)
  shown()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.getByText(notice)).toHaveAttribute('role', 'status')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  core = 'up'
  await refetch(router)
  shown()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
}

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  await userEvent.type(field, value)
}

test.each([
  ['/stores', 'Stores', 'Koramangala'],
  ['/products', 'Products', 'Sunny Fields Toned Milk'],
  ['/categories', 'Categories', 'Dairy, Bread & Eggs'],
])('a failed refetch keeps the table of %s', async (path, caption, cell) => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(path)
  await screen.findByRole('table', { name: caption })

  await keptThroughARefetch(router, () => expect(screen.getByRole('table', { name: caption })).toHaveTextContent(cell))
})

test('a failed refetch keeps the store page, what was typed in its form and the unsaved pincodes', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(`/stores/${koramangala.id}`)
  await replace('Name', 'Koramangala West')
  await screen.findByRole('table', { name: 'Pincodes' })
  await userEvent.type(screen.getByLabelText('Add pincode'), '560001')
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))

  await keptThroughARefetch(router, () => {
    expect(screen.getByLabelText('Name')).toHaveValue('Koramangala West')
    expect(within(screen.getByRole('table', { name: 'Pincodes' })).getByText('560001')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
  })
})

test('a failed refetch keeps the product page and what was typed in its form', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(`/products/${tonedMilk.id}`)
  await replace('Name', 'Toned Milk 500')

  await keptThroughARefetch(router, () => {
    expect(screen.getByLabelText('Name')).toHaveValue('Toned Milk 500')
    expect(screen.getByLabelText('Category')).toHaveValue(tonedMilk.categoryId)
  })
})

test('a failed refetch keeps the new product form and what was typed in it', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/products/new')
  await replace('Name', 'Curd Cup')

  await keptThroughARefetch(router, () => expect(screen.getByLabelText('Name')).toHaveValue('Curd Cup'))
})

test('a failed refetch keeps the stock table and the unsaved quantity', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: `Quantity of ${stockRow.name}` })
  await userEvent.clear(field)
  await userEvent.type(field, '40')

  await keptThroughARefetch(router, () => {
    expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('40')
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
    expect(screen.getByLabelText('Store')).toHaveValue(indiranagar.id)
  })
})

test('a failed refetch keeps the stock and the store name of store staff', async () => {
  setToken('tok')
  const own = `/admin/stores/${storeStaff.storeId}/stock`
  fakeCore({
    'GET /admin/me': () => json(200, storeStaff),
    [`GET ${own}`]: read(() => json(200, { items: [stockRow], page: 1, pageSize: 24, total: 1 })),
    [`GET /stores/${storeStaff.storeId}`]: read(() => json(200, { id: storeStaff.storeId, name: 'Indiranagar' })),
  })
  const router = renderApp('/stock')
  await screen.findByText('Indiranagar')

  await keptThroughARefetch(router, () => {
    expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('17')
    expect(screen.getByText('Indiranagar')).toBeInTheDocument()
  })
})

test('a save whose reload fails shows the saved quantity, "Stock saved." and the notice', async () => {
  setToken('tok')
  const calls = fakeCore({ ...routes, [`PUT ${stockPath}`]: () => { core = 'down'; return json(204) } })
  renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: `Quantity of ${stockRow.name}` })
  await userEvent.clear(field)
  await userEvent.type(field, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Stock saved.')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: `Quantity of ${stockRow.name}` })).toHaveValue('40')
  expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
})

test('a category save whose reload fails closes the dialog and keeps the table with the notice', async () => {
  setToken('tok')
  fakeCore({ ...routes, [`PATCH /admin/categories/${dairy.id}`]: () => { core = 'down'; return json(200, { ...dairy, name: 'Dairy' }) } })
  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: `Edit ${dairy.name}` }))
  await replace('Name', 'Dairy')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('table', { name: 'Categories' })).toBeInTheDocument()
  expect(screen.getAllByText(notice)).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test.each([
  ['store', `/stores/${koramangala.id}`],
  ['product', `/products/${tonedMilk.id}`],
])('a %s deleted elsewhere shows not found on the next refetch, without the notice', async (_, path) => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp(path)
  await screen.findByLabelText('Name')

  core = 'gone'
  await refetch(router)

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
})

test('a 403 on a refetch shows not found, without the notice', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stores')
  await screen.findByRole('table', { name: 'Stores' })

  core = 'forbidden'
  await refetch(router)

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
})

test.each([
  [`/stores/${koramangala.id}`, 'Could not load the store.', 'Name'],
  [`/products/${tonedMilk.id}`, 'Could not load the product.', 'Name'],
  ['/products/new', 'Could not load the categories.', 'Name'],
])('a first load of %s that fails shows the alert with "Try again" and no notice', async (path, message, label) => {
  setToken('tok')
  core = 'down'
  fakeCore(routes)
  renderApp(path)

  const alerts = await screen.findAllByRole('alert')
  expect(alerts[0]).toHaveTextContent(message)
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  expect(screen.queryByLabelText(label)).not.toBeInTheDocument()
  core = 'up'
  await userEvent.click(within(alerts[0]).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByLabelText(label)).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
})

test('the pincodes failing on the first load show their own alert inside the store page, which stays', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...routes, [`GET ${storePath}/service-areas`]: () => (fail ? json(502) : json(200, { pincodes: ['560034'] })) })
  renderApp(`/stores/${koramangala.id}`)

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the pincodes.')
  expect(screen.getByLabelText('Name')).toHaveValue('Koramangala')
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Pincodes' })).toBeInTheDocument()
})

test('a page of stock that fails on its first load shows the alert and no notice, and the unsaved quantity is still counted', async () => {
  setToken('tok')
  const rows: StockRow[] = Array.from({ length: 30 }, (_, i) => ({ ...stockRow, productId: `00000000-0000-4000-8000-0000000007${String(i + 1).padStart(2, '0')}`, name: `Product ${String(i + 1).padStart(2, '0')}` }))
  fakeCore({
    ...routes,
    [`GET ${stockPath}`]: (request) => {
      const page = Number(new URL(request.url).searchParams.get('page') ?? 1)
      return page === 2 ? json(502) : json(200, { items: rows.slice(0, 24), page: 1, pageSize: 24, total: 30 })
    },
  })
  renderApp('/stock')
  const field = await screen.findByRole('textbox', { name: 'Quantity of Product 01' })
  await userEvent.clear(field)
  await userEvent.type(field, '40')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the stock.')
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument()
  expect(screen.queryByText(notice)).not.toBeInTheDocument()
})

test('the notice leaves with the page it was about', async () => {
  setToken('tok')
  fakeCore(routes)
  const router = renderApp('/stores')
  await screen.findByRole('table', { name: 'Stores' })
  core = 'down'
  await refetch(router)
  expect(screen.getByText(notice)).toBeInTheDocument()

  core = 'up'
  await userEvent.click(screen.getByRole('link', { name: 'Categories' }))

  expect(await screen.findByRole('table', { name: 'Categories' })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText(notice)).not.toBeInTheDocument())
})
```

### NEW FILE `src/refetch-notice.tsx` (step 2, the `fix:` commit)
```tsx
import { notifyManager, useQueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { StatusMessage } from '@shopperstop/ui'
import type { ApiError } from './api'

// The one notice for a read that failed while its page still shows what it loaded before: the page keeps its data
// (each page asks `data === undefined` before it shows an alert) and this says the data may be old. It reads the query
// cache, not a page: any query on screen that holds data and whose last read failed. A 404 is an answer, not a failure:
// the detail pages show "Page not found" for it. The next good answer to that query takes the notice away.
export function RefetchNotice() {
  const cache = useQueryClient().getQueryCache()
  const subscribe = useCallback((changed: () => void) => cache.subscribe(notifyManager.batchCalls(changed)), [cache])
  const failed = useSyncExternalStore(subscribe, () =>
    cache
      .findAll({ type: 'active' })
      .some(({ state }) => state.status === 'error' && state.data !== undefined && (state.error as Partial<ApiError>).code !== 'not_found'),
  )
  return failed ? <StatusMessage tone="warning" className="mb-6">Could not refresh. Showing what was loaded last.</StatusMessage> : null
}
```

### EDIT 1 `src/routes/__root.tsx`: import of the notice
Replace:
```tsx
import { NotFound } from '../not-found'
import { clearToken } from '../session'
```
With:
```tsx
import { NotFound } from '../not-found'
import { RefetchNotice } from '../refetch-notice'
import { clearToken } from '../session'
```

### EDIT 2 `src/routes/__root.tsx`: the notice above every page
Replace:
```tsx
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
```
With:
```tsx
      <main className="px-4 py-6 sm:px-6">
        <RefetchNotice />
        <Outlet />
```

### EDIT 3 `src/routes/_staff/_admin/stores/index.tsx`: the stores table
Replace:
```tsx
      {stores.isPending ? (
        <Skeleton variant="table" count={4} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : stores.data.items.length === 0 ? (
```
With:
```tsx
      {stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : stores.data.items.length === 0 ? (
```

### EDIT 4 `src/routes/_staff/_admin/stores/$storeId.tsx`: the store page
Replace:
```tsx
  if (store.isPending) return <Skeleton variant="list" count={3} />
  if (store.isError) {
    if ((store.error as Partial<ApiError>).code === 'not_found') return <NotFound />
    return <ErrorBanner message="Could not load the store." onRetry={() => void store.refetch()} />
  }
```
With:
```tsx
  // A store deleted elsewhere is gone even while the page shows it; any other failed read leaves what is shown.
  if ((store.error as Partial<ApiError> | null)?.code === 'not_found') return <NotFound />
  if (store.data === undefined) {
    return store.isError ? <ErrorBanner message="Could not load the store." onRetry={() => void store.refetch()} /> : <Skeleton variant="list" count={3} />
  }
```

### EDIT 5 `src/routes/_staff/_admin/products/index.tsx`: the products table
Replace:
```tsx
      {products.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : products.isError ? (
        <ErrorBanner message="Could not load the products." onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
```
With:
```tsx
      {products.data === undefined ? (
        products.isError ? (
          <ErrorBanner message="Could not load the products." onRetry={() => void products.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : products.data.items.length === 0 ? (
```

### EDIT 6 `src/routes/_staff/_admin/products/$productId.tsx`: the product page
Replace:
```tsx
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
```
With:
```tsx
  // A product deleted elsewhere is gone even while the page shows it; any other failed read leaves what is shown.
  if ((product.error as Partial<ApiError> | null)?.code === 'not_found') return <NotFound />
  if (product.data === undefined || categories.data === undefined) {
    if (!product.isError && !categories.isError) return <Skeleton variant="list" count={3} />
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
```

### EDIT 7 `src/routes/_staff/_admin/products/new.tsx`: the new product form
Replace:
```tsx
      {categories.isPending ? (
        <Skeleton variant="list" count={3} />
      ) : categories.isError ? (
        <ErrorBanner message="Could not load the categories." onRetry={() => void categories.refetch()} />
      ) : (
```
With:
```tsx
      {categories.data === undefined ? (
        categories.isError ? (
          <ErrorBanner message="Could not load the categories." onRetry={() => void categories.refetch()} />
        ) : (
          <Skeleton variant="list" count={3} />
        )
      ) : (
```

### EDIT 8 `src/routes/_staff/_admin/categories.tsx`: the categories table
Replace:
```tsx
      {tree.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : tree.isError ? (
        <ErrorBanner message="Could not load the categories." onRetry={() => void tree.refetch()} />
      ) : rows.length === 0 ? (
```
With:
```tsx
      {tree.data === undefined ? (
        tree.isError ? (
          <ErrorBanner message="Could not load the categories." onRetry={() => void tree.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : rows.length === 0 ? (
```

### EDIT 9 `src/service-areas.tsx`: the pincode editor
Replace:
```tsx
      {saved.isPending ? (
        <Skeleton variant="table" count={2} />
      ) : saved.isError ? (
        <ErrorBanner message="Could not load the pincodes." onRetry={() => void saved.refetch()} />
      ) : (
```
With:
```tsx
      {saved.data === undefined ? (
        saved.isError ? (
          <ErrorBanner message="Could not load the pincodes." onRetry={() => void saved.refetch()} />
        ) : (
          <Skeleton variant="table" count={2} />
        )
      ) : (
```

### EDIT 10 `src/routes/_staff/stock.tsx`: the save's `onSuccess`: saved quantities into the page on screen before it is read again
Replace:
```tsx
    onSuccess: async (rows, sent) => {
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since, or beyond the 500 rows of one PUT, stays unsaved.
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      setDraft((current) =>
```
With:
```tsx
    onSuccess: async (rows, sent) => {
      const done = new Map(rows.map((row) => [row.productId, row.quantity]))
      // Kept pages hold the old quantities: drop the ones not on screen and read this one again before the edits go.
      // The page on screen gets what was saved first: if that read fails its rows stay, and must not show the old quantities.
      queryClient.removeQueries({ queryKey: ['admin', 'stock', sent.store], type: 'inactive' })
      queryClient.setQueriesData<{ items: StockRow[] }>(
        { queryKey: ['admin', 'stock', sent.store] },
        (shown) => shown && { ...shown, items: shown.items.map((row) => ({ ...row, quantity: done.get(row.productId) ?? row.quantity })) },
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'stock', sent.store] })
      // Only what was sent is saved: an edit typed since, or beyond the 500 rows of one PUT, stays unsaved.
      setDraft((current) =>
```

### EDIT 11 `src/routes/_staff/stock.tsx`: the stock table
Replace:
```tsx
      {stock.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stock.isError ? (
        <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
```
With:
```tsx
      {stock.data === undefined ? (
        stock.isError ? (
          <ErrorBanner message="Could not load the stock." onRetry={() => void stock.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : stock.data.items.length === 0 ? (
```

### EDIT 12 `src/routes/_staff/stock.tsx`: the admin's stores list around the editor
Replace:
```tsx
      ) : stores.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : storeId ? (
```
With:
```tsx
      ) : stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="table" count={6} />
        )
      ) : storeId ? (
```

## Ceilings, in one place
- A 404 on a refetch of a non-detail read keeps the rows without a notice (Decision 5).
- The stock save guard patches quantities only (Decision 7).
- No retry on the notice (Decision 8); not sticky (Decision 9).
- While a dialog is open (a category being edited, a delete being confirmed) the notice is behind it at the top of the page: seen when the dialog closes. The dialog's own fields are form state and are not what the notice is about.
- A category write whose reload fails leaves the old table under the notice (Mutation flows).
- `/products` still shows the skeleton while a new filter or page loads, and the alert if that first load fails: a new filter is a new read with no data. `/stock` keeps its rows through that (admin-stock Decision 11); the same `placeholderData` for products is a separate change if wanted.
- The account of the session read (site 12) rests on it having no observer. A later `useQuery(meQuery)` anywhere would make it refetch on focus; the cache-level notice would then cover its failure, and the guard would still return the held staff member.
- The test's wait leans on TanStack telling observers through `notifyManager`'s own queue. If an upgrade changes that order, the eleven tests fail on the missing notice, loudly, not silently.

## Risks / Trade-offs
- The pins are green on arrival, so the `test:` commit is red by 11 and green by 8 new tests; the commit body says which.
- admin-P2-L5 may still edit `src/routes/_staff/stock.tsx` (its tree did at one point). EDIT 10 to 12 touch three separate places there; whichever lane lands second rebases, and the EDIT blocks say what each place must become.
- The notice appears on a page of a role that then turns out to be signed out: a 401 clears the cache (`onUnauthorized`), which removes the notice with it.
