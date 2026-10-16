## ADDED Requirements

### Requirement: Customer email verification banner
`/account` and `/checkout` SHALL show, under the level-1 heading, a `warning` `StatusMessage` "Verify your email to pay online" holding a "Send verification email" button while `GET /me` answers `emailVerified` false, and nothing in its place while `/me` loads, has failed, or answers `emailVerified` true. On `/checkout` the banner SHALL show in every state of the page.

#### Scenario: Unverified customer sees the banner
- **WHEN** a token is held, `GET /me` answers `emailVerified` false, and the app renders `/account`, and separately `/checkout`
- **THEN** each page shows a status "Verify your email to pay online" holding a "Send verification email" button

#### Scenario: Verified customer sees no banner
- **WHEN** a token is held, `GET /me` answers `emailVerified` true, and the app renders `/account`
- **THEN** no "Verify your email to pay online" text and no "Send verification email" button are shown

### Requirement: Customer sends a verification email
"Send verification email" SHALL send `POST /me/email-verification` and be busy meanwhile. On 202 the banner SHALL become a `success` `StatusMessage` "Verification email sent" with no button; on 409 `conflict` the site SHALL read `GET /me` again, so the banner goes once it answers `emailVerified` true; on any other failure an `ErrorBanner` SHALL show the error's message and the button SHALL stay.

#### Scenario: Verification email sent
- **WHEN** an unverified customer on `/account` chooses "Send verification email" and core answers 202
- **THEN** exactly one `POST /api/core/v1/me/email-verification` was sent, a status reads "Verification email sent", and no "Send verification email" button is shown

#### Scenario: Already verified when sending
- **WHEN** the answer is 409 `conflict` and `GET /me` then answers `emailVerified` true
- **THEN** `GET /me` was sent again and the banner is gone

#### Scenario: Sending fails
- **WHEN** core cannot be reached when the customer chooses "Send verification email"
- **THEN** an alert reads "Could not reach ShopperStop. Try again." and the "Send verification email" button is still shown and not busy

### Requirement: Customer verify-email page
`/verify-email?token=<code>` SHALL need no session, show the level-1 heading "Verify email", send `POST /auth/verify-email` `{token}` once when it opens, and show a loading status meanwhile. On 204 it SHALL show a `success` `StatusMessage` "Your email is verified" and a "Continue" link to `/account`, and the site SHALL read `GET /me` again.

#### Scenario: Email verified with the code
- **WHEN** the app renders `/verify-email?token=c-1` and core answers 204
- **THEN** exactly one `POST /api/core/v1/auth/verify-email` was sent with body `{"token":"c-1"}`, a status reads "Your email is verified", and a "Continue" link points to `/account`

### Requirement: Customer verify-email failures
A 400 answer with field `token`, or the page opened without a `token` (nothing sent), SHALL show an alert "This verification link is invalid or has expired." and, while a token is held, the email verification banner; with no token held, a link "Sign in to get a new link" to `/sign-in?returnTo=%2Faccount`. Any other failure SHALL show an alert with the error's message and a "Try again" button that sends the code again.

#### Scenario: Expired code while signed in
- **WHEN** a token is held, `GET /me` answers `emailVerified` false, and `/verify-email?token=old` answers 400 `validation` with field `token`
- **THEN** an alert reads "This verification link is invalid or has expired." and the "Send verification email" button is shown

#### Scenario: Missing code while signed out
- **WHEN** no token is held and the app renders `/verify-email`
- **THEN** no request is sent, the alert reads "This verification link is invalid or has expired.", and a "Sign in to get a new link" link points to `/sign-in?returnTo=%2Faccount`

#### Scenario: Verification unreachable then retried
- **WHEN** the first `POST /auth/verify-email` cannot reach core and the customer chooses "Try again", which core answers 204
- **THEN** an alert first reads "Could not reach ShopperStop. Try again.", and after the retry a status reads "Your email is verified"

### Requirement: Customer forgot-password link
`/sign-in` SHALL show a "Forgot password?" link to `/forgot-password` directly under the password field.

#### Scenario: Forgot-password link on sign-in
- **WHEN** the app renders `/sign-in`
- **THEN** a "Forgot password?" link points to `/forgot-password`

### Requirement: Customer forgot-password page
`/forgot-password` SHALL need no session and show the level-1 heading "Forgot password", an "Email" field, a "Send reset link" button and a "Back to sign in" link to `/sign-in`. An empty email SHALL show "Enter your email" under the field and send nothing; otherwise the button SHALL send `POST /auth/password-reset` with the trimmed email and be busy meanwhile.

#### Scenario: Empty email checked
- **WHEN** the forgot-password form is submitted empty
- **THEN** "Enter your email" shows under the email field and nothing is sent

