## Why
`apps/admin`, `apps/rider` and `apps/web` (and `apps/mobile`) each carry their own copy of the same client plumbing: an `openapi-fetch` client on a same-origin base URL with `globalThis.fetch` looked up per call, a middleware that attaches the bearer token, ends the session on a 401 and turns a failure without the error envelope into an `internal` envelope, a `localStorage` token store that survives blocked storage, and (admin and rider) the "12 min ago" and "13 Oct 2026, 2:50 pm" time helpers. rider-P3-L3 found the copies; the orchestrator took it as D46. One shared copy in `@shopperstop/ui` lets the apps drop theirs in follow-up lanes.

## What Changes
- New entry `@shopperstop/ui/app` (`packages/ui/src/app/`), additive:
  - `createTokenStore(key)`: the token in memory, mirrored to `localStorage` under `key`, observable through `subscribe`; blocked storage leaves it in memory only.
  - `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })`: an `openapi-fetch` client with the shared middleware: bearer token while the session holds one; a 401 to a request that carried the current token clears the session and calls `onUnauthorized`; a not-ok answer without the error envelope becomes `{ error: { code: "internal", message } }` with its status kept.
  - `since(at, now)`, `useSince(at)`, `when(at)`: the admin and rider time helpers, unchanged in output.
- `packages/ui/package.json`: `exports["./app"]`; `openapi-fetch` 0.17.0 as a peer dependency (the version every app pins) and as a dev dependency for the tests and the build. Root `package-lock.json` changes mechanically with it.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `design-system`: ADDED "App token store", "App API client", "Session ends only on a 401 to the current token", "Failures without the error envelope become internal", "Relative and stamped times", "App entry".

## Impact
- Area: ui. Files: `packages/ui/src/app/{index,session,client,time}.ts` and their tests, `packages/ui/package.json`; root `package-lock.json` (mechanical, from `npm install`).
- Contracts relied on: the error envelope `{ error: { code, message, field? } }` that `services/core/openapi.json` and `services/rider/openapi.json` both define; `openapi-fetch` 0.17.0 as pinned by every app. New contract: the `@shopperstop/ui/app` exports.
- Consumers (follow-up lanes in their areas, not this change): admin, rider and web swap their `api.ts`, `session.ts` and (admin, rider) time helpers; mobile may use `createApiClient` and the time helpers.
- Behaviour note for web's swap: web's spec today clears the token on any 401; the shared client clears it only on a 401 to the current token (admin, rider and mobile already do). Web's swap lane modifies its `web-app` requirement.
- Out of scope: anything in `apps/`; the router factory (`createAppRouter`: it binds each app's generated `routeTree`, error component, basepath and the `Register` augmentation, and would make `@tanstack/react-router` and `@tanstack/react-query` runtime dependencies of `packages/ui` for about fifteen lines); web and mobile's `call`, `splitError` and `unreachable` (customer apps only, not asked); `itemCount` (admin and rider differ in signature); web's `formatWhen` (browser time zone, differs from `when`); a `useToken` hook (one line over `subscribe`); token expiry (core and the rider service own it: sliding 30 days for customers, staff and rider rules server-side; the client learns of an expired token only through the 401 rule); `formatInr` (already at `@shopperstop/ui/format`).
