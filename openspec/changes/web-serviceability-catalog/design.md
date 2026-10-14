# Design

## Context
`apps/web` on main (f345142): the shell (`src/routes/__root.tsx`: brand banner with a dead "Enter pincode" button and `<AccountLink />`, `main`, not-found), accounts from web-P2-L2 (`src/api.ts`: `api` openapi-fetch client with `baseUrl: '/api/core/v1'` and the bearer middleware, `queryClient` with `retry: false`, `call`, `splitError`, `useMe`; `src/session.ts`: guarded `localStorage` store with `useSyncExternalStore`), Vitest route tests that render `routeTree` in a memory router, and Playwright with `e2e/global-setup.ts` running `core-admin migrate` and `seed-demo --reset` on `shopperstop_core_e2e`.

Core routes this change reads, as designed on the core lanes' branches and since landed on main; the generated `packages/ui/src/api/core.d.ts` matched this section for all four tasks (no type deviation, lane log):
- core-P2-L2 `core-stores-serviceability`: `GET /serviceability?pincode=` → 200 `Serviceability {store: Store}`, 404 `not_serviceable`, 400 `validation` field `pincode`; `Store {id, name, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`; `POST /admin/stores` (new stores are closed), `PUT /admin/stores/{id}/service-areas {pincodes}`. Demo: Koramangala `00000000-0000-4000-8000-000000000401` serves 560034 and 560095 (10 minutes), Indiranagar `...0402` serves 560038 and 560008 (12 minutes), both open.
- core-P2-L3 `core-catalog`: `Category {id, name, slug, parentId?, sortOrder, imageUrl?}`, `CategoryNode` = Category + `children: Category[]`, `CategoryTree {items}`; `imageUrl` is a path `/api/core/v1/files/<kind>/<name>` used as `src` as is; demo catalog of 12 parents (first `Fruits & Vegetables`, `fruits-vegetables`; second `Dairy, Bread & Eggs` with children Milk, Bread & Pav, Eggs, Paneer & Curd), 148 products (`Banana Robusta`, `banana-robusta`, first; the last inactive).
- core-P2-L4 `core-stock-cart` (D24): `GET /stores/{id}/categories` → `CategoryTree` of only categories with stock; `GET /stores/{id}/products?categoryId=&q=&page=&pageSize=` → `StoreProductList {items: StoreProduct[], page, pageSize, total}` ordered by name, `q` matching name or brand, a parent `categoryId` including its children; `GET /stores/{id}/products/{slug}` → `StoreProduct`, 404 `not_found`; `StoreProduct {id, name, slug, description?, brand?, unitLabel, mrpCents, priceCents, categoryId, imageUrl?, inStock, quantity}` with `quantity` capped at 10 (D7). Demo stock: per store one product in 15 at 0 and one in 15 at 1 to 4.

## Goals / Non-Goals
**Goals:** every scenario of the delta (30) has a named test; four sequential worker tasks with disjoint new files; one store gate and one product card reused by every page; a single cart hook web-P2-L3 replaces.

**Non-Goals:** the cart and its drawer, the store-change confirm dialog (web-P2-L3 wraps `setPincode`), geolocation, cross-tab pincode sync, a product image gallery, sorting or filters beyond category and text.

