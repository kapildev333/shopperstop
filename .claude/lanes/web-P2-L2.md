# web-P2-L2 - web-accounts: sign-in, register, account and addresses (team lead)
Status: started
## Doing
T3 (account, addresses, header, sign out): red `e201ca4`, feat committed; gates and e2e green; awaiting review.
## Found
- 2026-10-12: core manager: core-P2-L1 (`core-accounts-auth`) owns `/auth/*`, `/me` and `/me/addresses` CRUD; this lane waits on that single merge. It also seeds the demo customer `demo@shopperstop.local` / `demo12345` via `core-admin seed-demo --reset` (D22); the web Playwright global setup runs `core-admin migrate` and `seed-demo --reset` on the e2e database.
- `packages/ui/src/api/core.d.ts` on 5101344 has only `/healthz` and `/readyz`; no core-P2-L1 commits yet.
- Overlap with web-P2-L1 (`web-serviceability-catalog`): both need the typed client, `QueryClientProvider` and the header in `src/routes/__root.tsx`. This change owns `src/api.ts` (client, `queryClient`, error split) and `src/session.ts`; L1 should import them. The header gets one `<AccountLink />` line here.
- `make e2e` already runs `core-admin migrate` and `seed-demo --reset` before all suites; the web `e2e/global-setup.ts` repeats them so web starts fresh after admin's suite and `npm run e2e` works alone.
- Pins: `@tanstack/react-query` 5.104.2, `openapi-fetch` 0.17.0, dev `@testing-library/user-event` 14.6.7.
- 2026-10-12 T1 (worker, Haiku): red before code, `npm run test --workspace apps/web -- --run src/session.test.ts src/api.test.ts`:
  ```
  FAIL  src/api.test.ts [ src/api.test.ts ]
  Error: Failed to resolve import "./api" from "src/api.test.ts". Does the file exist?
  FAIL  src/session.test.ts [ src/session.test.ts ]
  Error: Failed to resolve import "./session" from "src/session.test.ts". Does the file exist?
  Test Files  2 failed (2)
       Tests  no tests
  ```
- T1 deviation: brief said workers run on current main, so `paths` has only `/healthz` and `/readyz`. `api.GET('/me')` would not type-check, so `useMe` is not in T1; it lands with the header in T3 (where `/me` is first used). `call`, `splitError`, `ApiError` are in T1 as designed; T2 consumes them.
- T1 was started before core-P2-L1 is on main, per the orchestrator's D21 course correction; the blocker below is superseded for T1 only.
- 2026-10-12 review fix T1 (worker, Haiku): session store read `localStorage` at load and in `setToken` without a guard; blocked or full storage threw and stopped listeners. Red: `test: session tolerates blocked storage` (7488b5a) failed with SecurityError from `session.ts`. Fix: guarded `read()`, `setToken` sets the token and notifies before the guarded write. Token then lives in memory only when storage is blocked.
- 2026-10-12 T2 (worker, Haiku): red `test: sign-in and register` (1ab276c). `npx vitest --run src/auth-forms.test.tsx src/auth.test.ts`:
  ```
  FAIL  src/auth-forms.test.tsx [ src/auth-forms.test.tsx ]
  Error: Failed to resolve import "./auth-forms" from "src/auth-forms.test.tsx". Does the file exist?
  FAIL  src/auth.test.ts [ src/auth.test.ts ]
  Error: Failed to resolve import "./auth" from "src/auth.test.ts". Does the file exist?
  Test Files  2 failed (2)
       Tests  no tests
  ```
- T2 deviations from design.md, all following the generated types (`packages/ui/src/api/core.d.ts`):
  - `POST /auth/register` answers 201 with `CustomerSession` (`{token, customer}`) and `POST /auth/sign-in` answers 200 the same, so `register` has no "signIn after register" fallback. Both go through one `openSession` helper in `auth.ts`, which keeps `call`'s envelope handling.
  - `GET /me` answers `Customer` directly; `AddressList` wraps addresses in `items` (T3 `useAddresses` returns `data.items`).
  - Core's sign-in 401 message is lowercase `wrong email or password`; the alert shows core's text as received, and the e2e matches it case-insensitively.
  - `src/api.ts` needed no change: `call`'s parameter type compiles against the real `paths` (typecheck green).
  - Added `searchReturnTo` (the `validateSearch` for both routes) to `auth.ts`, so the two routes share one definition.
  - Name and email are trimmed before submit; the password is sent as typed (the contract says not trimmed).
  - Post-success navigation uses `navigate({ href: safeReturnTo(returnTo), replace: true })`; it type-checks in router 1.170.
