# Design

## Context
See proposal.md for why. `apps/admin` on main is the Phase 1 shell (admin-P1-L1): `__root.tsx` with a banner, a one-link `TabNav` on a `surface` strip and `<Outlet />` in `main`; `index.tsx` is a Dashboard placeholder; `main.tsx` builds the router with `basepath: '/admin'`; `shell.test.tsx` renders the real route tree on a memory history; `e2e/smoke.spec.ts` visits Dashboard and not-found with axe and proves the `/api` proxy. `@shopperstop/ui/api` is types only (`paths`, `components`), generated from `services/core/openapi.json` whose `servers[0].url` is `/api/core/v1`, so `paths` keys have no prefix (`/healthz`). Since core-P2-L1 (#63, origin/main ba69715, openapi 0.2.0) it holds the staff routes and the `Staff`, `StaffSession`, `SignInRequest` and `Error` schemas.

Spike, 2026-10-12, scratchpad copy of 5101344 with Node 22.23.3: the staff routes below were added to a scratch `openapi.json` exactly as assumed in "Assumptions", `core.d.ts` regenerated, and every file in this design written and run: `npm install` in the workspace clean (no peer conflict), lint, typecheck, Vitest 5 files / 31 tests (after dropping the sign-in 403 row and adding the blocked-storage, route 403 and two 401-race tests), `vite build` with `routeTree.gen.ts` byte-stable across builds, and Playwright with axe against `vite preview` on a scratch port (sign-in page, error banner, Dashboard, signed-out not-found, store-staff not-found on `/stores`, reload restoring the session, deep link `/admin/stock` round trip through sign-in, sign-out): no violations. The real-core e2e (task 4) could not run: core does not serve the routes yet.

## Assumptions, verified against `core.d.ts` (task 0, ba69715)
| # | Assumption | Where it is used | If wrong | `core.d.ts` on ba69715 |
|---|---|---|---|---|
| A1 | `paths` has `/admin/auth/sign-in` (post), `/admin/auth/sign-out` (post), `/admin/me` (get); base `/api/core/v1` | `api.ts`, `sign-in.tsx`, `__root.tsx`, `fake-core.ts` keys | rename the path strings | verified: `postAdminAuthSignIn`, `postAdminAuthSignOut`, `getAdminMe` under `servers` `/api/core/v1` |
| A2 | sign-in request body is `{ email: string, password: string }`; success is **200** with `{ token: string, staff: <Staff> }` | `sign-in.tsx` `onSuccess` | adjust the destructuring; if 201, nothing changes (openapi-fetch treats any 2xx as `data`) | verified: body `SignInRequest {email, password}`; 200 `StaffSession {token, staff}` |
| A3 | the staff schema is `components['schemas']['Staff']` with required `id` (uuid), `email`, `name`, `role: 'admin' \| 'store_staff'`, `isActive: boolean`, and optional `storeId` (omitted for admins, never `null`) | `api.ts` `export type Staff`, fixtures in `fake-core.ts` | change the schema name in the one alias; drop or add fixture fields | verified: `Staff` required `id, email, name, role, isActive`; `storeId?` ("Omitted for admins; present for store staff") |
| A4 | `GET /admin/me` answers 200 with the staff object itself, not wrapped (`{ staff }`) | `meQuery` | return `data.staff` | verified: 200 `Staff` |
| A5 | wrong email or password and inactive staff: 401 `unauthorized` | sign-in errors | add the code to `messages` | verified: sign-in documents 200, 400, 401 ("wrong password, unknown email, customer credentials or inactive staff user. The four cases look the same"), 429; no 403 |
| A6 | rate limit: 429 `rate_limited`; bad input: 400 `validation` with `field` `email` or `password` | sign-in errors | adjust the field names | verified: 429 `rate_limited`; 400 `validation` with `field` `email` ("must be a valid email address") or password empty |
| A7 | sign-out: 204 with no body, needs the bearer; a dead token answers 401 | `signOut` | none: the client clears the session whatever core answers | verified: 204 no body, 401 |
| A8 | an expired or revoked session (12 h, inactive staff) answers 401 `unauthorized` on any staff route | 401 rule | none | verified: `getAdminMe` and `postAdminAuthSignOut` document 401 for a missing, unknown, expired, customer or deactivated token |
| A9 | the error envelope is `components['schemas']['Error']` = `{ error: { code, message, field? } }` (already on main) | `ApiError`, `throw error.error` | none | verified: `components["schemas"]["Error"]`, code enum includes `unauthorized`, `forbidden`, `rate_limited`, `validation`, `internal` |
| A10 | `core-admin seed-demo --reset` creates `admin@shopperstop.local` / `admin12345`, active (D22, core-P2-L1) | `e2e/auth.spec.ts` | change the credentials in the spec only | verified: openapi example and core lane log: id `...0101`, name `Admin`; seed command as in contract fact 8 |

## Core contract facts (core-P2-L1 as proposed, relayed by the manager 2026-10-12)
1. Staff sign-in answers `{token, staff}`.
2. 401 `unauthorized` on any secured route means the session is gone: the client clears the token and the guard sends the user to sign-in (the `onResponse` rule below).
3. Store staff calling admin-only routes get 403 `forbidden`. The nav hides those sections and the `_admin` layout shows not-found from the role in `/admin/me` before any call; a stray 403 from any call renders the same not-found page, never sign-in (`RouteError` below). Core answers 404 `not_found` for another store's objects: the page lanes' concern.
4. PATCH rejects explicit `null`; `""` unsets an optional text field (page lanes).
5. Validation errors carry the JSON field name in `field` (A6 holds).
6. Lists are `{items, page, pageSize, total}` (page lanes).
7. Every secured operation documents 401 and `security` in `openapi.json`, so `core.d.ts` types the 401 bodies as `Error`; `throw error.error` covers them.
8. The seed creates `admin@shopperstop.local` / `admin12345` with id `00000000-0000-4000-8000-000000000101`. core's e2e seed command (its design.md decision 22) is `go run ./cmd/core-admin migrate && go run ./cmd/core-admin seed-demo --reset` in `services/core` with the `make e2e` environment; `e2e/global-setup.ts` runs exactly those two commands there, with the environment Playwright was given.

Core accepted the admin requests: schema names `Staff` and `StaffSession`, `/admin/me` unwrapped, inactive staff 401, `storeId` omitted for admins. Task 0 (2026-10-12, ba69715): no differences in shapes. The spike's code compiled, linted and passed Vitest 29/29 and `vite build` against the real `core.d.ts`. `getAdminMe` and `postAdminAuthSignIn` type no 403; the 403 rule (fact 3) applies to later admin-only calls. The one edit: the field-validation scenario now quotes core's real message.

## Goals / Non-Goals
**Goals:** the smallest auth layer every later admin page sits in: one client, one guard, one role rule, one place that knows the nav. **Non-Goals:** page bodies, store selector, client-side expiry timers, refresh tokens, "remember me", password reset (Spec 2 §14), a sign-in redirect for an already signed-in visitor (they can sign in again; harmless).

## Decisions

### Files (all under `apps/admin/`)
```
package.json                        + openapi-fetch 0.17.0, @tanstack/react-query 5.104.2; dev @testing-library/user-event 14.6.7
src/session.ts                      token in memory + localStorage                       (task 1)
src/api.ts                          typed client, bearer + 401 middleware, meQuery, Staff (task 1)
src/fake-core.ts                    test helper: fake fetch at the process boundary      (task 1)
src/session.test.ts, src/api.test.ts                                                    (task 1; api.ts and api.test.ts amended in task 3)
src/router.ts                       createAppRouter: QueryClient in router context       (task 2)
src/route-error.tsx                 every route's error boundary: 403 → not found        (task 2)
src/render-app.tsx                  test helper: renderApp(path)                         (task 2)
src/main.tsx                        uses createAppRouter + QueryClientProvider           (task 2)
src/nav.ts                          the section list and the role filter                 (task 2)
src/not-found.tsx                   the one not-found page                               (task 2)
src/routes/__root.tsx               shell: name, Sign out, role nav                      (task 2)
src/routes/_staff.tsx               guard (pathless layout)                              (task 2)
src/routes/_staff/_admin.tsx        admin-only rule (pathless layout)                    (task 2)
src/routes/_staff/index.tsx         Dashboard, moved from src/routes/index.tsx           (task 2)
src/routes/_staff/orders.tsx, stock.tsx                                placeholders     (task 2)
src/routes/_staff/_admin/categories.tsx, staff.tsx                     placeholders     (task 2)
src/routes/_staff/_admin/stores/index.tsx, products/index.tsx          placeholders     (task 2)
src/routes/sign-in.tsx              stub with validateSearch (task 2), the form (task 3)
src/shell.test.tsx                  rewritten for sessions (task 2)
src/sign-in.test.tsx                                                                    (task 3)
src/routeTree.gen.ts                regenerated by the build, committed                  (tasks 2, 3)
playwright.config.ts                + globalSetup                                        (task 4)
e2e/global-setup.ts, e2e/auth.spec.ts                                                   (task 4)
e2e/smoke.spec.ts                   "dashboard passes axe" removed (moved into auth.spec) (task 4)
```

### Package pins
`dependencies`: `openapi-fetch` 0.17.0 and `@tanstack/react-query` 5.104.2 (current stable on 2026-10-12; approved as D10 tooling in the work package; record the pin). `devDependencies`: `@testing-library/user-event` 14.6.7, the pin `packages/ui` already uses (Testing Library tooling, D10). Install with `npm install -E --workspace apps/admin`.

### Session (`src/session.ts`)
```ts
const KEY = 'shopperstop:staff-token'

// Memory is the source for every request; localStorage keeps the session across reloads (Spec 2 §5).
// Storage can be blocked or full (privacy modes, disabled cookies): the token then lives in memory only.
function read() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function write(value: string | null) {
  try {
    if (value) localStorage.setItem(KEY, value)
    else localStorage.removeItem(KEY)
  } catch {
    // Not persisted; the memory copy still holds for this page.
  }
}

let token = read()

export function getToken() {
  return token
}

export function setToken(value: string) {
  token = value
  write(value)
}

export function clearToken() {
  token = null
  write(null)
}
```
The module reads storage once at import (that is the reload path); afterwards memory is the source and storage the copy. Every storage access is guarded, the same rule as `apps/web` (web-P2-L2 review fix): Safari private mode and disabled cookies make `localStorage` throw. Not a React store: nothing renders from the token itself; the router guard reads it, and the root reads the staff member from the guard's match.

### Client (`src/api.ts`)
```ts
import createClient from 'openapi-fetch'
import type { components, paths } from '@shopperstop/ui/api'
import { clearToken, getToken } from './session'

export type Staff = components['schemas']['Staff']
export type ApiError = components['schemas']['Error']['error']

let unauthorized = () => {}

// The router registers what a lost session does (clear the cache, re-run the guard).
export function onUnauthorized(handler: () => void) {
  unauthorized = handler
}

// Absolute same-origin URL: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
export const api = createClient<paths>({
  baseUrl: `${location.origin}/api/core/v1`,
  fetch: (request) => globalThis.fetch(request),
})

api.use({
  onRequest({ request }) {
    const token = getToken()
    if (token) request.headers.set('Authorization', `Bearer ${token}`)
    return request
  },
  onResponse({ request, response }) {
    // Only a 401 to the current token ends the session: not one to a signed-out request or to a token since replaced.
    const token = getToken()
    if (response.status === 401 && token && request.headers.get('Authorization') === `Bearer ${token}`) {
      clearToken()
      unauthorized()
    }
    return response
  },
})

export const meQuery = {
  queryKey: ['admin', 'me'],
  queryFn: async (): Promise<Staff> => {
    const { data, error } = await api.GET('/admin/me')
    if (error) throw error.error
    return data
  },
  staleTime: Infinity,
}
```
- `baseUrl` is the page origin plus `/api/core/v1`: same-origin through the Vite proxy and Caddy, and jsdom's `Request` rejects a relative URL (spike: `TypeError: Failed to parse URL from /api/core/v1/admin/me`). The spec's proxy requirement is reworded for this.
- `fetch` is looked up per call, so a test's `vi.stubGlobal('fetch', ...)` takes effect after the module is imported (openapi-fetch captures `globalThis.fetch` at `createClient` otherwise; spike confirmed).
- openapi-fetch's `error` is the whole envelope; `throw error.error` throws `{ code, message, field? }` (spike: throwing `error` lost the code).
- 401 is acted on only when the request carried the current token (its `Authorization` header equals `Bearer <token now>`). A wrong-password sign-in, sent without a token, never clears a session stored meanwhile; a request still in flight with an old token never clears the new one. `request.headers.has('Authorization')` was rejected: it still lets an old token's 401 clear a new token (spike: that test fails with it). No path is special-cased. Amended after task 1 review (reviewer nit, 2026-10-12); lands as task 3's first fix.
- `onUnauthorized` is a setter, not an import of the router, to avoid a module cycle (router imports routes import api).
- Every later page uses `api` and TanStack Query; queries throw `error.error` the same way.

### Test helper (`src/fake-core.ts`, task 1)
```ts
import { vi } from 'vitest'
import type { Staff } from './api'

type Handler = (request: Request) => Response | Promise<Response>

export const admin: Staff = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.test', name: 'Asha Admin', role: 'admin', isActive: true }
export const storeStaff: Staff = { id: '00000000-0000-4000-8000-000000000002', email: 'staff@example.test', name: 'Sam Staff', role: 'store_staff', storeId: '00000000-0000-4000-8000-0000000000aa', isActive: true }

export function json(status: number, body?: unknown) {
  return body === undefined ? new Response(null, { status }) : Response.json(body, { status })
}

export function apiError(status: number, code: string, message = code, field?: string) {
  return json(status, { error: { code, message, ...(field ? { field } : {}) } })
}

// Fake core at the process boundary: keys are "METHOD /path" under /api/core/v1; unknown routes answer 404 not_found.
export function fakeCore(routes: Record<string, Handler>) {
  const calls: Request[] = []
  vi.stubGlobal('fetch', async (request: Request) => {
    calls.push(request)
    const path = new URL(request.url).pathname.replace('/api/core/v1', '')
    const handler = routes[`${request.method} ${path}`]
    return handler ? handler(request) : apiError(404, 'not_found')
  })
  return calls
}
```
Fake at the process boundary (`fetch`), the only fake allowed (Spec 1 §5.2); everything above it (client, middleware, router, components) is real. Fixture emails use `example.test`, never a real address.

### Router (`src/router.ts`) and `main.tsx`
```ts
import { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'
import { onUnauthorized, type ApiError } from './api'
import { RouteError } from './route-error'
import { routeTree } from './routeTree.gen'

export function createAppRouter(history?: RouterHistory) {
  const queryClient = new QueryClient({
    // A 403 in a page query goes to the route's error boundary, which shows not found.
    defaultOptions: { queries: { retry: false, throwOnError: (error) => (error as Partial<ApiError>).code === 'forbidden' } },
  })
  const router = createRouter({ routeTree, history, basepath: history ? undefined : '/admin', context: { queryClient }, defaultErrorComponent: RouteError })
  onUnauthorized(() => {
    queryClient.clear()
    void router.invalidate()
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
```
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { createAppRouter } from './router'
import './index.css'

const router = createAppRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
```
- Tests pass a memory history without the basepath (Phase 1 convention: test paths are `/`, `/stores`); the app passes none and gets `/admin`.
- `retry: false`: a 401 or 500 on `/admin/me` must surface at once; pages that want retries set them per query.
- `throwOnError` for `forbidden` only: a 403 in a page's `useQuery` goes to the route's error boundary and shows not-found (contract fact 3); every other query error stays in the query for the page to show. Loader errors reach the boundary anyway.
- The 401 handler clears the query cache and invalidates the router; the `_staff` guard re-runs, finds no token and redirects with the current path.
- `src/render-app.tsx` (task 2):
```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createAppRouter } from './router'

