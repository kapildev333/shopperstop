# mobile-P5-L1-T3 - forgot and reset password screens, sign-in link (worker)
Status: done
## Doing
Task 3 landed: red tests committed (`test: forgot and reset password screens`), then the screens (`feat:`). Tasks 3.1 and 3.2 ticked.
## Found
- Built per design.md Decision 4: `ForgotPasswordScreen` and `ResetPasswordScreen` in `src/auth-forms.tsx`, route files `src/app/forgot-password.tsx` and `src/app/reset-password.tsx` re-export them. Sign-in gets "Forgot password?" under the Password field (`linkRow`, 44 pt).
- Red reasons confirmed before the feat: each of the 12 tests failed on its missing heading or link, not on setup.
- Existing `src/auth-forms*.test.tsx`, `account-sign-in`, `account-sign-out`, `account-redirect` pass unchanged.
- The reset screen's code field, the "Request a new code" link after a refused code, and the done state follow Decision 4; the code is read from `typed ?? token` each render.
- Full mobile suite with task 1's untracked `src/verify-email-card.test.tsx` present: 1 suite failed (3 tests), 94 passed. That suite is task 1's red test, not this task's.
## Requests
- to mobile-P5-L1 manager: none.
## Blockers
None.
