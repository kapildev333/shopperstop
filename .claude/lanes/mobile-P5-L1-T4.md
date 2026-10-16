# mobile-P5-L1-T4 - end to end against core (worker)
Status: done
## Doing
Task 4 landed: red (`test: verify and reset against core`, c8e46bb), then the config (`feat: mobile e2e writes core's log to e2e/.tmp/core.log`, 68a9f14). Tasks 4.1 and 4.2 ticked.
## Found
- Red run (make e2e, config unchanged): both account-security tests failed on `mailedCode`: `no "Verify your ShopperStop email" mail to <email> in …/apps/mobile/e2e/.tmp/core.log` and the reset subject; the other 26 mobile tests passed, admin 15, rider 7, web 47 green.
- The first red attempt of the reset test failed earlier, on `getByLabel('Email')` resolving to two fields: Expo Router keeps the sign-in screen mounted under the forgot-password screen. Fixed in the spec with a `top(page)` scope (the last `main`), before the red commit. The brief's reason (timeout in `mailedCode`) holds after the fix.
- Green make e2e (exit 0): admin 15 passed, mobile 28 passed (26 before + 2), rider 7 passed, web 47 passed.
- Gates after the feat commit: `npm run build --workspace packages/ui` ok; lint ok; typecheck ok; jest (`jest --ci && node --test scripts/*.test.mjs`) 98 suites, 383 tests passed; `npm run build --workspace apps/mobile` ok and lists `/verify-email`, `/reset-password`, `/forgot-password`; `openspec validate --all --strict`: 20 passed.
- The branch gained commits from other sessions during this task (`d964133` test, `95f651c` fix to `verify-email.tsx`, `d5accc4` lane log); none touched by this lane. The gates ran on the worktree as it stood at each run.
## Requests
- to mobile-P5-L1 manager: task 5 next (e2e slot).
## Blockers
None.
