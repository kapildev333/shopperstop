## Context
ui-P4-L2 put `createTokenStore`, `createApiClient`, `since`, `useSince` and `when` in `@shopperstop/ui/app` (`packages/ui/src/app/`, spec in `openspec/specs/design-system`). rider's `src/api.ts`, `src/session.ts` and `src/format.ts` were one of the sources it was copied from; the 401 rule (only a 401 to the current token ends the session) is the same. Every diff below was spiked on 31c7e73 and reverted: rider Vitest 10 files / 61 tests green, lint, typecheck and build clean; the test diff alone is red on the old code (listed under Test strategy).

## Goals / Non-Goals
Goals: rider drops its copies; pages, texts, routes and the e2e suite stay as they are.
Non-goals: `itemCount` (rider-only), `router.ts`, any `packages/ui` change, dependency or lockfile changes.

## Decisions
1. **Keep `getToken`, `setToken`, `clearToken` as aliases over the shared store.** `session.ts` exports `session = createTokenStore('shopperstop:rider-token')` plus three one-liners, so the ten importers (routes, tests) are untouched. Ceiling: two names for one thing; drop the aliases if a later lane touches every importer anyway.
2. **`getToken()` returns `undefined`, not `null`, with no token.** It is the shared store's contract; only tests compared with `null`. They change to `toBeUndefined()`, which is also what makes them red until the store is wired.
3. **Keep `onUnauthorized(handler)` in `api.ts`.** The clients are module singletons created before the router exists; `createApiClient`'s `onUnauthorized` gets `() => unauthorized()`, and `router.ts` keeps registering its clean-up (clear the query cache, `router.invalidate()`) as today. A factory per router would be more code for no behaviour.
4. **`core` gets no `session`.** The shared client then never sets `Authorization`, which is the "Core never gets the rider token" rule; the existing test pins it.
5. **Accept the stricter envelope check.** The shared client needs a string `message` as well as `code`; rider needed only `code`. Neither service answers without a message, so the only answers affected are foreign ones, which now read as `internal` like any other foreign failure. Specified as the ADDED requirement; one new `test.each` row pins it.
6. **Time helpers imported straight from `@shopperstop/ui/app`**, not re-exported from `format.ts`: no local alias of a shared function. `format.test.ts` keeps only `itemCount`; the `since` wording is covered by `packages/ui/src/app/time.test.tsx` and, in rider, by `ready.test.tsx` ("12 min ago" on a card).
7. **`openapi-fetch` stays in `apps/rider/package.json`.** No rider file imports it after the swap, but it is the peer `@shopperstop/ui/app` declares, and keeping it leaves `package-lock.json` untouched (PLAN.md Found: npm 10.9.9 can crash on lock edits).

## Spec delta choice
The swap keeps the 401 rule word for word, so "Rider lost session" keeps its text; it is MODIFIED only to add the scenario "401 mid-session returns to sign-in", because no test pinned the router clean-up: with `onUnauthorized` left out, all 60 existing tests still passed (spiked). The envelope fix-up was tested but never specified; it is ADDED with the one behaviour the swap changes (Decision 5). Nothing else in `rider-app` names the old code.

## Files
- Task 1: `apps/rider/src/api.ts`, `apps/rider/src/session.ts`, `apps/rider/src/api.test.ts`, `apps/rider/src/session.test.ts`, `apps/rider/src/shell.test.tsx`, `apps/rider/src/sign-in.test.tsx`.
- Task 2: `apps/rider/src/format.ts`, `apps/rider/src/format.test.ts`, `apps/rider/src/ready.tsx`, `apps/rider/src/routes/_rider/history.tsx`.

## Test strategy
Vitest with Testing Library and the existing `fakeApi` (fetch stubbed at the process boundary). Red for task 1 (test diff on the old code, spiked): `a failure answer with an error envelope without a message ...`, `expired session on load returns to sign-in`, `a 401 mid-session returns to sign-in`, `blocked storage keeps the token in memory`, `sign out ends the session`, and four sign-in tests (`wrong credentials or inactive rider`, `rate limited`, `service unreachable or failing`, `field validation from the service`), 8 failed / 52 passed. `a 401 mid-session returns to sign-in` also fails if `onUnauthorized` is left out of the `rider` client (spiked). Task 2 has no red test: it moves two imports and deletes copies; the moved functions keep their tests in `packages/ui` and rider's page tests, so its commit is `refactor:` with the suite green before and after. e2e is not re-run by the lane (no page change); the manager's `make e2e` slot is optional.

