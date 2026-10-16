## Why

Core-P4-L2 (#314) gave customers email verification and password reset, and web-P5-L1 (#324) built them on the site. The mobile app has neither: an unverified customer is never told, and a customer who forgot the password cannot get back in from the app. Phase 5's online payment (mobile-P5-L2) is refused with 409 `email_unverified` until the email is verified, so the app needs the banner and the screens first (PLAN.md Phase 5, D53).

Core mails a bare code today (no link; the body's last word). On a phone nothing turns that code into a `shopperstop://` link, so the app takes the code as a field on both the verify and the reset screen, and also from the link (`shopperstop://verify-email?token=`, `/verify-email?token=` on the web export) for when core mails one.

## What Changes

Area `mobile` (`apps/mobile/` only). Capability `mobile-app`, ADDED requirements only.

- A verification card on "My account" (top of the content) and at the top of checkout in every state while `GET /me` answers `emailVerified` false: a `warning` status "Verify your email to pay online" and a "Send verification email" button (`POST /me/email-verification`). On 202 it reads "Verification email sent" with an "Enter the code" button to `/verify-email`; 409 reads `/me` again; other failures show an alert.
- `/verify-email`: with `token` in the URL it posts the code once on open; without one it shows a "Code from the email" field and "Verify email". "Your email is verified" with "Continue" to `/account`; a refused code shows "This code is invalid or has expired." with the field again and the card (signed in) or a sign-in link (signed out).
- `/forgot-password`: Email, "Send reset code"; on 202 "If that email has an account, a reset code is on its way" and "Enter the code" to `/reset-password`; field error, 429 and other failures shown.
- `/reset-password`: "Code from the email" (prefilled from `token` in the URL), "New password", "Confirm password", "Set password"; on 204 the held session is dropped and "Sign in" is offered; a refused code shows under the code field with "Request a new code".
- The sign-in screen gains "Forgot password?" under Password.
- e2e: the mobile suite writes core's stdout to `apps/mobile/e2e/.tmp/core.log` (gitignored by the root `apps/*/e2e/.tmp/`) and reads the mailed code from core's `mail` log line; verify through the link on a direct load of the export, reset through the code typed in the app, axe on each screen.
- Hygiene from the area plan's Found (manager's call, last task): e2e product picks are read once in `e2e/global-setup.ts` and handed to every spec; the helpers copied across five spec files move into one `e2e/support.ts`.

Out of scope: a link in the mail body (core; see design "Contract audit"), a public resend for a signed-out customer (core has no route), the checkout's 409 `email_unverified` handling (mobile-P5-L2), any change outside `apps/mobile/`, a native deep-link e2e (no device runner, D37 ceiling).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `mobile-app`: ADDED "Mobile email verification card", "Mobile sends a verification email", "Mobile verify-email screen", "Mobile verify-email outcome", "Mobile verify-email failures", "Mobile forgot-password link", "Mobile forgot-password screen", "Mobile forgot-password outcome", "Mobile reset-password screen", "Mobile reset-password checks", "Mobile reset-password outcome", "Mobile reset-password refusals", "Mobile account security end-to-end", "Mobile end-to-end picks read once". No existing requirement changes.

## Impact

- Area `mobile`, files under `apps/mobile/` only (listed in design.md).
- Cross-area contracts relied on, all on main: `services/core/openapi.json` through `packages/ui/src/api/core.d.ts` (`Customer.emailVerified`, `POST /me/email-verification`, `POST /auth/verify-email`, `POST /auth/password-reset`, `POST /auth/password-reset/confirm`); `@shopperstop/ui/tokens`; core's log format (`accounts` "Mail is logged until a transport exists": one `slog` JSON line, `msg` `mail`, `to`, `subject`, `body`, the code as the body's last word; subjects "Verify your ShopperStop email" and "Reset your ShopperStop password").
- No new dependency (Expo Router's own linking serves `shopperstop://verify-email`; the scheme is already in `app.json`).
