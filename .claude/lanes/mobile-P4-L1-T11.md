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
