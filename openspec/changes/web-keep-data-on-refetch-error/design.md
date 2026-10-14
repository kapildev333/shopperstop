# Design

## Context
`apps/web` on main (34b35ac). Reads go through TanStack Query 5 with one `queryClient` (`src/api.ts`, `retry: false`). The catalog reads in `src/catalog.ts` and the server cart in `src/cart.ts` carry `staleTime: 60_000`; `useMe` and `useAddresses` carry none. A query that holds an answer and whose refetch fails ends with `status: 'error'`, `error` set and `data` still the old answer (`isPending` false). Five views read `error` first and so drop what they hold.

No `docs/design/web-P2-L6.md`: this file is enough.

## Goals / Non-Goals
**Goals:** the rule holds in every query-driven view of `apps/web/src`; each of the 8 scenarios has a named Vitest test with no HTTP mock; one worker task.

**Non-Goals:** telling the customer a refresh failed; retries; changing `staleTime` or refetch-on-focus; the imperative `fetchQuery` reads; `apps/admin`; e2e.

## The pattern
In every view, in this order:

```tsx
if (data === undefined) return error ? <the alert with Try again> : <the skeleton>
// from here on data is an answer; null is one of them
```

`data !== undefined` is the test for "holds an answer", never truthiness and never `status`, `isPending` or `isError`.

## Audit: every query-driven view in `apps/web/src`
| View | File | Reads | Today | Change |
|---|---|---|---|---|
| `StoreGate` | `src/store-gate.tsx` | `useServiceability` | `isPending`, then `error`, then `!data` | yes |
| Home `Categories` | `src/routes/index.tsx` | `useCategories` | `error`, then `!data` | yes |
| Home `Picked` | `src/routes/index.tsx` | `usePicked` | `error ? … : data ? …` | yes |
| `CategoryContent` | `src/routes/c.$slug.tsx` | `useCategories` | `error`, then `!data` | yes |
| `ProductContent` | `src/routes/p.$slug.tsx` | `useProduct` | `error`, then `isPending`, then `!data` | yes |
| `ProductFeed` (category and search results) | `src/product-feed.tsx` | `useProductFeed` | `isPending`, then `error && !data`; data is never `null` here; a failed next page has its own banner under the list | no (pin test) |
| Search `Suggestions` | `src/routes/search.tsx` | `useCategories` | `data` only, no alert at all | no |
| `ProfileCard` | `src/routes/account.tsx` | `useMe` | `me.data ? … : me.isError ? …` | no (probed) |
| `AddressesCard` | `src/routes/account.tsx` | `useAddresses` | `addresses.data ? … : addresses.isError ? …` (`[]` is truthy) | no (probed) |
| `AccountLink` | `src/account-link.tsx` | `useMe` | `me.data?.name ?? 'Account'` | no |
| `PincodeButton` | `src/pincode-sheet.tsx` | `useServiceability` | `data` only | no |
| `CartBody` | `src/cart-drawer.tsx` | `useCart` | `!view && isError`, then `!view` | no |
| `CartSheet`, `CartBar`, `CartButton` | `src/cart-drawer.tsx` | `useCart` | `view` only | no |
| `ReplacedNotice` | `src/cart-drawer.tsx` | `GET /stores/{id}` | `data` only, "another store" otherwise | no |
| `useCart`, `useCartQuantity` | `src/cart.ts` | cart, serviceability | `.data` only | no |
| not views: `changePincode`, `knownCart`, `mergeGuestCart` | `src/store-change.tsx`, `src/cart.ts` | `queryClient.fetchQuery(...).catch(() => undefined)` | a failed read is "unknown" (web-cart requirements) | no, out of scope |

"Probed": a throwaway Vitest probe on 34b35ac (stale seed, failed refetch, as in Test strategy) showed the profile form, the address list and the product list staying with no alert; not committed. The same probe showed the five "yes" rows replacing their content with the alert, and the three nothing-held pins passing.

