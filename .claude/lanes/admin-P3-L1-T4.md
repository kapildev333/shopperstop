# admin-P3-L1-T4 - admin-riders task 4: the riders page (worker brief)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 4
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: task 3 landed, and **ui-P3-L2 on main with the branch rebased onto it** (the manager rebases). Step 0 checks it.

## Read first
`tasks.md` section 4; `design.md` decisions 1 to 7 and 14; the whole `specs/admin-riders/spec.md`; the delta's "Role-based navigation" and "Core reached through a same-origin proxy".

## Scope
`apps/admin/src/riders-fake.ts` (new), `apps/admin/src/riders.test.tsx` (new), `apps/admin/src/rider-dialog.test.tsx` (new), `apps/admin/src/shell.test.tsx`, `apps/admin/vite.config.ts`, `apps/admin/playwright.config.ts`, `apps/admin/e2e/global-setup.ts`, `apps/admin/src/api.ts`, `apps/admin/src/nav.ts`, `apps/admin/src/riders.ts` (new), `apps/admin/src/rider-dialog.tsx` (new), `apps/admin/src/routes/_staff/riders.tsx` (new), `apps/admin/src/routeTree.gen.ts` (generated), `tasks.md` ticks 4.1 and 4.2, this file.

## Scenarios
Every scenario of `specs/admin-riders/spec.md` except "Riders against the rider service" (task 5); Role-based navigation › Admin sees every section, Store staff see their sections; Core reached through a same-origin proxy › Rider client calls the page's origin.

## Failing tests to start from
All of `src/riders.test.tsx` (7 tests, 8 runs) and `src/rider-dialog.test.tsx` (10 tests, 15 runs), names in design.md "Tests"; `src/shell.test.tsx` › "admin sees every section", "store staff see dashboard, orders and stock".

## Commits, in this order
0. Check `packages/ui/package.json` has an export `"./api/rider"` and `packages/ui/src/api/rider.d.ts` exists, and that it declares `paths` with `"/admin/riders"` and `"/admin/riders/{id}"` and `components` with `schemas` `Rider`. If anything differs, stop: patch 4.3 imports `components` and `paths` from `@shopperstop/ui/api/rider`. Base: `Tests  299 passed (299)`.
1. `git apply …/patches/4.1-riders-tests.diff`. Expect `Tests  25 failed | 297 passed (322)` (three files fail). Typecheck fails here by design (`Rider` is exported from `src/api.ts` by 4.3); lint passes. Tick 4.1. Commit `test: riders page, rider dialog, Riders in the nav`.
2. `git apply …/patches/4.2-rider-service-config.diff`, then `git apply …/patches/4.3-riders-code.diff`. Run `npm run build --workspace apps/admin`. `git diff apps/admin/src/routeTree.gen.ts` must show only the patch's `/riders` lines: if the build rewrote it differently, stop. Expect `Tests  322 passed (322)`. Gates. Tick 4.2. Commit `feat: riders page against the rider service`.

## Steps, rules and gates
- Work only in `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`. Never the root checkout, never push. Use absolute paths or `git -C <worktree>`; never a relative `cd ..`.
- Prefix every command with `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`. If `node_modules` is missing run `npm ci` at the worktree root; run `npm run build --workspace packages/ui` once before the first test run.
- Apply each patch from the worktree root with `git apply openspec/changes/admin-riders/patches/<name>.diff`. Do not retype, reformat or "improve" what it writes. A patch that does not apply cleanly: stop.
- After each patch, run `npm run test --workspace apps/admin -- --run` and compare the `Tests` line with the expected count. Record every summary in your log. Any other count: stop.
- Commit identity is the repo's git config; no attribution or co-author lines. Tick this task's boxes in `openspec/changes/admin-riders/tasks.md` with the Edit tool (`- [ ]` to `- [x]`), in the commit that does the box.
- Before each `feat:`/`refactor:` commit: `make test-web` exits 0; `git status --short` lists only this task's files; `openspec validate admin-riders --strict` is valid.
- Never run `make e2e`, `npx playwright`, `npm run e2e`, `make db`, `make dev` or any docker command. Never edit a test to make it pass. Any open design choice, failure or difference: write it under `## Blockers` in your log and stop.
- Keep your log in this file below `# Worker log` (format in `.claude/lanes/README.md`). Report the commit hashes, every Vitest summary, the `make test-web` exit code and `git status --short`.

# Worker log