## Files (all under `apps/web/`)
| File | Task | What |
|---|---|---|
| `src/pincode.ts`, `src/pincode.test.ts` | 1 | pincode and sheet-open store |
| `src/catalog.ts` | 1, 2, 3, 4 | the schema type aliases, query keys and hooks: 1 `useServiceability`; 2 `serviceabilityMissing` (fold-in), `useCategories`, `usePicked`; 3 `useProductFeed`, `findCategory`; 4 `useProduct` |
| `src/catalog.test.ts` | 2 | "only not_serviceable means no store delivers" (fold-in, see Decision 5) |
| `src/pincode-sheet.tsx`, `src/pincode-sheet.test.tsx` | 1 | `PincodeSheet`, `PincodeButton` |
| `src/search-form.tsx` | 1, 4 | banner search form (task 4 reads `q` with `useSearch` once `/search` validates it) |
| `src/store-gate.tsx`, `src/store-gate.test.tsx` | 1 | `StoreGate` |
| `src/routes/__root.tsx` | 1 | banner: wordmark link, search form, pincode button; `<PincodeSheet />` |
| `src/routes/index.tsx` | 1, 2 | 1: opens the sheet without a pincode, `StoreGate`; 2: Home content |
| `src/shell.test.tsx` | 1 | "home renders in the shell" updated, "search from the banner" added |
| `src/test-setup.ts` | 1 | also clears the pincode |
| `src/test-data.ts` | 1, 2 | test-only builders and render helpers (1: `store`, `renderAt`; 2: `product`, `category`, `renderInRouter`) |
| `e2e/browse.spec.ts` | 1, 2, 3, 4 | one test per "against core" scenario, added by the task that owns it |
| `e2e/auth.spec.ts`, `e2e/account.spec.ts` | 1, 4 | `test.beforeEach` storing pincode `560034` so the first-visit sheet does not cover Home; task 4 also makes `account.spec.ts` "addresses and default" wait for the Work `Default` badge before it reloads (a flaky wait from web-P2-L2, test only) |
| `src/cart.ts` | 2 | `useCartQuantity` stub |
| `src/product-card.tsx`, `src/product-card.test.tsx` | 2, 3 | `ImageTile`, `ProductCard`, `ProductGrid`; task 3 adds the test "out of stock card" |
| `src/home.test.tsx` | 2 | |
| `src/product-feed.tsx` | 3 | `ProductFeed` (paged grid, Load more, scroll loading) |
| `src/routes/c.$slug.tsx`, `src/category.test.tsx` | 3 | |
| `src/routes/search.tsx`, `src/search.test.tsx` | 3 | |
| `src/routes/p.$slug.tsx`, `src/product.test.tsx` | 4 | |
| `src/routeTree.gen.ts` | 3, 4 | regenerated by the build, committed |

No new dependency. `src/api.ts` and `src/session.ts` do not change.

## Interfaces

Types everywhere: `type Store = components['schemas']['Store']`, `StoreProduct`, `StoreProductList`, `Category`, `CategoryNode` from `@shopperstop/ui/api`, aliased and exported once in `src/catalog.ts` (`src/test-data.ts` repeats the three it builds).

### `src/pincode.ts` (task 1)
```ts
const key = 'shopperstop:pincode'
export const pincodePattern = /^[1-9][0-9]{5}$/
type PincodeState = { pincode?: string; sheetOpen: boolean }
// read(): guarded localStorage.getItem; a value failing pincodePattern reads as undefined
let state: PincodeState = { pincode: read(), sheetOpen: false }
export function getPincode(): string | undefined
export function setPincode(next: string | undefined): void   // new state object {pincode: next, sheetOpen: false}, notify, then guarded set/remove
export function openPincodeSheet(): void                     // {...state, sheetOpen: true}, notify
export function closePincodeSheet(): void                    // {...state, sheetOpen: false}, notify
export function usePincode(): PincodeState                   // useSyncExternalStore(subscribe, () => state)
```
Every change replaces `state` (a new object), so the snapshot is stable between changes. Same storage guard and ordering as `session.ts` (memory first, then the guarded write). `setPincode(undefined)` exists for `test-setup.ts` and costs nothing. Web-P2-L3 wraps `setPincode` for the store-change confirm.

