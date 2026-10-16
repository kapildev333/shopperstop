# rider-P4-L3-T1 - rider on the shared client and token store (task 1 of rider-app-shared-swap)
Status: done

## Brief
- LANE-ID: rider-P4-L3 (task T1). Area: `rider`.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P4-L3`. Branch: `lane/rider-P4-L3-app-shared-swap`. Work and commit only there; never push. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution or co-author trailers. Commit with a pathspec, never amend.
- Change: `openspec/changes/rider-app-shared-swap/`, task 1 (`tasks.md` 1.1, 1.2). Read `design.md` Decisions 1 to 5 and 7, then "Code".
- Scenarios (rider-app): "A failure answer without an envelope reaches the caller as internal", "401 mid-session returns to sign-in"; must stay green: "Expired session on load", "401 to a replaced token keeps the new session", "Service unreachable on load", "Token survives a reload", "Blocked storage keeps the token in memory", "Core never gets the rider token".
- Scope paths (nothing else): `apps/rider/src/api.ts`, `apps/rider/src/session.ts`, `apps/rider/src/api.test.ts`, `apps/rider/src/session.test.ts`, `apps/rider/src/shell.test.tsx`, `apps/rider/src/sign-in.test.tsx`, `openspec/changes/rider-app-shared-swap/tasks.md` (ticks 1.1, 1.2), this file.
- Failing tests to start from: `apps/rider/src/api.test.ts` › `a failure answer with an error envelope without a message reaches the caller as an internal error with its status`, `a 401 mid-session returns to sign-in` (pins the router clean-up passed as `onUnauthorized`), `expired session on load returns to sign-in`; `session.test.ts` › `blocked storage keeps the token in memory`; `shell.test.tsx` › `sign out ends the session`; `sign-in.test.tsx` › `wrong credentials or inactive rider`, `rate limited`, `service unreachable or failing`, `field validation from the service`.

## Steps and commits
0. Setup, from the worktree root: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (Node 22.11 breaks Vitest with ERR_REQUIRE_ESM); `test -d node_modules || npm ci`; `npm run build --workspace packages/ui`.
1. Copy design.md "Task 1: tests" (the diff between the fences) to a scratch file outside the repo, `git apply` it. `npm run test --workspace apps/rider -- --run` must show exactly the 8 failures above (8 failed / 52 passed). Paste the summary under "Red run". Commit `test: rider envelope rule and mid-session 401 against the shared client` (the four test files and this file).
2. Apply "Task 1: code" the same way. Gates: `npm run lint --workspace apps/rider`, `npm run typecheck --workspace apps/rider`, `npm run test --workspace apps/rider -- --run` (61 passed), `npm run build --workspace apps/rider`; all exit 0. Tick 1.1 and 1.2 in tasks.md. Commit `feat: rider uses createApiClient and createTokenStore from @shopperstop/ui/app` (`api.ts`, `session.ts`, tasks.md, this file).

If a diff does not apply or the red/green counts differ, stop and write it under Blockers; do not improvise. Never edit `packages/ui/`, `router.ts`, other apps or the lane log `rider-P4-L3.md`.

## Red run
Status: done

Applied "Task 1: tests" with `git apply` (clean). `npm run build --workspace packages/ui` exit 0. `npm run test --workspace apps/rider -- --run` run twice, both exit 1:
 Test Files  4 failed | 6 passed (10)
      Tests  9 failed | 52 passed (61)

Failing tests (9, the same nine the brief names):
FAIL  src/api.test.ts > a 401 mid-session returns to sign-in
FAIL  src/api.test.ts > a failure answer with an error envelope without a message reaches the caller as an internal error with its status
FAIL  src/api.test.ts > expired session on load returns to sign-in
FAIL  src/session.test.ts > blocked storage keeps the token in memory
FAIL  src/shell.test.tsx > sign out ends the session
FAIL  src/sign-in.test.tsx > field validation from the service
FAIL  src/sign-in.test.tsx > rate limited
FAIL  src/sign-in.test.tsx > service unreachable or failing
FAIL  src/sign-in.test.tsx > wrong credentials or inactive rider

Brief text said "8 failed / 52 passed" and "8 red in all"; the brief also names nine tests, and design.md lists nine. Manager decision: 9 is correct, the "8" was a typo. Passing count 52, total 61.
## Green run
 Test Files  10 passed (10)
      Tests  61 passed (61)
## Gates
- `npm run test --workspace apps/rider -- --run` exit 0: 10 files, 61 passed.
- `npm run lint --workspace apps/rider` exit 0.
- `npm run typecheck --workspace apps/rider` exit 0.
- `npm run build --workspace apps/rider` exit 0 (built in 256 ms).
## Found
## Blockers
Red count is 9 (brief typo said 8; manager confirmed 9). Resolved, proceeding.
