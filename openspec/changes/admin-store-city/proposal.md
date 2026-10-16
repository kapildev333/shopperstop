## Why

core-P4-L1 (#272) gave a store an optional `city` (`AdminStore.city`, `StoreCreate.city`, `StorePatch.city`: at most 100 characters, trimmed, omitted when empty, PATCH `""` clears). The admin panel cannot set or see it: #270 kept `city` out of the store form's field type so the form still typechecked.

## What Changes

- The store form on `/stores/new` and `/stores/{id}` gains an optional "City" text field after "Address"; create sends it as typed, change sends it only when it differs from the loaded store (an empty field against a store with a city sends `""`, which clears it).
- A core `validation` error naming `city` is shown on the field as "Enter at most 100 characters.".
- The `/stores` table gains a "City" column after the name (its header is the phone `stack` label); a store without a city shows an empty cell.
- The `Exclude<keyof StoreCreate, 'city'>` from #270 goes away.

Out of scope: city filtering or grouping, city on the dashboard, staff or stock pages, any core or ui change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `admin-app`: "Stores table", "Store create", "Store change", "Store form errors".

## Impact

- Area: admin. Files: `apps/admin/src/store-form.tsx`, `apps/admin/src/store-form.test.tsx`, `apps/admin/src/routes/_staff/_admin/stores/index.tsx`, `apps/admin/src/stores.test.tsx`, `apps/admin/e2e/stores.spec.ts`.
- Cross-area contracts relied on: `services/core/openapi.json` `AdminStore`, `StoreCreate`, `StorePatch` `city` (on main, #272) through `@shopperstop/ui/api`; `FormField`, `Input`, `Table` from `@shopperstop/ui`. The demo stores' city `Bengaluru` (`admin-stores` "Demo stores") for the e2e line.