## Files (all under `apps/web/`)
| File | What |
|---|---|
| `src/store-gate.tsx` | after the `!pincode` notice: `if (data === undefined)` → the alert frame when `error`, else the skeleton frame; then the existing `!data` (now only `null`) and `!data.isOpen` notices. `isPending` is no longer read |
| `src/routes/index.tsx` | `Categories`: `if (data === undefined) return error ? <ErrorBanner …/> : <Skeleton …/>`. `Picked`: `data ? <ProductGrid/> : error ? <ErrorBanner/> : <Skeleton/>` |
| `src/routes/c.$slug.tsx` | `CategoryContent`: one `data === undefined` branch holding the alert frame or the skeleton frame |
| `src/routes/p.$slug.tsx` | `ProductContent`: the same branch; then the existing `!data` "Product not found"; `isPending` is no longer read |
| `src/test-data.ts` | two test-only helpers, below |
| `src/store-gate.test.tsx`, `src/home.test.tsx`, `src/category.test.tsx`, `src/product.test.tsx` | the tests in Scenario → test |

Copy, components, frames and class names do not change; nothing is added to `packages/ui`.

## Interfaces (`src/test-data.ts`, test-only)
```ts
// An answer older than the catalog staleTime: the view that mounts on it refetches, and under jsdom that refetch fails.
export function seedStale(key: QueryKey, data: unknown): void
//   queryClient.setQueryData(key, data, { updatedAt: Date.now() - 61_000 })

// Resolves once that refetch has failed with the seeded answer still held.
export function refetchFailed(key: QueryKey): Promise<void>
//   waitFor(() => expect(queryClient.getQueryState(key)).toMatchObject({ status: 'error', fetchStatus: 'idle' }))
```
`QueryKey` from `@tanstack/react-query`; `waitFor` from Testing Library, `expect` from Vitest.

## Decisions
1. **`data !== undefined`, not truthiness.** `useServiceability` and `useProduct` answer `null` for core's 404 (`not_serviceable`, unknown slug): a real answer with its own notice. `error && !data`, the form `ProductFeed` uses, would be wrong in `StoreGate` and `ProductContent`: a failed refetch over a `null` answer would swap the notice for the alert. Two scenarios pin this. `ProductFeed` keeps its form (its data is never `null`); not touched.
2. **No shared helper.** Four files, one branch each, and each branch returns a different frame, alert copy and skeleton. A helper would need those as parameters and save no lines. The plain check is repeated. Ceiling: a sixth and seventh view repeat it again; lift a `QueryState` component into `packages/ui` when a third alert-or-skeleton shape is copied or admin wants the same.
3. **The requirement is ADDED, nothing is MODIFIED.** "Customer store notices" says "any other failure, an alert" and "Customer cart drawer states" says "when it fails to load": both describe a view holding nothing, which the new requirement leaves as it is. Reading them together is unambiguous, and a MODIFIED copy of each page requirement would repeat the rule six times.
4. **Ceiling: old data shows with no hint that the refresh failed.** A price, a stock count or an open store may be out of date for as long as core is unreachable. Accepted: nothing can be ordered without core anyway (every cart write and the later checkout go to core, which clamps and refuses), and TanStack Query refetches on the next focus, mount or reconnect. Upgrade path: a `StatusMessage` "Could not refresh" above the content, from `isRefetchError`, as a `packages/ui` pattern with a Figma state.
5. **Ceiling: a store that closed while core was unreachable still shows as open** until a lookup succeeds; same reasoning as 4.
6. **"Try again" is unchanged.** It shows only with nothing held; while its refetch runs the alert stays (the error is kept until an answer lands), as today.
7. **No e2e.** Nothing changes while core answers, and the failing state would need the network cut under Playwright (`route.abort`), which the suite does not do anywhere. The existing e2e suite must stay green; the manager runs it before landing as for any web PR.

