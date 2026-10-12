# Design

## Context
See proposal.md for why. On origin/main f42fb87 `apps/admin` has admin-P2-L1's sign-in, session and shell: `src/api.ts` (one `openapi-fetch` client, bearer and 401 middleware, `ApiError`), `src/router.ts` (QueryClient with `retry: false` and `throwOnError` for `forbidden`), `src/route-error.tsx` (403 → not found, anything else → retry banner), `src/not-found.tsx`, the `_staff` guard and the `_admin` layout (store staff see not found on every admin path), `src/nav.ts`, and the placeholder `routes/_staff/_admin/stores/index.tsx` (a `PageHeader` only). Tests render the real router with `renderApp(path)` (`src/render-app.tsx`) over `fakeCore(routes)` (`src/fake-core.ts`), which stubs `fetch` at the process boundary. Playwright's global setup migrates and runs `seed-demo --reset` (D22).

core-P2-L2 (`core-stores-serviceability`) serves the routes this change calls. It is not on main yet; this design follows its change folder and its branch at 5691d60 (`services/core/openapi.json` and the regenerated `packages/ui/src/api/core.d.ts` already hold every store operation and schema). Task 0 (2026-10-12): core-P2-L2 merged as 3ca4b62 (#76) and was archived in 50af48f (#77), now origin/main. `packages/ui/src/api/core.d.ts` on 50af48f is byte-identical to the 5691d60 file the spike compiled against; `apps/admin` is unchanged since f42fb87; the seed (`internal/seed/seed.go`) and `GET /admin/stores` paging (`pageSize` 1 to 100, default 24) match A3 and A12. Every row below holds; no edit to the delta, the code or the tasks.

Spike, 2026-10-12: a scratchpad copy of f42fb87 with core-P2-L2's `core.d.ts` and `openapi.json` (5691d60) copied in, Node 22.23.3, `npm ci`, and every file below written as shown. Gates: `tsc` clean, `eslint .` clean, Vitest 8 files / 50 tests (L1's 31 plus the 19 here), `vite build` with `routeTree.gen.ts` byte-stable on a second build. Playwright on a scratch preview port (25174) with core answered by a stateful `page.route` fake: both tests of `e2e/stores.spec.ts` pass with axe clean on the stores table, the store page, the conflict, the delete dialog with its alert and the create form with field errors. The real-core run is task 5's.

## Assumptions (verified in task 0 against origin/main 50af48f)
| # | Assumption | Used in | If wrong | origin/main 50af48f (task 0) |
|---|---|---|---|---|
| A1 | `paths` has `/admin/stores` (get, post), `/admin/stores/{id}` (get, patch, delete), `/admin/stores/{id}/service-areas` (get, put); base `/api/core/v1` | `stores.ts`, `store-form.tsx`, `service-areas.tsx`, `$storeId.tsx`, `fake-core` keys | rename the path strings | matches (`listStores`, `createStore`, `getAdminStore`, `updateStore`, `deleteStore`, `getServiceAreas`, `replaceServiceAreas`) |
| A2 | `components['schemas']['AdminStore']` has required `id, name, addressLine, pincode, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes` | `AdminStore` alias, fixtures, table, form | change the alias or field names | matches |
| A3 | `GET /admin/stores` takes `pageSize` (1 to 100) and answers `StoreList {items: AdminStore[], page, pageSize, total}` ordered by name | `storesQuery` | adjust the query param | matches; default `pageSize` 24, so the page asks for 100 |
| A4 | `StoreCreate` is typed with every field required (`isOpen` and the money fields have defaults, so openapi-typescript marks them required); the form sends all eight | `parse`, the `POST` body | none: sending every field is valid either way | matches |
| A5 | `StorePatch` has every field optional; `{}` answers the store unchanged; `null` is refused | `changed`, the `PATCH` body | none | matches |
| A6 | `POST` answers 201 `AdminStore`; `PATCH` 200 `AdminStore`; `DELETE` 204 no body, 409 `conflict` while staff users (later orders) refer to the store | form `onSuccess`, `DeleteStore` | openapi-fetch treats any 2xx as `data`; a different 409 code changes `inUse` | matches |
| A7 | validation errors are 400 `validation` with `field` = the JSON name (`name`, `addressLine`, `pincode`, `deliveryFeeCents`, `freeDeliveryAboveCents`, `minOrderCents`, `promisedMinutes`) | `serverField` in `store-form.tsx` | map the names | matches (`check` in `internal/store/store.go`) |
| A8 | `GET|PUT /admin/stores/{id}/service-areas` answer `ServiceAreas {pincodes: string[]}`, sorted and deduplicated; `[]` allowed | `service-areas.tsx` | sort on the client | matches |
| A9 | `PUT` service-areas answers 409 `PincodeConflict {error: {code: 'conflict', message, field?: 'pincodes', pincode?, storeId?}}`; `pincode` and `storeId` are absent in the concurrent-claim race | `problem()` | read the members where they are | matches |
| A10 | `GET /admin/stores/{id}` answers 404 `not_found` for an unknown or malformed id | `$storeId.tsx` | none | matches |
| A11 | every `/admin/stores*` route answers 403 `forbidden` to store staff, before the id is read | L1's `_admin` layout and `throwOnError` (unchanged) | none | matches (design Decision 4) |
| A12 | `seed-demo --reset` seeds Koramangala `…0401` (`560034`, promised 10, serves `560034`, `560095`) and Indiranagar `…0402` (serves `560038`, `560008`), both open; store staff `koramangala@shopperstop.local` / `staff12345`; admin `admin@shopperstop.local` / `admin12345` | `e2e/stores.spec.ts` | change the strings in the spec | core design Decision 12 |

