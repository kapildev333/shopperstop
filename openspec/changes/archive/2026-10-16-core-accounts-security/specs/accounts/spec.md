## MODIFIED Requirements

### Requirement: Customers register with email and password
`POST /api/core/v1/auth/register` SHALL accept `{email, password, name}`, create a customer and a session, and answer 201 `{token, customer}` where `customer` is `{id, email, name, emailVerified}` (false) plus `phone` when set. The email SHALL be a single address of at most 254 bytes, unique without regard to case; the password SHALL be 8 to 72 bytes; the name SHALL be 1 to 100 characters after trimming. Passwords SHALL be stored only as bcrypt hashes of cost 12.

#### Scenario: Registration returns a working token
- **WHEN** a client registers `new@example.com` with password `password123` and name `Asha`
- **THEN** the response is 201 with a non-empty string `token` and `customer.email` `new@example.com`, and `GET /me` with that token answers 200 with the same customer

#### Scenario: New customer is unverified
- **WHEN** a client registers a new customer
- **THEN** `customer.emailVerified` is `false` in the 201 answer and in `GET /me`

#### Scenario: Email taken in another case
- **WHEN** `new@example.com` is registered and a client registers `NEW@example.com`
- **THEN** the response is 409 with code `conflict` and field `email`

#### Scenario: Password too short or too long
- **WHEN** a client registers with a 7-byte password, or with a 73-byte password
- **THEN** the response is 400 with code `validation` and field `password`

#### Scenario: Invalid email or blank name
- **WHEN** a client registers with email `not-an-email`, or with name `"   "`
- **THEN** the response is 400 with code `validation` and field `email`, or field `name`

#### Scenario: Password stored as bcrypt cost 12
- **WHEN** a customer has registered with password `password123`
- **THEN** the stored hash is a bcrypt hash of cost 12 that matches `password123` and does not contain it

### Requirement: Sign-in and registration are rate limited
The core service SHALL count attempts at customer registration, customer sign-in and staff sign-in in memory per process, against one limiter, and SHALL count password reset requests against a second limiter of its own with the same numbers, so a reset never uses up sign-in attempts. It SHALL answer 429 `rate_limited` to an attempt beyond 10 per email address (compared without case) or beyond 100 per client IP within one hour.

#### Scenario: Eleventh attempt for one email
- **WHEN** a client makes 10 sign-in or registration attempts for `slow@example.com` within an hour and then an 11th
- **THEN** the 11th response is 429 with code `rate_limited`

#### Scenario: Eleventh reset request for one email
- **WHEN** a client asks for a password reset for one email 10 times within an hour and then an 11th time
- **THEN** the first 10 answer 202 and the 11th answers 429 with code `rate_limited`

#### Scenario: Reset requests leave sign-in open
- **WHEN** a client asks for a password reset for a customer's email 11 times within an hour, the 11th answered 429, and then the customer signs in with the right password
- **THEN** the sign-in answers 200

#### Scenario: Hundred and first attempt from one IP
- **WHEN** one IP makes 100 attempts for different emails within an hour and then a 101st
- **THEN** the 101st attempt is refused

#### Scenario: Window passes
- **WHEN** an email was refused and one hour has passed since its window began
- **THEN** the next attempt for that email is allowed

### Requirement: Demo customer
`core-admin seed-demo --reset` SHALL delete every customer, address and mailed code it does not define and leave the customer `demo@shopperstop.local`, password `demo12345`, id `00000000-0000-4000-8000-000000000201`, email verified, with addresses `00000000-0000-4000-8000-000000000301` (Home, 560034, default) and `00000000-0000-4000-8000-000000000302` (Work, 560038), so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another customer with a mailed code
- **THEN** the other customer and its code are gone, `demo@shopperstop.local` has id `00000000-0000-4000-8000-000000000201`, its email verified and exactly the two fixed addresses, and signing in with `demo12345` answers 200

## ADDED Requirements