Scenario to test: "A failure answer without an envelope reaches the caller as internal" → `api.test.ts` `a failure answer with %s reaches the caller as an internal error with its status` (three rows); "401 mid-session returns to sign-in" → `api.test.ts` `a 401 mid-session returns to sign-in`; "Expired session on load" → `expired session on load returns to sign-in`; "401 to a replaced token keeps the new session" → `a 401 to a replaced token keeps the new session`; "Service unreachable on load" → `service unreachable on load shows a retry and keeps the session`.

## Risks / Trade-offs
- The shared store also notifies subscribers; rider has none, so nothing changes. `setToken('')` would now store `''` where rider removed the key; sign-in never stores an empty token.
- A future change to `@shopperstop/ui/app` changes rider's behaviour with it; that is the point (D46), and the shared tests guard it.

## Code
Apply in order with `git apply` (each copied out to a scratch file). They are the exact diffs of the spike.

### Task 1: tests
```diff
diff --git a/apps/rider/src/api.test.ts b/apps/rider/src/api.test.ts
index 97fcc08..275e2c2 100644
--- a/apps/rider/src/api.test.ts
+++ b/apps/rider/src/api.test.ts
@@ -2,7 +2,7 @@ import { screen, waitFor, within } from '@testing-library/react'
 import { afterEach, expect, test, vi } from 'vitest'
 import { core, onUnauthorized, rider } from './api'
 import { clearToken, getToken, setToken } from './session'
-import { apiError, arjun, fakeApi, json, koramangala } from './fake-api'
+import { apiError, arjun, fakeApi, json, koramangala, signedInRoutes } from './fake-api'
 import { renderApp } from './render-app'
 
 const storePath = `/api/core/v1/stores/${koramangala.id}`
@@ -53,6 +53,7 @@ test('a 401 to a replaced token keeps the new session', async () => {
 test.each([
   ['no body', () => new Response(null, { status: 502 })],
   ['a plain-text body', () => new Response('Bad Gateway', { status: 502, headers: { 'Content-Type': 'text/plain' } })],
+  ['an error envelope without a message', () => json(502, { error: { code: 'bad_gateway' } })],
 ])('a failure answer with %s reaches the caller as an internal error with its status', async (_, answer) => {
   setToken('tok')
   fakeApi({ 'GET /api/rider/v1/me': answer })
@@ -73,7 +74,19 @@ test('expired session on load returns to sign-in', async () => {
 
   await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
   expect(router.state.location.search).toEqual({ redirect: '/history' })
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
+  expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
+})
+
+test('a 401 mid-session returns to sign-in', async () => {
+  setToken('tok')
+  fakeApi({ ...signedInRoutes(), 'GET /api/rider/v1/me/deliveries': () => apiError(401, 'unauthorized') })
+
+  const router = renderApp('/history')
+
+  await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'))
+  expect(router.state.location.search).toEqual({ redirect: '/history' })
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
 })
 
diff --git a/apps/rider/src/session.test.ts b/apps/rider/src/session.test.ts
index c455f83..01821ea 100644
--- a/apps/rider/src/session.test.ts
+++ b/apps/rider/src/session.test.ts
@@ -33,9 +33,9 @@ test('blocked storage keeps the token in memory', async () => {
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
diff --git a/apps/rider/src/shell.test.tsx b/apps/rider/src/shell.test.tsx
index 5a1319e..517fd26 100644
--- a/apps/rider/src/shell.test.tsx
+++ b/apps/rider/src/shell.test.tsx
@@ -104,7 +104,7 @@ test('sign out ends the session', async () => {
   const signOut = calls.find((call) => call.url.endsWith('/api/rider/v1/auth/sign-out'))
   expect(signOut?.method).toBe('POST')
   expect(signOut?.headers.get('Authorization')).toBe('Bearer tok')
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
   expect(screen.queryByRole('navigation', { name: 'Rider' })).not.toBeInTheDocument()
   expect(router.options.context.queryClient.getQueryCache().getAll()).toEqual([])
diff --git a/apps/rider/src/sign-in.test.tsx b/apps/rider/src/sign-in.test.tsx
index 7d06674..b66060e 100644
--- a/apps/rider/src/sign-in.test.tsx
+++ b/apps/rider/src/sign-in.test.tsx
@@ -91,7 +91,7 @@ test('wrong credentials or inactive rider', async () => {
   await fillAndSubmit('arjun@example.test', 'wrong')
 
   expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is wrong, or the account is inactive.')
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
   expect(localStorage.getItem('shopperstop:rider-token')).toBeNull()
 })
 
@@ -102,7 +102,7 @@ test('rate limited', async () => {
   await fillAndSubmit('arjun@example.test', 'secret-test')
 
   expect(await screen.findByRole('alert')).toHaveTextContent('Too many sign-in attempts. Try again later.')
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
 })
 
 test('service unreachable or failing', async () => {
@@ -121,7 +121,7 @@ test('service unreachable or failing', async () => {
 
   await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
   await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.'))
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
 })
 
 test('field validation from the service', async () => {
@@ -135,5 +135,5 @@ test('field validation from the service', async () => {
   expect(await screen.findByText('must be a valid email address')).toBeInTheDocument()
   expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('must be a valid email address')
   expect(screen.queryByRole('alert')).not.toBeInTheDocument()
-  expect(getToken()).toBeNull()
+  expect(getToken()).toBeUndefined()
 })
```

