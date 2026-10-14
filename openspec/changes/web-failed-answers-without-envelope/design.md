# Design

## Context

What `openapi-fetch` 0.17.0 does, read from `node_modules/openapi-fetch/dist/index.mjs` (`coreFetch`) and run against real `Response` values through the client's `fetch` option:

| Answer | Lines | `data` | `error` |
|---|---|---|---|
| 204, or `Content-Length: 0`, ok | 179-181 | `undefined` | absent |
| not ok, `Content-Length: 0` (or 204/HEAD) | 179-181 | absent | `undefined` |
| not ok, empty body, no `Content-Length` | 196-201 | absent | `""` (`JSON.parse("")` throws, the text is kept) |
| not ok, HTML or other text | 196-201 | absent | the text, a truthy string |
| not ok, JSON `{"message":"x"}` | 196-201 | absent | `{ message: 'x' }` |
| not ok, JSON `"x"` | 196-201 | absent | `"x"` |
| not ok, core's envelope | 196-201 | absent | `{ error: { code, message } }` |
| ok, JSON | 183-194 | the parsed body | absent |

Middleware (lines 157-177): `onResponse` runs before any of the above; when it returns a value that value must be a `Response` and replaces the answer; the body is read only afterwards, from whatever was handed on. A rejected `fetch` (lines 122-155) rejects the call; `call()` already turns that into `unreachable`.

`apps/web/src` has one client (`api.ts:20`), with one middleware. Every use, and what it does today with a failed answer that has no envelope:

| Call site | Request | Today |
|---|---|---|
| `api.ts:49` `useMe` | `GET /me` | empty: returns `undefined`, TanStack Query 5 rejects it ("data is undefined"): error state by accident. Text: throws a string. Safe, not by design |
| `cart.ts:30` `cartOptions` | `GET /me/cart` | same as `useMe` |
| `cart-drawer.tsx:87` `ReplacedNotice` | `GET /stores/{id}` | same; shows "another store" |
| `catalog.ts:33` `serviceabilityOptions` | `GET /serviceability` | safe: own guard throws "answered without a store"; text throws a string |
| `catalog.ts:54` `useCategories` | `GET /stores/{id}/categories` | empty: `data.items` throws a `TypeError`; text: throws a string. Error state |
| `catalog.ts:71` `usePicked` | `GET /stores/{id}/products` | same as `useCategories` |
| `catalog.ts:90` `useProductFeed` | `GET /stores/{id}/products` | same as `useMe` |
| `catalog.ts:116` `useProduct` | `GET /stores/{id}/products/{slug}` | same as `useMe`; a bare 404 shows "Product not found" (status check, before and after) |
| `routes/account.tsx:23` `useAddresses` | `GET /me/addresses` | same as `useCategories` |
| `cart.ts:117` `setLine` | `PUT /me/cart/items` | safe: ignores `call`'s result, no `data` means refetch |
| `cart.ts:147` `clearCart` | `DELETE /me/cart` | **false success**: the cache is set to an empty cart, core's cart is intact |
| `cart.ts:171` `mergeGuestCart` | `PUT /me/cart/items` | safe: `error \|\| !answered.cart` counts as failed |
| `auth.ts:41`, `:45` `signIn`, `register` | `POST /auth/sign-in`, `/auth/register` | safe: no session, shows "Core answered without a session. Try again." |
| `auth.ts:49` `signOut` | `POST /auth/sign-out` | safe: result ignored by design |
| `routes/account.tsx:68` profile | `PATCH /me` | **false success**: "Saved" is shown |
| `routes/account.tsx:118`, `:119` `saveAddress` | `PATCH /me/addresses/{id}`, `POST /me/addresses` | **false success**: the dialog closes |
| `routes/account.tsx:166`, `:176` `rowAction` | `PATCH` (default), `DELETE /me/addresses/{id}` | **false success**: no banner |

