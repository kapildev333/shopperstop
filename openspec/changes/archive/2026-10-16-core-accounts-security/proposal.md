## Why

Spec 2 §14 deferred email verification and password reset; Phase 2 left two related ceilings (a password reset cannot end the old sessions because there is no reset, and `seed-demo --reset` is not guarded against a non-local database). PLAN.md D46 gives core the gateway-free half of Phase 5 while mobile finishes: verification, reset, the session sweep and the seed guard. The payment half waits on the owner's gateway choice.

## What Changes

- Migration 0010: `customers.email_verified boolean not null default false`; table `customer_tokens` (peppered `sha256` hash only, `purpose` `verify_email` or `reset_password`, 24 h expiry, one row per customer and purpose).
- `Customer` gains `emailVerified` (always present). `seed-demo` loads the demo customer verified.
- Mail is a process boundary: `auth.Mailer` (one method); the service uses `auth.LogMailer`, which writes the message and its code to the log; tests capture mail with a fake. No SMTP library, no new dependency.
- `POST /api/core/v1/me/email-verification` (signed-in customer): mails a code, 202; 409 `conflict` when already verified.
- `POST /api/core/v1/auth/verify-email {token}`: spends the code, sets `emailVerified`, 204; a bad, used, expired, replaced or other-purpose code is 400 `validation` field `token`.
- `POST /api/core/v1/auth/password-reset {email}`: 202 whether or not the email is registered (mail only when it is); malformed email 400 field `email`; counts against the sign-in limiter (429).
- `POST /api/core/v1/auth/password-reset/confirm {token, password}`: register's password rules (checked before the code is spent), bcrypt cost 12, marks the email verified, deletes every session of the customer, 204, in one transaction.
- Expired sessions: already swept on every session start (core-P3-L3, accounts "Expired sessions are deleted"); nothing added. Mailed tokens need no sweep: at most two rows per customer.
- `core-admin seed-demo [--reset]` refuses a database URL naming any host but `localhost`, `127.0.0.1`, `::1` or a Unix socket, unless `--force`; usage `seed-demo [--reset] [--force]`.
- Contract: `openapi.json` (four routes, `TokenRequest`, `PasswordResetRequest`, `PasswordResetConfirm`, `Customer.emailVerified` and every customer example; plus platform-P4-L3's mechanical reorder of the `POST /admin/orders/{id}/status` request examples, rider first); regenerated `packages/ui/src/api/core.d.ts` (D19), the Postman collection (D23) and every `internal/*/db/models.go`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `accounts`: MODIFIED "Customers register with email and password" (`emailVerified`), "Sign-in and registration are rate limited" (reset requests count), "Demo customer" (verified); ADDED "Customers verify their email", "Customers reset a forgotten password", "Mailed codes are single use and expire", "Mail is logged until a transport exists".
- `platform`: ADDED "Seed-demo refuses a database on another machine".

## Impact

- Area: `core`. Files under `services/core/`: `migrations/0010_customer_tokens.sql` (new), `queries/auth.sql` and sqlc output, `internal/auth` (`auth.go`, `customer.go`, new `account.go`, `mail.go`, `mail_test.go`), `internal/app/app.go` and tests (`app_test.go`, `accounts_test.go`, new `email_verification_test.go`, `password_reset_test.go`), `internal/seed` (`seed.go`, `seed_test.go`), `cmd/core-admin` (`main.go`, `main_test.go`), `openapi.json`. Generated: `packages/ui/src/api/core.d.ts`, `docs/postman/shopperstop-core.postman_collection.json`.
- Contracts relied on: `services/core/openapi.json` (core to the apps).
- Cross-area: `Customer.emailVerified` is required, so `apps/mobile/src/profile-sheet.test.tsx` line 7 (an untyped `customer` literal passed as `Customer`) fails `tsc` with TS2741 three times (spiked). Adding `emailVerified: false` to that literal typechecks against both the current and the new `core.d.ts` and keeps the test green (spiked); it must reach main before Task 1 merges. Web, admin, rider and `packages/ui` typecheck unchanged (spiked).
- platform-P4-L3 also regenerates `docs/postman/`: whichever of the two merges second merges `origin/main`, re-runs `make postman` and commits the collection (the manager handles it at landing).
- No new dependency. No new environment variable.
- Out of scope (follow-ups): staff password reset under `/admin/auth/password-reset*` (admins already set a staff password with `PATCH /admin/staff-users/{id}`; a locked-out last admin uses `core-admin create-admin`); the web, mobile and admin screens (verify banner, forgot-password and reset pages), relayed by the orchestrator after merge; a real mail transport and a link to a web page in the mail; requiring a verified email for anything (payment, D46); changing the email address; a `core-admin sweep-sessions` command.