### Task 1: code
```diff
diff --git a/apps/rider/src/api.ts b/apps/rider/src/api.ts
index 6164a92..c718ecb 100644
--- a/apps/rider/src/api.ts
+++ b/apps/rider/src/api.ts
@@ -1,7 +1,7 @@
-import createClient from 'openapi-fetch'
+import { createApiClient } from '@shopperstop/ui/app'
 import type { components, paths } from '@shopperstop/ui/api/rider'
 import type { paths as corePaths } from '@shopperstop/ui/api'
-import { clearToken, getToken } from './session'
+import { session } from './session'
 
 export type Rider = components['schemas']['Rider']
 export type ReadyOrder = components['schemas']['ReadyOrder']
@@ -15,48 +15,15 @@ export function onUnauthorized(handler: () => void) {
   unauthorized = handler
 }
 
-// Absolute same-origin URLs: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
-// The rider service carries the token; core never does (the store read is public and a rider token means nothing to core).
-export const rider = createClient<paths>({
+// Absolute same-origin URLs: jsdom's Request rejects a relative one.
+// The rider service carries the token and ends the session on a 401 to it; core never gets it (the store read is public).
+export const rider = createApiClient<paths>({
   baseUrl: `${location.origin}/api/rider/v1`,
-  fetch: (request) => globalThis.fetch(request),
+  session,
+  onUnauthorized: () => unauthorized(),
 })
 
-export const core = createClient<corePaths>({
-  baseUrl: `${location.origin}/api/core/v1`,
-  fetch: (request) => globalThis.fetch(request),
-})
-
-// A failure another party wrote (a proxy's empty or plain-text 502 while the service is down) carries no error envelope, and
-// openapi-fetch then hands callers a falsy `error`: every `if (error) throw error.error` would read it as success.
-// Such an answer is given the envelope here, with its status kept, so no caller needs to know.
-async function withEnvelope(response: Response) {
-  if (response.ok) return response
-  const body = (await response.clone().json().catch(() => undefined)) as { error?: { code?: unknown } } | undefined
-  if (typeof body?.error?.code === 'string') return response
-  return Response.json({ error: { code: 'internal', message: 'The server did not answer as expected.' } }, { status: response.status })
-}
-
-core.use({
-  onResponse: ({ response }) => withEnvelope(response),
-})
-
-rider.use({
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
-    return withEnvelope(response)
-  },
-})
+export const core = createApiClient<corePaths>({ baseUrl: `${location.origin}/api/core/v1` })
 
 export const meQuery = {
   queryKey: ['rider', 'me'],
diff --git a/apps/rider/src/session.ts b/apps/rider/src/session.ts
index 0a8558f..b6ad626 100644
--- a/apps/rider/src/session.ts
+++ b/apps/rider/src/session.ts
@@ -1,36 +1,7 @@
-const KEY = 'shopperstop:rider-token'
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
+// Memory first, mirrored to localStorage (memory only when storage is blocked): the shared store (Spec 2 §5, D29 key).
+export const session = createTokenStore('shopperstop:rider-token')
+export const getToken = session.get
+export const setToken = (token: string) => session.set(token)
+export const clearToken = () => session.set(undefined)
```

