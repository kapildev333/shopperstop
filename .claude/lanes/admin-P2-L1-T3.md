# admin-P2-L1 task 3 - 401 handling and staff sign-in form (OpenSpec change admin-auth-nav, tasks 3.1 to 3.4)
Status: done
## Doing
Task 3 landed on `lane/admin-P2-L1-admin-auth-nav`: `33e2d33` (test, 401 red), `983e9c7` (fix, `onResponse` keyed on the request's bearer header), `ce8a286` (test, sign-in red), then `feat: staff sign-in form` with the form and the ticks 3.1 to 3.4. Gates green. Awaiting reviewer. Task 4 (e2e) not started.
## Found
- `src/api.ts` `onResponse` now reads `request.headers.get('Authorization')` and clears only when it equals `Bearer <token now>`. Per design.md, no path special-cased.
- `src/routes/sign-in.tsx` is the form per design.md: `noValidate`, own empty-field checks, `useMutation` posting `/admin/auth/sign-in`, `Button loading` disables while pending, `setToken` then `setQueryData(meQuery)` then `navigate({ href: redirect ?? '/' })`.
- Tests: `src/sign-in.test.tsx` (10 tests, the `%s` rows counted as 4). Fixture password is a test literal `secret-test`; addresses are `example.test`.
- `routeTree.gen.ts` did not change in task 3.
- Vitest prints `Not implemented: Window's scrollTo() method` (jsdom, router scroll restoration). Noise from task 2, not silenced.
## Deviations from design.md
- Design's banner expression hid the alert for any `validation` error that carries a `field`. Spec says only `email` and `password` go to the field and any other error goes to the alert. The form narrows `serverField` to those two names, so a validation error on another field falls through to "Something went wrong. Try again." Escalating for confirmation only if the team lead wants it differently.
- Commit `ce8a286` was amended once before the feat commit: the helper `fillAndSubmit` read the Email field synchronously after `renderApp`, which races the async router mount. It now uses `findByLabelText`. The amend replaced only the test commit (HEAD); the red run was repeated after the fix, 10 of 10 failing on the missing form.
- The feat commit also removes the unused `setToken` import from `sign-in.test.tsx`, which lint caught after the red commit.
## Requests
- to admin-P2-L1 (team lead): decide whether the validation-on-other-field fallback (above) is wanted, or the design's version.
## Blockers
(none)
## Red output (commit `33e2d33`, `npm run test --workspace apps/admin -- --run src/api.test.ts`, before the fix)
```
 ❯ src/api.test.ts (4 tests | 2 failed) 14ms
   × a 401 to a signed-out request keeps a session set meanwhile 5ms
   × a 401 to a replaced token keeps the new session 1ms
AssertionError: expected null to be 'fresh' // Object.is equality
AssertionError: expected null to be 'new' // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 2 passed (4)
```
## Red output (commit `ce8a286`, `src/sign-in.test.tsx` against the stub `sign-in.tsx`)
```
 FAIL  src/sign-in.test.tsx > sign-in form has labelled fields and one h1
 FAIL  src/sign-in.test.tsx > empty fields are flagged without a request
 FAIL  src/sign-in.test.tsx > wrong credentials shows an error banner
 FAIL  src/sign-in.test.tsx > rate limited shows an error banner
 FAIL  src/sign-in.test.tsx > any other error shows an error banner
 FAIL  src/sign-in.test.tsx > network error shows an error banner
 FAIL  src/sign-in.test.tsx > validation error is shown on its field
 FAIL  src/sign-in.test.tsx > submit is disabled while signing in
 FAIL  src/sign-in.test.tsx > success stores the token and returns to the redirect
 FAIL  src/sign-in.test.tsx > an outside redirect is ignored
TestingLibraryElementError: Unable to find a label with the text of: Email
TestingLibraryElementError: Unable to find role="button" and name "Sign in"
 Test Files  1 failed (1)
      Tests  10 failed (10)
```
