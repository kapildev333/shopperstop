## Context
Read before designing (origin/main 49553f4): `apps/admin/src/{api,session,router,orders}.ts`, `apps/rider/src/{api,session,router,format}.ts`, `apps/web/src/{api,session,auth,orders}.ts`, `apps/mobile/src/{api,session}.ts`.

| Piece | admin | rider | web | mobile |
|---|---|---|---|---|
| client | `createClient` on `${location.origin}/api/core/v1` and `/api/rider/v1`, `fetch: (r) => globalThis.fetch(r)` | same; the core client has no token | same as admin | base URL from `EXPO_PUBLIC_CORE_URL` |
| token | every request, both clients | rider client only | both clients | core client |
| 401 | clears only when the request carried the current token, then calls a handler the router registers | same | clears on any 401, no handler (`useToken` re-renders) | current-token rule, no handler |
| no envelope | checks `error.code`; `Response.json`, message `The server did not answer as expected.` | same | checks `code` and `message`; `new Response`, only `Content-Type`; message `Could not reach ShopperStop. Try again.` | same as web |
| token store | `localStorage` `shopperstop:staff-token`, `null` when none, try/catch, no listeners | `shopperstop:rider-token`, same | `shopperstop:customer-token`, `undefined`, listeners and `useToken` | secure store (native) or `localStorage` (web export) |
| expiry | none in the app | none | none | none |
| time | `since`, `useSince`, `when` (Asia/Kolkata) in `orders.ts` | identical in `format.ts` | `formatWhen` (browser zone) | none |
| router | `createAppRouter`: QueryClient (+ 403 to the error boundary), basepath `/admin`, registers `onUnauthorized` | same without the 403 rule, `/rider` | plain `createRouter` | Expo Router |

Every row that two apps share is in this change; nothing only one app does is.

## Goals / Non-Goals
Goals: one copy of the client middleware, the `localStorage` token store and the admin/rider time helpers in `@shopperstop/ui/app`, with the apps' current tests' behaviour as scenarios. Non-goals: touching `apps/`; the router; the items in the proposal's out of scope.

## Decisions

### 1. One new entry, `@shopperstop/ui/app`, four small files
`src/app/session.ts`, `src/app/client.ts`, `src/app/time.ts`, and `src/app/index.ts` (re-exports only). `package.json` gains, after `./format`:

```json
"./app": { "types": "./dist/app/index.d.ts", "default": "./dist/app/index.js" },
```

`tsconfig.build.json` already compiles everything under `src` with `rootDir: src`, so `dist/app/` appears with no build change. Not added to the root entry `.`: the root pulls in the DOM components and Tailwind recipes; the app entry stays DOM-free and React-Native-safe (React is used only by `useSince`, through `useSyncExternalStore`).

### 2. Interfaces (exact)
```ts
// src/app/session.ts
export type TokenStore = {
  get(): string | undefined
  set(token: string | undefined): void
  subscribe(listener: () => void): () => void
}
export function createTokenStore(key: string): TokenStore

// src/app/client.ts
import createClient, { type Client } from 'openapi-fetch'
import type { TokenStore } from './session'
export type ApiClientOptions = {
  baseUrl: string
  session?: Pick<TokenStore, 'get' | 'set'>
  onUnauthorized?: () => void
  failureMessage?: string
}
export function createApiClient<Paths extends object>(options: ApiClientOptions): Client<Paths>

// src/app/time.ts
export function since(at: string, now: number): string
export const when: (at: string) => string
export function useSince(at: string): string

// src/app/index.ts
export * from './session'
export * from './client'
export * from './time'
```

