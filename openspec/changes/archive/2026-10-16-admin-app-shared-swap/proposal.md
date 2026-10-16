## Why
ui-P4-L2 (#296, D47) put the client plumbing every app copied into `@shopperstop/ui/app`: `createTokenStore(key)`, `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })` and the time helpers `since`, `useSince`, `when`. The admin app still carries its own copies in `apps/admin/src/session.ts`, `apps/admin/src/api.ts` (the `staffSession` middleware) and `apps/admin/src/orders.ts`. Swapping deletes about seventy lines and leaves one place to fix the session, envelope and time rules for all four apps. web (#302) and rider (#304) did the same.

## What Changes
- `apps/admin/src/session.ts`: the token store becomes `session = createTokenStore('shopperstop:staff-token')`; `getToken`, `setToken` and `clearToken` stay as one-line wrappers, so no importer changes. `getToken()` with no token returns `undefined` (the shared contract) instead of `null`; only tests compared with `null`.
- `apps/admin/src/api.ts`: `api` and `riderApi` become `createApiClient` with the staff session and `onUnauthorized: () => unauthorized()`; the `staffSession` middleware and the `openapi-fetch` import are deleted. `onUnauthorized(handler)` stays, so `router.ts` is untouched. The default failure message is admin's own ("The server did not answer as expected.").
- `apps/admin/src/orders.ts`: `since`, `useSince` and `when` are deleted; `order-board.tsx`, `order-sheet.tsx`, `order-history.tsx` and `orders-rules.test.ts` import them from `@shopperstop/ui/app`. `itemCount` and everything else admin-specific stays.
- **Behaviour change (narrow)**: a failed answer counts as core's error envelope only when `error.code` and `error.message` are both strings. Today a string `code` alone is enough. Core and the rider service always write both, so only foreign answers are affected; they now reach callers as `internal` like any other foreign failure.
- Unchanged: the 401 rule. Admin already ends the session only on a 401 to a request that carried the current token (admin-P2-L4); the shared client has the same rule.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `admin-app`: MODIFIED "Failure answers without core's error body" (names the envelope as `error.code` and `error.message`, both strings; new scenario "Envelope without a message"). "Staff session", "Lost session" and "Orders time since placed" keep their text: the swap keeps their behaviour.

## Impact
- Area: admin. Files: `apps/admin/src/{session,api,orders}.ts`, `apps/admin/src/{order-board,order-sheet,order-history}.tsx`, and the tests `apps/admin/src/{api,session,orders-rules}.test.ts`, `apps/admin/src/{shell,sign-in}.test.tsx`. Nothing outside `apps/admin/` and this change.
- Contracts relied on: the `@shopperstop/ui/app` exports (`createTokenStore`, `createApiClient`, `since`, `useSince`, `when`, on main since #296); the error envelope in `services/core/openapi.json` and `services/rider/openapi.json`.
- Unchanged: the storage key `shopperstop:staff-token`, the base URLs, the failure message, the router clean-up, `apps/admin/package.json` (admin keeps `openapi-fetch` 0.17.0: it satisfies ui's peer dependency, and the lockfile stays untouched).
- Out of scope: `itemCount` (also copied in rider; not in `@shopperstop/ui/app`), a `useToken` hook (admin has none and needs none), the router factory (ui-P4-L2 left it out), the e2e suite (no route, text or flow changes).