### `src/catalog.ts`
```ts
export const keys = {
  serviceability: (pincode: string) => ['serviceability', pincode] as const,
  categories: (storeId: string) => ['categories', storeId] as const,
  picked: (storeId: string) => ['picked', storeId] as const,
  feed: (storeId: string, filter: { categoryId?: string; q?: string }) => ['feed', storeId, filter] as const,
  product: (storeId: string, slug: string) => ['product', storeId, slug] as const,
}
const staleTime = 60_000   // every hook below sets it; also what lets tests seed the cache without a refetch

// fold-in (task 2): true only for status 404 with the envelope code not_serviceable
export function serviceabilityMissing(status: number, error: components['schemas']['Error'] | undefined): boolean
// task 1: null = 404 not_serviceable (a notice, not an error); throws otherwise,
// including a 404 with another code or no body and a 200 without a store
export function useServiceability(pincode: string | undefined)   // useQuery, enabled: !!pincode, queryFn → Store | null
// task 2
export function useCategories(storeId: string)                   // queryFn → data.items (CategoryNode[])
export function usePicked(storeId: string)                       // queryFn GET products {pageSize: 24} → data.items;
                                                                 // select: items.filter(p => p.inStock).slice(0, 12)
// task 3
export const feedPageSize = 24
export function useProductFeed(storeId: string, filter: { categoryId?: string; q?: string })
  // useInfiniteQuery, initialPageParam 1, queryFn GET products {...filter, page: pageParam, pageSize: feedPageSize} → data,
  // getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined)
export function findCategory(tree: CategoryNode[], slug: string): { parent: CategoryNode; selected: Category } | undefined
// task 4: null = any 404 (unknown store, unknown slug, inactive product)
export function useProduct(storeId: string, slug: string)        // queryFn → StoreProduct | null
```
Every `queryFn` reads `{ data, error, response }` from `api.GET`. "Absent" is `null`: `useServiceability` returns it only when `serviceabilityMissing(response.status, error)` (404 and code `not_serviceable`), `useProduct` on any `response.status === 404`; any other `error` is thrown. The filter object passed to `keys.feed` contains only the members that are set (`{ categoryId }` or `{ q }`), so tests seed the same key.

