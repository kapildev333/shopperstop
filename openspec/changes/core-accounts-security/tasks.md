# Tasks

Three worker tasks, in order, on branch `lane/core-P4-L2-accounts-security` in `.worktrees/core-P4-L2`. Every code block is verbatim in `design.md` ("Task 1", "Task 2", "Task 3"); a choice neither file settles is a stop-and-report. Task 3 touches no file of Tasks 1 and 2.

Databases (D26): tests only, on the per-run schemas of `shopperstop_core_test`. No `core-admin migrate`, no `seed-demo`, no `make dev`/`make seed`/`make e2e`, no client on `shopperstop_core` or `shopperstop_core_e2e`, no `docker`.

Gates, from `services/core` with `SHOPPERSTOP_CORE_TEST_DATABASE_URL=postgres://shopperstop_core:shopperstop_core@localhost:5432/shopperstop_core_test?sslmode=disable`: `gofmt -l .` empty, `go vet ./...`, `go test -race -count=1 ./...`. From the worktree root with `PATH=$HOME/.local/node-v22.23.3/bin:$PATH` (`npm ci` once if `node_modules` is missing): `make gen postman`, then `git status --short` clean after the last commit; `make test-web` (fails only with the three mobile TS2741 lines of design.md "Cross-area" until that line is on main and merged here); `openspec validate --all --strict`.

Landing (manager): platform-P4-L3 also regenerates `docs/postman/`; whichever merges second merges `origin/main`, re-runs `make postman` and commits the collection.

## 1. Email verification

Scope: `services/core/migrations/0010_customer_tokens.sql` (new), `services/core/queries/auth.sql`, sqlc output (`services/core/internal/auth/db/*` and every `services/core/internal/*/db/models.go`, regenerated only), `services/core/internal/auth/{auth.go,customer.go,account.go,mail.go,mail_test.go}`, `services/core/internal/app/{app.go,app_test.go,accounts_test.go,email_verification_test.go}`, `services/core/internal/seed/{seed.go,seed_test.go}`, `services/core/openapi.json`, generated `packages/ui/src/api/core.d.ts` and `docs/postman/shopperstop-core.postman_collection.json`, this file (ticks). Scenarios: accounts "Customers register with email and password" / New customer is unverified; "Customers verify their email" (all three); "Mailed codes are single use and expire" (all three); "Mail is logged until a transport exists"; "Demo customer" / Reset twice. Starts from `internal/app/email_verification_test.go` `TestRegisteredCustomerIsUnverified`, `TestEmailVerification`, `TestVerifyEmailBadToken`, `TestNewVerificationTokenReplacesOld`, `TestMailedTokenStoredHashed` (red: the package does not compile, `auth.Mail` and `Auth.Mailer` undefined), `internal/auth/mail_test.go` `TestLogMailerLogsTheMessage` (red: does not compile) and `internal/seed/seed_test.go` `TestResetTwiceLeavesDemoAccounts` (red: relation `customer_tokens` does not exist). Commits: `test: email verification, mailed codes and the verified demo customer`, `feat: email verification (migration 0010, mailer, two routes)`.

- [x] 1.1 `git apply --include='*_test.go'` the Task 1 block; run `go test -race -count=1 ./internal/app ./internal/auth ./internal/seed` and see the three failures above; commit.
- [x] 1.2 `git apply --exclude='*_test.go'` the Task 1 block; `make gen`; run the Task 1 `openapi.json` script; `make gen postman`; run the gates; tick 1.1 and 1.2; commit.

## 2. Password reset

Scope: `services/core/queries/auth.sql`, sqlc output (`services/core/internal/auth/db/auth.sql.go`, regenerated only), `services/core/internal/auth/account.go`, `services/core/internal/app/{app.go,password_reset_test.go}`, `services/core/openapi.json`, generated `core.d.ts` and the Postman collection, this file (ticks). Scenarios: accounts "Customers reset a forgotten password" (all five); "Sign-in and registration are rate limited" / Eleventh reset request for one email. Starts from `internal/app/password_reset_test.go` `TestPasswordReset`, `TestPasswordResetUnknownEmail`, `TestPasswordResetBadInput`, `TestPasswordResetTokenExpires`, `TestPasswordResetRateLimited` (red: 404 on both routes). Commits: `test: password reset`, `feat: password reset ends every session`.

- [x] 2.1 `git apply --include='*_test.go'` the Task 2 block; run `go test -race -count=1 -run TestPasswordReset ./internal/app` and see the five fail; commit.
- [x] 2.2 `git apply --exclude='*_test.go'` the Task 2 block; `make gen`; run the Task 2 `openapi.json` script; `make gen postman`; run the gates; tick 2.1 and 2.2; commit.

## 3. Seed-demo guard

Scope: `services/core/cmd/core-admin/main.go`, `services/core/cmd/core-admin/main_test.go`, this file (ticks). Scenarios: platform "Seed-demo refuses a database on another machine" (all four); `TestSeedDemoExitCodes` stays green. Starts from `cmd/core-admin/main_test.go` `TestLocalDatabase`, `TestSeedDemoRefusesRemoteDatabase`, `TestSeedDemoForceSkipsTheGuard`, `TestRunRefusesBadArguments` (red: does not compile, `localDatabase` undefined). Commits: `test: seed-demo refuses a remote database`, `feat: seed-demo guard with --force`.

- [x] 3.1 `git apply --include='*_test.go'` the Task 3 block; run `go test -race -count=1 ./cmd/core-admin` and see it fail; commit.
- [x] 3.2 `git apply --exclude='*_test.go'` the Task 3 block; run the gates (no `openapi.json` change); tick 3.1 and 3.2; commit.

## 4. Reset limiter and mail failure

Scope: `services/core/internal/auth/{auth.go,customer.go,staff.go,account.go}`, `services/core/cmd/core/main.go`, `services/core/internal/app/password_reset_test.go`, `services/core/openapi.json` (the reset description only), generated `core.d.ts` and the Postman collection, the spec delta and `design.md` (wording), this file (ticks). Scenarios: accounts "Sign-in and registration are rate limited" / Reset requests leave sign-in open; "Customers reset a forgotten password" / Mail fails for a registered email. Starts from `internal/app/password_reset_test.go` `TestPasswordResetLeavesSignInOpen` and `TestPasswordResetMailFailureAnswers202` (red: the package did not compile, `Auth.ResetLimit` undefined, so the pin tests `TestResetCodeDoesNotVerifyEmail` and `TestPasswordResetLeavesOtherCustomersSessions` ran with the feat commit). Commits: `test: password reset keeps sign-in open and never reveals a mail failure`, `fix: separate reset limiter; mail failure answers 202`.

- [x] 4.1 Add the failing tests (`TestPasswordResetLeavesSignInOpen`, `TestPasswordResetMailFailureAnswers202`) and the two pins; commit.
- [x] 4.2 `Auth.ResetLimit` built in `main` with the sign-in numbers; `refused` takes its limiter; a mail or token failure for a found email is logged and answers 202; reset description and spec and design wording; regenerate; run the gates; tick 4.1 and 4.2; commit.
