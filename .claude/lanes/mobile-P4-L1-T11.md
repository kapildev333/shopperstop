# mobile-P4-L1-T11: Sign-in and register screens (mobile-foundation-accounts, task 11)
Status: blocked (escalated to team lead)

## Doing
Red test written: `apps/mobile/src/auth-forms.test.tsx` (eight tests: the seven scenarios from "Sign-in screen" to "Register lands on Home", plus `required fields checked on register`). Not committed yet. No `auth-forms.tsx` or route files written.

## Found
- Blocker: `renderRouter` from `expo-router/testing-library` cannot be loaded under the committed `apps/mobile/jest.config.js`. Jest fails before any test runs:
  ```
  FAIL src/auth-forms.test.tsx
    ● Test suite failed to run
      Must use import to load ES Module: .../node_modules/standard-navigation/lib/src/index.js
  ```
  `src/shell.test.tsx` (task 10, uncommitted red) fails the same way, so this is shared, not specific to my test.
- Cause: `expo-router` reaches `standard-navigation` (ESM) through its bottom-tabs code, and `transformIgnorePatterns` does not allow it. `jest.config.js` is task 1's scaffold, outside my scope.
- Diagnosis, without editing the repo: a temporary config in the scratchpad (`.../scratchpad/jestprobe/jest.probe.js`, extends the committed config and adds `standard-navigation|react-navigation|@react-navigation/.*` to the allowed list) loads `expo-router/testing-library`. With it, the test fails for the intended reason:
  ```
  FAIL src/auth-forms.test.tsx
    ● Test suite failed to run
      Cannot find module './app/sign-in' from 'src/auth-forms.test.tsx'
  ```
  So the red is valid once the config allows the ESM packages through.

## Requests
- Team lead: decide who changes `apps/mobile/jest.config.js` (task 1 scope, or T10 since its shell test needs the same) to allow `standard-navigation` and `react-navigation` through `transformIgnorePatterns`. I have not edited it.
- Team lead: until that lands, the red commit for task 11 cannot show a behaviour failure, and the green commit cannot pass the mobile test gate.

## Deviations and choices (for the team lead)
- None decided. Open choice for the record: `Link` for "Create an account" and "Sign in" (expo-router `Link` inside `Text`, role link) versus a `Pressable` with `router.push`. I will use `Link`, which keeps `href` and `returnTo` in one place, and check it in the red run.

## Gates
Not run past the red step. Blocked on the config above.

## Blockers
- `jest.config.js` `transformIgnorePatterns` (see Requests). Blocks the red commit and every mobile test gate.

## Update (after the config fix, 2b5838e)
- Red test committed as `39515b7 test: sign in and register screens follow the spec scenarios`. Failure at that point: `Cannot find module './app/sign-in'`.
- Written, uncommitted: `src/auth-forms.tsx` (`SignInScreen`, `RegisterScreen`, exported `splitError(error, fields)` for T13 to fold in), `src/app/sign-in.tsx` and `src/app/register.tsx` (re-exports).
- Current run: the first test (`sign-in screen`, which navigates) passes; every later test fails to find its heading. The manager reports expo-router keeps its navigation store at module level, so a later `renderRouter` in the same file ignores `initialUrl`. Waiting for T10's `chore: reset the expo-router store between tests`; not worked around in this file.

## Update 2 (one navigating test per file, manager decision)
T10's fix for the navigation store is not coming (no reset without patching node_modules). Rule: one navigating test per file. Test names unchanged, so the design.md map holds.

| Test | File |
|---|---|
| sign-in screen (navigates, Link to /register) | `src/auth-forms-sign-in-screen.test.tsx` |
| register lands on Home (navigates to /) | `src/auth-forms-register-home.test.tsx` |
| password shown on request, required fields checked, required fields checked on register, short password on register, field error from the envelope, non-field error in an alert (no navigation) | `src/auth-forms.test.tsx` |

Red on the committed tests (screen files held aside, then restored; output in `/private/tmp/claude-501/-Users-kapilsoni-KapilProjects-ShopperStop/dee63189-8ed7-4dcc-8d08-f93f0a2019f8/scratchpad/t11-red-split.txt`):
```
FAIL src/auth-forms-sign-in-screen.test.tsx
  Cannot find module './app/sign-in' from 'src/auth-forms-sign-in-screen.test.tsx'
FAIL src/auth-forms.test.tsx
  Cannot find module './app/sign-in' from 'src/auth-forms.test.tsx'
FAIL src/auth-forms-register-home.test.tsx
  Cannot find module './app/sign-in' from 'src/auth-forms-register-home.test.tsx'
Test Suites: 3 failed, 3 total
```

## Done (11.1 to 11.3)
Commits on the branch: `39515b7` test (red), `20e327c` test (split navigating tests into their own files), `4b4314f` test (`await fireEvent`), `ab34174` test (typed router result instead of the untyped matchers), then the `feat:` commit with `src/auth-forms.tsx`, `src/app/sign-in.tsx`, `src/app/register.tsx` and boxes 11.1 to 11.3 ticked.

Deviations, each small, for the team lead:
- `splitError(error, fields)` is exported from `src/auth-forms.tsx`. T13's local `splitError` in `address-sheet.tsx` does the same job for its own field list. T14 or the reviewer can fold them into one export.
- The alert is `accessible` with `accessibilityRole="alert"`. RNTL's `getByRole('alert')` does not find the non-accessible View.
- RNTL 14's `fireEvent` is async: tests `await` it. Without that, state updates are not visible to the assertion.
- expo-router ships no types for `toHavePathname` and `toHaveSearchParams`; the two navigating tests read `router.getPathname()` and `router.getSearchParams()` from the `renderRouter` result instead.
- Links use expo-router's `Link` (approved by the manager).

Gates (run from the worktree root, after the feat commit's staging):
```
npm run build --workspace packages/ui         exit 0
npm run lint --workspace apps/mobile          exit 0
npm run typecheck --workspace apps/mobile     exit 0
npm run test --workspace apps/mobile -- --run exit 0: Test Suites 17 passed, Tests 67 passed
npm run build --workspace apps/mobile         exit 0 in 4s, Exported: dist; dist holds index.html, register.html, sign-in.html
openspec validate mobile-foundation-accounts --strict  valid
```
