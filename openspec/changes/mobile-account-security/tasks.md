# Tasks

Five worker tasks and the team lead's acceptance. design.md "Decisions" settles every choice; anything it does not settle is a stop-and-report in your lane log, not a guess.

## Common rules (every worker brief)

- Area `mobile`; worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P5-L1`; branch `lane/mobile-P5-L1-account-security`; OpenSpec change `openspec/changes/mobile-account-security/` (scenarios in `specs/mobile-app/spec.md`, decisions and the scenario-to-test map in `design.md`). Paths below are under `apps/mobile/` unless they start with `openspec/`. Your LANE-ID is in your task heading; log in `.claude/lanes/<LANE-ID>.md` (format in `.claude/lanes/README.md`).
- Scope is the paths your task lists plus ticking your own boxes in this file. A needed change anywhere else stops the task: report it in your log with the failing line.
- Test first: write the task's tests, run them, see them fail for the reason the task names, commit `test: …`; then the smallest code that passes, commit `feat: …`. Existing tests must pass unchanged; if one breaks, stop and report (never edit it).
- Commit by explicit path with `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers. Never push, pull, merge, amend, reset, rebase or stash; never `git add -A` or `git add .`. Other workers may be committing in the same worktree: stage only your files.
- Never run `make db`, `make dev`, `make prod-local` or docker. `make e2e` only with the manager's e2e slot (ask in your log and wait). Any server you start is stopped by its PID or port (`kill $(lsof -tiTCP:<port> -sTCP:LISTEN)`), never by name.
- RNTL 14: `render`, `renderRouter` and `fireEvent` are async; await them. When a test holds a server answer (a handler awaiting a promise the test resolves), fire the press without `await` and wait for the result with `findBy…` or `waitFor`. A map-based `renderRouter` gets `_layout: Layout` with `QueryClientProvider` around `Stack` (copy `Layout` from `src/checkout-emptied.test.tsx`). One navigating `renderRouter` test per file (expo-router keeps navigation state per module). No `level` in `getByRole`; find headings by name. Links not pressed are checked with `toHaveProp('href', …)`. openapi-fetch failures carry the envelope in `error.error`; `call()` in `src/api.ts` already unwraps it.
- Router tests through `appDir` render the real root layout: if the first-visit pincode sheet or Home's reads get in the way, `setPincode('560034')` and fake `GET /serviceability` as `src/account-sign-out.test.tsx` does.
- UI: colours, radius and spacing only from `src/ui/tokens.ts`; muted text (`tone="inkMuted"`) only on `surface`; compose `src/ui/` primitives, no one-off look-alikes.
- Gates, in order, paste the last lines into your log (if `node_modules` is missing, run `npm ci` first with the same prefix):
  - `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P5-L1 && npm run build --workspace packages/ui && npm run lint --workspace apps/mobile && npm run typecheck --workspace apps/mobile && npm run test --workspace apps/mobile && npm run build --workspace apps/mobile && openspec validate --all --strict`
  - One file while working: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P5-L1/apps/mobile && npx jest --ci <file>`
  - Tasks 4 and 5, with the slot only: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P5-L1 && make e2e` (paste every suite's summary line).

## Order

- Group A, in parallel: task 1 (`mobile-P5-L1-T1`) and task 3 (`mobile-P5-L1-T3`); disjoint files.
- Group B: task 2 (`mobile-P5-L1-T2`) after task 1's `feat:` commit (it renders `VerifyEmailCard`).
- Group C: task 4 (`mobile-P5-L1-T4`) after tasks 2 and 3; needs the e2e slot.
- Group D: task 5 (`mobile-P5-L1-T5`) after task 4; needs the e2e slot.
- Then 6.1, the team lead's acceptance.

## 1. Verification card on "My account" and checkout (`mobile-P5-L1-T1`)

Scope: `src/verify-email-card.tsx` (new), `src/verify-email-card.test.tsx` (new), `src/app/account.tsx` (one line in `AccountContent` and the import), `src/checkout-screen.tsx` (one line under the header, the `cardPad` style and the import).

Scenarios: "Mobile email verification card" › Unverified customer sees the card, Verified customer sees no card; "Mobile sends a verification email" › Verification email sent, Already verified when sending, Sending fails. Build: design.md Decision 1.

Starts from: `src/verify-email-card.test.tsx` with five tests, rendering the real screens under `QueryClientProvider` and no router (copy `renderAccount` from `src/account.test.tsx` and `renderScreen` from `src/checkout-screen.test.tsx`, with its fonts mock), `setToken('t-1')`, `fakeCore` answering `GET /me` with `{ id, email: 'asha@example.com', name: 'Asha Rao', emailVerified }` and `GET /me/addresses` with `{ items: [] }`:
- `unverified customer sees the card`: `emailVerified: false`; on the account, `findByText('Verify your email to pay online')` and the button "Send verification email"; then (same test, unmount first) on checkout with `GET /me/cart` unanswered (fakeCore's 404), the same two.
- `verified customer sees no card`: `emailVerified: true`; wait for "Asha Rao", then no such text and no such button.
- `verification email sent`: `POST /me/email-verification` → `json(202)`; press; "Verification email sent", button "Enter the code", no "Send verification email" button, exactly one `POST` to `/api/core/v1/me/email-verification` in the calls.
- `already verified when sending`: the POST answers `apiError(409, 'conflict', 'email already verified')`; `GET /me` answers `emailVerified: false` the first time and `true` after; press; `waitFor` the card text gone; `GET /me` was called at least twice.
- `sending fails`: the POST handler throws `new TypeError('Network request failed')`; press; `findByRole('alert')` has text "Could not reach ShopperStop. Try again."; the button is shown and its `accessibilityState` has `disabled: false`.
Red: no card text on either screen (four fail; "verified customer sees no card" passes before the feature and guards; note it in your log).

Commits: `test: verification card on the account and checkout`, `feat: verification card on the account and checkout`.

- [x] 1.1 Write the five tests; run `npx jest --ci src/verify-email-card.test.tsx`; see them fail as above; commit.
- [x] 1.2 Build Decision 1; `src/account.test.tsx`, `src/checkout-screen.test.tsx` and every other test pass unchanged; run the gates; tick 1.1 and 1.2; commit.

## 2. Verify-email screen (`mobile-P5-L1-T2`)

Scope: `src/app/verify-email.tsx` (new), `src/verify-email.test.tsx` (new), `src/verify-email-continue.test.tsx` (new), `src/verify-email-card-enter.test.tsx` (new).

Scenarios: "Mobile verify-email screen" › Empty code checked; "Mobile verify-email outcome" › Email verified from the link, Email verified with a typed code, Continue opens the account; "Mobile verify-email failures" › Expired code while signed in, Expired code while signed out, Verification unreachable then retried; "Mobile sends a verification email" › Enter the code opens the verify screen. Build: design.md Decisions 2 and 3.

Starts from:
- `src/verify-email.test.tsx`, non-navigating, `renderRouter({ _layout: Layout, 'verify-email': VerifyEmail }, { initialUrl })` with `VerifyEmail` imported from `./app/verify-email`: `empty code checked` (`/verify-email`, press "Verify email", "Enter the code from the email", calls empty); `email verified from the link` (`/verify-email?token=c-1`, `POST /auth/verify-email` → `json(204)`, "Your email is verified", button "Continue", exactly one POST whose body is `{"token":"c-1"}`); `email verified with a typed code` (`/verify-email`, `changeText` the "Code from the email" input to ` c-2 `, press "Verify email", body `{"token":"c-2"}`, "Your email is verified"); `expired code while signed in` (`setToken('t-1')`, `GET /me` `emailVerified: false`, POST → `apiError(400, 'validation', 'invalid or expired token', 'token')`; alert "This code is invalid or has expired.", the "Code from the email" input, button "Send verification email"); `expired code while signed out` (no token, same 400; the alert and link "Sign in to get a new code" with `href` `/sign-in?returnTo=%2Faccount`); `verification unreachable then retried` (POST throws `TypeError` the first time, `json(204)` the second; alert "Could not reach ShopperStop. Try again.", press "Try again", "Your email is verified").
- `src/verify-email-continue.test.tsx`: `continue opens the account`, `renderRouter(appDir, { initialUrl: '/verify-email?token=c-1' })` (copy the header of `src/account-sign-out.test.tsx`), token held, `GET /me` `emailVerified: true`, `GET /me/addresses` `{ items: [] }`, POST 204; press "Continue"; heading "My account"; pathname `/account`.
- `src/verify-email-card-enter.test.tsx`: `enter the code opens the verify screen`, `renderRouter(appDir, { initialUrl: '/account' })`, token held, `GET /me` `emailVerified: false`, `GET /me/addresses`, `POST /me/email-verification` 202; press "Send verification email", then "Enter the code"; pathname `/verify-email`; the "Code from the email" input is shown.
Red: the map tests fail on the missing module `./app/verify-email` (create it as `export default function VerifyEmail() { return null }` in the test commit so the failures are on the assertions, and say so in your log); the two router tests show "Page not found".

Commits: `test: verify-email screen`, `feat: verify-email screen`.

- [ ] 2.1 Write the eight tests (with the empty route stub); run the three files; see them fail on their assertions; commit.
- [ ] 2.2 Build Decisions 2 and 3; run the gates (`npm run build --workspace apps/mobile` must list `/verify-email`); tick 2.1 and 2.2; commit.

## 3. Forgot and reset password, sign-in link (`mobile-P5-L1-T3`)

Scope: `src/auth-forms.tsx` (the two new screens, the sign-in link, the `linkRow` style), `src/app/forgot-password.tsx` (new), `src/app/reset-password.tsx` (new), `src/password-reset.test.tsx` (new), `src/password-forgot-link.test.tsx` (new), `src/password-forgot-sent.test.tsx` (new), `src/password-reset-sign-in.test.tsx` (new).

Scenarios: "Mobile forgot-password link" › Forgot-password link on sign-in; "Mobile forgot-password screen" › Empty email checked; "Mobile forgot-password outcome" › Reset code requested, Enter the code opens the reset screen, Malformed email from core, Too many reset requests; "Mobile reset-password screen" › Code from the link; "Mobile reset-password checks" › Reset form checks fields; "Mobile reset-password outcome" › Password reset, Sign in after the reset; "Mobile reset-password refusals" › Password refused by core, Expired reset code. Build: design.md Decisions 2 and 4.

Starts from:
- `src/password-reset.test.tsx`, non-navigating, `renderRouter({ 'forgot-password': ForgotPassword, 'reset-password': ResetPassword }, { initialUrl })` with the route files' default exports: `empty email checked`; `reset code requested` (` asha@example.com `, `POST /auth/password-reset` → `json(202)`, body `{"email":"asha@example.com"}`, the success text, button "Enter the code", no "Send reset code"); `malformed email from core` (400 field `email` "must be a valid email address" under Email, `queryByRole('alert')` null); `too many reset requests` (`apiError(429, 'rate_limited', 'too many attempts, try again later')`, alert text, "Send reset code" still shown); `code from the link` (`/reset-password?token=r-1`, the "Code from the email" input's `value` is `r-1`); `reset form checks fields` (the three submits of the scenario, calls empty); `password reset` (`setToken('t-1')`, `/reset-password?token=r-1`, `newpass123` twice, `POST /auth/password-reset/confirm` → `json(204)`, body `{"token":"r-1","password":"newpass123"}`, `getToken()` undefined, the success text, button "Sign in"); `password refused by core` (400 field `password` "must be 8 to 72 bytes"); `expired reset code` (400 field `token`; "This code is invalid or has expired.", link "Request a new code" with `href` `/forgot-password`, "Set password" still shown).
- `src/password-forgot-link.test.tsx`: `forgot-password link on sign-in`, `renderRouter(appDir, { initialUrl: '/sign-in' })`; press "Forgot password?"; heading "Forgot password"; pathname `/forgot-password`.
- `src/password-forgot-sent.test.tsx`: `enter the code opens the reset screen`, `appDir` at `/forgot-password`, 202, press "Enter the code"; heading "Reset password"; pathname `/reset-password`.
- `src/password-reset-sign-in.test.tsx`: `sign in after the reset`, `appDir` at `/reset-password?token=r-1`, 204, press "Sign in"; heading "Sign in"; pathname `/sign-in`.
Red: commit the two route files as `export default function ForgotPassword() { return null }` and `export default function ResetPassword() { return null }` with the tests so the map tests fail on their assertions; the sign-in test finds no "Forgot password?" link.

Commits: `test: forgot and reset password screens`, `feat: forgot and reset password screens`.

- [x] 3.1 Write the twelve tests (with the empty route stubs); run the four files; see them fail on their assertions; commit.
- [x] 3.2 Build Decision 4 (route files re-export `ForgotPasswordScreen` and `ResetPasswordScreen` as `sign-in.tsx` does); `src/auth-forms*.test.tsx` pass unchanged; run the gates (`npm run build --workspace apps/mobile` lists `/forgot-password` and `/reset-password`); tick 3.1 and 3.2; commit.

## 4. End to end against core (`mobile-P5-L1-T4`)

Scope: `playwright.config.ts` (core's `webServer` command, the `coreLog` import and the `mkdirSync` only), `e2e/mail.ts` (new), `e2e/account-security.spec.ts` (new).

Scenarios: "Mobile account security end-to-end" › Email verified against core, Password reset against core. Build: design.md Decision 5.

Starts from: `e2e/mail.ts` (`coreLog`, `mailedCode`, copied from `apps/web/e2e/mail.ts` with `path.resolve(__dirname, '.tmp/core.log')`) and `e2e/account-security.spec.ts` › `email verified against core` and `password reset against core`, steps as Decision 5, axe (`expectNoViolations`) after each screen named there. Red under `make e2e` with the config unchanged: both tests time out in `mailedCode` with `no "<subject>" mail to <email> in …/apps/mobile/e2e/.tmp/core.log`; every other spec passes.

Commits: `test: verify and reset against core`, `feat: mobile e2e writes core's log to e2e/.tmp/core.log`.

- [ ] 4.1 Write `e2e/mail.ts` and the two tests; with the slot, run `make e2e`; see both fail on the `mailedCode` timeout and every other test pass; commit.
- [ ] 4.2 Change `playwright.config.ts` as Decision 5 says; with the slot, `make e2e` all green; run the gates; tick 4.1 and 4.2; commit.

## 5. e2e hygiene: picks read once, shared helpers (`mobile-P5-L1-T5`)

Scope: `e2e/support.ts` (new), `e2e/global-setup.ts`, and the helper blocks, imports and helper call sites of `e2e/accounts.spec.ts`, `e2e/catalog.spec.ts`, `e2e/cart.spec.ts`, `e2e/checkout.spec.ts`, `e2e/orders.spec.ts`, `e2e/flow.spec.ts`, `e2e/account-security.spec.ts`. No expectation, step or copy changes in any test.

Scenario: "Mobile end-to-end picks read once" › Picks answer from the setup read. Build: design.md Decision 6.

No failing test first, and why: a refactor of the e2e suite with no app behaviour; the suite is its own test (it must stay green), and "picks read once" is proved by `orderPick` and `homePicks` being synchronous (typecheck fails on any leftover `await orderPick(request, …)`). One commit, `refactor: mobile e2e picks read once in global setup, shared helpers in e2e/support.ts`.

- [ ] 5.1 Build Decision 6; `npm run lint --workspace apps/mobile` and `npm run typecheck --workspace apps/mobile` green; `grep -n "function freshEmail\|function expectNoViolations\|function orderPick\|function homePicks" apps/mobile/e2e/*.spec.ts` prints nothing; with the slot, `make e2e` with every mobile spec green (paste the mobile count: the previous count plus 2); run the gates; tick 5.1; commit.

## 6. Acceptance (team lead)

- [ ] 6.1 `/opsx:verify mobile-account-security`: every scenario in design.md's map has its passing test, tasks 1 to 5 ticked, nothing outside the Files list changed against origin/main, `openspec validate --all --strict` green.