Six writes report success for a failure. The reads fail, but with a string, a `TypeError` or TanStack's "data is undefined" instead of an `ApiError`.

## Decisions

### 1. One fix, in `authMiddleware.onResponse`

```ts
async onResponse({ response }) {
  if (response.status === 401) setToken(undefined)
  if (response.ok) return response
  const body: unknown = await response.clone().json().catch(() => undefined)
  if (isEnvelope(body)) return response
  return new Response(JSON.stringify({ error: unreachable }), {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
```

- `isEnvelope`: `error.code` and `error.message` are both strings. A private function or an inline expression in `api.ts`, not exported.
- Order matters: the 401 line stays first, so a bare 401 drops the token and then becomes `internal`.
- `response.ok` returns before any read: an ok answer (the common case) is never cloned or parsed by the middleware, and 204 stays empty. A failed answer is parsed twice, here and by `openapi-fetch`; error bodies are a few hundred bytes.
- The body is read from `response.clone()`: an enveloped failure is handed on as the same, unread object.
- The new `Response` carries only `Content-Type`. The original headers are not copied: a copied `Content-Length: 0` would send `openapi-fetch` down lines 179-181 and give `error: undefined` again.
- The message is the existing `unreachable` constant, moved above the middleware. No new copy.

### 2. `call()` gets no guard

`call()` sees only what `request()` resolves to, typed `{ error?: { error: ApiError } }`; it has no response to check. Widening that type to carry `response` would also change `rowAction` (`routes/account.tsx:125`) and `openSession` (`auth.ts:25`), which repeat it. The site has one client and the middleware is on it, so after Decision 1 a failed answer always reaches `call()` with `error.error` set. The scenario "Failed write reports an error" pins that join through a real `openapi-fetch` client.

Ceiling: a second client created without `authMiddleware` would bring the bug back. Create none; add a guard in `call()` when one is needed.

### 3. Tests: the middleware directly, and once through a real client

Seven tests call `authMiddleware.onResponse` with real `Response` values. One test builds `createClient<paths>({ baseUrl: 'http://localhost/api/core/v1', fetch: async () => new Response('', { status: 502 }) })`, adds `authMiddleware`, and runs `PATCH /me` through `call()`. The `fetch` option is the process boundary (the network); the function returns a real `Response`, no module is mocked, and `openapi-fetch`, the middleware and `call()` all run as shipped. That is a fake at the process boundary, which the repository rule allows. It is the only test that would catch a `Response` built so that `openapi-fetch` still yields a falsy `error` (the `Content-Length` trap above). The exported `api` is not given a `fetch` option: no product change for the test.

Red on `main`: tests 1, 2, 3, 5 and 8 below. Green on `main`, kept as pins: 4, 6, 7.

## Ceilings

- The original status text and body are dropped, not logged. Add logging when there is somewhere to send it.
- A non-envelope 4xx (a gateway's 404 or 413) is reported as `internal` with "Could not reach ShopperStop. Try again.", though core may have been reachable.
- The status is kept, so a status check ahead of the error check still acts on it: `useProduct` shows "Product not found" for a bare 404. Unchanged by this lane.
- A non-ok status that may not carry a body (304) makes `new Response` throw; the call then rejects, `call()` answers `unreachable` and a read goes to its error state. Browsers do not hand a 304 to `fetch` unless the request sets conditional headers, and the site sets none. No code for it.

## For web-P2-L4

- Every failed answer now reaches a call site as `{ error: { error: ApiError } }`; a non-envelope one has code `internal`. `response.status` is unchanged.
- Place the order through `call()` on the shared `api`, capture `data` the way `cart.ts:115-121` does, and treat `error || !data` as failure. Never create a second client.
- `internal` on `POST /orders` does not prove the order was not placed: a proxy can answer 502 after core committed. Re-read the cart or the orders before offering a blind retry.

## Files

`apps/web/src/api.ts`, `apps/web/src/api.test.ts`. Both in web.