## Goals / Non-Goals
**Goals:** the Spec 2 §8 stores pages on L1's shell with no new helper beyond three small modules; every scenario in the delta mapped to one test.
**Non-Goals:** a pager, a switch component, creating pincodes with the store, leave-page guards for unsaved edits, the store selector (L4, L5), any `packages/ui` or `services/core` change.

## Decisions
1. **Capability `admin-app`.** Same call as admin-P2-L1: the client side of a flow is app behaviour; `admin-stores` stays core's HTTP capability.
2. **Three modules, three routes.** `src/stores.ts` (query options, the `AdminStore` alias, rupee/paise conversion), `src/store-form.tsx` (create and change in one component: `store` absent means create), `src/service-areas.tsx` (the pincode editor). Routes: `stores/index.tsx` (table), `stores/new.tsx`, `stores/$storeId.tsx` (form, delete, pincodes). The static `new` route wins over `$storeId` in TanStack Router.
3. **Query keys.** List `['admin', 'stores']`, one store `['admin', 'stores', id]`, its pincodes `['admin', 'stores', id, 'service-areas']`. A save writes the answer into the store's key with `setQueryData` and invalidates only the list (`exact: true`); a pincode save writes its key. A delete invalidates the list; the deleted store's cache entry is left (a revisit refetches and shows not found). Sign-out's `queryClient.clear()` (L1) drops all of it.
4. **Reads in the component, no loaders.** Each page `useQuery`s what it shows, as L1 planned; L1's `throwOnError` sends a 403 to `RouteError` (not found). A 404 on the store is handled on the page (`NotFound`), other failures by an `ErrorBanner` with retry.
5. **Rupees in, paise out.** Inputs are text with `inputMode="decimal"`; `toCents` accepts `^\d{1,7}(\.\d{1,2})?$` and rounds `Number × 100` (`199.50` → 19950, `19.99` → 1999); anything else is flagged on the field and nothing is sent. `toRupees` prints whole rupees without decimals and paise with two. Ranges (0 to 1,00,000 rupees, 1 to 240 minutes, name lengths, pincode pattern) are core's; the form maps core's `field` to its own message because core's messages speak in paise and JSON names.
6. **PATCH carries only what changed.** `changed(body, store)` keeps the entries whose value differs from the loaded store with `!==`; nothing can be `null`. An unchanged form sends `{}` (core answers the store unchanged); not worth a disabled state. Ceiling: a name differing only by surrounding spaces is sent and core trims it back.
7. **Open toggle is a `Select`.** `packages/ui` has no switch or checkbox (web-P2-L2 got the same answer: no Checkbox). "Status" with Open and Closed is labelled, keyboard-native and composes `Select` + `FormField`. Ceiling: a `Switch` in `packages/ui` if the owner wants the Figma toggle; a ui request then.
8. **Pincodes are one document.** The editor keeps a local `draft` (undefined = no edits); "Unsaved changes." shows while the draft differs from the saved list; "Save pincodes" is disabled otherwise and sends the whole list in one `PUT`. Added pincodes are checked against `^[1-9][0-9]{5}$`, merged with `Set`, sorted. Rows are a `Table` with a `ghost-danger` "Remove" button (accessible name `Remove <pincode>`), so no removable-chip recipe is invented. Ceiling: no leave-page warning; navigating away drops the draft.
9. **The conflict names the store by fetching it.** On a 409 with `pincode` and `storeId`, the mutation fetches `storeQuery(storeId)` through the query cache (cached when the admin came from the table) and throws `Pincode <p> is served by <name>.`; if that read fails the id stands in for the name. A 409 without them (core's concurrent-claim race, core Decision 7), any other error and no answer at all read "Could not save the pincodes. Try again.". The mutation's error is always an `Error` whose message is the alert.
10. **Delete in a dialog.** "Delete store" (secondary) opens `Dialog` "Delete <name>?" with `DialogFooter` (Cancel first) and a primary "Delete". 409 `conflict` keeps the dialog open with core's reason in words ("This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted."); other failures "Could not delete the store. Try again.". Green is the action colour (CLAUDE.md), so there is no red button.
11. **No pager.** The table asks for `pageSize=100` (core's maximum) and shows what comes back. Ceiling: more than 100 stores are not all listed; add a pager or a search when a city passes 100 stores (Spec 2 §14 expects a handful).
12. **New store then pincodes.** Create opens the new store's page, where the pincode editor is; a new store is closed (core's default, the form's initial status) until an admin opens it.
13. **Store staff e2e lands here.** core-P2-L2 seeds store staff, so the "store staff open an admin page" e2e L1 deferred is the second test of `e2e/stores.spec.ts`.
14. **Fixtures.** `fake-core.ts` gains `koramangala`, `indiranagar` (closed, so the table shows both badges) and `storeList(items)`; the type comes from `@shopperstop/ui/api` so the red test commit does not need `stores.ts`.

## Files (all under `apps/admin/`)
```
src/stores.ts                                     query options, AdminStore, toCents/toRupees    (task 1)
src/fake-core.ts                                  + koramangala, indiranagar, storeList           (task 1)
src/routes/_staff/_admin/stores/index.tsx         the table (replaces the placeholder)           (task 1)
src/stores.test.tsx                                                                               (task 1)
src/store-form.tsx                                create and change                               (task 2)
src/routes/_staff/_admin/stores/new.tsx                                                           (task 2)
src/routes/_staff/_admin/stores/$storeId.tsx      form (task 2), + DeleteStore (task 3), + ServiceAreas (task 4)
src/store-form.test.tsx                                                                           (task 2)
src/store-delete.test.tsx                                                                         (task 3)
src/service-areas.tsx                                                                             (task 4)
src/service-areas.test.tsx                                                                        (task 4)
src/routeTree.gen.ts                              regenerated by the build, committed             (task 2)
e2e/stores.spec.ts                                written in task 1 (before the pages), run in task 5
```
`src/shell.test.tsx` is unchanged: "admin opens an admin page" renders `/stores` with no `GET /admin/stores` route in its fake, so the page shows its heading and the load-failure alert; the test only checks the heading and nav.

## Code (spiked; workers copy it)

### `src/stores.ts`
```ts
import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type AdminStore = components['schemas']['AdminStore']

// Keys: the list is ['admin', 'stores'] (exact), one store ['admin', 'stores', id], its pincodes one level below.
// ponytail: first 100 stores by name, no pager; add one when a city passes 100 stores.
export const storesQuery = queryOptions({
  queryKey: ['admin', 'stores'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/stores', { params: { query: { pageSize: 100 } } })
    if (error) throw error.error
    return data
  },
})

export const storeQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'stores', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/stores/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

export const serviceAreasQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'stores', id, 'service-areas'],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/stores/{id}/service-areas', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

// Rupees as typed (whole or two decimals, up to 7 digits) to paise; anything else is not sendable.
export function toCents(rupees: string) {
  const value = rupees.trim()
  return /^\d{1,7}(\.\d{1,2})?$/.test(value) ? Math.round(Number(value) * 100) : undefined
}

export function toRupees(cents: number) {
  return cents % 100 ? (cents / 100).toFixed(2) : String(cents / 100)
}
```

### `src/fake-core.ts` (appended; plus the import and alias at the top)
```ts
import type { components } from '@shopperstop/ui/api'
import type { Staff } from './api'

type AdminStore = components['schemas']['AdminStore']

// ... L1's helpers unchanged ...

export const koramangala: AdminStore = {
  id: '00000000-0000-4000-8000-000000000401',
  name: 'Koramangala',
  addressLine: '80 Feet Rd, Koramangala',
  pincode: '560034',
  isOpen: true,
  deliveryFeeCents: 2500,
  freeDeliveryAboveCents: 19900,
  minOrderCents: 9900,
  promisedMinutes: 10,
}
export const indiranagar: AdminStore = {
  ...koramangala,
  id: '00000000-0000-4000-8000-000000000402',
  name: 'Indiranagar',
  addressLine: '100 Feet Rd, Indiranagar',
  pincode: '560038',
  isOpen: false,
  promisedMinutes: 12,
}

export function storeList(items: AdminStore[]) {
  return json(200, { items, page: 1, pageSize: 100, total: items.length })
}
```

### `src/routes/_staff/_admin/stores/index.tsx`
```tsx
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, Table, buttonClass, type Column } from '@shopperstop/ui'
import { storesQuery, type AdminStore } from '../../../../stores'

const columns: Column<AdminStore>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (store) => (
      <Link to="/stores/$storeId" params={{ storeId: store.id }} className="font-semibold text-accent hover:underline">
        {store.name}
      </Link>
    ),
  },
  { key: 'pincode', header: 'Pincode', cell: (store) => <span className="tabular-nums">{store.pincode}</span> },
  {
    key: 'status',
    header: 'Status',
    cell: (store) => <Badge variant={store.isOpen ? 'success' : 'neutral'}>{store.isOpen ? 'Open' : 'Closed'}</Badge>,
  },
  { key: 'fee', header: 'Delivery fee', cell: (store) => <Price cents={store.deliveryFeeCents} /> },
  { key: 'free', header: 'Free delivery above', cell: (store) => <Price cents={store.freeDeliveryAboveCents} /> },
  { key: 'min', header: 'Minimum order', cell: (store) => <Price cents={store.minOrderCents} /> },
  { key: 'minutes', header: 'Promised time', cell: (store) => <span className="tabular-nums">{store.promisedMinutes} min</span> },
]

function Stores() {
  const stores = useQuery(storesQuery)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stores" actions={<Link to="/stores/new" className={buttonClass({})}>New store</Link>} />
      {stores.isPending ? (
        <Skeleton variant="table" count={4} />
      ) : stores.isError ? (
        <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
      ) : stores.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then add the pincodes it delivers to." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table stack caption="Stores" columns={columns} rows={stores.data.items} rowKey={(store) => store.id} />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/')({ component: Stores })
```

### `src/store-form.tsx`
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { components } from '@shopperstop/ui/api'
import { Button, ErrorBanner, FormField, Input, Select, StatusMessage } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { storeQuery, storesQuery, toCents, toRupees, type AdminStore } from './stores'

type StoreCreate = components['schemas']['StoreCreate']
type Field = keyof StoreCreate
type Values = Record<Field, string>

const rupees = 'Enter 0 to 100000 rupees, at most two decimals.'

// One message per field: for a value the form cannot send, and for core's 400 naming the field (core's messages speak in cents).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  addressLine: 'Enter 1 to 200 characters.',
  pincode: 'Enter a 6-digit pincode.',
  isOpen: 'Choose open or closed.',
  deliveryFeeCents: rupees,
  freeDeliveryAboveCents: rupees,
  minOrderCents: rupees,
  promisedMinutes: 'Enter 1 to 240 minutes.',
}

function initial(store?: AdminStore): Values {
  return {
    name: store?.name ?? '',
    addressLine: store?.addressLine ?? '',
    pincode: store?.pincode ?? '',
    isOpen: store?.isOpen ? 'open' : 'closed',
    deliveryFeeCents: toRupees(store?.deliveryFeeCents ?? 0),
    freeDeliveryAboveCents: toRupees(store?.freeDeliveryAboveCents ?? 0),
    minOrderCents: toRupees(store?.minOrderCents ?? 0),
    promisedMinutes: store ? String(store.promisedMinutes) : '',
  }
}

// The request body for the values, and the fields that cannot be sent. Text goes as typed: core trims and checks it.
function parse(values: Values): [StoreCreate, Partial<Values>] {
  const errors: Partial<Values> = {}
  const cents = (field: 'deliveryFeeCents' | 'freeDeliveryAboveCents' | 'minOrderCents') => {
    const value = toCents(values[field])
    if (value === undefined) errors[field] = messages[field]
    return value ?? 0
  }
  const minutes = /^\d{1,3}$/.test(values.promisedMinutes.trim()) ? Number(values.promisedMinutes) : undefined
  if (minutes === undefined) errors.promisedMinutes = messages.promisedMinutes
  const body: StoreCreate = {
    name: values.name,
    addressLine: values.addressLine,
    pincode: values.pincode.trim(),
    isOpen: values.isOpen === 'open',
    deliveryFeeCents: cents('deliveryFeeCents'),
    freeDeliveryAboveCents: cents('freeDeliveryAboveCents'),
    minOrderCents: cents('minOrderCents'),
    promisedMinutes: minutes ?? 0,
  }
  return [body, errors]
}

// PATCH sends only what differs from the loaded store; never null.
function changed(body: StoreCreate, store: AdminStore) {
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => store[key as Field] !== value))
}

