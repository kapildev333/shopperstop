# Proposal

## Why
Found at web-P2-L1's acceptance (lane log `web-P2-L1`, "Finding (medium, backlog, behaviour)"; `.claude/areas/web.md` backlog): `StoreGate`, Home's categories and picks, `/c/$slug` and `/p/$slug` check a query's `error` before its `data`. The catalog reads are trusted for 60 s (`staleTime` in `src/catalog.ts`); after that a window refocus or a remount refetches, and with the network down that refetch fails. TanStack Query then holds both the old `data` and the `error`, and these five views show the alert in place of the page that was showing, until "Try again" succeeds. `StoreGate` wraps every catalog page, so its case also unmounts everything beneath it. `ProductFeed`, the account cards and the cart drawer already keep what they hold. A customer reading a product page in a lift should not lose it.

## What Changes
- One rule for the whole customer site, stated once: a view that holds an answer keeps showing it when a later read fails; the alert with "Try again" shows only while the view holds nothing. An answer of "nothing" (`null`: no store delivers to the pincode, no such product) is an answer and is kept too.
- The check is reordered in five views in four files: `src/store-gate.tsx`, `src/routes/index.tsx` (`Categories`, `Picked`), `src/routes/c.$slug.tsx`, `src/routes/p.$slug.tsx`. No new component, hook or helper in app code.
- Vitest proves it without an HTTP mock: an answer is seeded older than the `staleTime`, the view mounts, the refetch fails by itself under jsdom (the relative `baseUrl`), and the test asserts the content stays and no alert appears. Two test-only helpers in `src/test-data.ts`.
- Pin tests for the other half of the rule in the three files that had none (nothing held and core unreachable still alerts), and one pin for `ProductFeed`, which already complies.

Area: web. Capabilities touched: `web-app` (one ADDED requirement, no existing requirement modified). Out of scope: any hint that a refresh failed while old data shows (ceiling, design.md Decision 4), retry or backoff policy (`retry: false` stays), `staleTime` and refetch-on-focus settings, the imperative reads in `src/store-change.tsx` and `src/cart.ts` (`fetchQuery`, where a failed read already means "unknown" by the web-cart requirements), `apps/admin` (a request below), Playwright (no new e2e: nothing changes while core answers), Figma (no new state: the page simply stays).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-app`: ADDED "Customer pages keep data when a refetch fails" (1 requirement, 8 scenarios; the name is distinct from the 37 on main). "Customer store notices" and "Customer cart drawer states" are not modified: their alerts ("any other failure", "when it fails to load") are the nothing-held case, which the new requirement keeps.

## Impact
- Files: `apps/web/src/**` (listed in design.md), this change folder. No new dependency.
- Cross-area contracts relied on, none changed:
  - core (`services/core/openapi.json` through `@shopperstop/ui/api`): `GET /serviceability`, `GET /stores/{id}/categories`, `GET /stores/{id}/products`, `GET /stores/{id}/products/{slug}` as they are.
  - ui: `@shopperstop/ui` `ErrorBanner`, `Skeleton` as they are. No ui change.
  - web, same area: `src/catalog.ts` (`keys`, the 60 s `staleTime`), `src/api.ts` (`queryClient` with `retry: false`, relative `baseUrl`), `src/test-data.ts`, all on main.

## Requests to other areas
- admin (information, not a blocker): `apps/admin` may order the same checks the same way (`error` before `data`); this lane did not read it. Worth one look by the admin manager; the pattern and the test recipe are in this change's design.md.
