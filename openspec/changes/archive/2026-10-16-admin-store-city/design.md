## Context

`apps/admin/src/store-form.tsx` keeps one string per `StoreCreate` field (`Values = Record<Field, string>`), one message per field, `parse` builds the body and `changed` diffs it against the loaded `AdminStore`. #270 set `type Field = Exclude<keyof StoreCreate, 'city'>` so the form compiled when core added `city`. The stores table is a `columns` array in `routes/_staff/_admin/stores/index.tsx` rendered by ui `Table stack`, whose phone labels are the column headers.

## Goals / Non-Goals

Goals: set, change, clear and see a store's city in the panel. Non-goals: any validation of the city beyond core's (core trims and caps at 100), filtering by city.

## Decisions

1. **Field type back to `keyof StoreCreate`.** `city` joins `messages` ("Enter at most 100 characters."), `initial` (`store?.city ?? ''`) and the body (`city: values.city`, as typed; core trims). No client-side length check: core's 400 `validation` field `city` lands on the field through the existing `serverField` path, like `name` and `addressLine`.
2. **Create always sends `city`.** An empty field sends `"city":""`, which core's `StoreCreate` documents as "absent or empty: no city". One code path instead of an omit branch.
3. **Change compares with `(store[key] ?? '') !== value`.** `AdminStore.city` is omitted when empty, so an empty field equals a store without a city (nothing sent), and emptying the field of a store with a city sends `""` (clears). Every other field is always present, so `?? ''` changes nothing for them.
4. **Placement.** "City" after "Address" on the form (postal order), with the hint "Optional."; in the table a "City" column right after "Name" (the table shows no address line; the city is the address column it has). No city: empty cell. Plain text, no `tabular-nums`.
5. **"Dialogs" in the brief are the create and change pages** (`/stores/new`, `/stores/{id}`); the store form is not a dialog.

## Simplifications and ceilings

- No client-side 100-character check: one round trip to learn it; add a `maxLength` only if admins hit it.
- Empty table cell for a store without a city rather than a placeholder dash; revisit if stores without a city become common (both demo stores have one).

## Risks / Trade-offs

- The create request body changes shape (`city` always present): the "Create a store" scenario and its test are updated in the same task.

## Files

`apps/admin/src/store-form.tsx`, `apps/admin/src/store-form.test.tsx`, `apps/admin/src/routes/_staff/_admin/stores/index.tsx`, `apps/admin/src/stores.test.tsx`, `apps/admin/e2e/stores.spec.ts`. All in `apps/admin/`.

## Test strategy

Vitest + Testing Library with the existing `fakeCore` (process-boundary fetch fake, as every admin page test): fixtures with a city are spreads (`{ ...koramangala, city: 'Bengaluru' }`) inside the tests; `fake-core.ts` is not changed. Playwright: one assertion in the existing "admin edits a store and meets the pincode conflict" test that the seeded Koramangala's "City" field reads `Bengaluru` (read from the real core).
