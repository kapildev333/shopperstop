# Tasks

Branch `lane/admin-P2-L1-admin-auth-nav` in `.worktrees/admin-P2-L1`. Read `design.md`: it fixes every file, pin, code shape and test name; a worker who finds a design choice still open stops and reports. Tasks run in order on the one branch (each builds on the previous one's files; `routeTree.gen.ts` changes in tasks 2 and 3). No worker starts before task 0 is ticked: core-P2-L1 must be on origin/main with the regenerated `packages/ui/src/api/core.d.ts` (D19), and the branch rebased on it by the manager.

Gates, from the worktree root, Node 22.12+ (D11): prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`. `npm run build --workspace packages/ui` first, then `npm run lint --workspace apps/admin`, `npm run typecheck --workspace apps/admin`, `npm run test --workspace apps/admin -- --run`, `npm run build --workspace apps/admin` (then `git status` shows no `routeTree.gen.ts` drift), and `openspec validate admin-auth-nav --strict`. Task 4 adds the e2e (one `make e2e` at a time across managers; the manager announces it).

## 0. Recheck the design against core (team lead)
Scope: `openspec/changes/admin-auth-nav/**`, `.claude/lanes/admin-P2-L1.md`. No test: a document check.
- [x] 0.1 Diff design.md "Assumptions" A1 to A10 and "Core contract facts" against the regenerated `packages/ui/src/api/core.d.ts`, `services/core/openapi.json` and the core-P2-L1 lane log on origin/main; update design.md, the spec delta and these tasks where they differ; `openspec validate admin-auth-nav --strict` passes; record the result in the lane log

## 1. Session and typed client
Scope: `apps/admin/package.json`, `apps/admin/src/session.ts`, `apps/admin/src/api.ts`, `apps/admin/src/fake-core.ts`, `apps/admin/src/session.test.ts`, `apps/admin/src/api.test.ts`, root `package-lock.json` (mechanical), this file's checkboxes, the worker's lane log.
Scenarios: Staff session › Token kept in memory and storage, Token survives a reload, Blocked storage keeps the token in memory, Bearer token attached; Lost session › 401 clears the session, 401 without a session changes nothing; Core reached through a same-origin proxy › Client calls the page's origin.
Failing tests: `src/session.test.ts` › "token is kept in memory and localStorage", "token survives a reload", "clear removes the token from memory and storage", "blocked storage keeps the token in memory"; `src/api.test.ts` › "client attaches the bearer token", "401 with a session clears it and reports the loss", "401 without a session reports nothing".
- [x] 1.1 Dependencies committed (`chore: admin client dependencies`): `npm install -E --workspace apps/admin openapi-fetch@0.17.0 @tanstack/react-query@5.104.2` and `npm install -E -D --workspace apps/admin @testing-library/user-event@14.6.7`; existing gates green
- [x] 1.2 Tests committed red (`test: staff session storage and bearer client`): the two test files and `src/fake-core.ts` per design.md; Vitest shows them failing (modules missing)
- [x] 1.3 `src/session.ts` and `src/api.ts` per design.md (`feat: staff session and typed core client`); every gate green

## 2. Protected routes, role nav, not found, sign-out
Scope: `apps/admin/src/router.ts`, `src/route-error.tsx`, `src/render-app.tsx`, `src/main.tsx`, `src/nav.ts`, `src/not-found.tsx`, `src/routes/__root.tsx`, `src/routes/_staff.tsx`, `src/routes/_staff/**`, `src/routes/index.tsx` (moved to `src/routes/_staff/index.tsx`), `src/routes/sign-in.tsx` (stub only), `src/routeTree.gen.ts` (generated), `src/shell.test.tsx`, this file's checkboxes, the worker's lane log.
Scenarios: Admin shell › Dashboard renders in the shell, Current section stays marked on a sub-page; Unknown paths show not found › Unknown path; Protected routes › Signed-out deep link, Unknown path signed out; Role-based navigation › Admin sees every section, Store staff see their sections; Wrong-role deep link shows not found › Store staff open an admin page, A 403 from core shows not found, Admin opens an admin page; Lost session › Expired session on load, Core unreachable on load; Sign-out › Sign out ends the session.
Failing tests (`src/shell.test.tsx`, rewritten): "dashboard renders in the shell", "unknown path", "admin sees every section", "store staff see dashboard, orders and stock", "signed-out deep link goes to sign-in with the path", "store staff deep link to an admin page shows not found in the shell", "a 403 from core shows not found, not sign-in", "admin opens an admin page", "expired session on load returns to sign-in", "core unreachable on load shows a retry", "sign out ends the session".
- [x] 2.1 Tests committed red (`test: protected routes, role nav, not found and sign-out`): `src/shell.test.tsx` rewritten per design.md "Tests" and `src/render-app.tsx`; Vitest shows `shell.test.tsx` failing (`./router` does not exist yet), task 1's tests still green
- [x] 2.2 Routes per design.md (`feat: protected routes, role-based nav and sign-out`): `router.ts`, `route-error.tsx`, `main.tsx`, `nav.ts`, `not-found.tsx`, `__root.tsx`, `_staff.tsx`, `_staff/_admin.tsx`, Dashboard moved, the six placeholders, the `sign-in.tsx` stub; `routeTree.gen.ts` regenerated by `npm run build --workspace apps/admin`; every gate green

## 3. Sign-in form
Scope: `apps/admin/src/api.ts`, `src/api.test.ts` (3.1 and 3.2 only), `apps/admin/src/routes/sign-in.tsx`, `src/sign-in.test.tsx`, `src/routeTree.gen.ts` (generated, if it changes), this file's checkboxes, the worker's lane log.
Scenarios: Lost session › 401 without a session changes nothing (amended), 401 to a replaced token keeps the new session; Staff sign-in › Sign-in form is labelled, Empty fields are flagged, Submit disabled while pending, Return to the page after sign-in, Outside redirect ignored; Sign-in errors › Wrong credentials or inactive staff, Rate limited, Any other error, Core unreachable, Field validation from core.
Failing tests: `src/api.test.ts` › "a 401 to a signed-out request keeps a session set meanwhile" (replaces "401 without a session reports nothing"), "a 401 to a replaced token keeps the new session"; `src/sign-in.test.tsx`: "sign-in form has labelled fields and one h1", "empty fields are flagged without a request", "%s shows an error banner" (rows: wrong credentials, rate limited, any other error, network error), "validation error is shown on its field", "submit is disabled while signing in", "success stores the token and returns to the redirect", "an outside redirect is ignored".
- [x] 3.1 401 tests committed red (`test: 401 handling keys on the request's bearer header`): the two `api.test.ts` tests per design.md "Tests"; Vitest shows both failing against task 1's `onResponse`
- [x] 3.2 `onResponse` per design.md's `src/api.ts` block (`fix: 401 handling keys on the request's bearer header`); every gate green
- [x] 3.3 Tests committed red (`test: staff sign-in form states`); Vitest shows them failing against the stub
- [x] 3.4 The form per design.md (`feat: staff sign-in form`); every gate green

## 4. Review follow-ups and sign-in e2e against core
Scope: `apps/admin/src/shell.test.tsx`, `src/sign-in.test.tsx`, `src/routes/sign-in.tsx`, `src/routes/__root.tsx`, `src/routeTree.gen.ts` (must not change), `apps/admin/playwright.config.ts`, `apps/admin/e2e/global-setup.ts` (new), `apps/admin/e2e/auth.spec.ts` (new), `apps/admin/e2e/smoke.spec.ts`, this file's checkboxes, the worker's lane log.
Waits on: core-P2-L1 on main (done, ba69715) and, for 4.4 and 4.5 only, the e2e slot the manager holds (one `make e2e` at a time).
Scenarios:
- Unit follow-ups from the task 2 and 3 reviews: Sign-out › Sign out ends the session (amended: no cached core answer remains); Staff sign-in › Outside redirect ignored (amended: backslash form); Admin shell › Current section stays marked on a sub-page (refactor guard).
- e2e: Served under /admin/ › Built app opens under the prefix; Sign-out › Sign in, dashboard, sign out against core; End-to-end suite with axe › Smoke pages pass axe, Suite seeds its own data; Sign-in errors › Wrong credentials or inactive staff (against core).
Failing tests:
- `src/sign-in.test.tsx` › "an outside redirect is ignored: %s": the `%2F%5Cevil.example` row is red.
- `src/shell.test.tsx` › "sign out ends the session" gains a cache assertion. It passes against the current code because it guards the existing `queryClient.clear()`; record in the lane log that removing `clear()` turns it red, then restore.
- `e2e/auth.spec.ts` › "admin signs in, reloads and signs out" and "wrong password shows the error".
- [x] 4.1 Unit tests committed (`test: backslash redirect ignored, sign-out drops cached data`):
  - "an outside redirect is ignored" becomes `test.each([['%2F%2Fevil.example'], ['%2F%5Cevil.example']])('an outside redirect is ignored: %s', ...)`, with the old body using the row as the `redirect` value.
  - "sign out ends the session" gets `expect(router.options.context.queryClient.getQueryCache().getAll()).toEqual([])` as its last line. It checks the whole cache, not only `['admin','me']`, so the page lanes' cached data is covered too.
  - Vitest shows only the backslash row failing.
- [x] 4.2 `safeRedirect` per design.md (`fix: reject a backslash redirect`): `typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : undefined`, with the comment as in design.md. Vitest 31 passed; every unit gate green.
- [x] 4.3 Drop `activeOptions={{ exact: link.to === '/' }}` from the nav `Link` in `__root.tsx` (`refactor: nav links use the router's default active match`). TanStack's default already matches `/` exactly; "admin opens an admin page" guards it. Vitest 31 passed; every unit gate green.
- [x] 4.4 e2e tests committed (`test: admin sign-in flow against core with axe`): `e2e/auth.spec.ts` per design.md "End-to-end", and "dashboard passes axe" deleted from `e2e/smoke.spec.ts`. Run once before the global setup exists, against an e2e database the seed has not reached, and record the result; if the database is already seeded and the run is green, record that and why.
- [ ] 4.5 Global setup (`feat: admin e2e seeds its own data`): `e2e/global-setup.ts` per design.md and `globalSetup: './e2e/global-setup.ts'` in `playwright.config.ts`. The setup runs core's e2e seed command (core-P2-L1 lane log; it is what `make e2e` runs), the two `go run ./cmd/core-admin` commands, in `services/core` with the environment Playwright was given:
  `cd services/core && SHOPPERSTOP_CORE_DATABASE_URL='postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_e2e?sslmode=disable' SHOPPERSTOP_CORE_ADDR=':18080' SHOPPERSTOP_CORE_SESSION_PEPPER='e2e-pepper-e2e-pepper-e2e-pepper-00' SHOPPERSTOP_CORE_FILES_DIR="$PWD/data/e2e-files" SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174' sh -c 'go run ./cmd/core-admin migrate && go run ./cmd/core-admin seed-demo --reset'`
  Then, with the same five `SHOPPERSTOP_CORE_*` variables exported and after `npm run build --workspace packages/ui` and `npm run build --workspace apps/admin`, `CI=1 npm run e2e --workspace apps/admin` gives **4 passed**: auth "admin signs in, reloads and signs out" and "wrong password shows the error"; smoke "not found passes axe" and "preview proxies to core".

## Workflow follow-up
- Team lead runs `/opsx:verify admin-auth-nav` after task 4 lands: every scenario mapped in design.md "Tests" has a passing test, every task ticked, nothing extra in `git diff origin/main...HEAD`.
- Area manager archives the change by PR after the feature PR merges.
