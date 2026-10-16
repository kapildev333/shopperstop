## Why

Core-P4-L2 (#314, archived into `accounts`) gave customers email verification and password reset, but the customer site has no way in: an unverified customer is never told, and a customer who forgot the password has no page. Phase 5's online payment (web-P5-L2) is refused with 409 `email_unverified` until the email is verified, so the site needs the banner and the pages first (PLAN.md Phase 5, D53).

## What Changes

- A verification banner on `/account` and `/checkout` while `GET /me` answers `emailVerified` false: "Verify your email to pay online" with a "Send verification email" button (`POST /me/email-verification`), announcing "Verification email sent" or the error.
- `/verify-email?token=`: posts the code once on open; "Your email is verified" and "Continue" to `/account`, or "This verification link is invalid or has expired." with the banner's resend (signed in) or a sign-in link (signed out).
- `/forgot-password`: email form; always "If that email has an account, a reset link is on its way" on 202; field error, 429 and other failures as alerts.
- `/reset-password?token=`: "New password" and "Confirm password"; on 204 the held session is dropped (core ended it) and the page offers "Sign in".
- `/sign-in` gains "Forgot password?" under the password field.
- e2e: the web suite tees core's stdout to `apps/web/e2e/.tmp/core.log` (already gitignored) and a helper reads the mailed code from the `mail` log line, so verify and reset are walked against the real core, axe on each page.

Out of scope: a mail link in the body (core mails a bare code today; see design "Ceilings"), resend on the verify page for a signed-out customer, the 409 `email_unverified` handling at checkout (web-P5-L2), any change in `packages/ui` or `services/core`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: ADDED "Customer email verification banner", "Customer sends a verification email", "Customer verify-email page", "Customer verify-email failures", "Customer forgot-password link", "Customer forgot-password page", "Customer forgot-password outcome", "Customer reset-password page", "Customer reset-password outcome", "Customer reset-password bad code", "Customer account security end to end". No existing requirement changes.

## Impact

- Area `web`, files under `apps/web/` only (listed in design.md).
- Cross-area contracts relied on, all on main: `services/core/openapi.json` and its generated `packages/ui/src/api/core.d.ts` (`Customer.emailVerified`, `POST /me/email-verification`, `POST /auth/verify-email`, `POST /auth/password-reset`, `POST /auth/password-reset/confirm`); `@shopperstop/ui` exports `StatusMessage`, `ErrorBanner`, `FormField`, `Input`, `Button`, `Card`, `PageHeader`, `buttonClass`; `@shopperstop/ui/app` (`createApiClient` via `src/api.ts`); core's log format (`slog` JSON on stdout, `msg` `mail`, fields `to`, `subject`, `body`, the code as the body's last word; `accounts` "Mail is logged until a transport exists").
- No new dependency.