`undefined` means "no token" (web and mobile already use it; admin and rider's `null` maps to it at their swap, `clearToken()` becomes `set(undefined)`). `session` takes any `{ get, set }` so mobile's secure store can pass its own functions without using `createTokenStore`.

### 3. Token store
Body is web's `session.ts` turned into a factory: `read()` once at creation inside `try` (a missing `localStorage`, as in React Native, throws `ReferenceError` and is caught: memory only); `set` assigns memory, calls each listener, then writes or removes inside `try`. `subscribe` adds to a `Set` and returns the delete. No `storage` event listener, no expiry.

### 4. Client and middleware
```ts
const client = createClient<Paths>({ baseUrl, fetch: (request) => globalThis.fetch(request) })
client.use({ onRequest, onResponse })
```
- `onRequest`: `const token = session?.get(); if (token) request.headers.set('Authorization', `Bearer ${token}`)`.
- `onResponse`: first the 401 rule (`response.status === 401`, `token = session?.get()`, `token && request.headers.get('Authorization') === `Bearer ${token}`` then `session.set(undefined)` and `onUnauthorized?.()`); then `if (response.ok) return response`; then `body = await response.clone().json().catch(() => undefined)`; enveloped when `typeof body?.error?.code === 'string' && typeof body?.error?.message === 'string'` (web's stricter check: callers show `message`); otherwise
  `new Response(JSON.stringify({ error: { code: 'internal', message: failureMessage ?? 'The server did not answer as expected.' } }), { status: response.status, headers: { 'Content-Type': 'application/json' } })`.
  `new Response` rather than `Response.json` (web's and mobile's form): works where `Response.json` is missing (older fetch polyfills), and setting only `Content-Type` avoids copying a `Content-Length: 0` that would make `openapi-fetch` drop the body again.
- The default message is admin's and rider's; web and mobile pass theirs. One message per client is all any app uses.
- A single middleware object per client (not shared between clients); admin's two clients sharing one session is two `createApiClient` calls with the same `session` and `onUnauthorized`.

### 5. Time helpers
Copied from `apps/rider/src/format.ts` byte for byte in behaviour (`since`, `everyFewSeconds` at 5 000 ms, `useSince`, the module-level `Intl.DateTimeFormat` for `when`). `itemCount` stays in the apps (different signatures).

### 6. `openapi-fetch` as a peer dependency
`"peerDependencies": { "openapi-fetch": "0.17.0", ... }` and `"devDependencies": { "openapi-fetch": "0.17.0", ... }` (alphabetical in each block). Peer, not dependency: the apps already pin 0.17.0 and npm keeps one hoisted copy, so `Client` types and middleware run against the app's copy. Installed with `npm install --workspace packages/ui --save-dev --save-exact openapi-fetch@0.17.0`, the peer line added by hand, then `npm install` at the root to settle `package-lock.json`; the lock diff touches only the `packages/ui` entry. This is a runtime import of `packages/ui`, so it needs the orchestrator's record (D10 covers dev tooling only).

### 7. Router: out of scope
`createAppRouter` in admin and rider is fifteen lines bound to each app's `routeTree.gen`, `RouteError`, basepath, query defaults and the `Register` module augmentation, which must name the app's own router type. Sharing it would make `@tanstack/react-router` and `@tanstack/react-query` runtime dependencies of `packages/ui` to save the three shared lines (`queryClient.clear(); void router.invalidate()` in `onUnauthorized`). Each app passes those three lines as `onUnauthorized`.

## Simplifications and ceilings
- No cross-tab sync (`storage` event): a sign-out in one tab leaves others holding the token until their next 401. Add a listener in `createTokenStore` when someone reports it.
- No client-side expiry: core and the rider service expire sessions (customer and rider 30 days sliding; staff per core); the client finds out through the 401 rule. Fine while every app asks the server on load.
- One `failureMessage` per client, not per status: no app distinguishes them today.
- `onUnauthorized` is fixed at creation; admin and rider register their handler after the client exists, so they pass `() => unauthorized()` over their own `let`. A setter can come if a third app needs late registration.

## Files
| Task | Files |
|---|---|
| 1 | `packages/ui/package.json`, `package-lock.json` (mechanical), `packages/ui/src/app/index.ts` (only `export * from './session'`), `packages/ui/src/app/session.ts`, `packages/ui/src/app/session.test.ts`, `packages/ui/src/app/package.test.ts` |
| 2 | `packages/ui/src/app/time.ts`, `packages/ui/src/app/time.test.tsx` |
| 3 | `packages/ui/src/app/client.ts`, `packages/ui/src/app/client.test.ts`, `packages/ui/src/app/index.ts` (adds the `client` and `time` lines), `packages/ui/src/app/index.test.ts` |

## Test strategy
Vitest in jsdom (the package default). `globalThis.fetch` is replaced with `vi.stubGlobal('fetch', vi.fn(async (request: Request) => ...))` after the client is created (proves the per-call lookup); this is the process boundary the apps' `fake-core.ts` also fakes. Blocked storage is `vi.spyOn(Storage.prototype, 'getItem' | 'setItem' | 'removeItem')` throwing. `useSince` uses `vi.useFakeTimers()` + `vi.setSystemTime`, `render` from Testing Library and `act(() => vi.advanceTimersByTime(60_000))`. `afterEach`: `localStorage.clear()`, `vi.restoreAllMocks()`, `vi.unstubAllGlobals()`, `vi.useRealTimers()`. The client tests type their client with `import type { paths } from '../api/core'` and use `GET /admin/me`. Test names are the scenario names in lower case (`client attaches the bearer token`).

## Risks
- The first `packages/ui` runtime import of a third-party fetch library: if an app ever moves off 0.17.0, npm will warn on the exact peer. All apps move together (one decision).
- Web's swap narrows its 401 rule (any 401 to current-token 401): its `web-app` requirement needs a MODIFIED delta in that lane.