// Create when there is no store (then open it), change it otherwise.
export function StoreForm({ store }: { store?: AdminStore }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initial(store))
  const [errors, setErrors] = useState<Partial<Values>>({})

  const save = useMutation({
    mutationFn: async (body: StoreCreate) => {
      const { data, error } = store
        ? await api.PATCH('/admin/stores/{id}', { params: { path: { id: store.id } }, body: changed(body, store) })
        : await api.POST('/admin/stores', { body })
      if (error) throw error.error
      return data
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(storeQuery(saved.id).queryKey, saved)
      void queryClient.invalidateQueries({ queryKey: storesQuery.queryKey, exact: true })
      if (!store) await navigate({ to: '/stores/$storeId', params: { storeId: saved.id } })
    },
  })

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [body, found] = parse(values)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate(body)
  }

  // A validation error naming a form field goes to that field; anything else to the banner.
  const apiError = save.error && 'code' in save.error ? (save.error as ApiError) : undefined
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => errors[field] ?? (serverField === field ? messages[field] : undefined)
  const text = (field: Field, label: string, props: { inputMode?: 'numeric' | 'decimal'; hint?: string } = {}) => (
    <FormField label={label} hint={props.hint} error={errorFor(field)}>
      <Input inputMode={props.inputMode} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </FormField>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {save.error && !serverField && <ErrorBanner message="Could not save the store. Try again." />}
      {text('name', 'Name')}
      {text('addressLine', 'Address')}
      {text('pincode', 'Pincode', { inputMode: 'numeric' })}
      {text('deliveryFeeCents', 'Delivery fee (₹)', { inputMode: 'decimal' })}
      {text('freeDeliveryAboveCents', 'Free delivery above (₹)', { inputMode: 'decimal', hint: '0 means delivery is always free.' })}
      {text('minOrderCents', 'Minimum order (₹)', { inputMode: 'decimal', hint: '0 means no minimum.' })}
      {text('promisedMinutes', 'Promised minutes', { inputMode: 'numeric' })}
      <FormField label="Status" hint="A closed store takes no new orders." error={errorFor('isOpen')}>
        <Select value={values.isOpen} onChange={(event) => set('isOpen', event.target.value)}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </Select>
      </FormField>
      {store && save.isSuccess && <StatusMessage tone="success">Store saved.</StatusMessage>}
      <div>
        <Button type="submit" loading={save.isPending}>{store ? 'Save changes' : 'Create store'}</Button>
      </div>
    </form>
  )
}
```

### `src/routes/_staff/_admin/stores/new.tsx`
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Card, PageHeader } from '@shopperstop/ui'
import { StoreForm } from '../../../../store-form'

function NewStore() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="New store" />
      <Card className="p-6">
        <StoreForm />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/new')({ component: NewStore })
```

