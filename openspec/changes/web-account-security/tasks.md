# Tasks

Three worker tasks, run one after another on branch `lane/web-P5-L1-account-security` in `.worktrees/web-P5-L1` (Tasks 1 and 2 both regenerate `src/routeTree.gen.ts`; Task 3 needs both pages). design.md "Decisions" settles every choice; anything it does not settle is a stop-and-report.

Gates, from the worktree root with `export PATH="$HOME/.local/node-v22.23.3/bin:$PATH"` (`npm ci` and `npm run build --workspace packages/ui` once if `node_modules` or `packages/ui/dist` is missing): `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`; `openspec validate web-account-security --strict`. Task 3 also runs `make e2e` with the e2e slot the manager holds.

## 1. Verification banner and `/verify-email`

Scope: `apps/web/src/verify-email-banner.tsx` (new), `apps/web/src/verify-email-banner.test.tsx` (new), `apps/web/src/routes/account.tsx`, `apps/web/src/checkout.tsx` (the `Frame` only), `apps/web/src/routes/verify-email.tsx` (new), `apps/web/src/verify-email.test.tsx` (new), `apps/web/src/routeTree.gen.ts` (regenerated), this file (ticks). Scenarios: "Customer email verification banner" (both), "Customer sends a verification email" (all three), "Customer verify-email page" / Email verified with the code, "Customer verify-email failures" (all three). Starts from `src/verify-email-banner.test.tsx` `unverified customer sees the banner`, `verified customer sees no banner`, `verification email sent`, `already verified when sending`, `sending fails` and `src/verify-email.test.tsx` `email verified with the code`, `expired code while signed in`, `missing code while signed out`, `verification unreachable then retried` (red: no banner text on `/account` and `/checkout`; `/verify-email` renders "Page not found"). Commits: `test: verification banner and verify-email page`, `feat: verification banner and verify-email page`.

- [x] 1.1 Write the nine tests (design.md "Test strategy"), run `npm run test --workspace apps/web -- --run src/verify-email-banner.test.tsx src/verify-email.test.tsx`, see them fail for the reasons above; commit.
- [x] 1.2 Build design.md decisions 1 and 2; run the gates; tick 1.1 and 1.2; commit.

## 2. Forgot and reset password, sign-in link

Scope: `apps/web/src/auth-forms.tsx` (the `forgotPassword` slot only), `apps/web/src/routes/sign-in.tsx`, `apps/web/src/routes/forgot-password.tsx` (new), `apps/web/src/routes/reset-password.tsx` (new), `apps/web/src/password-reset.test.tsx` (new), `apps/web/src/routeTree.gen.ts` (regenerated), this file (ticks). Scenarios: "Customer forgot-password link", "Customer forgot-password page", "Customer forgot-password outcome" (all three), "Customer reset-password page", "Customer reset-password outcome" (both), "Customer reset-password bad code" (both). Starts from `src/password-reset.test.tsx` `forgot-password link on sign-in`, `empty email checked`, `reset link requested`, `malformed email from core`, `too many reset requests`, `reset form checks fields`, `password reset`, `password refused by core`, `expired reset code`, `missing reset code` (red: no "Forgot password?" link; `/forgot-password` and `/reset-password` render "Page not found"). Commits: `test: forgot and reset password pages`, `feat: forgot and reset password pages`.

- [ ] 2.1 Write the ten tests, run `npm run test --workspace apps/web -- --run src/password-reset.test.tsx`, see them fail; commit.
- [ ] 2.2 Build design.md decisions 3 and 4; run the gates (`src/auth-forms.test.tsx` must stay green unchanged); tick 2.1 and 2.2; commit.

## 3. End to end against core

Scope: `apps/web/playwright.config.ts` (core's webServer command and the `mkdirSync` only), `apps/web/e2e/mail.ts` (new), `apps/web/e2e/account-security.spec.ts` (new), this file (ticks). Scenarios: "Customer account security end to end" (both). Starts from `e2e/account-security.spec.ts` `email verified against core` and `password reset against core`, with `e2e/mail.ts` exporting `coreLog` and `mailedCode` (red under `make e2e`: `mailedCode` times out because core's stdout is not written to `coreLog`). Commits: `test: verify and reset against core`, `feat: e2e writes core's log to e2e/.tmp/core.log`.

- [ ] 3.1 Write `e2e/mail.ts` and the two tests (design.md decision 5; "Password reset against core" checks the old password with `request.post('/api/core/v1/auth/sign-in', ...)` answering 401); with the e2e slot, run `make e2e`, see both fail on the `mailedCode` timeout and every other test pass; commit.
- [ ] 3.2 Change `playwright.config.ts` as decision 5 says; with the slot, run `make e2e` (all green) and the gates; tick 3.1 and 3.2; commit.
