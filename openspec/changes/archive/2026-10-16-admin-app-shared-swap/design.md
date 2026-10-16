## Context
`@shopperstop/ui/app` (#296) exports `createTokenStore(key)` (`get`, `set`, `subscribe`; `undefined` = no token; storage that throws keeps the token in memory), `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })` (an `openapi-fetch` client that looks `globalThis.fetch` up per call, attaches `Bearer <session.get()>`, on a 401 calls `session.set(undefined)` and `onUnauthorized()` only when the request's `Authorization` equals `Bearer <current token>`, and turns a not-ok answer without the `{ error: { code, message } }` strings into `{ error: { code: 'internal', message: failureMessage } }` with the status kept; default message "The server did not answer as expected.") and `since`, `useSince`, `when`.

Admin's copies compared:

| Piece | Admin today | Shared | Same? |
|---|---|---|---|
| Token store | `shopperstop:staff-token`, memory first, storage errors swallowed, `null` = none | same, `undefined` = none | yes but the empty value |
| Bearer | `Authorization: Bearer <token>` when held | same | yes |
| 401 rule | clear and `unauthorized()` only when the request carried the current token (admin-P2-L4) | same | yes |
| Envelope check | `error.code` string | `error.code` and `error.message` strings | stricter |
| Rewritten failure | `Response.json(...)` with the status | `new Response(JSON.stringify(...))`, status, `Content-Type: application/json` | yes |
| Failure message | "The server did not answer as expected." | same default | yes |
| `since`/`useSince`/`when` | in `orders.ts` | byte-for-byte the same bodies (parameter `placedAt` vs `at`) | yes |

## Goals / Non-Goals
Goals: admin uses the shared store, client and time helpers; every observable behaviour stays except the stricter envelope check. Non-goals: `itemCount`, a `useToken` hook, the router, `package.json`, e2e.

## Decisions
1. **`session.ts` exports the store and keeps three one-line wrappers** (`getToken = session.get`, `setToken`, `clearToken`), exactly as rider did (#304). Twenty-odd importers (routes, `api.ts`, every page test) stay untouched. Ceiling: two names for one thing; drop the wrappers if a later lane touches every importer anyway.
2. **`getToken()` returns `undefined` with no token**, the shared contract, as in rider. Only tests compared with `null`: nine assertions in `api.test.ts`, `session.test.ts`, `shell.test.tsx`, `sign-in.test.tsx` change to `toBeUndefined()` (the `localStorage.getItem(...)` `toBeNull()` checks stay: that is the DOM's `null`). These, plus the new envelope row, are what make the `test:` commit red. Alternative rejected: `getToken = () => session.get() ?? null` keeps four test files untouched but leaves admin as the one app with a different empty value.
3. **`onUnauthorized(handler)` stays in `api.ts`.** The clients are module singletons created before the router exists; `createApiClient` gets `onUnauthorized: () => unauthorized()` (late-bound), and `router.ts` keeps registering its clean-up (clear the query cache, `router.invalidate()`). Pinned by the existing `api.test.ts` tests that register `lost` and by `shell.test.tsx` › "expired session on load returns to sign-in".
4. **Both clients share one options object** (`{ session, onUnauthorized }`); `riderApi` keeps sending the staff token and ending the session on its 401s, as with the shared middleware today.
5. **Accept the stricter envelope check** (the one behaviour change). Neither service answers without a `message`, so only foreign answers are affected, and they now read as `internal` like any other foreign failure. Specified as the MODIFIED requirement's new scenario; one new `test.each` row in `api.test.ts` pins it (red today: the answer passes through as `{ error: { code: 'bad_gateway' } }`).
6. **Time helpers imported straight from `@shopperstop/ui/app`**, not re-exported from `orders.ts` (no local alias of a shared function, as rider). `orders-rules.test.ts` keeps its "Wording" table, now importing `since` from `@shopperstop/ui/app`: the admin-app scenario "Wording" keeps an admin test. "A minute passes" stays covered by `orders-board.test.tsx`.
7. **`openapi-fetch` stays in `apps/admin/package.json`**: no admin file imports it after the swap, but it is the peer `@shopperstop/ui/app` declares, and keeping it leaves `package-lock.json` untouched.

Known difference, no caller: `setToken('')` would now store `''` (admin's old store removed the key on any falsy value). The only caller, `routes/sign-in.tsx`, passes core's sign-in token.

Simplifications and ceilings: none new.

## Files
- `apps/admin/src/session.ts` (rewritten, 7 lines)
- `apps/admin/src/api.ts` (middleware deleted, clients swapped)
- `apps/admin/src/orders.ts` (time helpers and the `react` import deleted)
- `apps/admin/src/order-board.tsx`, `order-sheet.tsx`, `order-history.tsx` (imports only)
- tests: `apps/admin/src/api.test.ts`, `session.test.ts`, `orders-rules.test.ts`, `shell.test.tsx`, `sign-in.test.tsx`

## Spike (team lead, reverted)
Applied on origin/main (d5012f0) in the worktree, then reverted. Baseline: admin Vitest 27 files, 326 passed. Test diff alone against today's code: 12 failed (eleven tests through the nine `null` assertions, one being a four-row `test.each` in `sign-in.test.tsx`, and `a failure answer with an error code without a message ...`), 315 passed. With the code diff too: lint clean, typecheck clean, Vitest 27 files, 327 passed. Code diff: 6 files, net about minus 70 lines.

### Test diff (the `test:` commit)
```diff
diff --git a/apps/admin/src/api.test.ts b/apps/admin/src/api.test.ts
index 7e5711f..386c0eb 100644
--- a/apps/admin/src/api.test.ts
+++ b/apps/admin/src/api.test.ts
@@ -27,7 +27,7 @@ test('401 with a session clears it and reports the loss', async () => {
 
   await api.GET('/admin/me')
 
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
   expect(lost).toHaveBeenCalledOnce()
 })
@@ -72,6 +72,7 @@ test.each([
   ['an empty body with its length', () => new Response(null, { status: 502, headers: { 'Content-Length': '0' } })],
   ['a plain-text body', () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })],
   ['JSON that is not core\'s error', () => Response.json({ message: 'upstream down' }, { status: 502 })],
+  ['an error code without a message', () => Response.json({ error: { code: 'bad_gateway' } }, { status: 502 })],
 ])('a failure answer with %s reaches the caller as an internal error with its status', async (_, answer) => {
   setToken('tok')
   fakeCore({ 'GET /admin/me': answer })
@@ -112,7 +113,7 @@ test('a 401 without core\'s error body still ends the session and is an error to
 
   const { error, response } = await api.GET('/admin/me')
 
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(lost).toHaveBeenCalledOnce()
   expect(error).toEqual({ error: { code: 'internal', message: 'The server did not answer as expected.' } })
   expect(response.status).toBe(401)
diff --git a/apps/admin/src/orders-rules.test.ts b/apps/admin/src/orders-rules.test.ts
index 0a3e770..7be68bf 100644
--- a/apps/admin/src/orders-rules.test.ts
+++ b/apps/admin/src/orders-rules.test.ts
@@ -1,5 +1,6 @@
 import { expect, test } from 'vitest'
-import { itemCount, since } from './orders'
+import { since } from '@shopperstop/ui/app'
+import { itemCount } from './orders'
 import { order } from './orders-fake'
 
 const placed = '2026-10-13T09:20:00Z'
diff --git a/apps/admin/src/session.test.ts b/apps/admin/src/session.test.ts
index 3fc95b6..01cce5c 100644
--- a/apps/admin/src/session.test.ts
+++ b/apps/admin/src/session.test.ts
@@ -35,7 +35,7 @@ test('clear removes the token from memory and storage', async () => {
   const { clearToken, getToken, setToken } = await freshSession()
   setToken('t3')
   clearToken()
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem(KEY)).toBeNull()
 })
 
@@ -48,9 +48,9 @@ test('blocked storage keeps the token in memory', async () => {
   vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked)
 
   const { clearToken, getToken, setToken } = await freshSession()
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(() => setToken('t4')).not.toThrow()
   expect(getToken()).toBe('t4')
   expect(() => clearToken()).not.toThrow()
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
 })
diff --git a/apps/admin/src/shell.test.tsx b/apps/admin/src/shell.test.tsx
index 3d604a0..0568354 100644
--- a/apps/admin/src/shell.test.tsx
+++ b/apps/admin/src/shell.test.tsx
@@ -112,7 +112,7 @@ test('expired session on load returns to sign-in', async () => {
 
   await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
   expect(router.state.location.search).toEqual({ redirect: '/orders' })
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
 })
 
@@ -144,7 +144,7 @@ test('sign out ends the session', async () => {
   const signOut = calls.find((call) => call.url.endsWith('/admin/auth/sign-out'))
   expect(signOut?.method).toBe('POST')
   expect(signOut?.headers.get('Authorization')).toBe('Bearer tok')
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
   expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
   expect(router.options.context.queryClient.getQueryCache().getAll()).toEqual([])
diff --git a/apps/admin/src/sign-in.test.tsx b/apps/admin/src/sign-in.test.tsx
index 28ff741..8484ac8 100644
--- a/apps/admin/src/sign-in.test.tsx
+++ b/apps/admin/src/sign-in.test.tsx
@@ -57,7 +57,7 @@ test.each([
 
   const alert = await screen.findByRole('alert')
   expect(alert).toHaveTextContent(message)
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:staff-token')).toBeNull()
 })
 
@@ -72,7 +72,7 @@ test('validation error is shown on its field', async () => {
   expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
   expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('must be a valid email address')
   expect(screen.queryByRole('alert')).not.toBeInTheDocument()
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
 })
 
 test('submit is disabled while signing in', async () => {
```

### Code diff (the `feat:` commit)
```diff
diff --git a/apps/admin/src/api.ts b/apps/admin/src/api.ts
index 6d0776a..db11c8e 100644
--- a/apps/admin/src/api.ts
+++ b/apps/admin/src/api.ts
@@ -1,7 +1,7 @@
-import createClient, { type Middleware } from 'openapi-fetch'
+import { createApiClient } from '@shopperstop/ui/app'
 import type { components, paths } from '@shopperstop/ui/api'
 import type { components as riderComponents, paths as riderPaths } from '@shopperstop/ui/api/rider'
-import { clearToken, getToken } from './session'
+import { session } from './session'
 
 export type Staff = components['schemas']['Staff']
 export type ApiError = components['schemas']['Error']['error']
@@ -14,44 +14,14 @@ export function onUnauthorized(handler: () => void) {
   unauthorized = handler
 }
 
-// Absolute same-origin URL: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
-export const api = createClient<paths>({
-  baseUrl: `${location.origin}/api/core/v1`,
-  fetch: (request) => globalThis.fetch(request),
-})
-
-// One rule for both services: the staff token on every request, a 401 to it ends the session, a failure without the
-// error envelope (both services write the same one) is handed on as one with code `internal`.
-const staffSession: Middleware = {
-  onRequest({ request }) {
-    const token = getToken()
-    if (token) request.headers.set('Authorization', `Bearer ${token}`)
-    return request
-  },
-  async onResponse({ request, response }) {
-    // Only a 401 to the current token ends the session: not one to a signed-out request or to a token since replaced.
-    const token = getToken()
-    if (response.status === 401 && token && request.headers.get('Authorization') === `Bearer ${token}`) {
-      clearToken()
-      unauthorized()
-    }
-    if (response.ok) return response
-    // A failure core did not write (a proxy's empty or plain-text 502 while core is down) carries no error envelope, and
-    // openapi-fetch then hands callers a falsy `error`: every `if (error) throw error.error` would read it as success.
-    // Such an answer is given the envelope here, with its status kept, so no caller needs to know.
-    const body = (await response.clone().json().catch(() => undefined)) as { error?: { code?: unknown } } | undefined
-    if (typeof body?.error?.code === 'string') return response
-    return Response.json({ error: { code: 'internal', message: 'The server did not answer as expected.' } }, { status: response.status })
-  },
-}
-api.use(staffSession)
+// One rule for both services (they write the same error envelope): the staff token on every request, a 401 to the
+// current token ends the session, a failure without the envelope reaches callers as `internal` with its status.
+// Absolute same-origin URL: jsdom's Request rejects a relative one; the shared client looks fetch up per call so tests can stub it.
+const options = { session, onUnauthorized: () => unauthorized() }
+export const api = createApiClient<paths>({ baseUrl: `${location.origin}/api/core/v1`, ...options })
 
 // The rider service (`services/rider`), same origin; it checks the staff token with core itself.
-export const riderApi = createClient<riderPaths>({
-  baseUrl: `${location.origin}/api/rider/v1`,
-  fetch: (request) => globalThis.fetch(request),
-})
-riderApi.use(staffSession)
+export const riderApi = createApiClient<riderPaths>({ baseUrl: `${location.origin}/api/rider/v1`, ...options })
 
 export const meQuery = {
   queryKey: ['admin', 'me'],
diff --git a/apps/admin/src/order-board.tsx b/apps/admin/src/order-board.tsx
index 5bb9ce2..7bcbd95 100644
--- a/apps/admin/src/order-board.tsx
+++ b/apps/admin/src/order-board.tsx
@@ -1,8 +1,9 @@
 import { useQuery, useQueryClient } from '@tanstack/react-query'
 import { useEffect, useRef, useState } from 'react'
 import { Badge, Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, Price, Skeleton, StatusMessage, VisuallyHidden } from '@shopperstop/ui'
+import { useSince } from '@shopperstop/ui/app'
 import { OrderSheet } from './order-sheet'
-import { activeStatuses, boardQuery, isActive, itemCount, nextLabel, nextStatus, orderQuery, statusLabel, useSetStatus, useSince, type Order } from './orders'
+import { activeStatuses, boardQuery, isActive, itemCount, nextLabel, nextStatus, orderQuery, statusLabel, useSetStatus, type Order } from './orders'
 
 
 // Its own component, so a minute passing renders this text and nothing else on the board.
diff --git a/apps/admin/src/order-history.tsx b/apps/admin/src/order-history.tsx
index 294d7e6..90767cb 100644
--- a/apps/admin/src/order-history.tsx
+++ b/apps/admin/src/order-history.tsx
@@ -2,7 +2,8 @@ import { useQuery, useQueryClient } from '@tanstack/react-query'
 import { useEffect, useState } from 'react'
 import { Button, Card, Chip, EmptyState, ErrorBanner, Price, Skeleton, Table, cn, type Column } from '@shopperstop/ui'
 import { OrderSheet } from './order-sheet'
-import { historyQuery, itemCount, orderQuery, pageSize, statusLabel, when, type Finished, type Order, type OrdersSearch } from './orders'
+import { when } from '@shopperstop/ui/app'
+import { historyQuery, itemCount, orderQuery, pageSize, statusLabel, type Finished, type Order, type OrdersSearch } from './orders'
 
 // One store's finished orders. The route gives it `key={storeId}`, so nothing kept here outlives a change of store.
 // `go` changes the URL; the status filter starts again at page 1.
diff --git a/apps/admin/src/order-sheet.tsx b/apps/admin/src/order-sheet.tsx
index 6bcbba7..ba14e93 100644
--- a/apps/admin/src/order-sheet.tsx
+++ b/apps/admin/src/order-sheet.tsx
@@ -1,7 +1,8 @@
 import { useQuery } from '@tanstack/react-query'
 import { useEffect, useRef, useState, type FormEvent } from 'react'
 import { Badge, Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Price, Sheet, StatusMessage } from '@shopperstop/ui'
-import { orderQuery, statusBadge, statusLabel, useSetStatus, when, type Order } from './orders'
+import { when } from '@shopperstop/ui/app'
+import { orderQuery, statusBadge, statusLabel, useSetStatus, type Order } from './orders'
 
 // Core takes a note of at most 500 characters (services/core/internal/order/handlers.go).
 const maxReason = 500
diff --git a/apps/admin/src/orders.ts b/apps/admin/src/orders.ts
index b9a8f95..81d54e4 100644
--- a/apps/admin/src/orders.ts
+++ b/apps/admin/src/orders.ts
@@ -1,5 +1,4 @@
 import { keepPreviousData, queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
-import { useSyncExternalStore } from 'react'
 import type { components } from '@shopperstop/ui/api'
 import { api } from './api'
 
@@ -111,24 +110,6 @@ export function useSetStatus(storeId: string) {
   })
 }
 
-// "12 min ago" for a card; whole minutes, hours above 59.
-export function since(placedAt: string, now: number) {
-  const minutes = Math.max(0, Math.floor((now - Date.parse(placedAt)) / 60_000))
-  if (minutes === 0) return 'just now'
-  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
-}
-
-// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
-function everyFewSeconds(tick: () => void) {
-  const id = setInterval(tick, 5_000)
-  return () => clearInterval(id)
-}
-export const useSince = (placedAt: string) => useSyncExternalStore(everyFewSeconds, () => since(placedAt, Date.now()))
-
-// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
-const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
-export const when = (at: string) => stamp.format(new Date(at))
-
 export function itemCount(order: Order) {
   const count = order.items.reduce((sum, item) => sum + item.quantity, 0)
   return count === 1 ? '1 item' : `${count} items`
diff --git a/apps/admin/src/session.ts b/apps/admin/src/session.ts
index 85b79a6..3bf22a4 100644
--- a/apps/admin/src/session.ts
+++ b/apps/admin/src/session.ts
@@ -1,36 +1,7 @@
-const KEY = 'shopperstop:staff-token'
+import { createTokenStore } from '@shopperstop/ui/app'
 
-// Memory is the source for every request; localStorage keeps the session across reloads (Spec 2 §5).
-// Storage can be blocked or full (privacy modes, disabled cookies): the token then lives in memory only.
-function read() {
-  try {
-    return localStorage.getItem(KEY)
-  } catch {
-    return null
-  }
-}
-
-function write(value: string | null) {
-  try {
-    if (value) localStorage.setItem(KEY, value)
-    else localStorage.removeItem(KEY)
-  } catch {
-    // Not persisted; the memory copy still holds for this page.
-  }
-}
-
-let token = read()
-
-export function getToken() {
-  return token
-}
-
-export function setToken(value: string) {
-  token = value
-  write(value)
-}
-
-export function clearToken() {
-  token = null
-  write(null)
-}
+// Memory first, mirrored to localStorage (memory only when storage is blocked): the shared store (Spec 2 §5).
+export const session = createTokenStore('shopperstop:staff-token')
+export const getToken = session.get
+export const setToken = (token: string) => session.set(token)
+export const clearToken = () => session.set(undefined)
```