### `src/routes/_staff/_admin/stores/$storeId.tsx`
Final shape. Task 2 lands it without `DeleteStore` (and its imports `useMutation`, `useQueryClient`, `useNavigate`, `useState`, `Button`, `Dialog`, `DialogFooter`, `api`, `storesQuery`, `AdminStore`), with `PageHeader` taking no `actions`, and without the `ServiceAreas` card; task 3 adds `DeleteStore` and `actions`; task 4 adds the `ServiceAreas` card and import.
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { api, type ApiError } from '../../../../api'
import { NotFound } from '../../../../not-found'
import { ServiceAreas } from '../../../../service-areas'
import { StoreForm } from '../../../../store-form'
import { storeQuery, storesQuery, type AdminStore } from '../../../../stores'

function DeleteStore({ store }: { store: AdminStore }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/stores/{id}', { params: { path: { id: store.id } } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: storesQuery.queryKey, exact: true })
      await navigate({ to: '/stores' })
    },
  })
  const inUse = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  return (
    <>
      <Button variant="secondary" onClick={() => { remove.reset(); setOpen(true) }}>Delete store</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Delete ${store.name}?`}>
        <p className="mt-2 text-body text-ink">The store and the pincodes it serves are removed.</p>
        {remove.error && (
          <ErrorBanner
            className="mt-4"
            message={inUse ? 'This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted.' : 'Could not delete the store. Try again.'}
          />
        )}
        <DialogFooter onCancel={() => setOpen(false)}>
          <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}

function StorePage() {
  const { storeId } = Route.useParams()
  const store = useQuery(storeQuery(storeId))
  if (store.isPending) return <Skeleton variant="list" count={3} />
  if (store.isError) {
    if ((store.error as Partial<ApiError>).code === 'not_found') return <NotFound />
    return <ErrorBanner message="Could not load the store." onRetry={() => void store.refetch()} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={store.data.name} actions={<DeleteStore store={store.data} />} />
      <Card className="p-6">
        <StoreForm key={store.data.id} store={store.data} />
      </Card>
      <Card className="p-6">
        <ServiceAreas storeId={storeId} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/$storeId')({ component: StorePage })
```

### `src/service-areas.tsx`
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorBanner, FormField, Input, Skeleton, StatusMessage, Table } from '@shopperstop/ui'
import { api } from './api'
import { serviceAreasQuery, storeQuery } from './stores'