### Requirement: Customers verify their email
`POST /api/core/v1/me/email-verification` SHALL mail the signed-in customer a verification code and answer 202, or answer 409 `conflict` and mail nothing when the email is already verified. `POST /api/core/v1/auth/verify-email` SHALL accept `{token}` without a session, spend a live verification code, set the customer's `emailVerified` to true and answer 204; any other code SHALL answer 400 `validation` field `token` and change nothing.

#### Scenario: Verify with the mailed code
- **WHEN** an unverified customer asks for a code and posts the mailed code to `/auth/verify-email`
- **THEN** the answers are 202 and 204, exactly one mail went to the customer's email, and `GET /me` shows `emailVerified` true

#### Scenario: Already verified
- **WHEN** a verified customer asks for a verification code
- **THEN** the response is 409 with code `conflict` and no mail is sent

#### Scenario: Bad code
- **WHEN** `/auth/verify-email` gets an empty token, an unknown token, or the customer's expired code
- **THEN** each answers 400 with code `validation` and field `token`, and `emailVerified` stays false

### Requirement: Customers reset a forgotten password
`POST /api/core/v1/auth/password-reset` SHALL accept `{email}` and answer 202 with no body whether or not a customer has that email, mailing a reset code only when one does; a malformed email SHALL answer 400 field `email`. `POST /api/core/v1/auth/password-reset/confirm` SHALL accept `{token, password}`, check the password by the registration rules before spending the code, then set the password, set `emailVerified` true and delete every session of that customer, and answer 204.

#### Scenario: Reset ends every session
- **WHEN** a customer holding tokens A and B asks for a reset and confirms the mailed code with `newpass123`
- **THEN** the answers are 202 and 204, `GET /me` with A and with B answers 401, signing in with the old password answers 401, and signing in with `newpass123` answers 200 with `emailVerified` true

#### Scenario: Unknown email looks the same
- **WHEN** a client asks for a reset for an unregistered email and for a registered one
- **THEN** both answer 202 with the same empty body, and no mail goes to the unregistered address

#### Scenario: Bad password keeps the code
- **WHEN** a customer confirms a live reset code with password `short`, then with `newpass123`
- **THEN** the first answers 400 with field `password` and the second 204

#### Scenario: Bad code
- **WHEN** the confirm route gets an empty token, an unknown token, an expired reset code, a verification code, or a reset code already spent
- **THEN** each answers 400 with code `validation` and field `token`, and the password is unchanged

#### Scenario: Mail fails for a registered email
- **WHEN** a client asks for a reset for a registered email and the code cannot be issued or mailed
- **THEN** the answer is 202 with no body, as for any email, and the failure is logged without the code

#### Scenario: Malformed email
- **WHEN** a client asks for a reset for `not-an-email`
- **THEN** the response is 400 with code `validation` and field `email`

### Requirement: Mailed codes are single use and expire
A mailed code SHALL be 32 random bytes in unpadded base64url, the last word of the mail body; the database SHALL hold only `sha256(code || pepper)`. A code SHALL expire 24 hours after it is issued, work once and only for its purpose (verification or reset), and a new code for the same customer and purpose SHALL replace the earlier one.

#### Scenario: Only the peppered hash is stored
- **WHEN** a customer is mailed a verification code C
- **THEN** exactly one code row of that customer has hash `sha256(C || pepper)`, expires 24 hours from now, and no column of it contains C

#### Scenario: Newer code replaces the older
- **WHEN** a customer asks for a verification code twice and posts the first, then the second
- **THEN** the first answers 400 with field `token` and the second 204

#### Scenario: Used once
- **WHEN** a verification code that has been spent is posted again
- **THEN** the response is 400 with code `validation` and field `token`

### Requirement: Mail is logged until a transport exists
The core service SHALL send mail through one mailer interface. Until a mail transport is chosen, the service SHALL use a mailer that writes each message as one log line `mail` with the recipient, subject and body at level info, code included; tests SHALL capture mail with a fake mailer.

#### Scenario: Message in the log
- **WHEN** the logging mailer sends a mail to `asha@example.com`
- **THEN** one log line with message `mail` carries `to` `asha@example.com` and the mail's subject and body
