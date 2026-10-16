## Context
`@shopperstop/ui/app` (#296) exports `createTokenStore(key)` (`get`, `set`, `subscribe`; storage that throws keeps the token in memory) and `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })` (an `openapi-fetch` client that looks `globalThis.fetch` up per call, attaches `Bearer <session.get()>`, on a 401 clears the session only when the request's `Authorization` equals `Bearer <current token>`, and turns a not-ok answer without the `{ error: { code, message } }` strings into `{ error: { code: 'internal', message: failureMessage } }` with the status kept and only `Content-Type` set). Web's `authMiddleware` does the same except the 401 rule (any 401 clears). Web's token store is the same as `createTokenStore` except it removes the key on any falsy token; nothing ever sets `''`.

## Goals / Non-Goals
Goals: web uses the shared store and client; the 401 rule becomes the shared one; every other observable behaviour stays. Non-goals: time helpers (none to swap, see proposal), `call`/`splitError`/`unreachable`, cross-tab sync, `package.json` changes.

## Decisions
1. **`session.ts` wraps the store and keeps its exports.** `getToken = store.get`, `setToken = store.set`, `useToken()` = `useSyncExternalStore(store.subscribe, store.get)`. Twenty-odd importers (`addresses.ts`, `cart.ts`, `orders.ts`, `auth.ts`, routes, tests, `test-setup.ts`) stay untouched. Alternative rejected: export the store and edit every importer; more diff, no gain.
2. **`api.ts` builds both clients with `createApiClient`.** `api` on `${location.origin}/api/core/v1`, `riderApi` on `${location.origin}/api/rider/v1`, both with `session: { get: getToken, set: setToken }` and `failureMessage: unreachable.message`. No `onUnauthorized`: web's pages already react to the token through `useToken`. `authMiddleware` and `isEnvelope` are deleted; the `openapi-fetch` import goes.
3. **`riderApi` keeps clearing the customer token on its 401s**, as it does today through the shared middleware (the rider service checks the customer's core token). Now under the same current-token rule.
4. **Tests drive the shipped client.** `authMiddleware` no longer exists, so `api.test.ts` replaces its direct middleware calls with `api.GET`/`POST`/`PATCH` against a fake `globalThis.fetch` that records the `Request` and returns a real `Response` (the process boundary, as `test-setup.ts` already does). Each existing test keeps its name; assertions move from the handed-on `Response` to `{ data, error, response }`. The two identity assertions (`toBe(response)`) become equality on status and body: identity is the shared client's concern and `packages/ui/src/app/client.test.ts` covers it. The zero-content-length pin keeps its `call()` half; its second half (no `Content-Length: 0` on the rewritten answer) is a property of the shared client, covered there.
5. **Stale-token test**: the fake `fetch` calls `setToken('t-new')` before answering 401 to a request sent with `t-old`. Red on today's code (`expected undefined to be 't-new'`, spiked), green after the swap.
6. **`openapi-fetch` stays in `apps/web/package.json`**: web no longer imports it, but it is the install that satisfies `@shopperstop/ui`'s peer dependency; removing it would also churn the lockfile.

Simplifications and ceilings: none new. The existing ponytail note on `useToken` (no cross-tab `storage` listener) moves along unchanged.

## Files
- `apps/web/src/session.ts` (rewritten, about 12 lines)
- `apps/web/src/api.ts` (middleware deleted, clients swapped)
- `apps/web/src/api.test.ts` (rewritten against `api`, plus the stale-token test)

## Spike (team lead, reverted)
Applied on a9d11d2 in the worktree, then reverted: with the three files below, `npm run lint` and `npm run typecheck` in `apps/web` clean, `vitest --run` 26 files, 164 tests passed (163 before plus the stale-token test); the new `api.test.ts` against today's `api.ts`/`session.ts` fails only `stale 401 keeps the newer session`.

### `apps/web/src/session.ts` after
```ts
import { useSyncExternalStore } from 'react'
import { createTokenStore } from '@shopperstop/ui/app'

const store = createTokenStore('shopperstop:customer-token')

export const getToken = store.get
export const setToken = store.set

// ponytail: no `storage` listener, so a sign-out in one tab leaves other tabs holding the token until their next 401. Add the listener when a customer reports it.
export function useToken() {
  return useSyncExternalStore(store.subscribe, store.get)
}
```

### `apps/web/src/api.ts` diff
```diff
@@ -1,5 +1,5 @@
 import { QueryClient, useQuery } from '@tanstack/react-query'
-import createClient, { type Middleware } from 'openapi-fetch'
+import { createApiClient } from '@shopperstop/ui/app'
 import type { components, paths } from '@shopperstop/ui/api'
 import type { paths as RiderPaths } from '@shopperstop/ui/api/rider'
 import { getToken, setToken, useToken } from './session'
@@ -8,43 +8,21 @@ export type ApiError = components['schemas']['Error']['error']
 
 export const unreachable: ApiError = { code: 'internal', message: 'Could not reach ShopperStop. Try again.' }
 
-function isEnvelope(body: unknown): boolean {
-  const error = (body as { error?: { code?: unknown; message?: unknown } } | null)?.error
-  return typeof error?.code === 'string' && typeof error?.message === 'string'
-}
-
-export const authMiddleware: Middleware = {
-  onRequest({ request }) {
-    const token = getToken()
-    if (token) request.headers.set('Authorization', `Bearer ${token}`)
-    return request
-  },
-  async onResponse({ response }) {
-    if (response.status === 401) setToken(undefined)
-    if (response.ok) return response
-    const body: unknown = await response.clone().json().catch(() => undefined)
-    if (isEnvelope(body)) return response
-    // Only Content-Type is set: copying Content-Length: 0 would make openapi-fetch drop the error again.
-    return new Response(JSON.stringify({ error: unreachable }), {
-      status: response.status,
-      headers: { 'Content-Type': 'application/json' },
-    })
-  },
-}
+const session = { get: getToken, set: setToken }
 
-// Absolute same-origin URL: jsdom's Request rejects a relative one. fetch is looked up per call so tests can stub it.
-export const api = createClient<paths>({
+// Absolute same-origin URL: jsdom's Request rejects a relative one. The shared client looks fetch up per call so tests can stub it.
+export const api = createApiClient<paths>({
   baseUrl: `${location.origin}/api/core/v1`,
-  fetch: (request) => globalThis.fetch(request),
+  session,
+  failureMessage: unreachable.message,
 })
-api.use(authMiddleware)
 
-// The rider service, same origin (/api/rider is proxied like /api/core), with the customer's core token and the same middleware.
-export const riderApi = createClient<RiderPaths>({
+// The rider service, same origin (/api/rider is proxied like /api/core), with the customer's core token.
+export const riderApi = createApiClient<RiderPaths>({
   baseUrl: `${location.origin}/api/rider/v1`,
-  fetch: (request) => globalThis.fetch(request),
+  session,
+  failureMessage: unreachable.message,
 })
-riderApi.use(authMiddleware)
 
 export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
 
```

### `apps/web/src/api.test.ts` after
```ts
import { afterEach, expect, test } from 'vitest'
import { api, call } from './api'
import { getToken, setToken } from './session'

const key = 'shopperstop:customer-token'
const internal = { error: { code: 'internal', message: 'Could not reach ShopperStop. Try again.' } }

// The network boundary: globalThis.fetch answers with a real Response; the shipped client runs as is.
let sent: Request[] = []
function answer(response: () => Response) {
  sent = []
  globalThis.fetch = async (request: RequestInfo | URL) => {
    sent.push(request as Request)
    return response()
  }
}

afterEach(() => {
  setToken(undefined)
  globalThis.fetch = async () => {
    throw new TypeError('fetch failed')
  }
})

test('bearer attached', async () => {
  setToken('t-3')
  answer(() => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  await api.GET('/me')
  expect(sent[0].url).toBe(`${location.origin}/api/core/v1/me`)
  expect(sent[0].headers.get('Authorization')).toBe('Bearer t-3')
})

test('expired session dropped', async () => {
  setToken('t-4')
  answer(() => new Response(null, { status: 401 }))
  await api.GET('/me')
  expect(getToken()).toBeUndefined()
  expect(localStorage.getItem(key)).toBeNull()
  await api.GET('/me')
  expect(sent[1].headers.get('Authorization')).toBeNull()
})

test('stale 401 keeps the newer session', async () => {
  setToken('t-old')
  answer(() => {
    setToken('t-new')
    return new Response(null, { status: 401 })
  })
  await api.GET('/me')
  expect(sent[0].headers.get('Authorization')).toBe('Bearer t-old')
  expect(getToken()).toBe('t-new')
  expect(localStorage.getItem(key)).toBe('t-new')
})

test('empty failed answer becomes internal', async () => {
  answer(() => new Response('', { status: 502 }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('HTML failed answer becomes internal', async () => {
  answer(() => new Response('<html><body>Bad Gateway</body></html>', { status: 502, headers: { 'Content-Type': 'text/html' } }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(502)
  expect(error).toEqual(internal)
})

test('other JSON failed answer becomes internal', async () => {
  answer(() => new Response('{"message":"x"}', { status: 500, headers: { 'Content-Type': 'application/json' } }))
  const { error, response } = await api.GET('/me')
  expect(response.status).toBe(500)
  expect(error).toEqual(internal)
})

test('enveloped failure passes through', async () => {
  const envelope = { error: { code: 'conflict', message: 'Email already registered', field: 'email' } }
  answer(() => new Response(JSON.stringify(envelope), { status: 409, headers: { 'Content-Type': 'application/json' } }))
  const { error, response } = await api.POST('/auth/register', { body: { name: 'A', email: 'a@example.com', password: 'password1' } })
  expect(response.status).toBe(409)
  expect(error).toEqual(envelope)
})

test('bare 401 drops the session and becomes internal', async () => {
  setToken('t-5')
  answer(() => new Response(null, { status: 401 }))
  const { error, response } = await api.GET('/me')
  expect(localStorage.getItem(key)).toBeNull()
  expect(response.status).toBe(401)
  expect(error).toEqual(internal)
})

test('no content answer untouched', async () => {
  setToken('t-6')
  answer(() => new Response(null, { status: 204 }))
  const { error, response } = await api.POST('/auth/sign-out')
  expect(error).toBeUndefined()
  expect(response.status).toBe(204)
  expect(await response.text()).toBe('')
})

test('ok JSON answer untouched', async () => {
  answer(() => new Response('{"items":[]}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  const { data, response } = await api.GET('/me/addresses')
  expect(response.status).toBe(200)
  expect(data).toEqual({ items: [] })
})

test('failed write reports an error', async () => {
  answer(() => new Response('', { status: 502 }))
  const result = await call(() => api.PATCH('/me', { body: { name: 'A', phone: '' } }))
  expect(result).toEqual(internal.error)
})

test('failed answer with a zero content length becomes internal', async () => {
  answer(() => new Response('', { status: 502, headers: { 'Content-Length': '0' } }))
  const result = await call(() => api.PATCH('/me', { body: { name: 'A', phone: '' } }))
  expect(result).toEqual(internal.error)
})

test('JSON that is not the envelope becomes internal', async () => {
  for (const body of ['null', '[]', '{"error":"x"}', '{"error":{"code":1}}']) {
    answer(() => new Response(body, { status: 500, headers: { 'Content-Type': 'application/json' } }))
    const { error, response } = await api.GET('/me')
    expect(response.status, body).toBe(500)
    expect(error, body).toEqual(internal)
  }
})
```