## Scenario → test
| Scenario | Test | State before the fix |
|---|---|---|
| Failed refetch keeps the store | `src/store-gate.test.tsx` › "failed refetch keeps the store" | red: alert "Could not check your pincode." |
| Failed refetch keeps the not serviceable notice | `src/store-gate.test.tsx` › "failed refetch keeps the not serviceable notice" | red: same alert |
| Failed refetch keeps home | `src/home.test.tsx` › "failed refetch keeps home" | red: two alerts |
| Failed refetch keeps the category page | `src/category.test.tsx` › "failed refetch keeps the category page" | red: alert "Could not load categories." |
| Failed refetch keeps the product list | `src/category.test.tsx` › "failed refetch keeps the product list" | pin, green |
| Failed refetch keeps the product page | `src/product.test.tsx` › "failed refetch keeps the product page" | red: alert "Could not load this product." |
| Failed refetch keeps product not found | `src/product.test.tsx` › "failed refetch keeps product not found" | red: same alert |
| Nothing held still alerts | `src/home.test.tsx` › "home alerts with nothing held"; `src/category.test.tsx` › "category alerts with nothing held"; `src/product.test.tsx` › "product alerts with nothing held" | pins, green |

Already on main and untouched, the same half of the rule for the gate and the drawer: `src/store-gate.test.tsx` › "store lookup fails"; `src/cart-drawer.test.tsx` › "empty, loading and failed cart".

## Test strategy
Vitest and Testing Library through `renderAt`, the real `queryClient`, no HTTP mock, as every other web test. The failure is the one "store lookup fails" already relies on: under jsdom the relative `baseUrl` `/api/core/v1` cannot be fetched (`TypeError: Failed to parse URL`), so any read that is actually made fails at once (`retry: false`).

- A failed refetch: `seedStale(key, answer)` for the read under test, plain `queryClient.setQueryData` for everything else the page needs (a fresh answer is not refetched), `renderAt(path)`, `await refetchFailed(key)`, then assert the content with `getBy…` and `expect(screen.queryAllByRole('alert')).toEqual([])`.
- The wait is the test. Without `await refetchFailed(key)` the assertions run while the stale answer still shows and pass on the unfixed code.
- `queryAllByRole('alert')`, not `queryByRole`: unfixed Home shows two alerts and `queryByRole` throws on two.
- Nothing held: seed only the store, render, `findByRole('alert')` (Home: wait for both texts).
- The account cards and the cart drawer get no new test: they already comply and their files are not touched. Ceiling: nothing but review stops a later edit there from reordering the check.

## As landed (acceptance 2026-10-13, `1ef74da` on the rebased branch)
- The five views carry the pattern as designed: `StoreGate`, `Categories`, `CategoryContent` and `ProductContent` branch on `data === undefined` and choose the alert or the skeleton inside it; `isPending` is gone from `store-gate.tsx` and `p.$slug.tsx`. No copy, frame or class changed; no app-code helper.
- `Picked` reads `data ? grid : error ? alert : skeleton`, truthiness rather than `data === undefined`, as the Files table above already wrote it. Its data is an array from `select` and never `null`, so the two agree. If `usePicked` ever answers `null`, switch it to the explicit check.
- `seedFeed` in `src/category.test.tsx` gained an optional fourth argument `stale = false`; when true it seeds through `seedStale`. Test-only, used by "failed refetch keeps the product list".
- `refetchFailed` is `async` and awaits `waitFor`, so it returns `Promise<void>` as declared.
- Acceptance was by reading (the manager's suites were running in the worktree): 8 of 8 scenarios have their named test, and each test seeds, waits and asserts what its scenario says. Two tests assert less than their THEN, backlog: "home alerts with nothing held" checks both alert texts and that there are two alerts, not their "Try again" buttons (the category and product pins do check the button); "failed refetch keeps the category page" checks the "Milk" chip, not every chip. "Without unmounting what is shown beneath it" is met by construction (the gate returns the same `children(data)` branch) and is not asserted by a test.

## Risks / Trade-offs
- The pins are green on arrival, so the `test:` commit is red by six tests and green by four; the commit body says which.
- `updatedAt` 61 s in the past is tied to the 60 s `staleTime` in `src/catalog.ts`; raising that constant makes the six tests wait for a refetch that never starts and time out, which names the cause loudly enough.
