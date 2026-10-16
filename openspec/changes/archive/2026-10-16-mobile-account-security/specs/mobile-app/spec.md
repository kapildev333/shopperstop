## ADDED Requirements

### Requirement: Mobile email verification card
"My account" (first in its content) and checkout (under its header, in every state of the screen) SHALL show a card holding a `warning` status "Verify your email to pay online" and a "Send verification email" button while `GET /me` answers `emailVerified` false, and nothing in its place while no token is held or `/me` loads, has failed, or answers `emailVerified` true.

#### Scenario: Unverified customer sees the card
- **WHEN** a token is held, `GET /me` answers `emailVerified` false, and the app renders "My account", and separately checkout with a cart core cannot read
- **THEN** each screen shows a status "Verify your email to pay online" and a "Send verification email" button

#### Scenario: Verified customer sees no card
- **WHEN** a token is held, `GET /me` answers `emailVerified` true, and the app renders "My account"
- **THEN** no "Verify your email to pay online" text and no "Send verification email" button are shown

### Requirement: Mobile sends a verification email
"Send verification email" SHALL send `POST /me/email-verification` and be busy meanwhile. On 202 the card SHALL show a `success` status "Verification email sent" and an "Enter the code" button to `/verify-email`, with no "Send verification email" button; on 409 `conflict` the app SHALL read `GET /me` again, so the card goes once it answers `emailVerified` true; on any other failure an alert SHALL show the error's message and the button SHALL stay.

#### Scenario: Verification email sent
- **WHEN** an unverified customer on "My account" chooses "Send verification email" and core answers 202
- **THEN** exactly one `POST /api/core/v1/me/email-verification` was sent, a status reads "Verification email sent", an "Enter the code" button is shown, and no "Send verification email" button is shown

#### Scenario: Enter the code opens the verify screen
- **WHEN** the card reads "Verification email sent" and the customer chooses "Enter the code"
- **THEN** the app is on `/verify-email` and the "Code from the email" input is shown

#### Scenario: Already verified when sending
- **WHEN** the answer is 409 `conflict` and `GET /me` then answers `emailVerified` true
- **THEN** `GET /me` was sent again and the card is gone

#### Scenario: Sending fails
- **WHEN** core cannot be reached when the customer chooses "Send verification email"
- **THEN** an alert reads "Could not reach ShopperStop. Try again." and the "Send verification email" button is shown and enabled

### Requirement: Mobile verify-email screen
`/verify-email` SHALL need no session and show a "Back" button and the level-1 heading "Verify email". With a `token` in the URL (`shopperstop://verify-email?token=<code>` on a device, `/verify-email?token=<code>` on the web export) it SHALL send `POST /auth/verify-email` `{token}` once when it opens; without one it SHALL show a "Code from the email" input and a "Verify email" button that sends the trimmed code, or shows "Enter the code from the email" and sends nothing when it is empty.

#### Scenario: Empty code checked
- **WHEN** the app renders `/verify-email` and the customer chooses "Verify email" with the code empty
- **THEN** "Enter the code from the email" is shown and no request is sent

### Requirement: Mobile verify-email outcome
While the code is being sent the verify screen SHALL show a status "Verifying your email". On 204 it SHALL show a `success` status "Your email is verified" and a "Continue" button to `/account`, and the app SHALL read `GET /me` again.

#### Scenario: Email verified from the link
- **WHEN** the app renders `/verify-email?token=c-1` and core answers 204
- **THEN** exactly one `POST /api/core/v1/auth/verify-email` was sent with body `{"token":"c-1"}`, a status reads "Your email is verified", and a "Continue" button is shown

#### Scenario: Email verified with a typed code
- **WHEN** the app renders `/verify-email`, the customer enters ` c-2 ` in "Code from the email" and chooses "Verify email", and core answers 204
- **THEN** exactly one request was sent with body `{"token":"c-2"}` and a status reads "Your email is verified"

#### Scenario: Continue opens the account
- **WHEN** a signed-in customer's email was verified on `/verify-email` and they choose "Continue"
- **THEN** the "My account" screen is shown

