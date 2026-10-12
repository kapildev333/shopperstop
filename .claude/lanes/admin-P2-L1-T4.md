# admin-P2-L1 task 4 - review follow-ups and sign-in e2e against core (OpenSpec change admin-auth-nav, tasks 4.1 to 4.3)
Status: started
## Doing
Tasks 4.1 to 4.3 landed on `lane/admin-P2-L1-admin-auth-nav` as three commits (`test:`, `fix:`, `refactor:`). Stopped before Playwright: 4.4 and 4.5 wait for the e2e slot the manager grants. Awaiting reviewer for 4.1 to 4.3.
## Found
- Commit 1 (`test:`) changes `src/sign-in.test.tsx` (redirect `test.each`) and `src/shell.test.tsx` (cache assertion). Red against the task 3 `safeRedirect`: only the `%2F%5Cevil.example` row fails; the `%2F%2Fevil.example` row and the sign-out assertion pass.
- The cache assertion passes against the current code because `queryClient.clear()` is in `signOut`. Removing that line turns it red (see below), as the brief expects.
- Commit 2 (`fix:`) changes `safeRedirect` in `src/routes/sign-in.tsx` to the design.md rule.
- Commit 3 (`refactor:`) drops `activeOptions` from the nav `Link` in `src/routes/__root.tsx`; the tick and this log land in the same commit.
- `routeTree.gen.ts` unchanged throughout.
## Deviations from design.md
- None in code.
- Tooling only: the first attempt to remove `clear()` used BSD `sed -i` without an extension argument and failed before running anything; the file was never changed. The retry used perl and `git checkout -- apps/admin/src/routes/__root.tsx` restored it. Verified with `grep -c "queryClient.clear()"` returning 1.
## Requests
- to admin-P2-L1 (manager): grant the e2e slot to run 4.4 and 4.5 (`make e2e` is not run in this task).
## Blockers
(none)
## Red output, commit 1 (`npm run test --workspace apps/admin -- --run src/sign-in.test.tsx src/shell.test.tsx`, before `safeRedirect` changed)
```
 × src/sign-in.test.tsx > an outside redirect is ignored: %2F%5Cevil.example
 FAIL  src/sign-in.test.tsx > an outside redirect is ignored: %2F%5Cevil.example
 Test Files  1 failed | 1 passed (2)
      Tests  1 failed | 21 passed (22)
```
Row `%2F%2Fevil.example` and every shell test pass. The failure is the Dashboard heading never appearing (the router lands on `/\evil.example`, which renders the not-found page), reported at `src/sign-in.test.tsx:124`.
## Red output, commit 1, temporary removal of `queryClient.clear()` from `signOut` (`src/routes/__root.tsx`, restored after)
```
 × src/shell.test.tsx > sign out ends the session
 FAIL  src/shell.test.tsx > sign out ends the session
AssertionError: expected [ Query{ options: { …(8) }, …(5) } ] to deeply equal []
```
The file was restored with `git checkout`; the cache assertion passes again with `clear()` in place.
## Gates (commit 3 tree, Node v22.23.3)
- `npm run build --workspace packages/ui`: exit 0
- `npm run lint --workspace apps/admin`: exit 0
- `npm run typecheck --workspace apps/admin`: exit 0
- `npm run test --workspace apps/admin -- --run`: 5 files, 31 tests passed
- `npm run build --workspace apps/admin`: exit 0; a second build leaves `routeTree.gen.ts` unchanged
- `openspec validate admin-auth-nav --strict`: "Change 'admin-auth-nav' is valid", exit 0
- `git status --short` before the commit: only `apps/admin/src/routes/__root.tsx`, `openspec/changes/admin-auth-nav/tasks.md` and this log
