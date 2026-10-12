# Tasks

One task, one worker, on branch `lane/web-P1-L1-apps-web` in `.worktrees/web-P1-L1`. Read `design.md`: it fixes every file, pin, class list and test. Commit order: `chore: apps/web scaffold` (no test can run before the workspace exists), `test: web shell, not found, proxy and axe` (red), `feat: web shell and home placeholder` (green on every gate).

Gates, from the worktree root, Node 22.12+ (D11): prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`.
`npm run build --workspace packages/ui` first, then `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, and the e2e with the `make e2e` environment exported: `CI=1 npm run e2e --workspace apps/web`.

## 1. Web app scaffold and shell

Scope: `apps/web/**` (files listed in design.md "Files"), `openspec/changes/web-apps-web/tasks.md` (checkboxes), root `package-lock.json` (mechanical), the worker's lane log `.claude/lanes/web-P1-L1-T1.md`.
Scenarios: Customer site shell › "Home renders in the shell"; Customer site not found › "Unknown customer path"; Customer site served at the root › "Built app opens at the root", "Not-found link returns home"; Customer site reaches core through a same-origin proxy › "Web preview proxies to core"; Customer site end-to-end suite with axe › "Customer smoke pages pass axe"; design-system seed scenarios "Literal colour fails the gate" (web) and "Axe on every e2e page" (web).
Failing tests: `src/shell.test.tsx` › "home renders in the shell", "unknown customer path"; `src/no-literal-colors.test.ts` › "no literal colours in src" (a guard, green from the start); `e2e/smoke.spec.ts` › "home passes axe", "not found passes axe", "not found link returns home", "web preview proxies to core" (the proxy test passes once the config exists; it is committed with the red tests because the config is test infrastructure).

- [x] 1.1 Scaffold committed (`chore:`): `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `index.html`, `src/main.tsx`, `src/index.css`, `src/test-setup.ts`, `src/routes/__root.tsx` as `createRootRoute()` only, `src/routes/index.tsx` as `createFileRoute('/')({})` only, `src/routeTree.gen.ts` from `vite build`; root `npm install` run; lint, typecheck and build green (no test file yet)
- [x] 1.2 Tests committed red (`test:`): `src/no-literal-colors.test.ts`, `src/shell.test.tsx`, `playwright.config.ts`, `e2e/smoke.spec.ts`; Vitest shows the two shell tests failing, Playwright the three page tests failing
- [ ] 1.3 Shell and Home placeholder (`feat:`): `__root.tsx` and `index.tsx` per design.md; lint, typecheck, test (3 passed), build and e2e (4 passed) green; `git status` clean after the build (no `routeTree.gen.ts` drift)

## Workflow follow-up
- Team lead runs `/opsx:verify web-apps-web` after 1.3 lands.
- Area manager archives the change by PR after the feature PR merges.