export function renderApp(path: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  render(
    <QueryClientProvider client={router.options.context.queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}
```

### Guard (`src/routes/_staff.tsx`)
```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { meQuery } from '../api'
import { getToken } from '../session'

export const Route = createFileRoute('/_staff')({
  beforeLoad: async ({ context, location }) => {
    const toSignIn = () => redirect({ to: '/sign-in', search: { redirect: location.href } })
    if (!getToken()) throw toSignIn()
    try {
      return { staff: await context.queryClient.ensureQueryData(meQuery) }
    } catch (error) {
      if (!getToken()) throw toSignIn()
      throw error
    }
  },
})
```
Pathless layout route: every protected page lives under `src/routes/_staff/`, the URL has no `_staff`. `location.href` excludes the basepath, so `redirect` is `/stock`, URL-encoded `%2Fstock` (spike, in Chromium under `/admin/`). `staleTime: Infinity` on `meQuery` means one `GET /admin/me` per page load, not per navigation; sign-in seeds the cache with the `staff` it got back, so no second call. Load errors are not handled here: the router's `defaultErrorComponent` (`RouteError`, below) renders them in the failing route's place, below the root, so the banner stays. A root `errorComponent` was tried and rejected: it replaces the whole layout and loses the banner (spike).

### Role rule (`src/routes/_staff/_admin.tsx`) and nav (`src/nav.ts`)
```tsx
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { NotFound } from '../../not-found'

function AdminOnly() {
  const { staff } = Route.useRouteContext()
  return staff.role === 'admin' ? <Outlet /> : <NotFound />
}

export const Route = createFileRoute('/_staff/_admin')({ component: AdminOnly })
```
```ts
import type { Staff } from './api'

const links = [
  { to: '/', label: 'Dashboard', adminOnly: false },
  { to: '/orders', label: 'Orders', adminOnly: false },
  { to: '/stock', label: 'Stock', adminOnly: false },
  { to: '/stores', label: 'Stores', adminOnly: true },
  { to: '/categories', label: 'Categories', adminOnly: true },
  { to: '/products', label: 'Products', adminOnly: true },
  { to: '/staff', label: 'Staff', adminOnly: true },
] as const

export function navLinks(role: Staff['role']) {
  return links.filter((link) => role === 'admin' || !link.adminOnly)
}
```
Admin-only pages live under `src/routes/_staff/_admin/`: one rule, no per-page checks; the page lanes put `/stores/$id`, `/products/$id` there too. Store staff stay on the URL and see `NotFound` inside the shell (Spec 2 §8), with their own three-link nav. `nav.ts` keeps the order and the role filter in one list; the role rule and the nav cannot drift because both say "admin only" for the same four sections (the `_admin` folder holds exactly the `adminOnly` routes).

### Shell (`src/routes/__root.tsx`)
```tsx
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link, Outlet, createRootRouteWithContext, useMatch, useNavigate } from '@tanstack/react-router'
import { Button, TabNav } from '@shopperstop/ui'
import { api } from '../api'
import { navLinks } from '../nav'
import { NotFound } from '../not-found'
import { clearToken } from '../session'

function RootLayout() {
  // Staff exists only while a guarded route is matched; the guard loaded it.
  const staff = useMatch({ from: '/_staff', shouldThrow: false })?.context.staff
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await api.POST('/admin/auth/sign-out').catch(() => undefined)
    clearToken()
    queryClient.clear()
    await navigate({ to: '/sign-in' })
  }

  return (
    <>
      <header>
        <div className="flex items-center justify-between gap-4 bg-brand px-4 py-3 text-on-brand sm:px-6">
          <span className="text-h3">ShopperStop Admin</span>
          {staff && (
            <div className="flex items-center gap-3">
              <span className="text-body">{staff.name}</span>
              <Button variant="secondary" onClick={signOut}>Sign out</Button>
            </div>
          )}
        </div>
        {staff && (
          <TabNav label="Admin" className="bg-surface px-4 sm:px-6">
            {navLinks(staff.role).map((link) => (
              <Link key={link.to} to={link.to} activeOptions={{ exact: link.to === '/' }}>
                {link.label}
              </Link>
            ))}
          </TabNav>
        )}
      </header>
      <main className="px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </>
  )
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})
```
- The root reads the staff member from the `_staff` match (`useMatch(..., shouldThrow: false)`), so name, Sign out and nav appear exactly while a protected page is shown, and vanish on sign-in and on the signed-out not-found page. A query observer was tried first and rejected: `useQuery({ enabled: false })` keeps showing its last data after `queryClient.clear()`, so the nav outlived sign-out (spike).
- `activeOptions.exact` only on Dashboard; the others match by prefix so `/stores/<id>` keeps "Stores" current.
- "Sign out" is a `secondary` `Button` on the brand band (axe-clean, as web's header button); the name is `text-body` `on-brand`.
- Sign-out ignores the server's answer: the local session ends whatever happens (A7).

### Errors (`src/route-error.tsx`)
```tsx
import { useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { ErrorBanner } from '@shopperstop/ui'
import { NotFound } from './not-found'

// Every route's error boundary. A 403 means the role cannot open this, so it reads as not found (Spec 2 §8);
// anything else is a load failure with a retry. 401 never lands here: the client clears the session and the guard redirects.
export function RouteError({ error }: ErrorComponentProps) {
  const router = useRouter()
  if ((error as { code?: string } | undefined)?.code === 'forbidden') return <NotFound />
  return <ErrorBanner message="Could not reach the server." onRetry={() => void router.invalidate()} />
}
```
Set once as the router's `defaultErrorComponent`, so it is every route's boundary; no route sets its own. Spike: a 403 on `GET /admin/me` shows not-found inside the banner with the token kept; a 403 inside a page's `useQuery` (throwaway probe on the Stock placeholder) shows not-found with the admin's seven-link nav kept; a 500 on `/admin/me` shows the banner and "Try again".

### Not found (`src/not-found.tsx`)
```tsx
import { Link } from '@tanstack/react-router'
import { Card, EmptyState, PageHeader, buttonClass } from '@shopperstop/ui'

export function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Page not found" />
      <Card className="p-6">
        <EmptyState
          title="Nothing here"
          description="This page does not exist or your role cannot open it."
          action={<Link to="/" className={buttonClass({ variant: 'secondary' })}>Go to Dashboard</Link>}
        />
      </Card>
    </div>
  )
}
```
One component for unknown paths (root `notFoundComponent`), wrong-role paths (`_admin`) and 403 answers (`RouteError`). The `Card` is required: `EmptyState`'s description is `ink-muted`, 4.47:1 on canvas (Phase 1 finding). The link is a router `Link` styled with `buttonClass`, so it gets the basepath; no `createLink(ButtonLink)` yet.

### Dashboard and placeholders
`src/routes/index.tsx` moves to `src/routes/_staff/index.tsx` with `createFileRoute('/_staff/')`, content unchanged except the description "Store cards arrive with the dashboard page." Each placeholder is the same five lines, for example `src/routes/_staff/orders.tsx`:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder for admin-P2-L1's nav; the page lane replaces it.
export const Route = createFileRoute('/_staff/orders')({ component: () => <PageHeader title="Orders" /> })
```
Titles: Orders, Stock, Categories, Staff (flat files), Stores and Products (`stores/index.tsx`, `products/index.tsx` with ids `/_staff/_admin/stores/` and `/_staff/_admin/products/`, so the page lanes add `$id.tsx` beside them without moving files).