const pincodePattern = /^[1-9][0-9]{5}$/

// The pincode list editor: edits stay local until "Save pincodes" replaces the whole list with one PUT.
export function ServiceAreas({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient()
  const saved = useQuery(serviceAreasQuery(storeId))
  const [draft, setDraft] = useState<string[]>()
  const [entry, setEntry] = useState('')
  const [entryError, setEntryError] = useState<string>()

  // The alert for a failed save: the other store by name (its id if unreadable) for a conflict, a retry hint otherwise.
  async function problem(error?: { code: string; pincode?: string; storeId?: string }) {
    if (error?.code !== 'conflict' || !error.pincode || !error.storeId) return 'Could not save the pincodes. Try again.'
    const other = error.storeId
    const name = await queryClient.fetchQuery(storeQuery(other)).then((store) => store.name, () => other)
    return `Pincode ${error.pincode} is served by ${name}.`
  }

  const save = useMutation({
    mutationFn: async (pincodes: string[]) => {
      const { data, error } = await api
        .PUT('/admin/stores/{id}/service-areas', { params: { path: { id: storeId } }, body: { pincodes } })
        .catch(() => ({ data: undefined, error: undefined }))
      if (data) return data
      throw new Error(await problem(error?.error))
    },
    onSuccess: (data) => {
      queryClient.setQueryData(serviceAreasQuery(storeId).queryKey, data)
      setDraft(undefined)
    },
  })

  const pincodes = draft ?? saved.data?.pincodes ?? []
  const unsaved = draft !== undefined && draft.join() !== saved.data?.pincodes.join()

  function edit(next: string[]) {
    setDraft(next)
    save.reset()
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const pincode = entry.trim()
    if (!pincodePattern.test(pincode)) return setEntryError('Enter a 6-digit pincode.')
    setEntryError(undefined)
    setEntry('')
    edit([...new Set([...pincodes, pincode])].sort())
  }

  return (
    <section aria-labelledby="pincodes-heading" className="flex flex-col gap-4">
      <h2 id="pincodes-heading" className="text-h2 text-ink">Delivery pincodes</h2>
      {saved.isPending ? (
        <Skeleton variant="table" count={2} />
      ) : saved.isError ? (
        <ErrorBanner message="Could not load the pincodes." onRetry={() => void saved.refetch()} />
      ) : (
        <>
          {pincodes.length === 0 ? (
            <p className="text-body text-ink-muted">No pincodes yet: customers cannot order from this store.</p>
          ) : (
            <Table
              caption="Pincodes"
              rows={pincodes}
              rowKey={(pincode) => pincode}
              columns={[
                { key: 'pincode', header: 'Pincode', cell: (pincode) => <span className="tabular-nums">{pincode}</span> },
                {
                  key: 'remove',
                  header: 'Action',
                  cell: (pincode) => (
                    <Button variant="ghost-danger" aria-label={`Remove ${pincode}`} onClick={() => edit(pincodes.filter((p) => p !== pincode))}>
                      Remove
                    </Button>
                  ),
                },
              ]}
            />
          )}
          <form noValidate onSubmit={add} className="flex items-end gap-2">
            <FormField label="Add pincode" error={entryError}>
              <Input inputMode="numeric" value={entry} onChange={(event) => setEntry(event.target.value)} />
            </FormField>
            <Button type="submit" variant="secondary">Add</Button>
          </form>
          {save.error && <ErrorBanner message={save.error.message} />}
          {unsaved && <StatusMessage tone="warning">Unsaved changes.</StatusMessage>}
          {save.isSuccess && <StatusMessage tone="success">Pincodes saved.</StatusMessage>}
          <div>
            <Button loading={save.isPending} disabled={!unsaved} onClick={() => save.mutate(pincodes)}>Save pincodes</Button>
          </div>
        </>
      )}
    </section>
  )
}
```

## Tests (spiked; scenario → test)
Every test file starts with L1's `afterEach(() => { clearToken(); vi.unstubAllGlobals() })` and signs in with `setToken('tok')` plus a `GET /admin/me` admin answer.

| Requirement › Scenario | Test (file › name) | Task |
|---|---|---|
| Stores table › Stores listed | `src/stores.test.tsx` › "stores table lists every store" | 1 |
| Stores table states › No stores | `src/stores.test.tsx` › "no stores shows the empty state" | 1 |
| Stores table states › Stores loading | `src/stores.test.tsx` › "stores table shows a skeleton while loading" | 1 |
| Stores table states › Stores load failure | `src/stores.test.tsx` › "stores load failure shows a retry that reloads" | 1 |
| Store create › Create a store | `src/store-form.test.tsx` › "create a store and open it" | 2 |
| Store change › Change sends only the changed fields | `src/store-form.test.tsx` › "edit sends only the changed fields and confirms" | 2 |
| Store change › Unknown store | `src/store-form.test.tsx` › "an unknown store shows not found" | 2 |
| Store form errors › Value the form cannot send | `src/store-form.test.tsx` › "a value the form cannot send is flagged without a request" | 2 |
| Store form errors › Field error from core | `src/store-form.test.tsx` › "a validation error from core is shown on its field" | 2 |
| Store form errors › Other save failure | `src/store-form.test.tsx` › "any other save error shows a banner" | 2 |
| Store delete › Delete after confirming | `src/store-delete.test.tsx` › "delete asks first, then removes the store" | 3 |
| Store delete › Store in use | `src/store-delete.test.tsx` › "a store in use cannot be deleted" | 3 |
| Store pincode editor › Pincodes listed | `src/service-areas.test.tsx` › "the store page lists its pincodes" | 4 |
| Store pincode editor › Add, remove and save | `src/service-areas.test.tsx` › "add and remove pincodes, then save the list with one PUT" | 4 |
| Store pincode editor › Pincode not six digits | `src/service-areas.test.tsx` › "a pincode that is not 6 digits is not added" | 4 |
| Pincode conflict names the other store › Pincode served by another store | `src/service-areas.test.tsx` › "a pincode served by another store names that store" | 4 |
| Pincode conflict names the other store › Other store's name unavailable | `src/service-areas.test.tsx` › "the conflict shows the store id when its name cannot be read" | 4 |
| Pincode conflict names the other store › Other pincode save failure | `src/service-areas.test.tsx` › "a pincode save failure with %s asks to try again" (rows: an error answer, no answer) | 4 |
| Stores against core › Admin edits a store and meets the pincode conflict | `e2e/stores.spec.ts` › "admin edits a store and meets the pincode conflict" | 5 |
| Stores against core › Store staff open the stores page | `e2e/stores.spec.ts` › "store staff open the stores page" | 5 |

### `src/stores.test.tsx`
```tsx
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala, storeList } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

