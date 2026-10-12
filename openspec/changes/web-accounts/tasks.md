# Tasks

Three tasks, one worker each, run in order 1 → 2 → 3 (2 imports 1; 3 imports 1 and 2 and links to `/sign-in`, which must exist for the typed router). All start only after core-P2-L1 (`core-accounts-auth`) is on main and `packages/ui/src/api/core.d.ts` carries `/auth/*`, `/me` and `/me/addresses`. Read `design.md`: it fixes files, interfaces, copy and tests. Where the generated types differ from design.md, follow the types and note it in the lane log.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`: `npm install` (task 1 only), `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build (no `routeTree.gen.ts` drift), and for tasks 2 and 3 the e2e with the Makefile `E2E_ENV` exported: `CI=1 npm run e2e --workspace apps/web` (announce it to the manager first: one e2e at a time). `openspec validate web-accounts --strict`.

## 1. Session store and API client

Scope: `apps/web/package.json`, `apps/web/src/session.ts`, `apps/web/src/session.test.ts`, `apps/web/src/api.ts`, `apps/web/src/api.test.ts`, `apps/web/src/routes/__root.tsx` (provider only), `apps/web/src/test-setup.ts`, root `package-lock.json`, this file's checkboxes.
Scenarios: Customer session token › "Token persisted and cleared", "Token restored on load", "Bearer attached", "Expired session dropped".
Failing tests: `src/session.test.ts` › "token persisted and cleared", "token restored on load"; `src/api.test.ts` › "bearer attached", "expired session dropped".

- [x] 1.1 Pins added and installed (`chore: web client dependencies`): `@tanstack/react-query` 5.104.2, `openapi-fetch` 0.17.0, dev `@testing-library/user-event` 14.6.7
- [x] 1.2 Tests committed red (`test: customer session token`)
- [x] 1.3 `session.ts`, `api.ts`, provider in `__root.tsx`, `test-setup.ts` reset (`feat: customer session store and api client`); all gates green

## 2. Sign-in and register

Scope: `apps/web/src/auth.ts`, `apps/web/src/auth.test.ts`, `apps/web/src/auth-forms.tsx`, `apps/web/src/auth-forms.test.tsx`, `apps/web/src/routes/sign-in.tsx`, `apps/web/src/routes/register.tsx`, `apps/web/src/routeTree.gen.ts`, `apps/web/e2e/global-setup.ts`, `apps/web/e2e/auth.spec.ts`, `apps/web/playwright.config.ts` (`globalSetup` line only), this file's checkboxes.
Scenarios: Customer sign-in and register › "Required fields checked", "Short password on register", "Field error from the envelope", "Non-field error in a banner", "Unsafe returnTo ignored", "Register signs in", "Demo customer signs in", "Wrong password against core".
Failing tests: `src/auth-forms.test.tsx` › "required fields checked", "short password on register", "field error from the envelope", "non-field error in a banner"; `src/auth.test.ts` › "unsafe returnTo ignored"; `e2e/auth.spec.ts` › "register signs in", "demo customer signs in", "wrong password against core".

- [x] 2.1 Tests committed red (`test: sign-in and register`), with `e2e/global-setup.ts` and the `globalSetup` line (test infrastructure); a red test that cannot compile without the module is acceptable when the failure is "module not found"
- [ ] 2.2 `auth.ts` (`safeReturnTo`, `signIn`, `register`, `startSession`), `auth-forms.tsx`, the two routes (`feat: sign-in and register pages`); all gates green, e2e green

## 3. Account, addresses, header and sign out

Scope: `apps/web/src/account-link.tsx`, `apps/web/src/routes/__root.tsx` (banner right side only), `apps/web/src/routes/account.tsx`, `apps/web/src/address-dialog.tsx`, `apps/web/src/address-dialog.test.tsx`, `apps/web/src/account.test.tsx`, `apps/web/src/auth.ts` (`signOut` only), `apps/web/src/routeTree.gen.ts`, `apps/web/e2e/account.spec.ts`, this file's checkboxes.
Scenarios: Customer header account control › "Signed-out header", "Signed-in header"; Customer account page requires sign-in › "Signed-out account redirect"; Customer sign-in and register › "Sign in returns to where the customer was"; Customer address dialog › "Address dialog checks fields", "Address dialog shows envelope field error", "Edit dialog prefilled"; Customer profile and sign out › "Profile saved", "Sign out"; Customer address list › "Addresses and default", "Address edited and deleted".
Failing tests: `src/account.test.tsx` › "signed-out header", "signed-out account redirect"; `src/address-dialog.test.tsx` › "address dialog checks fields", "address dialog shows envelope field error", "edit dialog prefilled"; `e2e/account.spec.ts` › "sign in returns to where the customer was", "profile saved", "addresses and default", "sign out".

- [ ] 3.1 Tests committed red (`test: account, addresses and header`)
- [ ] 3.2 `account-link.tsx`, banner edit, `address-dialog.tsx`, `routes/account.tsx`, `signOut` (`feat: account page, addresses and header sign-in`); all gates green, e2e green, `shell.test.tsx` and `smoke.spec.ts` unchanged and green

## Workflow follow-up
- Team lead runs `/opsx:verify web-accounts` after 3.2 lands.
- Area manager archives the change by PR after the feature PR merges.