### Components
- `PincodeSheet()` (task 1): `Sheet` `open={sheetOpen}` `onClose={closePincodeSheet}` title "Your delivery pincode"; body: one sentence "We show the store that delivers to you." (`text-body text-ink-muted`), a form with `FormField label="Pincode"` around `Input name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={6} defaultValue={pincode ?? ''}`, and a primary full-width submit `Button` (`size="lg"`) "Save pincode"; the form is `noValidate`. Submit trims; not matching `pincodePattern` → field error "Enter a 6-digit pincode"; else `setPincode(value)`. The form is an inner component, so every open starts fresh (the `Sheet` returns null while closed).
- `PincodeButton()` (task 1): `Button variant="secondary" aria-haspopup="dialog" onClick={openPincodeSheet}` with `MapPin` 16 `aria-hidden`; text: no pincode → "Enter pincode"; an open store resolved → `<span className="flex flex-col items-start leading-tight"><span>Delivery in {n} minutes</span>{' '}<span className="text-small">{pincode}</span></span>` (the `{' '}` makes the accessible name "Delivery in 10 minutes 560034"); otherwise the pincode alone.
- `SearchForm()` (task 1): `<form role="search">` holding `Input type="search" name="q" aria-label="Search products" placeholder="Search for milk, bread, eggs"`; `defaultValue` is the current `q` only on `/search`, read with `useSearch({ from: '/search', shouldThrow: false })?.q ?? ''` (the input keyed on it so it follows navigation); takes a `className` for the banner layout; submit (Enter) trims and calls `navigate({ href: q ? '/search?q=' + encodeURIComponent(q) : '/search' })` (an `href`, so it type-checks before task 3 adds the route). No submit button: `IconButton` forces `type="button"`, and Enter is the expected way to submit a search box.
- `__root.tsx` banner (task 1): `<header className="flex flex-wrap items-center gap-x-4 gap-y-2 bg-brand px-4 py-3 sm:px-6">`: wordmark `Link to="/"` (`text-h2 text-on-brand`), `SearchForm` (`order-last basis-full sm:order-none sm:basis-auto sm:flex-1 sm:max-w-xl`), then `<div className="ml-auto flex items-center gap-2"><PincodeButton /><AccountLink /></div>`; `<PincodeSheet />` after `main`.
- `StoreGate({ title, children }: { title: string; children: (store: Store) => ReactNode })` (task 1): reads `usePincode()` and `useServiceability`. An open store → `children(store)` (the page renders its own `PageHeader`). Otherwise `<div className="flex flex-col gap-6"><PageHeader title={title} />` and, in this order:
  | Condition | Shows |
  |---|---|
  | no pincode | `Card p-6` `EmptyState` "Set your pincode", "Enter your pincode to see the store that delivers to you.", `Button` "Choose pincode" → `openPincodeSheet` |
  | pending | `Skeleton variant="grid" count={8}` |
  | error | `ErrorBanner` "Could not check your pincode." `onRetry={() => refetch()}` |
  | `null` | `Card p-6` `EmptyState` "We do not deliver to {pincode} yet", "Try another pincode nearby.", secondary `Button` "Change pincode" |
  | `isOpen` false | `Card p-6` `EmptyState` "{name} is closed right now", "Orders open again when the store does. Try another pincode.", secondary `Button` "Change pincode" |
  Notices sit on a `Card` because `ink-muted` on `canvas` is below 4.5:1 (admin's axe finding). Ceiling: the error row is checked before the data, so a background refetch that fails (window focus after the 60 s `staleTime`) replaces a page that was showing with the alert until "Try again" succeeds; the page components below order their checks the same way, only `ProductFeed` keeps its data. Backlog: prefer the held data (`error && !data`).
- `ImageTile({ src }: { src?: string })` (task 2): `<div className="aspect-square w-full overflow-hidden rounded-control bg-surface">`, `<img src alt="" loading="lazy" className="size-full object-contain" />` when `src`, else `<div data-placeholder className="flex size-full items-center justify-center bg-canvas"><ShoppingBasket size={20} aria-hidden className="text-ink-muted" /></div>`. `alt=""`: the name is the adjacent link text.
- `ProductCard({ product })` (task 2): `Card` `p-3 flex flex-col gap-2`; one `Link to="/p/$slug"` holding `ImageTile src={product.imageUrl}`, `<p className="text-body font-semibold text-ink line-clamp-2">{name}</p>{' '}<p className="text-small text-ink-muted">{unitLabel}</p>`; then a row with `Price cents={priceCents} mrpCents={mrpCents}` and the `Stepper value={quantity} max={product.inStock ? product.quantity : 0} label={product.name} onChange={setQuantity}` from `useCartQuantity(product)`. `ProductGrid({ products })`: `<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">` of `<li><ProductCard /></li>`.
- `useCartQuantity(product)` (task 2, `src/cart.ts`): `useState(0)`; returns `[quantity, (next) => setQuantity(Math.min(next, product.quantity))] as const`. Marked `ponytail:` in the file: a local count per mounted card, nothing persisted; web-P2-L3 replaces the body and keeps the signature.
- Home (task 2), inside `StoreGate title="Groceries in minutes"`: `PageHeader` "Groceries in minutes"; `nav aria-label="Categories"` with a horizontally scrolling `ul` of `Link to="/c/$slug"` styled with `buttonClass({ variant: 'secondary' })` per parent (`RouterButtonLink` is a private `createLink(ButtonLink)` in `__root.tsx`, not exported; every button-styled link on these pages is `Link` + `buttonClass`); `<section aria-labelledby>` "Shop by category" (`h2 text-h2`) with `<ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">` of `Link to="/c/$slug"` holding `ImageTile src={imageUrl}` and the name (`text-small text-ink text-center`); `<section aria-labelledby>` "Picked for you" with `ProductGrid` of `usePicked`. Categories pending → one `Skeleton variant="grid" count={6}` standing for both category places, error → one `ErrorBanner` "Could not load categories." with retry in their place (the navigation and the section share one query; accepted by the manager); Picked pending → `Skeleton variant="grid" count={12}`, error → "Could not load products." with retry. The task-1 effect stays: `useEffect(() => { if (!getPincode()) openPincodeSheet() }, [])`.
- `ProductFeed({ storeId, filter, empty }: { ...; empty: ReactNode })` (task 3): `useProductFeed`; pending → `Skeleton variant="grid" count={8}`; error with no data → `ErrorBanner` "Could not load products." retry `refetch`; no items → `empty`; else `ProductGrid` of all pages' items, then `isFetchNextPageError` → `ErrorBanner` "Could not load more products." retry `fetchNextPage`, then while `hasNextPage` a `<div ref={end}>` holding `Button variant="secondary" loading={isFetchingNextPage}` "Load more" → `fetchNextPage()`. An effect observes `end` with `IntersectionObserver` (`rootMargin: '400px'`) and calls `fetchNextPage()` on intersection when `hasNextPage && !isFetchingNextPage && !isFetchNextPageError`; it returns early when `IntersectionObserver` is undefined (jsdom). The observer stays idle while a page is in error (otherwise a failed page re-fires it in a loop), so the banner's retry and "Load more" are the only ways to retry a failed page.
- `/c/$slug` (task 3): `StoreGate title="Category"` → `useCategories`; pending → `PageHeader` "Category" + `Skeleton variant="grid" count={8}`; error → `PageHeader` "Category" + `ErrorBanner` "Could not load categories." with retry; `findCategory` undefined → `PageHeader` "Category not found" + `Card p-6` `EmptyState` "Nothing here", "This store has nothing in this category right now.", `Link to="/"` (`buttonClass` secondary) "Go to Home"; else `PageHeader title={parent.name}`, `<div role="group" aria-label="Subcategories" className="flex gap-2 overflow-x-auto">` of `Chip`s "All" (always, so a parent without children shows "All" alone) then each child, `selected` by `selected.id`, `onClick` → `navigate({ to: '/c/$slug', params: { slug } })`; then `ProductFeed key={selected.id} filter={{ categoryId: selected.id }}` with `empty` `Card p-6` `EmptyState` "Nothing here yet".
- `/search` (task 3): `validateSearch: (s) => (typeof s.q === 'string' && s.q.trim() ? { q: s.q.trim() } : {})`. Title `Results for “${q}”` or "Search"; `StoreGate title={title}` → `PageHeader title={title}`; no `q` → `Suggestions title="Search for products"`; else `ProductFeed key={q} filter={{ q }} empty={<Suggestions title={`No results for “${q}”`} />}`. `Suggestions({ storeId, title })`: `Card p-6` `EmptyState` with the title, "Try a category instead.", and as `action` a `ul` (`flex flex-wrap justify-center gap-2`) of `Link to="/c/$slug"` (`buttonClass` secondary) per parent of `useCategories` (nothing while it loads or fails).
- `/p/$slug` (task 4): `StoreGate title="Product"` → `useProduct`; error → `PageHeader` "Product" + `ErrorBanner` "Could not load this product." retry; pending → `PageHeader` "Product" + `Skeleton variant="list" count={3}`; `null` → `PageHeader` "Product not found" + `Card p-6` `EmptyState` "Nothing here", "It may have been removed.", "Go to Home" link (`Link` + `buttonClass` secondary); else `<div className="grid gap-6 lg:grid-cols-2">` with `ImageTile` inside a `max-w-md` div and a `Card p-6 flex flex-col gap-3`: `PageHeader title={name} description={unitLabel}`, `Price` (`text-h2`) and, when `mrpCents > priceCents`, `Badge variant="accent"` "Save {formatInr(mrp − price)}"; stock note `p text-small text-ink-muted` only when `inStock`: `quantity >= 10` → "10+ left", else "Only {quantity} left"; the `Stepper` wired exactly as on the card (the same props repeated here over the shared `useCartQuantity`, so the hook has two call sites: `product-card.tsx` and `routes/p.$slug.tsx`); `description` in `p text-body text-ink`.

## Decisions
1. **One store gate, no route loader.** Every catalog page wraps its content in `StoreGate`, so the notices behave the same on Home, Category, Product and Search, and a deep link without a pincode shows "Set your pincode" instead of an empty page. Ceiling: each page shows its own heading ("Category", "Product") until the store resolves.
2. **A closed store blocks browsing.** Spec 2 §7 says a closed store shows a full-page notice; browsing a store that cannot deliver invites a cart that cannot be placed. Owner may override (browse but disable ADD).
3. **The sheet opens on Home only, every time Home renders without a pincode.** Spec 2 §7 places it on Home; opening it over `/c/...`, `/sign-in` or the not-found page would cover links the e2e suites click. Without a stored pincode every Home visit is a "first visit". Ceiling: a customer who closes it and stays on Home sees the "Set your pincode" notice, one click from the sheet.
4. **Store resolved on every load, not cached in storage.** Only the pincode is stored; `useServiceability` runs on load (`staleTime` 60 s), so `isOpen`, the store and the promised minutes are current. Ceiling: one request per page load.
5. **Not serviceable is data, not an error.** `useServiceability` and `useProduct` return `null` for "absent", so `retry: false` and the error banner stay for real failures. For serviceability only core's 404 with code `not_serviceable` is "absent" (`serviceabilityMissing`, a pure function with its own test, added during task 2 on the manager's decision): a 404 from a proxy or with another code is a lookup failure, not a "we do not deliver" notice. `useProduct` still reads any 404 as "Product not found". Ceiling: a 404 that is not core's (a proxy) shows "Product not found" instead of an error.
6. **Category tabs are URLs.** A child chip navigates to `/c/<child-slug>`; the page finds the parent through the tree, so a tab is shareable and Back works. The parent tree comes from the store's categories, which hide categories without stock (core), so an emptied category answers "Category not found". Ceiling: a slug shared between stores resolves per store, which is the intent.
7. **"Picked for you" is the first page filtered on the client.** First 24 products by name, in-stock ones, first 12. Ceiling: fewer than 12 when more than 12 of the first 24 are out of stock (the demo has about 2 in 24); add an `inStock=true` filter to core's list when a store runs that low.
8. **Paged lists: `useInfiniteQuery` with 24 per page, scroll loading plus a visible "Load more" button** (keyboard and screen-reader users, and a fallback where `IntersectionObserver` is missing). Ceiling: all loaded pages stay in memory; fine for a store of a few hundred products.
9. **The cart hook is a stub here.** `useCartQuantity(product)` holds a local count clamped to `product.quantity`; web-P2-L3 replaces the body (guest cart, server cart, clamping, store change) and keeps the signature, so no page changes. Ceiling until then: counts are per mounted card and vanish on navigation; the Stepper cannot go above `quantity` (at most 10) even when the store holds more; L3 decides the real maximum (cart lines go to 20).
10. **Product card and image tile live in `apps/web`, composed only of `@shopperstop/ui` parts** (`Card`, `Price`, `Stepper`) plus layout classes. No other app lists products for customers; moving them to `packages/ui` with a Figma component is a ui-area task when a second consumer appears. Escalated for the orchestrator's call.
11. **No submit button on the search form.** Enter submits (`type="search"`); `IconButton` forces `type="button"`, so a submit icon would need a ui change or a hand-styled button. Reported to ui as a finding, not a request.
12. **Vitest without HTTP mocks.** Route tests seed TanStack Query's cache with `queryClient.setQueryData(keys.x(...), data)` (infinite queries: `{ pages: [list], pageParams: [1] }`); with `staleTime` 60 s nothing refetches, so no request leaves the test. The error scenario uses no seed: the client's relative `baseUrl` cannot be fetched under jsdom (admin's finding), which is "core unreachable" without a mock. Everything that needs real answers (resolution, notices, paging, product states) also has a Playwright test against real core.
13. **E2e uses the demo seed (D22) as reset by `global-setup.ts`; nothing is created through admin routes except the closed store.** The demo has both stores open, so "Notices against core" signs in the seeded admin (`admin@shopperstop.local` / `admin12345`) with Playwright's `request`, and when `GET /serviceability?pincode=560076` is 404 creates store "E2E Closed" (`addressLine` "1 Test Rd", pincode `560076`, `promisedMinutes` 15, closed by default) and puts `["560076"]` as its service areas. The check first keeps a re-run (no reset in between) from hitting the 409. The out-of-stock product is found through `GET /stores/{id}/products?pageSize=100` (first `inStock: false`), not hard-coded.
14. **The first-visit sheet would cover Home in web-P2-L2's e2e tests** (they land on `/` and then click the banner), so `auth.spec.ts` and `account.spec.ts` get `test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('shopperstop:pincode', '560034')))`. One more change rode in with task 4: `account.spec.ts` "addresses and default" waits for the Work `Default` badge before reloading (the reload could cut the request; test only).
15. **Spec delta modifies "Customer site shell"** (the banner gains the home link and the search form); everything else is ADDED, as the brief asked.
16. **Store change and the cart.** Changing the pincode here only stores it and re-resolves; the confirm dialog that clears the cart when the store changes is web-P2-L3's, which wraps `setPincode`.

## Scenario → test
| Scenario | Test (file › name) | Task |
|---|---|---|
| Home renders in the shell | `src/shell.test.tsx` › "home renders in the shell" | 1 |
| Search from the banner | `src/shell.test.tsx` › "search from the banner" | 1 |
| Pincode persisted | `src/pincode.test.ts` › "pincode persisted" | 1 |
| Pincode restored on load | `src/pincode.test.ts` › "pincode restored on load" | 1 |
| Blocked storage tolerated | `src/pincode.test.ts` › "blocked storage tolerated" | 1 |
| First visit opens the pincode sheet | `src/pincode-sheet.test.tsx` › "first visit opens the pincode sheet" | 1 |
| Invalid pincode refused | `src/pincode-sheet.test.tsx` › "invalid pincode refused" | 1 |
| Pincode saved from the sheet | `src/pincode-sheet.test.tsx` › "pincode saved from the sheet" | 1 |
| Banner control opens the sheet | `src/pincode-sheet.test.tsx` › "banner control opens the sheet" | 1 |
| Banner shows the delivery promise | `src/pincode-sheet.test.tsx` › "banner shows the delivery promise" | 1 |
| Not serviceable notice | `src/store-gate.test.tsx` › "not serviceable notice" | 1 |
| Closed store notice | `src/store-gate.test.tsx` › "closed store notice" | 1 |
| Store lookup fails | `src/store-gate.test.tsx` › "store lookup fails" | 1 |
| Pincode resolves against core | `e2e/browse.spec.ts` › "pincode resolves against core" | 1 |
| Notices against core | `e2e/browse.spec.ts` › "notices against core" | 1 |
| Card links and prices | `src/product-card.test.tsx` › "card links and prices" | 2 |
| Add shows the count | `src/product-card.test.tsx` › "add shows the count" | 2 |
| Home lists categories and picks | `src/home.test.tsx` › "home lists categories and picks" | 2 |
| Home against core | `e2e/browse.spec.ts` › "home against core" | 2 |
| Category tabs | `src/category.test.tsx` › "category tabs" | 3 |
| Unknown category | `src/category.test.tsx` › "unknown category" | 3 |
| Load more while pages remain | `src/category.test.tsx` › "load more while pages remain" | 3 |
| No results suggests categories | `src/search.test.tsx` › "no results suggests categories" | 3 |
| Browse a category against core | `e2e/browse.spec.ts` › "browse a category against core" | 3 |
| Search and load more against core | `e2e/browse.spec.ts` › "search and load more against core" | 3 |
| Product with savings | `src/product.test.tsx` › "product with savings" | 4 |
| Plenty in stock | `src/product.test.tsx` › "plenty in stock" | 4 |
| Out of stock product | `src/product.test.tsx` › "out of stock product" | 4 |
| Unknown product | `src/product.test.tsx` › "unknown product" | 4 |
| Product pages against core | `e2e/browse.spec.ts` › "product pages against core" | 4 |

Tests beyond the scenarios (pins asked for in review): `src/catalog.test.ts` › "only not_serviceable means no store delivers"; `src/product-card.test.tsx` › "out of stock card"; `src/product.test.tsx` › "no savings badge when the MRP is not higher".

Known test ceilings (acceptance, 2026-10-13): "Unknown product" seeds the cached `null`, and no test makes core answer the 404 (`useProduct`'s 404 → `null` line is read, not run; the manager walked `/p/no-such-product` in Chrome against a real core with the demo seed and saw "Product not found" with the Home link, and the e2e visit is folded into web-P2-L3's next e2e change); the scroll loading of the paged lists has no test (jsdom has no `IntersectionObserver`; the e2e clicks "Load more"); `/search` without `q`, the banner reading the pincode alone, "Choose pincode" on the no-pincode notice, the notices on Category, Product and Search (one shared `StoreGate`, tested on Home) and the Home load errors are requirement sentences without a scenario and without a test.

## Test strategy
- Vitest helpers in `src/test-data.ts` (never imported by app code): `store(overrides?)` → a `Store` (Koramangala, id `...0401`, open, 10 minutes); `renderAt(path)` (memory router over `routeTree`, as `shell.test.tsx` does today; returns the router); task 2 adds `product(overrides?)`, `category(overrides?)` and `renderInRouter(ui)` (a root route rendering `ui`, for components that hold `Link`s).
- `renderInRouter` mounts no `QueryClientProvider` (the root layout is not rendered); a component under it that uses TanStack Query needs one added there.
- A test that needs a store calls `setPincode('560034')` and `queryClient.setQueryData(keys.serviceability('560034'), store())` before `renderAt`. `test-setup.ts` adds `setPincode(undefined)` to its `afterEach` (which also closes the sheet).
- Module-load scenarios (`pincode.test.ts`) use `vi.resetModules()` and `await import('./pincode')` like `session.test.ts`; the blocked-storage test spies on `Storage.prototype` like it.
- `Price` renders the struck MRP as `<s><span class="sr-only">MRP </span>₹60</s>`. Testing Library's `getByText` matches an element by its own text nodes, so `getByText('₹60')` finds the `s` element itself (the tests assert `tagName` `S`); the accessible text is "MRP ₹60".
- e2e: each "against core" test sets the pincode through the sheet or `addInitScript` and runs `new AxeBuilder({ page }).analyze()` on every page and open sheet it visits, expecting `[]`. Demo facts used: 560034 → Koramangala, 10 minutes; `Fruits & Vegetables` tile; `Dairy, Bread & Eggs` → `Milk`; `Banana Robusta` / `banana-robusta`; search "a" has more than 24 results.

## Risks / Trade-offs
- [Core lanes rename a schema or field before merging] → workers follow `core.d.ts`, note it in the lane log, stop on a behaviour difference.
- [The jsdom "unreachable" error path changes if `api.ts` switches to `${location.origin}` as admin did] → still a failed fetch (nothing listens in jsdom's origin); the test asserts the alert, not the cause.
- [The sheet now opens on `/` for any fresh browser] → existing smoke e2e tests only assert and do not click on `/`; auth and account specs get the init script (Decision 14).
- [Seed changes in core (counts, names)] → e2e asserts only the demo facts listed above.