### Requirement: Mobile verify-email failures
A 400 answer with field `token` SHALL show an alert "This code is invalid or has expired.", the "Code from the email" input and "Verify email" again, and, while a token is held, the email verification card; with no token held, a "Sign in to get a new code" link to `/sign-in?returnTo=%2Faccount`. Any other failure SHALL show an alert with the error's message and a "Try again" button that sends the code again.

#### Scenario: Expired code while signed in
- **WHEN** a token is held, `GET /me` answers `emailVerified` false, and `/verify-email?token=old` is answered 400 `validation` with field `token`
- **THEN** an alert reads "This code is invalid or has expired.", the "Code from the email" input is shown, and the "Send verification email" button is shown

#### Scenario: Expired code while signed out
- **WHEN** no token is held and `/verify-email?token=old` is answered 400 `validation` with field `token`
- **THEN** the alert reads "This code is invalid or has expired." and a "Sign in to get a new code" link is shown

#### Scenario: Verification unreachable then retried
- **WHEN** the first `POST /auth/verify-email` for `/verify-email?token=c-1` cannot reach core and the customer chooses "Try again", which core answers 204
- **THEN** an alert first reads "Could not reach ShopperStop. Try again.", and after the retry a status reads "Your email is verified"

### Requirement: Mobile forgot-password link
The sign-in screen SHALL show a "Forgot password?" link to `/forgot-password` directly under the Password field, at least 44 points tall.

#### Scenario: Forgot-password link on sign-in
- **WHEN** the app renders `/sign-in` and the customer chooses "Forgot password?"
- **THEN** the app is on `/forgot-password` and the heading "Forgot password" is shown

### Requirement: Mobile forgot-password screen
`/forgot-password` SHALL need no session and show the `brand` header with a "Back" button and the level-1 heading "Forgot password", an "Email" input, a "Send reset code" button and a "Back to sign in" link to `/sign-in`. An empty email SHALL show "Enter your email" under the input and send nothing; otherwise the button SHALL send `POST /auth/password-reset` with the trimmed email and be busy meanwhile.

#### Scenario: Empty email checked
- **WHEN** the forgot-password form is submitted empty
- **THEN** "Enter your email" shows under Email and no request is sent

### Requirement: Mobile forgot-password outcome
On 202 the screen SHALL show, in place of the form, a `success` status "If that email has an account, a reset code is on its way" and an "Enter the code" button to `/reset-password`; a 400 with field `email` SHALL show its message under Email; any other failure, 429 `rate_limited` included, SHALL show an alert with the error's message and keep the form.

#### Scenario: Reset code requested
- **WHEN** the form is submitted with ` asha@example.com ` and core answers 202
- **THEN** one request was sent with body `{"email":"asha@example.com"}`, a status reads "If that email has an account, a reset code is on its way", an "Enter the code" button is shown, and no "Send reset code" button is shown

#### Scenario: Enter the code opens the reset screen
- **WHEN** the reset code was requested and the customer chooses "Enter the code"
- **THEN** the app is on `/reset-password` and the heading "Reset password" is shown

#### Scenario: Malformed email from core
- **WHEN** core answers 400 `validation` with field `email` and message "must be a valid email address"
- **THEN** "must be a valid email address" shows under Email and no alert is shown

#### Scenario: Too many reset requests
- **WHEN** core answers 429 `rate_limited` with message "too many attempts, try again later"
- **THEN** an alert reads "too many attempts, try again later" and the "Send reset code" button is still shown

### Requirement: Mobile reset-password screen
`/reset-password` SHALL need no session and show the `brand` header with a "Back" button and the level-1 heading "Reset password", a "Code from the email" input holding the URL's `token` when there is one, "New password" (hint "8 to 72 characters") and "Confirm password" inputs and a "Set password" button.

#### Scenario: Code from the link
- **WHEN** the app renders `/reset-password?token=r-1`
- **THEN** the "Code from the email" input holds `r-1`