### Sign-in (`src/routes/sign-in.tsx`)
Task 2 lands a stub so the guard has a target:
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Only same-app paths: never an absolute or protocol-relative URL (open redirect).
function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined
}

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({ redirect: safeRedirect(search.redirect) }),
  component: () => <PageHeader title="Sign in" />,
})
```
Task 3 replaces the component with the form:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Button, Card, ErrorBanner, FormField, Input, PageHeader } from '@shopperstop/ui'
import { api, meQuery, type ApiError } from '../api'
import { setToken } from '../session'

// Only same-app paths: never an absolute or protocol-relative URL (open redirect).
function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : undefined
}

const messages: Partial<Record<ApiError['code'], string>> = {
  unauthorized: 'Email or password is wrong, or the account is inactive.',
  rate_limited: 'Too many sign-in attempts. Try again later.',
}

function SignIn() {
  const { redirect } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const signIn = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST('/admin/auth/sign-in', { body: { email, password } })
      if (error) throw error.error
      return data
    },
    onSuccess: async ({ token, staff }) => {
      setToken(token)
      queryClient.setQueryData(meQuery.queryKey, staff)
      await navigate({ href: redirect ?? '/' })
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const errors = {
      email: email.trim() ? undefined : 'Enter your email.',
      password: password ? undefined : 'Enter your password.',
    }
    setFieldErrors(errors)
    if (!errors.email && !errors.password) signIn.mutate()
  }

  const apiError = signIn.error && 'code' in signIn.error ? (signIn.error as ApiError) : undefined
  const serverField = apiError?.code === 'validation' ? apiError.field : undefined
  const banner = signIn.error
    ? apiError
      ? (serverField ? undefined : (messages[apiError.code] ?? 'Something went wrong. Try again.'))
      : 'Could not reach the server. Check your connection and try again.'
    : undefined

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6">
      <PageHeader title="Sign in" />
      <Card className="p-6">
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {banner && <ErrorBanner message={banner} />}
          <FormField label="Email" error={fieldErrors.email ?? (serverField === 'email' ? apiError?.message : undefined)}>
            <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Password" error={fieldErrors.password ?? (serverField === 'password' ? apiError?.message : undefined)}>
            <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <Button type="submit" loading={signIn.isPending}>Sign in</Button>
        </form>
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({ redirect: safeRedirect(search.redirect) }),
  component: SignIn,
})
```
- `noValidate` and own required checks: native bubbles are not announced through `FormField` and cannot be asserted in jsdom.
- The banner is cleared by the next submit (`useMutation` resets `error` on `mutate`). Field errors from core use `FormField`'s `error`, so the input gets `aria-invalid` and `aria-describedby`.
- `navigate({ href })` takes the already-validated path; `safeRedirect` stops `//evil.example` and absolute URLs (open redirect).
- `autoComplete` `username` and `current-password` for password managers.