test('stores table lists every store', async () => {
  setToken('tok')
  const calls = fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([indiranagar, koramangala]) })

  renderApp('/stores')

  const table = await screen.findByRole('table', { name: 'Stores' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('link').map((link) => link.textContent)).toEqual(['Indiranagar', 'Koramangala'])
  expect(within(rows[1]).getByRole('link', { name: 'Koramangala' })).toHaveAttribute('href', `/stores/${koramangala.id}`)
  expect(rows[1]).toHaveTextContent('560034')
  expect(within(rows[1]).getByText('Open')).toBeInTheDocument()
  expect(within(rows[0]).getByText('Closed')).toBeInTheDocument()
  expect(rows[1]).toHaveTextContent('₹25')
  expect(rows[1]).toHaveTextContent('₹199')
  expect(rows[1]).toHaveTextContent('₹99')
  expect(rows[1]).toHaveTextContent('10 min')
  expect(screen.getByRole('link', { name: 'New store' })).toHaveAttribute('href', '/stores/new')
  expect(new URL(calls.find((call) => call.url.includes('/admin/stores'))!.url).searchParams.get('pageSize')).toBe('100')
})

test('no stores shows the empty state', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => storeList([]) })

  renderApp('/stores')

  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New store' })).toBeInTheDocument()
})

test('stores table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ 'GET /admin/me': () => json(200, admin), 'GET /admin/stores': () => new Promise<Response>(() => {}) })

  renderApp('/stores')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Stores' })).toBeInTheDocument()
})

test('stores load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/stores': () => (fail ? apiError(500, 'internal') : storeList([koramangala])),
  })

  renderApp('/stores')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the stores.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Koramangala' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
```

### `src/store-form.test.tsx`
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const storePath = `/admin/stores/${koramangala.id}`
const signedIn = { 'GET /admin/me': () => json(200, admin) }
const withStore = {
  ...signedIn,
  [`GET ${storePath}`]: () => json(200, koramangala),
  [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  if (value) await userEvent.type(field, value)
}

test('create a store and open it', async () => {
  setToken('tok')
  const created = { ...koramangala, id: '00000000-0000-4000-8000-000000000499', name: 'HSR Layout', isOpen: false }
  const calls = fakeCore({
    ...signedIn,
    'POST /admin/stores': () => json(201, created),
    [`GET /admin/stores/${created.id}/service-areas`]: () => json(200, { pincodes: [] }),
  })

  const router = renderApp('/stores/new')
  expect(await screen.findByRole('heading', { level: 1, name: 'New store' })).toBeInTheDocument()
  expect(screen.getByLabelText('Status')).toHaveValue('closed')
  await replace('Name', 'HSR Layout')
  await replace('Address', '27th Main, HSR Layout')
  await replace('Pincode', '560102')
  await replace('Delivery fee (₹)', '25')
  await replace('Free delivery above (₹)', '199.50')
  await replace('Promised minutes', '12')
  await userEvent.click(screen.getByRole('button', { name: 'Create store' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'HSR Layout' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/stores/${created.id}`)
  const post = calls.find((call) => call.method === 'POST')!
  expect(await post.json()).toEqual({
    name: 'HSR Layout',
    addressLine: '27th Main, HSR Layout',
    pincode: '560102',
    isOpen: false,
    deliveryFeeCents: 2500,
    freeDeliveryAboveCents: 19950,
    minOrderCents: 0,
    promisedMinutes: 12,
  })
})

