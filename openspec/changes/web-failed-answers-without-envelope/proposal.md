# web-failed-answers-without-envelope

## Why

A lead from the admin area (`.claude/areas/admin.md`, Requests, "to web", 2026-10-13), confirmed for web against `openapi-fetch` 0.17.0: a failed answer whose body is not core's error envelope reaches the call site with a falsy or shapeless `error`.

- Empty body (the dev and preview proxy's 502 when core is down): `error` is `""`, or `undefined` with `Content-Length: 0`.
- HTML or other text (a gateway's error page): `error` is that string.
- JSON that is not the envelope: `error` is that value, with no `.error`.

`apps/web/src/api.ts` › `call()` returns `error?.error`, which is `undefined` in all three cases, so a failed write reports success: "Saved" on the profile, the address dialog closes, the cart is shown emptied, a row action shows no banner. Reads end in the error state only by accident (TanStack Query rejects `undefined` data). It has to be right before checkout: an order placement that fails this way must not show "order placed".

## What Changes

- The client's response middleware in `apps/web/src/api.ts` hands a failed answer without the envelope on as one with the same status and `{"error":{"code":"internal","message":"Could not reach ShopperStop. Try again."}}`. Every call site then sees a failure, with no change to any call site.
- A failed answer with the envelope, and every ok answer (204 included), is handed on untouched.
- The 401 rule is unchanged: the token is dropped for a bare 401 as for an enveloped one.

Area: web. Out of scope: every call site and every page, `call()` itself, `packages/ui`, core, admin (fixed there by `admin-stock` task 3b), e2e, any logging of the dropped body.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: one ADDED requirement, "Customer failed answers without the error envelope". "Customer session token" is not modified: its 401 sentence still holds as written.

## Impact

- `apps/web/src/api.ts` (the `onResponse` of `authMiddleware`; the `unreachable` constant moves above it), `apps/web/src/api.test.ts` (eight tests added).
- Cross-area contracts relied on, unchanged: `services/core/openapi.json` › `Error` schema (`error.code`, `error.message`, optional `error.field`) through `@shopperstop/ui/api`; `openapi-fetch` 0.17.0's middleware contract (`onResponse` may return a new `Response`).
- web-P2-L4 (`web-checkout-orders`) builds on this: see design.md, "For web-P2-L4".