- T2 gates green: lint, typecheck, 13 unit tests, build (tree clean after it), `openspec validate web-accounts --strict`. The "Not implemented: Window's scrollTo()" lines come from the existing `shell.test.tsx` alone, not from T2. e2e `CI=1 npm run e2e --workspace apps/web`: 7 passed (4 smoke, 3 auth); global setup ran `migrate` and `seed-demo --reset` on `shopperstop_core_e2e`.

- 2026-10-12 T3 (worker, Haiku): red `test: account, addresses and header` (e201ca4). `npm run test --workspace apps/web -- --run src/account.test.tsx src/address-dialog.test.tsx`:
  ```
  FAIL  src/address-dialog.test.tsx [ src/address-dialog.test.tsx ]
  Error: Failed to resolve import "./address-dialog" from "src/address-dialog.test.tsx". Does the file exist?
  FAIL  src/account.test.tsx > signed-out header
  TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Sign in"
  FAIL  src/account.test.tsx > signed-out account redirect
  TestingLibraryElementError: Unable to find role="heading" and name "Sign in"
  Test Files  2 failed (2)
       Tests  2 failed (2)
  ```
  E2e `CI=1 npx playwright test e2e/account.spec.ts` (real core on :18080): 4 failed (sign in returns, profile saved, addresses and default, sign out), all on missing UI.
- T3 deviations from design.md, all following the generated types or fixing a race:
  - Sign out navigates to `/` before `signOut()`, not after: dropping the token while `/account` is mounted re-renders its guard into a redirect to sign-in, which raced the navigation to `/`.
  - The default badge is `variant="accent"`, not `success`: success is a status colour and "Default" is not a status.
  - List load errors show fixed text ("Could not load your addresses.") with Try again, not the envelope message: the query error is not typed as the envelope.
  - `useAddresses` returns `data.items` (`AddressList` wraps in `items`); first page only (the API default of 24), marked `ponytail:` in the route.
  - Address form is an inner `AddressForm` mounted only while the dialog is open, so each open starts from fresh defaults.
  - Row actions and the dialog share `call` from `src/api.ts`; the dialog keeps its own `ApiError` banner through `splitError`.
  - e2e `global-setup.ts` guard lives in the red commit (test infrastructure): refuses unless `SHOPPERSTOP_CORE_DATABASE_URL` names an `_e2e` database.
- T3 gates green: `npm run build --workspace packages/ui`; `npm run lint --workspace apps/web` (clean); `npm run typecheck --workspace apps/web` (clean); `npm run test --workspace apps/web -- --run` (8 files, 18 tests); `npm run build --workspace apps/web` (tree clean after it, routeTree regenerated and committed); `openspec validate web-accounts --strict` valid; e2e `CI=1 npm run e2e --workspace apps/web`: 11 passed (smoke 4, auth 3, account 4), global setup ran `migrate` and `seed-demo --reset` on `shopperstop_core_e2e`.

## Requests
- to core (core-P2-L1, via the web area plan): (1) does `POST /auth/register` return `{token, customer}`? (design handles both); (2) accept `""` to clear `phone` and address `line2` on PATCH, omit them in responses when unset; (3) document 401 `unauthorized` on `/me*` for an expired or unknown token; (4) validation `field` uses the JSON field name.
- to web-P2-L1 (via the manager): import `api`, `queryClient`, `call`, `splitError` from `apps/web/src/api.ts` and the session from `src/session.ts` instead of a second client.
## Blockers
- Workers blocked until core-P2-L1 merges and `packages/ui/src/api/core.d.ts` on main carries `/auth/*`, `/me`, `/me/addresses`.
