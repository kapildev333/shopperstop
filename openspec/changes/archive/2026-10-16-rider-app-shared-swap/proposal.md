## Why
`apps/rider` carries its own copy of the client plumbing that ui-P4-L2 (D46, D47) moved into `@shopperstop/ui/app`: the `openapi-fetch` clients with the bearer and 401 middleware and the envelope fix-up (`src/api.ts`), the `localStorage` token store (`src/session.ts`) and the time helpers `since`, `useSince`, `when` (`src/format.ts`). ui asked rider to drop its copies (`.claude/areas/ui.md` `## Requests`). One copy means one place to fix.

## What Changes
- `src/session.ts` becomes the shared `createTokenStore('shopperstop:rider-token')` (key unchanged, D29) with `getToken`, `setToken`, `clearToken` kept as one-line aliases so no importer changes. `getToken()` returns `undefined` instead of `null` when there is no token (internal; tests follow).
- `src/api.ts` builds `rider` with `createApiClient({ baseUrl, session, onUnauthorized })`, the router's clean-up passed through the existing `onUnauthorized(handler)` registration, and `core` with `createApiClient({ baseUrl })` (no session, so never a token). The local middleware and `withEnvelope` go.
- `src/format.ts` keeps only `itemCount`; `ready.tsx` and `routes/_rider/history.tsx` import `useSince` and `when` from `@shopperstop/ui/app`.
- Behaviour change, one: a failure answer whose envelope has a string `code` but no string `message` now reaches callers as `internal` (the shared rule, `design-system` "Failures without the error envelope become internal"); before, rider passed it through. Neither service sends such an answer.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `rider-app`: ADDED "Rider failure answers without an error envelope" (the rule rider already applied, never specified, now with the shared `message` check); MODIFIED "Rider lost session" (same text, plus the scenario "401 mid-session returns to sign-in", which pins the router clean-up passed as `onUnauthorized`).

## Impact
- Area: rider. Files: `apps/rider/src/{api,session,format,ready}.ts(x)`, `apps/rider/src/routes/_rider/history.tsx`, tests `apps/rider/src/{api,session,format}.test.ts`, `shell.test.tsx`, `sign-in.test.tsx`. No dependency or lockfile change: `openapi-fetch` 0.17.0 stays in `apps/rider/package.json` as the peer `@shopperstop/ui/app` needs.
- Contracts relied on: the `@shopperstop/ui/app` exports (`createTokenStore`, `createApiClient`, `since`, `useSince`, `when`) as specified in `openspec/specs/design-system`; `@shopperstop/ui/api` and `@shopperstop/ui/api/rider` types; the error envelope in `services/rider/openapi.json` and `services/core/openapi.json`.
- Out of scope: `itemCount` (stays in rider), the router (`router.ts` unchanged), the e2e suite (no page text or flow changes), any change in `packages/ui` or another app.