### Requirement: Customer forgot-password outcome
On 202 the page SHALL show, in place of the form, a `success` `StatusMessage` "If that email has an account, a reset link is on its way"; a 400 with field `email` SHALL show its message under the email field; any other failure, 429 `rate_limited` included, SHALL show an `ErrorBanner` with the error's message and keep the form.

#### Scenario: Reset link requested
- **WHEN** the form is submitted with ` asha@example.com ` and core answers 202
- **THEN** one request was sent with body `{"email":"asha@example.com"}`, a status reads "If that email has an account, a reset link is on its way", and no "Send reset link" button is shown

#### Scenario: Malformed email from core
- **WHEN** core answers 400 `validation` with field `email` and message "must be a valid email address"
- **THEN** "must be a valid email address" shows under the email field and the email input is `aria-invalid`

#### Scenario: Too many reset requests
- **WHEN** core answers 429 `rate_limited` with message "too many attempts, try again later"
- **THEN** an alert reads "too many attempts, try again later" and the "Send reset link" button is still shown

### Requirement: Customer reset-password page
`/reset-password?token=<code>` SHALL need no session and show the level-1 heading "Reset password", "New password" and "Confirm password" fields and a "Set password" button. Before calling core it SHALL flag an empty new password ("Enter a new password"), one outside 8 to 72 bytes ("Use 8 to 72 characters") and a confirmation that differs ("Passwords do not match", under "Confirm password"); else it SHALL send `POST /auth/password-reset/confirm` `{token, password}`, busy meanwhile.

#### Scenario: Reset form checks fields
- **WHEN** the reset form is submitted empty; then with `short1` in both fields; then with `newpass123` and `newpass124`
- **THEN** "Enter a new password", then "Use 8 to 72 characters" show under "New password", then "Passwords do not match" under "Confirm password", and nothing is sent

### Requirement: Customer reset-password outcome
On 204 the site SHALL drop any held token and cached data and show, in place of the form, a `success` `StatusMessage` "Your password is changed. Sign in with your new password." and a "Sign in" link to `/sign-in`. A 400 with field `password` SHALL show its message under "New password"; any other failure but a bad code SHALL show an alert with the error's message and keep the form.

#### Scenario: Password reset
- **WHEN** a token is held, the app renders `/reset-password?token=r-1`, the form is submitted with `newpass123` twice, and core answers 204
- **THEN** one request was sent with body `{"token":"r-1","password":"newpass123"}`, the store holds no token, a status reads "Your password is changed. Sign in with your new password.", and a "Sign in" link points to `/sign-in`

#### Scenario: Password refused by core
- **WHEN** the confirm answers 400 `validation` with field `password` and message "must be 8 to 72 bytes"
- **THEN** "must be 8 to 72 bytes" shows under "New password" and the "Set password" button is still shown

### Requirement: Customer reset-password bad code
A 400 answer with field `token`, or the page opened without a `token` (no form shown, nothing sent), SHALL show an alert "This reset link is invalid or has expired." and a "Request a new link" link to `/forgot-password`.

#### Scenario: Expired reset code
- **WHEN** the confirm answers 400 `validation` with field `token`
- **THEN** an alert reads "This reset link is invalid or has expired." and a "Request a new link" link points to `/forgot-password`

#### Scenario: Missing reset code
- **WHEN** the app renders `/reset-password` with no `token`
- **THEN** no "New password" field is shown, the alert reads "This reset link is invalid or has expired.", and a "Request a new link" link points to `/forgot-password`

### Requirement: Customer account security end to end
`npm run e2e` in `apps/web` SHALL write core's standard output to `apps/web/e2e/.tmp/core.log`, emptied at each start, and SHALL read a mailed code as the last word of the `body` of the newest log line with message `mail`, the given `to` and the given `subject`, waiting up to 10 seconds for it.

#### Scenario: Email verified against core
- **WHEN** a newly registered customer opens `/account`, chooses "Send verification email", and opens `/verify-email?token=<the mailed code>`
- **THEN** "Verification email sent" and then "Your email is verified" are shown, "Continue" leads to `/account` with no "Verify your email to pay online" text, and axe reports no violations on `/account` with the banner and on `/verify-email`

#### Scenario: Password reset against core
- **WHEN** a registered customer follows "Forgot password?" on `/sign-in`, submits their email on `/forgot-password`, opens `/reset-password?token=<the mailed code>`, sets `newpass123`, follows "Sign in" and signs in with `newpass123`
- **THEN** each page shows the outcome above, the browser lands on `/` signed in, signing in with the old password through core answers 401, and axe reports no violations on `/forgot-password` and `/reset-password`