### Requirement: Mobile reset-password checks
Before calling core the reset screen SHALL flag an empty code ("Enter the code from the email"), an empty new password ("Enter a new password"), one outside 8 to 72 bytes ("Use 8 to 72 characters") and a confirmation that differs ("Passwords do not match"), each under its input, and send nothing; else "Set password" SHALL send `POST /auth/password-reset/confirm` `{token, password}` with the trimmed code and be busy meanwhile.

#### Scenario: Reset form checks fields
- **WHEN** the reset form is submitted empty; then with code `r-1` and `short1` in both password inputs; then with `newpass123` and `newpass124`
- **THEN** "Enter the code from the email" and "Enter a new password" show, then "Use 8 to 72 characters" under "New password", then "Passwords do not match" under "Confirm password", and no request is sent

### Requirement: Mobile reset-password outcome
On 204 the app SHALL drop any held token and cached data and show, in place of the form, a `success` status "Your password is changed. Sign in with your new password." and a "Sign in" button to `/sign-in`.

#### Scenario: Password reset
- **WHEN** a token is held, the app renders `/reset-password?token=r-1`, the form is submitted with `newpass123` twice, and core answers 204
- **THEN** one request was sent with body `{"token":"r-1","password":"newpass123"}`, the store holds no token, a status reads "Your password is changed. Sign in with your new password.", and a "Sign in" button is shown

#### Scenario: Sign in after the reset
- **WHEN** the password was reset and the customer chooses "Sign in"
- **THEN** the app is on `/sign-in` and the heading "Sign in" is shown

### Requirement: Mobile reset-password refusals
A 400 with field `token` SHALL show "This code is invalid or has expired." under the code input and a "Request a new code" link to `/forgot-password`; a 400 with field `password` SHALL show its message under "New password"; any other failure SHALL show an alert with the error's message. The form SHALL stay after any failure.

#### Scenario: Password refused by core
- **WHEN** the confirm is answered 400 `validation` with field `password` and message "must be 8 to 72 bytes"
- **THEN** "must be 8 to 72 bytes" shows under "New password" and the "Set password" button is still shown

#### Scenario: Expired reset code
- **WHEN** the confirm is answered 400 `validation` with field `token`
- **THEN** "This code is invalid or has expired." shows under "Code from the email", a "Request a new code" link is shown, and the "Set password" button is still shown

### Requirement: Mobile account security end-to-end
`npm run e2e` in `apps/mobile` SHALL write core's standard output to `apps/mobile/e2e/.tmp/core.log`, emptied at each start, and SHALL read a mailed code as the last word of the `body` of the newest log line with message `mail`, the given `to` and the given `subject`, waiting up to 10 seconds for it.

#### Scenario: Email verified against core
- **WHEN** a newly registered customer opens "My account" on the web export, chooses "Send verification email", and the browser loads `/verify-email?token=<the mailed code>` directly
- **THEN** "Verification email sent" and then "Your email is verified" are shown, "Continue" shows "My account" with no "Verify your email to pay online" text, and axe reports no violations on "My account" with the card and on the verify screen

#### Scenario: Password reset against core
- **WHEN** a registered customer chooses "Forgot password?" on sign-in, submits their email, chooses "Enter the code", types the mailed code and `newpass123` twice, chooses "Set password", then "Sign in", and signs in with `newpass123`
- **THEN** each screen shows the outcome above, the browser lands on `/` with a stored token, signing in with the old password through core answers 401, and axe reports no violations on the forgot-password and reset-password screens

### Requirement: Mobile end-to-end picks read once
The mobile e2e suite's global setup SHALL, after the reseed, read once the store and product lists the specs pick from and hand them to every spec, so `orderPick(n)` and `homePicks(minimum, storeId)` answer from that read without a request, and an order one spec places cannot shift another spec's pick.

#### Scenario: Picks answer from the setup read
- **WHEN** `npm run e2e` runs the mobile suite
- **THEN** every spec takes its products from `e2e/support.ts`'s `orderPick` and `homePicks`, which read only what global setup handed over, and every mobile spec passes
