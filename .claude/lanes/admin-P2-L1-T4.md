# admin-P2-L1 task 4 - review follow-ups and sign-in e2e against core (OpenSpec change admin-auth-nav, tasks 4.1 to 4.5)
Status: done
## Doing
Task 4 landed on `lane/admin-P2-L1-admin-auth-nav`: `6a74af3` (test: backslash redirect, sign-out cache, red), `a058081` (fix: reject a backslash redirect), `d2ec1cb` (refactor: nav links use the router's default active match, with the 4.1 to 4.3 ticks), `344719e` (test: admin sign-in flow against core with axe, with the 4.4 tick), then the 4.5 commit (feat: admin e2e seeds its own data, with the 4.5 tick and this log). Gates green. Ports 18080 and 15174 free after the runs. Awaiting reviewer.
## Found
- Commit 1 (`test:`) changes `src/sign-in.test.tsx` (redirect `test.each`) and `src/shell.test.tsx` (cache assertion). Red against the task 3 `safeRedirect`: only the `%2F%5Cevil.example` row fails; `%2F%2Fevil.example` and the sign-out assertion pass.
- The cache assertion passes against the current code because `queryClient.clear()` is in `signOut`. Removing that line turns it red (below), as the brief expects.
- Commit 2 (`fix:`) changes `safeRedirect` in `src/routes/sign-in.tsx` to the design.md rule.
- Commit 3 (`refactor:`) drops `activeOptions` from the nav `Link` in `src/routes/__root.tsx`.
- `routeTree.gen.ts` unchanged throughout.
- Commit 4 (`test:`) adds `e2e/auth.spec.ts` and removes "dashboard passes axe" from `e2e/smoke.spec.ts`. Its e2e run happened before the global setup existed, against a database that was already seeded (see 4.4 below).
- Commit 5 (`feat:`) adds `e2e/global-setup.ts` (migrate, then `seed-demo --reset`, in `services/core`, using the process environment) and `globalSetup` in `playwright.config.ts`. Playwright's `webServer`s start before `globalSetup`, so core is already listening when the seed truncates the database; core-P2-L1's seed is one transaction, so this is safe (design.md risk note).
- Demo credentials in `auth.spec.ts` (`admin@shopperstop.local` / `admin12345`) are core's seed; the wrong-password test uses a different email so the sign-in limit (10 per email per hour) is not spent on the admin.
## Deviations from design.md
- None in code.
- Tooling: the first attempt to remove `clear()` used BSD `sed -i` without an extension argument and failed before running anything; a second perl attempt had a regex bug and also changed nothing. `git checkout -- apps/admin/src/routes/__root.tsx` restored the file, and `grep -c "queryClient.clear()"` returned 1.
- `timeout` is not available in this zsh; the e2e run was not wrapped in it.
## Requests
- to admin-P2-L1 (manager): none open.
## Blockers
(none)
## 4.4 result (run before the global setup existed)
`CI=1 npm run e2e --workspace apps/admin` with the `make e2e` environment exported, after `packages/ui` and `apps/admin` builds: **4 passed (5.3s)**, exit 0. This is green, not red. The e2e database `shopperstop_core_e2e` was already seeded (the admin sign-in in the test succeeded), so the "unseeded database" case in tasks.md did not occur. The likely source is an earlier `make e2e` run on this machine, whose seed was never reset; core-P2-L1 and admin-P1-L1 logs record e2e runs and the same seed command. I did not run the seed myself before 4.4, and I did not empty the database to force a red run, because that would reset a database another run may depend on. The auth flow is therefore proven green against core, but the red-before-setup step was not reproduced.
## Red output, commit 1 (`npm run test --workspace apps/admin -- --run src/sign-in.test.tsx src/shell.test.tsx`, before `safeRedirect` changed)
```
 × src/sign-in.test.tsx > an outside redirect is ignored: %2F%5Cevil.example
 FAIL  src/sign-in.test.tsx > an outside redirect is ignored: %2F%5Cevil.example
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 21 passed (22)
```
Row `%2F%2Fevil.example` and every shell test pass. The failure is the Dashboard heading never appearing (the router lands on `/\evil.example`, which renders not found), reported at `src/sign-in.test.tsx:124`.
## Red output, commit 1, temporary removal of `queryClient.clear()` from `signOut` (`src/routes/__root.tsx`, restored after)
```
 × src/shell.test.tsx > sign out ends the session
 FAIL  src/shell.test.tsx > sign out ends the session
AssertionError: expected [ Query{ options: { …(8) }, …(5) } ] to deeply equal []
```
## Gates (final tree, Node v22.23.3)
- `npm run build --workspace packages/ui`: exit 0
- `npm run build --workspace apps/admin`: exit 0 (run before each e2e run)
- `npm run lint --workspace apps/admin`: exit 0
- `npm run typecheck --workspace apps/admin`: exit 0
- `npm run test --workspace apps/admin -- --run`: 5 files, 31 tests passed
- `openspec validate admin-auth-nav --strict`: valid, exit 0
- `CI=1 npm run e2e --workspace apps/admin`, run 1 (after `global-setup.ts`): **4 passed (5.7s)**, exit 0, setup output "seed-demo: demo accounts loaded"
- Same command, run 2 (idempotent): **4 passed (4.3s)**, exit 0, same setup output
- After the runs: nothing listening on 18080 or 15174 (`nc -z`)
