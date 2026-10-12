# admin-P2-L1 task 2 - protected routes, role nav, not found and sign-out (OpenSpec change admin-auth-nav, tasks 2.1 and 2.2)
Status: done
## Doing
Task 2 landed on `lane/admin-P2-L1-admin-auth-nav`: `test: protected routes, role nav, not found and sign-out` (red), then `feat: protected routes, role-based nav and sign-out` with the regenerated `routeTree.gen.ts` and the tick. Gates green. Awaiting reviewer. Task 3 (sign-in form) not started.
## Found
- Commit 1 (red): `shell.test.tsx` (11 tests) and `render-app.tsx`; the import of `./router` failed, so Vitest ran no test in `shell.test.tsx`; task 1's tests stayed green.
- `router.ts` exports `createAppRouter(history?)`; no history means basepath `/admin` (the app), a history means no basepath (tests). `render-app.tsx` returns the router so tests read `router.state.location`.
- Route tree: `_staff` (guard, `beforeLoad` loads `meQuery`), `_staff/_admin` (role rule, store staff get `NotFound` in the shell), `_staff/index` (Dashboard), placeholders `orders`, `stock`, `_admin/stores/`, `_admin/products/`, `_admin/categories`, `_admin/staff`. `sign-in.tsx` is the stub with `validateSearch`.
- Shell reads the staff member from the `_staff` match, so the name, Sign out and nav show only on protected pages.
- Per design.md, no deviations in code. Test names: as the brief, except "admin opens an admin page" also asserts the Stores link carries `aria-current` and Dashboard does not (the "Current section stays marked" scenario, which the brief lists without its own test name).
- Node 22.23.3 via the PATH prefix. Vitest prints `Not implemented: Window's scrollTo() method` (jsdom, from router scroll restoration on navigation). Noise only; the tests pass. Not silenced here (no design decision for it).
- Store staff `/stores` shows not found inside the shell with the three-link nav; admin `/stores` shows the Stores placeholder.
## Requests
- to admin-P2-L1 (team lead): none.
## Blockers
(none)
## Red output (commit 1, `npm run test --workspace apps/admin -- --run` before `./router` exists)
```
 ❯ src/shell.test.tsx (0 test)
 FAIL  src/shell.test.tsx [ src/shell.test.tsx ]
Error: Failed to resolve import "./router" from "src/render-app.tsx". Does the file exist?
 Test Files  1 failed | 3 passed (4)
      Tests  8 passed (8)
```
## Gates (commit 2, Node v22.23.3)
- `npm run build --workspace packages/ui`: exit 0
- `npm run lint --workspace apps/admin`: exit 0
- `npm run typecheck --workspace apps/admin`: exit 0
- `npm run test --workspace apps/admin -- --run`: 4 files, 19 tests passed, exit 0
- `npm run build --workspace apps/admin`: exit 0; a second build leaves `routeTree.gen.ts` unchanged
- `openspec validate admin-auth-nav --strict`: "Change 'admin-auth-nav' is valid"