test('edit sends only the changed fields and confirms', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withStore,
    [`PATCH ${storePath}`]: () => json(200, { ...koramangala, promisedMinutes: 11, isOpen: false }),
  })

  renderApp(`/stores/${koramangala.id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Koramangala' })).toBeInTheDocument()
  expect(screen.getByLabelText('Delivery fee (₹)')).toHaveValue('25')
  expect(screen.getByLabelText('Free delivery above (₹)')).toHaveValue('199')
  await replace('Promised minutes', '11')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'closed')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Store saved.')).toBeInTheDocument()
  const patch = calls.find((call) => call.method === 'PATCH')!
  expect(await patch.json()).toEqual({ promisedMinutes: 11, isOpen: false })
  expect(screen.getByLabelText('Promised minutes')).toHaveValue('11')
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`PATCH ${storePath}`]: () => apiError(400, 'validation', 'name must be 1 to 100 characters', 'name') })

  renderApp(`/stores/${koramangala.id}`)
  await replace('Name', '   ')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.getByLabelText('Name')).toHaveAccessibleDescription('Enter 1 to 100 characters.'))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Store saved.')).not.toBeInTheDocument()
})

test('a value the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)
  await replace('Delivery fee (₹)', '-1')
  await replace('Promised minutes', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByLabelText('Delivery fee (₹)')).toHaveAccessibleDescription('Enter 0 to 100000 rupees, at most two decimals.')
  expect(screen.getByLabelText('Promised minutes')).toHaveAccessibleDescription('Enter 1 to 240 minutes.')
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('any other save error shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`PATCH ${storePath}`]: () => apiError(500, 'internal') })

  renderApp(`/stores/${koramangala.id}`)
  await replace('Promised minutes', '11')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the store. Try again.')
})

test('an unknown store shows not found', async () => {
  setToken('tok')
  fakeCore(signedIn)

  const router = renderApp('/stores/00000000-0000-4000-8000-000000000000')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/stores/00000000-0000-4000-8000-000000000000')
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Stores' })).toHaveAttribute('aria-current', 'page')
})
```

### `src/store-delete.test.tsx`
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, json, koramangala, storeList } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const storePath = `/admin/stores/${koramangala.id}`
const withStore = {
  'GET /admin/me': () => json(200, admin),
  [`GET ${storePath}`]: () => json(200, koramangala),
  [`GET ${storePath}/service-areas`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

test('delete asks first, then removes the store', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withStore,
    [`DELETE ${storePath}`]: () => new Response(null, { status: 204 }),
    'GET /admin/stores': () => storeList([]),
  })

  const router = renderApp(`/stores/${koramangala.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete store' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Koramangala?' })
  const buttons = within(dialog).getAllByRole('button').map((button) => button.textContent)
  expect(buttons).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Delete store' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/stores'))
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(await screen.findByRole('heading', { level: 2, name: 'No stores yet' })).toBeInTheDocument()
})

test('a store in use cannot be deleted', async () => {
  setToken('tok')
  fakeCore({ ...withStore, [`DELETE ${storePath}`]: () => apiError(409, 'conflict', 'still in use') })

  const router = renderApp(`/stores/${koramangala.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete store' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
    'This store still has staff users or orders. Remove its staff users first; a store with orders cannot be deleted.',
  )
  expect(router.state.location.pathname).toBe(`/stores/${koramangala.id}`)
})
```

### `src/service-areas.test.tsx`
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, fakeCore, indiranagar, json, koramangala } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const areasPath = `/admin/stores/${koramangala.id}/service-areas`
const withStore = {
  'GET /admin/me': () => json(200, admin),
  [`GET /admin/stores/${koramangala.id}`]: () => json(200, koramangala),
  [`GET ${areasPath}`]: () => json(200, { pincodes: ['560034', '560095'] }),
}

function listed() {
  return within(screen.getByRole('table', { name: 'Pincodes' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.tabular-nums')?.textContent)
}

async function addPincode(value: string) {
  await userEvent.type(screen.getByLabelText('Add pincode'), value)
  await userEvent.click(screen.getByRole('button', { name: 'Add' }))
}

test('the store page lists its pincodes', async () => {
  setToken('tok')
  fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)

  expect(await screen.findByRole('heading', { level: 2, name: 'Delivery pincodes' })).toBeInTheDocument()
  await waitFor(() => expect(listed()).toEqual(['560034', '560095']))
  expect(screen.getByRole('button', { name: 'Save pincodes' })).toBeDisabled()
  expect(screen.queryByText('Unsaved changes.')).not.toBeInTheDocument()
})

test('add and remove pincodes, then save the list with one PUT', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withStore, [`PUT ${areasPath}`]: () => json(200, { pincodes: ['560034', '560047'] }) })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560047')
  await userEvent.click(screen.getByRole('button', { name: 'Remove 560095' }))
  expect(listed()).toEqual(['560034', '560047'])
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByText('Pincodes saved.')).toBeInTheDocument()
  expect(screen.queryByText('Unsaved changes.')).not.toBeInTheDocument()
  const puts = calls.filter((call) => call.method === 'PUT')
  expect(puts).toHaveLength(1)
  expect(await puts[0].json()).toEqual({ pincodes: ['560034', '560047'] })
})

test('a pincode that is not 6 digits is not added', async () => {
  setToken('tok')
  fakeCore(withStore)

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('5600')

  expect(screen.getByLabelText('Add pincode')).toHaveAccessibleDescription('Enter a 6-digit pincode.')
  expect(listed()).toEqual(['560034', '560095'])
})

test('a pincode served by another store names that store', async () => {
  setToken('tok')
  fakeCore({
    ...withStore,
    [`PUT ${areasPath}`]: () =>
      json(409, { error: { code: 'conflict', message: 'pincode 560038 is served by another store', field: 'pincodes', pincode: '560038', storeId: indiranagar.id } }),
    [`GET /admin/stores/${indiranagar.id}`]: () => json(200, indiranagar),
  })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560038')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Pincode 560038 is served by Indiranagar.')
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
})

test('the conflict shows the store id when its name cannot be read', async () => {
  setToken('tok')
  fakeCore({
    ...withStore,
    [`PUT ${areasPath}`]: () => json(409, { error: { code: 'conflict', message: 'x', field: 'pincodes', pincode: '560038', storeId: indiranagar.id } }),
    [`GET /admin/stores/${indiranagar.id}`]: () => apiError(500, 'internal'),
  })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560038')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(`Pincode 560038 is served by ${indiranagar.id}.`)
})

test.each([
  ['an error answer', () => apiError(500, 'internal')],
  ['no answer', () => Promise.reject(new TypeError('Failed to fetch'))],
])('a pincode save failure with %s asks to try again', async (_name, answer) => {
  setToken('tok')
  fakeCore({ ...withStore, [`PUT ${areasPath}`]: answer })

  renderApp(`/stores/${koramangala.id}`)
  await screen.findByRole('table', { name: 'Pincodes' })
  await addPincode('560047')
  await userEvent.click(screen.getByRole('button', { name: 'Save pincodes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the pincodes. Try again.')
  expect(screen.getByText('Unsaved changes.')).toBeInTheDocument()
})
```

