# admin-P1-L1-T1 - apps/admin scaffold, shell and dashboard placeholder (tasks 1.1 to 1.3)
Status: done
## Doing
Tasks 1.1 to 1.3 landed (scaffold, red tests, shell and dashboard placeholder); gates green, routeTree.gen.ts stable.
## Found
- Pinned typescript 5.9.3 (orchestrator override of design.md's 6.0.3, PLAN.md D18).
- Red run (Vitest): "dashboard renders in the shell" and "unknown path" fail, the root route renders nothing; "no literal colours in src" passes (guard).
- Red run (Playwright, CI=1): "dashboard passes axe" and "not found passes axe" fail on the missing heading; "preview proxies to core" passes against the real core on 18080.
## Requests
- to admin (area manager): none yet.
## Blockers

## Red output (commit 2)
Vitest (\`npm run test --workspace apps/admin -- --run\`): 2 failed | 1 passed (3)
- FAIL src/shell.test.tsx > dashboard renders in the shell: TestingLibraryElementError: Unable to find role="heading" and name "Dashboard" (body renders an empty div)
- FAIL src/shell.test.tsx > unknown path: Unable to find role="heading" and name "Page not found" (router default text "Not Found")
- PASS src/no-literal-colors.test.ts > no literal colours in src

Playwright (\`CI=1 npm run e2e --workspace apps/admin\`): 2 failed, 1 passed (13.7s)
- FAIL e2e/smoke.spec.ts:4 dashboard passes axe: getByRole('heading', { name: 'Dashboard', level: 1 }) element(s) not found
- FAIL e2e/smoke.spec.ts:14 not found passes axe: getByRole('heading', { name: 'Page not found', level: 1 }) element(s) not found
- PASS e2e/smoke.spec.ts:24 preview proxies to core

## Gates (commit 3)
- build packages/ui, lint, typecheck, vitest (3 passed), build apps/admin, e2e (3 passed, CI=1) all green; git status clean after the build.
