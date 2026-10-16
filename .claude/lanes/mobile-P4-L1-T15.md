# mobile-P4-L1-T15 - End-to-end suite (mobile-foundation-accounts, task 15)
Status: blocked (15.2 and 15.3 not done; app fixes needed in `src/app`, outside this brief)
## Doing
15.1 ticked. `make e2e` run from the worktree root: exit 2. The other workspaces' suites passed in the same run (two suites, 7 and 45 tests); mobile 0 of 4. Stopped per the brief: both causes are app code. Nothing else changed, nothing pushed, no dev servers left running (ports 18080, 18081, 15173-15176 free).
## Found
- `make e2e` mobile summary (the last lines before make's error):
  ```
  Running 4 tests using 1 worker
    ✘  1 accounts.spec.ts:38 › demo customer signs in
    ✘  2 accounts.spec.ts:51 › register with a field error
    ✘  3 accounts.spec.ts:68 › addresses against core
    ✘  4 accounts.spec.ts:97 › sign out against core
  4 failed
  npm error Lifecycle script `e2e` failed ... apps/mobile
  make: *** [e2e] Error 1
  ```
  The rider seed TRUNCATE failure from the earlier run did not recur: both seeds ran cleanly.
- Failure 1 (tests 1, 2, 3, axe): `document-title` (serious, WCAG 2.4.2), node `html` (`<html lang="en">`), "Document does not have a non-empty <title> element". The static export has no `<title>` in `dist-e2e/index.html`. Nothing in `apps/mobile/app.json` sets one, and `src/app/_layout.tsx` renders the `Stack` with no `Head` or `Stack.Screen` title. The fix belongs in app code (a `<title>` via `expo-router/head` or a root-layout `Head`), in `src/app`, outside this brief. The axe rule is on app-controlled markup, not react-native-web: no rule was switched off.
- Failure 2 (test 4, sign out): after "Sign out", the URL goes to `/sign-in?returnTo=%2Faccount` instead of `/`. Cause in `src/app/account.tsx`: line 23 `if (!token) return <Redirect href="/sign-in?returnTo=%2Faccount" />`, and the sign-out handler (lines 32-33) does `router.replace('/')` then `void signOut()`. The token clears while the account route is still mounted, so the Redirect fires before the replace lands and the account route wins. The fix is in app code (for example, defer the token-null redirect until navigation finishes), so it is also outside the brief.
- Tests 1 to 3 would also need the title fix before their own assertions run. Tests 2 and 3 have not been checked past axe, so further failures may be hidden.
## Deviations and choices (for the team lead)
- Gates 15.3 not run: the brief runs them only after `make e2e` exits 0.
- No change to `src/app`, `src/`, `app.json` or `e2e/accounts.spec.ts`: each would be out of scope.
## Requests
- to mobile-P4-L1 (team lead): decide whether the title and sign-out fixes land in a T15 fix task with a brief that names `src/app/_layout.tsx` and `src/app/account.tsx`, then rerun `make e2e`.
## Blockers
- Document title missing from the web export (axe `document-title`) and the sign-out redirect race in `src/app/account.tsx`; both in app code, not this lane's scope.
