# Proposal

## Why
Spec 2 §5 and §7: a customer must be able to register, sign in, return to where they were, keep a name, phone and delivery addresses, and sign out. Checkout (web-P2-L4) needs a signed-in customer with addresses, and the cart merge (web-P2-L3) needs a sign-in moment. `apps/web` today is a shell with no API client at all.

## What Changes
- First API call in `apps/web`: `openapi-fetch` 0.17.0 `createClient<paths>({ baseUrl: '/api/core/v1' })` with one middleware that attaches `Authorization: Bearer <token>` and drops the token on a 401; `@tanstack/react-query` 5.104.2 for `GET /me` and `GET /me/addresses`. Both pins recorded here and in the area plan (allowed by the Phase 2 work package under D10).
- A session store: token in memory and in `localStorage` `shopperstop:customer-token`, subscribable from React. No cookies.
- `/sign-in` and `/register`: email and password forms (register adds name), client checks (required, password 8 to 72 bytes), field errors from the error envelope's `field`, everything else (wrong password, `rate_limited`, network) in an `ErrorBanner`; on success return to `returnTo` (same-origin paths only) or Home.
- Header: a `Sign in` link carrying the current location as `returnTo` when signed out; the customer's name linking to `/account` when signed in. Replaces nothing else in the header.
- `/account`: redirects to `/sign-in?returnTo=/account` when signed out; profile card (name, phone, Save); addresses card (list with Default badge, Edit, Set as default, Delete, Add address) with an add/edit `Dialog`; Sign out.
- Playwright: global setup runs `core-admin migrate` and `core-admin seed-demo --reset` on the e2e database (D22 demo customer); `e2e/accounts.spec.ts` covers register, sign-in with return, account edits, addresses, sign out, axe on every page and dialog visited.

Area: web. Capabilities touched: `web-app` (ADDED requirements only). Out of scope: guest cart merge at sign-in (web-P2-L3 hooks into the sign-in success path), the checkout add-address dialog (web-P2-L4 reuses `AddressDialog`), password reset and email verification (Spec 2 §14), cross-tab session sync, the pincode sheet and catalog (web-P2-L1), Figma changes (Sign in, Register and Account frames exist).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `web-app`: ADDED requirements "Customer session token", "Customer sign-in and register forms", "Customer return after sign-in", "Customer header account control", "Customer account page requires sign-in", "Customer address dialog", "Customer profile and sign out", "Customer address list".

## Impact
- Files: `apps/web/**` (listed in design.md) and this change folder; root `package-lock.json` changes mechanically on `npm install`.
- Cross-area contracts relied on:
  - core (`services/core/openapi.json`, through `@shopperstop/ui/api` `paths`): `POST /auth/register`, `POST /auth/sign-in` (→ `{token, customer}`), `POST /auth/sign-out`, `GET|PATCH /me`, `GET|POST /me/addresses`, `PATCH|DELETE /me/addresses/{id}`, the error envelope `{error: {code, message, field?}}`, 401 `unauthorized` on a missing or expired token, 429 `rate_limited`; `go run ./cmd/core-admin migrate` and `seed-demo --reset` (D22) with the `make e2e` environment. All from core-P2-L1 (`core-accounts-auth`).
  - ui: `@shopperstop/ui` `Button`, `ButtonLink`, `Badge`, `Card`, `Dialog`, `DialogFooter`, `EmptyState`, `ErrorBanner`, `FormField`, `Input`, `PageHeader`, `Skeleton`, `StatusMessage`; `@shopperstop/ui/api` types; tokens. No ui change.
  - platform: `make e2e` environment (core :18080, `shopperstop_core_e2e`, preview 15173).

## Requests to other areas
- core (core-P2-L1): (1) say whether `POST /auth/register` returns `{token, customer}` like sign-in; the design handles both, but returning the token saves a round trip. (2) Clearing optional text (`phone`, address `line2`): PATCH rejects `null` (Spec 2 §5), so this change sends `""` to clear; please accept `""` as "unset" and omit the field in responses, or say what to send. (3) Document 401 `unauthorized` for `/me*` with an expired or unknown token in `openapi.json` (the client drops the token on it). (4) Validation errors carry `field` with the JSON field name (`email`, `password`, `name`, `phone`, `label`, `line1`, `line2`, `pincode`).
