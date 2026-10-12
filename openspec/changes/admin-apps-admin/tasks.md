# Tasks

One task, one worker, on branch `lane/admin-P1-L1-apps-admin` in `.worktrees/admin-P1-L1`. Read `design.md`: it fixes every file, pin, class list and test. Commit order: `chore: apps/admin scaffold` (no test can run before the workspace exists), `test: admin shell, not found, proxy and axe` (red), `feat: admin shell and dashboard placeholder` (green on every gate).

Gates, from the worktree root, Node 22.12+ (D11): prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`.
`npm run build --workspace packages/ui` first, then `npm run lint --workspace apps/admin`, `npm run typecheck --workspace apps/admin`, `npm run test --workspace apps/admin -- --run`, `npm run build --workspace apps/admin`, and the e2e with the `make e2e` environment exported: `npm run e2e --workspace apps/admin`.

## 1. Admin app scaffold and shell

Scope: `apps/admin/**` (files listed in design.md "Files"), `openspec/changes/admin-apps-admin/tasks.md` (checkboxes), root `package-lock.json` (mechanical), the worker's lane log.
Scenarios: Admin shell › "Dashboard renders in the shell"; Unknown paths show not found › "Unknown path"; Served under /admin/ › "Built app opens under the prefix"; Core reached through a same-origin proxy › "Preview proxies to core"; End-to-end suite with axe › "Smoke pages pass axe"; design-system seed scenarios "Literal colour fails the gate" (admin) and "Axe on every e2e page" (admin).
Failing tests: `src/shell.test.tsx` › "dashboard renders in the shell", "unknown path"; `src/no-literal-colors.test.ts` › "no literal colours in src" (a guard, green from the start); `e2e/smoke.spec.ts` › "dashboard passes axe", "not found passes axe", "preview proxies to core" (the proxy test passes once the config exists; it is committed with the red tests because the config is test infrastructure).

- [ ] 1.1 Scaffold committed (`chore:`): `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `src/test-setup.ts`, `src/routes/__root.tsx` as `createRootRoute()` only, `src/routes/index.tsx` as `createFileRoute('/')({})` only, `src/routeTree.gen.ts` from `vite build`; `npm install` run; lint, typecheck and build green (no test file yet)
- [ ] 1.2 Tests committed red (`test:`): `src/no-literal-colors.test.ts`, `src/shell.test.tsx`, `playwright.config.ts`, `e2e/smoke.spec.ts`; Vitest shows the two shell tests failing, Playwright the two axe tests failing
- [ ] 1.3 Shell and Dashboard placeholder (`feat:`): `__root.tsx` and `index.tsx` per design.md; lint, typecheck, test (3 passed), build and e2e (3 passed) green; `git status` clean after the build (no `routeTree.gen.ts` drift)

## Workflow follow-up
- Team lead runs `/opsx:verify admin-apps-admin` after 1.3 lands.
- Area manager archives the change by PR after the feature PR merges.
