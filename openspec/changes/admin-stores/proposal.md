# Proposal

## Why
Admins run the dark stores: which ones exist, what each charges, how fast it promises, whether it is open, and which pincodes it delivers to (Spec 2 §8). `apps/admin` has a `/stores` placeholder (a `PageHeader` from admin-P2-L1) and nothing else. core-P2-L2 (`core-stores-serviceability`) serves the admin store and service-area routes; this change, admin-P2-L2, gives admins the pages that call them.

## What Changes
- `/stores` (admin only, behind L1's `_admin` layout): a `Table` with `stack` of every store (name linking to its page, pincode, Open/Closed `Badge`, delivery fee, free-delivery threshold and minimum order as `Price`, promised minutes), a "New store" action, a loading `Skeleton`, an `EmptyState` when there are none and an `ErrorBanner` with "Try again" when the list fails.
- `/stores/new`: the store form (name, address, pincode, delivery fee, free delivery above, minimum order, promised minutes, status Open/Closed); amounts are typed in rupees and sent in paise; "Create store" posts and opens the new store's page.
- `/stores/{id}`: the same form filled from the store; "Save changes" sends a `PATCH` with only the fields that changed and confirms with "Store saved."; a core `validation` error is shown on the field it names; an unknown id shows the not-found page.
- Delete on the store page: a confirmation `Dialog` (Cancel first); a 409 is explained in the dialog (the store still has staff users or orders).
- Pincode list editor on the store page: the store's pincodes from core, add (six digits) and remove locally with an "Unsaved changes." note, "Save pincodes" replaces the list with one `PUT`; a 409 for a pincode another store serves names that store ("Pincode 560038 is served by Indiranagar.").
- Reads are TanStack Query queries keyed under `['admin', 'stores']`; saves update or invalidate them. L1's 401 and 403 rules apply unchanged through the shared client and the route error boundary.
- Playwright: the seeded admin edits Koramangala's promised minutes, meets the pincode conflict naming Indiranagar, saves and restores a pincode list; the seeded Koramangala store staff member gets the not-found page on `/stores` (the store-staff e2e L1 deferred). Axe on every page visited.

Area: admin. Capability: `admin-app` (ADDED requirements only).

Out of scope: a pager for the stores table (first 100 by name; see design.md); a toggle or switch component (status is a `Select`; see design.md); creating a store together with its pincodes in one step (pincodes are set on the store's page after create); unsaved-changes guards on navigation; the store selector other admin pages need (L4, L5); any change to `packages/ui` or `services/core`.

## Capabilities

### New Capabilities
None. The pages are behaviour of the admin app, so they go in `admin-app`, as admin-P2-L1 did for sign-in. `admin-stores` is core's HTTP capability (core-P2-L2's delta); a sibling `admin-stores-pages` would split one admin flow across two client specs and leave the next page lanes guessing which shape to follow.

### Modified Capabilities
- `admin-app`: ADDED "Stores table", "Store form", "Store delete", "Store pincode editor", "Stores against core".

## Impact
- Files: `apps/admin/src/**` (new `stores.ts`, `store-form.tsx`, `service-areas.tsx`, three route files under `routes/_staff/_admin/stores/`, three test files, fixtures added to `fake-core.ts`, regenerated `routeTree.gen.ts`), `apps/admin/e2e/stores.spec.ts`, this change folder, `.claude/lanes/admin-P2-L2*.md`. No new dependency.
- Cross-area contracts relied on:
  - core (`services/core/openapi.json`, regenerated into `packages/ui/src/api/core.d.ts` by core-P2-L2 per D19): `GET|POST /admin/stores`, `GET|PATCH|DELETE /admin/stores/{id}`, `GET|PUT /admin/stores/{id}/service-areas`, schemas `AdminStore`, `StoreCreate`, `StorePatch`, `StoreList`, `ServiceAreas`, `PincodeConflict`, `Error`. Shapes are listed as assumptions in design.md and rechecked in task 0.
  - core: `seed-demo --reset` seeds the stores Koramangala and Indiranagar and their store-staff users (D22), used by the e2e.
  - ui: `@shopperstop/ui` exports `Badge`, `Button`, `buttonClass`, `Card`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Price`, `Select`, `Skeleton`, `StatusMessage`, `Table` (with `Column`); `@shopperstop/ui/api` types `components`, `paths`.
  - admin-P2-L1 (this app): `api.ts` client and `ApiError`, `route-error.tsx`, `not-found.tsx`, the `_admin` layout, `fake-core.ts`, `render-app.tsx`, `e2e/global-setup.ts`.
