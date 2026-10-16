# rider-P4-L3-T2 - rider takes the shared time helpers (task 2 of rider-app-shared-swap)
Status: done (2.1 ticked; refactor commit on lane branch, not pushed)

## Brief
- LANE-ID: rider-P4-L3 (task T2). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P4-L3`. Branch: `lane/rider-P4-L3-app-shared-swap`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend.
- Change: `openspec/changes/rider-app-shared-swap/`, task 2 (`tasks.md` 2.1). Read `design.md` Decision 6, then "Code" › "Task 2".
- Scenarios: none new. Must stay green: rider-app "Ready orders list" (`ready.test.tsx`, "12 min ago") and "Delivery history" (`history.test.tsx`).
- Scope paths (nothing else): `apps/rider/src/format.ts`, `apps/rider/src/format.test.ts`, `apps/rider/src/ready.tsx`, `apps/rider/src/routes/_rider/history.tsx`, `openspec/changes/rider-app-shared-swap/tasks.md` (tick 2.1), this file.
- Failing test: none, by design. The task moves two imports (`useSince`, `when`) to `@shopperstop/ui/app` and deletes rider's copies of `since`, `useSince`, `when`; their behaviour is tested in `packages/ui/src/app/time.test.tsx` and rider's page tests. `format.test.ts` keeps only the `itemCount` assertions (renamed `itemCount wording`). Commit type `refactor:`, suite green before and after.

## Steps and commits
0. Setup as T1: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `npm run build --workspace packages/ui`. Confirm the suite is green first (61 passed after T1).
1. Copy design.md "Task 2" to a scratch file outside the repo, `git apply` it. Gates: `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (61 passed), `npm run build --workspace apps/rider`; all exit 0. `grep -rn "useSyncExternalStore\|Intl.DateTimeFormat\|openapi-fetch'" apps/rider/src` prints nothing.
2. Then, once, from the worktree root: `make test-web` (exit 0; paste the per-workspace test counts). Tick 2.1. Commit `refactor: rider takes since, useSince and when from @shopperstop/ui/app` (the four files, tasks.md, this file).

Stop and write under Blockers on anything design.md does not settle. Never edit `packages/ui/`, other apps or the lane log `rider-P4-L3.md`.

## Gates
- Baseline before the swap: rider Vitest 10 files / 61 passed (Node 22.23.3 on PATH; `packages/ui` built).
- After the swap: `lint` exit 0; `typecheck` exit 0; `test --run` 10 files / 61 passed; `build` exit 0; `grep -rn "useSyncExternalStore\|Intl.DateTimeFormat\|openapi-fetch'" apps/rider/src` no output.
- `make test-web` from the worktree root exit 0. Per workspace: ui 35 files / 104 tests; admin 27 files / 326 tests; mobile jest 68 suites / 237 tests (plus node --test scripts); rider 10 files / 61 tests; web 26 files / 163 tests.

## Found
- Diff applied with `git apply` from a scratch copy of design.md "Task 2"; `git apply --check` clean first. Only the four scoped files changed plus tasks.md and this file.
- `format.test.ts` now holds only `itemCount wording`; `since` and `when` wording is covered by `packages/ui/src/app/time.test.tsx` and rider's `ready.test.tsx` ("12 min ago").

## Blockers
None.