### Task 2
```diff
diff --git a/apps/rider/src/format.test.ts b/apps/rider/src/format.test.ts
index 7d9d506..89aeebb 100644
--- a/apps/rider/src/format.test.ts
+++ b/apps/rider/src/format.test.ts
@@ -1,13 +1,7 @@
 import { expect, test } from 'vitest'
-import { itemCount, since } from './format'
+import { itemCount } from './format'
 
-const now = Date.parse('2026-10-15T10:00:00Z')
-const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString()
-
-test('since and itemCount wording', () => {
-  expect(since(ago(0), now)).toBe('just now')
-  expect(since(ago(12), now)).toBe('12 min ago')
-  expect(since(ago(65), now)).toBe('1 h 5 min ago')
+test('itemCount wording', () => {
   expect(itemCount(1)).toBe('1 item')
   expect(itemCount(3)).toBe('3 items')
 })
diff --git a/apps/rider/src/format.ts b/apps/rider/src/format.ts
index 47bdcc0..f799a6d 100644
--- a/apps/rider/src/format.ts
+++ b/apps/rider/src/format.ts
@@ -1,23 +1,3 @@
-import { useSyncExternalStore } from 'react'
-
-// "12 min ago" for a card; whole minutes, hours above 59.
-export function since(at: string, now: number) {
-  const minutes = Math.max(0, Math.floor((now - Date.parse(at)) / 60_000))
-  if (minutes === 0) return 'just now'
-  return minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} h ${minutes % 60} min ago`
-}
-
-// The text of `since`, kept current: only the component that calls this renders again, and only when the text changes.
-function everyFewSeconds(tick: () => void) {
-  const id = setInterval(tick, 5_000)
-  return () => clearInterval(id)
-}
-export const useSince = (at: string) => useSyncExternalStore(everyFewSeconds, () => since(at, Date.now()))
-
-// "13 Oct 2026, 2:50 pm", in the stores' time zone whatever the browser's is.
-const stamp = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })
-export const when = (at: string) => stamp.format(new Date(at))
-
 export function itemCount(n: number) {
   return n === 1 ? '1 item' : `${n} items`
 }
diff --git a/apps/rider/src/ready.tsx b/apps/rider/src/ready.tsx
index 1ef000e..1937cec 100644
--- a/apps/rider/src/ready.tsx
+++ b/apps/rider/src/ready.tsx
@@ -2,8 +2,9 @@ import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
 import { Link, useNavigate } from '@tanstack/react-router'
 import { useState } from 'react'
 import { Button, Card, Dialog, DialogFooter, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, buttonClass } from '@shopperstop/ui'
+import { useSince } from '@shopperstop/ui/app'
 import { deliveryQuery, rider, type ApiError, type Delivery, type ReadyOrder } from './api'
-import { itemCount, useSince } from './format'
+import { itemCount } from './format'
 
 const readyKey = ['rider', 'ready'] as const
 const assignedKey = ['rider', 'deliveries', 'assigned'] as const
diff --git a/apps/rider/src/routes/_rider/history.tsx b/apps/rider/src/routes/_rider/history.tsx
index 3400158..39fc4b7 100644
--- a/apps/rider/src/routes/_rider/history.tsx
+++ b/apps/rider/src/routes/_rider/history.tsx
@@ -2,7 +2,7 @@ import { useQuery } from '@tanstack/react-query'
 import { Link, createFileRoute } from '@tanstack/react-router'
 import { Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, Table, type Column } from '@shopperstop/ui'
 import { rider, type Delivery } from '../../api'
-import { when } from '../../format'
+import { when } from '@shopperstop/ui/app'
 
 // The newest 50 delivered deliveries. ponytail: no pager; a rider past 50 sees the newest 50, add the admin pager when riders ask.
 const pageSize = 50
```