### Tests
Vitest (Testing Library, `userEvent`, fake `fetch` only). Every test file's `afterEach` calls `clearToken()` and `vi.unstubAllGlobals()`; `session.test.ts` instead clears storage, calls `vi.restoreAllMocks()` and `vi.resetModules()`, and imports `./session` dynamically per test.

| Scenario | Test |
|---|---|
| Staff session › Token kept in memory and storage | `src/session.test.ts` › "token is kept in memory and localStorage" |
| Staff session › Token survives a reload | `src/session.test.ts` › "token survives a reload" |
| Staff session › Blocked storage keeps the token in memory | `src/session.test.ts` › "blocked storage keeps the token in memory" (`vi.spyOn(Storage.prototype, 'getItem' / 'setItem' / 'removeItem')` throwing `DOMException('blocked', 'SecurityError')`: a fake at the process boundary) |
| (support for Sign-out, Lost session) | `src/session.test.ts` › "clear removes the token from memory and storage" |
| Staff session › Bearer token attached; Core reached through a same-origin proxy › Client calls the page's origin | `src/api.test.ts` › "client attaches the bearer token" (URL is `${location.origin}/api/core/v1/admin/me`, header `Bearer tok`) |
| Lost session › 401 clears the session | `src/api.test.ts` › "401 with a session clears it and reports the loss" |
| Lost session › 401 without a session changes nothing | `src/api.test.ts` › "a 401 to a signed-out request keeps a session set meanwhile" (the sign-in handler calls `setToken('fresh')` before answering 401; replaces task 1's "401 without a session reports nothing") |
| Lost session › 401 to a replaced token keeps the new session | `src/api.test.ts` › "a 401 to a replaced token keeps the new session" (token `old`; the `/admin/me` handler calls `setToken('new')` before answering 401) |
| Admin shell › Dashboard renders in the shell | `src/shell.test.tsx` › "dashboard renders in the shell" (also asserts the admin's name and a "Sign out" button in the banner) |
| Unknown paths show not found › Unknown path; Protected routes › Unknown path signed out | `src/shell.test.tsx` › "unknown path" (no session, no nav) |
| Role-based navigation › Admin sees every section | `src/shell.test.tsx` › "admin sees every section" |
| Role-based navigation › Store staff see their sections | `src/shell.test.tsx` › "store staff see dashboard, orders and stock" |
| Protected routes › Signed-out deep link | `src/shell.test.tsx` › "signed-out deep link goes to sign-in with the path" (`router.state.location.search` equals `{ redirect: '/stock' }`, zero fetch calls) |
| Wrong-role deep link › Store staff open an admin page | `src/shell.test.tsx` › "store staff deep link to an admin page shows not found in the shell" |
| Wrong-role deep link › A 403 from core shows not found | `src/shell.test.tsx` › "a 403 from core shows not found, not sign-in" (`GET /admin/me` answers 403: the only call this lane makes; the page-query path is the same boundary plus `throwOnError`, proven in the spike and by the first page lane that meets a 403) |
| Wrong-role deep link › Admin opens an admin page; Admin shell › Current section stays marked | `src/shell.test.tsx` › "admin opens an admin page" |
| Lost session › Expired session on load | `src/shell.test.tsx` › "expired session on load returns to sign-in" |
| Lost session › Core unreachable on load | `src/shell.test.tsx` › "core unreachable on load shows a retry" (banner still present, token kept) |
| Sign-out › Sign out ends the session | `src/shell.test.tsx` › "sign out ends the session" |
| Staff sign-in › Sign-in form is labelled | `src/sign-in.test.tsx` › "sign-in form has labelled fields and one h1" |
| Staff sign-in › Empty fields are flagged | `src/sign-in.test.tsx` › "empty fields are flagged without a request" (`toHaveAccessibleDescription`) |
| Sign-in errors › Wrong credentials or inactive staff, Rate limited, Any other error, Core unreachable | `src/sign-in.test.tsx` › `test.each` "%s shows an error banner" with rows "wrong credentials" (401), "rate limited" (429), "any other error" (500 `internal`), "network error" (handler returns `Promise.reject(new TypeError('Failed to fetch'))`); each asserts the alert text and `getToken()` null |
| Sign-in errors › Field validation from core | `src/sign-in.test.tsx` › "validation error is shown on its field" |
| Staff sign-in › Submit disabled while pending | `src/sign-in.test.tsx` › "submit is disabled while signing in" (handler returns a promise released by the test) |
| Staff sign-in › Return to the page after sign-in | `src/sign-in.test.tsx` › "success stores the token and returns to the redirect" (`/sign-in?redirect=%2Fstock` → h1 Stock, path `/stock`, storage `tok`, zero `/admin/me` calls) |
| Staff sign-in › Outside redirect ignored | `src/sign-in.test.tsx` › "an outside redirect is ignored" |
| Served under /admin/ › Built app opens under the prefix; Sign-out › Sign in, dashboard, sign out against core; End-to-end suite › Smoke pages pass axe, Suite seeds its own data | `e2e/auth.spec.ts` › "admin signs in, reloads and signs out" |
| Sign-in errors › Wrong credentials or inactive staff (against core) | `e2e/auth.spec.ts` › "wrong password shows the error" |
| Smoke pages pass axe (not found); Preview proxies to core | `e2e/smoke.spec.ts` › "not found passes axe", "preview proxies to core" (unchanged) |
| design-system seed "Literal colour fails the gate" (admin) | `src/no-literal-colors.test.ts` (unchanged, covers the new files) |

### End-to-end (task 4)
`e2e/global-setup.ts`:
```ts
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const core = fileURLToPath(new URL('../../../services/core', import.meta.url))

// Self-contained suite (D22): migrate and reset the demo seed with the environment Playwright was given.
export default function globalSetup() {
  for (const args of [['migrate'], ['seed-demo', '--reset']]) {
    execFileSync('go', ['run', './cmd/core-admin', ...args], { cwd: core, stdio: 'inherit' })
  }
}
```
`playwright.config.ts` gains `globalSetup: './e2e/global-setup.ts'`, nothing else. The two commands are core's e2e seed command (contract fact 8). Core reads the same `SHOPPERSTOP_CORE_*` variables the `webServer` core gets (both inherit the process environment that `make e2e` sets). Under `make e2e` the Makefile has already migrated and seeded; the second run is idempotent and costs a few seconds.

`e2e/auth.spec.ts` (credentials live only here, A10):
- "admin signs in, reloads and signs out": `goto('./')` → URL matches `/\/admin\/sign-in\?redirect=%2F$/`, h1 "Sign in", `body` background `rgb(245, 246, 248)`, axe clean; `goto('./stock')` → URL ends `sign-in?redirect=%2Fstock`; fill Email `admin@shopperstop.local`, Password `admin12345`, click "Sign in" → URL ends `/admin/stock`, h1 "Stock"; click nav link "Dashboard" → h1 "Dashboard", that link has `href` `/admin/`, the "Admin" nav has the seven links in order, axe clean; `page.reload()` → h1 "Dashboard" and seven links again (session restored by the real `GET /admin/me`); click "Sign out" → URL ends `/admin/sign-in`, h1 "Sign in", `localStorage` `shopperstop:staff-token` is `null`, no "Admin" navigation, axe clean.
- "wrong password shows the error": `goto('./sign-in')`, fill `nobody@shopperstop.local` / `wrong-password`, click "Sign in" → alert "Email or password is wrong, or the account is inactive.", axe clean. A different email from the admin's keeps the admin under the 10-per-email-per-hour limit.

`e2e/smoke.spec.ts`: delete "dashboard passes axe" (the Dashboard now needs a session; its assertions moved into auth.spec). "not found passes axe" and "preview proxies to core" stay unchanged.

### Simplifications and ceilings
- One `GET /admin/me` per page load, cached forever: a role change or deactivation by an admin shows on the next 401 or reload. Ceiling: fine for staff tooling; add a `staleTime` when roles change live.
- No client-side 12-hour timer: the first call after expiry answers 401 and the 401 rule signs the user out. Ceiling: a user idle on a page sees the redirect only when they act.
- 401 handler is a module-level setter: one router per page. Ceiling: tests create a router per test, and the latest registration wins, which is what each test wants.
- Admin-only rule is a folder (`_admin/`), not per-route metadata. Ceiling: a third role with a different section set needs a role list per section in `nav.ts` and one more pathless layout.
- Placeholders are a `PageHeader` only. Ceiling: replaced by the page lanes; no behaviour depends on their content.
- The signed-in visitor can still open `/sign-in`. Ceiling: harmless; redirect it when someone asks.
- Store-staff cases are Vitest only (D22). Ceiling: an e2e for store staff lands with the seed's store staff (core-P2-L2) in a later admin lane.

## Risks / Trade-offs
- [Assumptions A1 to A10 differ from what core-P2-L1 ships] → task 0 rechecks against the regenerated `core.d.ts` and the core lane log before any worker starts; each row names its one-line fix.
- [Rate limiter: 10 sign-ins per email per hour per core process] → only one admin sign-in per run; CI starts a fresh core. Locally, `reuseExistingServer` keeps a core alive across runs: more than ten runs in an hour against a reused core fail with `rate_limited`. Restart core (stop the process on 18080) if it happens.
- [`go run` in global setup needs Go and the database] → same prerequisites `make e2e` already has.
- [Playwright starts the `webServer`s before `globalSetup` (plugin setup runs first; read in playwright 1.64.0 `lib/runner/index.js` `createGlobalSetupTasks`)] → core does not need the seed to start, and the seed runs before any test. core-P2-L1's `seed.Reset` is one transaction (truncate, insert), safe while core runs.
- [Web's cross-app e2e (web-P2-L5) drives this sign-in page] → its labels, button name and redirect behaviour are in the spec; changing them is a spec change.
- [A later page needs the staff member] → `Route.useRouteContext()` under `_staff` gives `staff`; no new store.

## Migration Plan
None: no data. Signed-out users of the Phase 1 shell now see the sign-in page at `/admin/`.