### `e2e/stores.spec.ts`
```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back what it changes.
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

async function savePromisedMinutes(page: Page, minutes: string) {
  await page.getByLabel('Promised minutes').fill(minutes)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Store saved.' })).toBeVisible()
}

async function addPincode(page: Page, pincode: string) {
  await page.getByLabel('Add pincode').fill(pincode)
  await page.getByRole('button', { name: 'Add', exact: true }).click()
}

async function savePincodes(page: Page) {
  await page.getByRole('button', { name: 'Save pincodes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Pincodes saved.' })).toBeVisible()
}

test('admin edits a store and meets the pincode conflict', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name: 'Stores' }).click()
  const stores = page.getByRole('table', { name: 'Stores' })
  await expect(stores.getByRole('link')).toHaveText(['Indiranagar', 'Koramangala'])
  await expectNoAxeViolations(page)

  await stores.getByRole('link', { name: 'Koramangala' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Koramangala' })).toBeVisible()
  await expect(page.getByLabel('Promised minutes')).toHaveValue('10')
  await expectNoAxeViolations(page)

  await savePromisedMinutes(page, '11')
  await page.reload()
  await expect(page.getByLabel('Promised minutes')).toHaveValue('11')
  await savePromisedMinutes(page, '10')

  const pincodes = page.getByRole('table', { name: 'Pincodes' })
  await expect(pincodes).toContainText('560034')
  await addPincode(page, '560038')
  await page.getByRole('button', { name: 'Save pincodes' }).click()
  await expect(page.getByRole('alert')).toHaveText('Pincode 560038 is served by Indiranagar.')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Remove 560038' }).click()
  await expect(page.getByRole('button', { name: 'Save pincodes' })).toBeDisabled()

  await addPincode(page, '560001')
  await savePincodes(page)
  await page.reload()
  await expect(pincodes).toContainText('560001')
  await page.getByRole('button', { name: 'Remove 560001' }).click()
  await savePincodes(page)
  await expect(pincodes).not.toContainText('560001')
})

test('store staff open the stores page', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  await expect(page.getByRole('navigation', { name: 'Admin' }).getByRole('link')).toHaveText(['Dashboard', 'Orders', 'Stock'])
  await page.goto('./stores')
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
  await expect(page).toHaveURL(/\/admin\/stores$/)
  await expectNoAxeViolations(page)
})
```

## Risks / Trade-offs
- [core-P2-L2's shapes move before merge] → task 0 diffs A1 to A12 against main's `core.d.ts` and updates this file and the briefs; the code above compiles only if the types match, so `tsc` is the tripwire.
- [The real-core e2e has not run] → the spike ran it against a stateful fake; task 5 runs it against core with the e2e slot. Its writes are restored in the test (promised minutes back to 10, `560001` removed; the conflict writes nothing), and the global setup reseeds anyway.
- [Sign-in rate limit, 10 per email per hour per core process] → this suite adds one admin and one store-staff sign-in per run; a reused local core on 18080 reaches the limit after about four full admin runs (`auth.spec` signs in twice). Restart core to clear (L1 Found).
- [Phone width: the admin nav overflows] → measured in the spike at 375 px: the seven admin links run past the `surface` strip and axe flags "Products" and "Staff" (`ink-muted` on `canvas`, 4.47:1). It is L1's shell, not these pages (the stores table passes at 375 px otherwise). The e2e runs at desktop width. Reported as a request (`TabNav` or the shell needs `overflow-x-auto`).
- [`ghost-danger` "Remove" and the `Badge` colours] → axe-clean in the spike at desktop width.
- [The `fetchQuery` for the conflict's store] → reuses `storeQuery`, so a 403 or 401 there follows L1's rules; for an admin neither happens.

## Migration Plan
None: client pages only. Rollback is reverting the PR; the `/stores` placeholder returns.
