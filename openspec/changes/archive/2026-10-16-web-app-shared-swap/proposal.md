## Why
ui-P4-L2 (#296, D47) put the client plumbing every app copied into `@shopperstop/ui/app`: `createTokenStore(key)` and `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })`. The customer site still carries its own copies in `apps/web/src/session.ts` and `apps/web/src/api.ts` (`authMiddleware`, `isEnvelope`, the storage-tolerant token store). Swapping to the shared ones deletes about sixty lines and leaves one place to fix the session and envelope rules for all four apps.

## What Changes
- `apps/web/src/session.ts`: the token store becomes `createTokenStore('shopperstop:customer-token')`; `getToken`, `setToken` and `useToken` keep their names and signatures, so no importer changes.
- `apps/web/src/api.ts`: `api` and `riderApi` become `createApiClient` with the web session and `failureMessage: 'Could not reach ShopperStop. Try again.'`; `authMiddleware` and `isEnvelope` are deleted. `unreachable`, `call`, `splitError`, `queryClient` and `useMe` stay.
- `apps/web/src/api.test.ts`: the tests drive the shipped `api` through the process-boundary fake `fetch` instead of calling the deleted middleware, and gain the stale-token case.
- **Behaviour change**: a 401 now clears the customer token only when it answers a request that carried the token held when the answer arrives. A 401 to a request sent with an older token (or none) leaves a newer session alone. Today any 401 clears it.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `web-app`: MODIFIED "Customer session token" (the 401 rule; scenario "Stale 401 keeps the newer session") and "Customer failed answers without the error envelope" (wording only: "the client" instead of "the response middleware", the bare-401 scenario names the request that carried the token).

## Impact
- Area: web. Files: `apps/web/src/session.ts`, `apps/web/src/api.ts`, `apps/web/src/api.test.ts`. Nothing outside `apps/web/` and this change.
- Contracts relied on: the `@shopperstop/ui/app` exports (`createTokenStore`, `createApiClient`, on main since #296); the error envelope in `services/core/openapi.json` and `services/rider/openapi.json`.
- Unchanged: the storage key `shopperstop:customer-token`, the base URLs (`${location.origin}/api/core/v1`, `/api/rider/v1`), the failure message, the 30-day sliding session (core owns expiry), every other web test, `apps/web/package.json` (web keeps `openapi-fetch` 0.17.0: it satisfies ui's peer dependency).
- Out of scope: the time helpers. Web has no copy of `since`/`useSince`/`when`: `formatWhen` uses the browser's time zone and stays (D47), `lastSeen` words its text differently ("Last seen 1 minute ago") and the countdown in `order-parts.tsx` counts down, not up; swapping any of them would change what the customer reads. `call`, `splitError` and `unreachable` stay in web (customer apps only). A cross-tab `storage` listener stays a ponytail note as today.
