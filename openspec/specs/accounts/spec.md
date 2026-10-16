# accounts Specification

## Purpose
Customer accounts for `services/core`: registration and sign-in with email and password, bearer sessions, the customer profile, delivery addresses, and the rate limits that protect sign-in. Everything a customer owns (cart, orders) sits behind the session this capability issues.

## Requirements

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

### Requirement: Customers sign in and out
`POST /api/core/v1/auth/sign-in` SHALL accept `{email, password}` and answer 200 `{token, customer}` with a new session, without revoking the customer's other sessions. A wrong password and an unknown email SHALL both answer 401 `unauthorized` with the same message. `POST /api/core/v1/auth/sign-out` SHALL delete the session of the bearer token it carries and answer 204.

#### Scenario: Sign-in keeps other sessions
- **WHEN** a customer signs in twice and gets tokens A and B
- **THEN** both A and B answer `GET /me` with 200

#### Scenario: Wrong password and unknown email look the same
- **WHEN** a client signs in with a registered email and a wrong password, and then with an unregistered email
- **THEN** both responses are 401 with code `unauthorized` and identical messages

#### Scenario: Sign-out ends only that session
- **WHEN** a customer holding tokens A and B signs out with A
- **THEN** the response is 204, `GET /me` with A answers 401, and `GET /me` with B answers 200

### Requirement: Customer bearer sessions
Customer routes SHALL require `Authorization: Bearer <token>` naming a live customer session, and answer 401 `unauthorized` otherwise (missing header, other scheme, unknown token, expired session, or a staff token). A token SHALL be 32 random bytes in unpadded base64url; the database SHALL hold only `sha256(token || pepper)`, never the token. A customer session SHALL expire 30 days after its last use, and its last use SHALL be recorded at most once an hour.

#### Scenario: Missing or foreign token
- **WHEN** `GET /me` is requested with no `Authorization` header, with `Basic abc`, with an unknown bearer token, or with a staff bearer token
- **THEN** each response is 401 with code `unauthorized`

#### Scenario: Only the peppered hash is stored
- **WHEN** a customer registers and receives token T
- **THEN** exactly one session row has `token_hash` equal to `sha256(T || pepper)` and no session column contains T

#### Scenario: Expired after 30 idle days
- **WHEN** a customer session's expiry is in the past
- **THEN** `GET /me` with its token answers 401

#### Scenario: Use after an hour slides the expiry
- **WHEN** a session last used 2 hours ago is used for `GET /me`
- **THEN** its last use becomes the current time and its expiry becomes 30 days from now

#### Scenario: Use within the hour writes nothing
- **WHEN** a session last used 30 minutes ago is used for `GET /me`
- **THEN** its last use and expiry are unchanged

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

### Requirement: Customer profile
`GET /api/core/v1/me` SHALL answer 200 with the signed-in customer. `PATCH /api/core/v1/me` SHALL accept any of `name` (1 to 100 characters after trimming) and `phone` (empty to clear, otherwise an optional `+` and 10 to 15 digits), change only the fields present, and answer 200 with the updated customer.

#### Scenario: Name and phone change
- **WHEN** a customer patches `{"name":"Asha R","phone":"+919800000001"}`
- **THEN** the response is 200 with that name and phone, and `GET /me` returns the same

#### Scenario: Empty phone clears it
- **WHEN** a customer with a phone patches `{"phone":""}`
- **THEN** the response has no `phone` field

#### Scenario: Bad phone
- **WHEN** a customer patches `{"phone":"call me"}`
- **THEN** the response is 400 with code `validation` and field `phone`

### Requirement: Customer addresses
A signed-in customer SHALL list, create, change and delete their own addresses at `/api/core/v1/me/addresses`: `GET` answers a paged list with the default first, then newest first; `POST` answers 201; `PATCH /{id}` changes only the fields present and answers 200; `DELETE /{id}` answers 204. Another customer's address id SHALL answer 404 `not_found`. Deleting the last or the default address SHALL be allowed.

#### Scenario: Create and list
- **WHEN** a customer creates `{"label":"Home","line1":"12 Main Rd","pincode":"560034","isDefault":true}` and then `{"label":"Work","line1":"1 Park St","pincode":"560038"}`
- **THEN** both answers are 201 and `GET /me/addresses` returns `total` 2 with Home first and `isDefault` true

#### Scenario: Another customer's address
- **WHEN** customer B patches or deletes customer A's address id
- **THEN** the response is 404 with code `not_found` and A's address is unchanged

#### Scenario: Delete the default address
- **WHEN** a customer deletes their default address
- **THEN** the response is 204 and the address is gone from the list

### Requirement: One default address
A customer SHALL have at most one default address: creating or patching an address with `isDefault` true SHALL clear the previous default in the same transaction.

#### Scenario: New default clears the old one
- **WHEN** the customer patches Work with `{"isDefault":true}`
- **THEN** Work is the only address with `isDefault` true

### Requirement: Address fields are validated
An address SHALL have `label` of 1 to 40 characters, `line1` of 1 to 200, optional `line2` of up to 200 (empty clears it and it is then omitted from responses), and `pincode` of six digits not starting with 0; any other value SHALL answer 400 `validation` naming the field.

#### Scenario: Bad pincode
- **WHEN** a customer creates an address with pincode `56003`
- **THEN** the response is 400 with code `validation` and field `pincode`

#### Scenario: Empty line2 clears it
- **WHEN** a customer patches an address that has a `line2` with `{"line2":""}`
- **THEN** the response has no `line2` field

### Requirement: Demo customer
`core-admin seed-demo --reset` SHALL delete every customer, address and mailed code it does not define and leave the customer `demo@shopperstop.local`, password `demo12345`, id `00000000-0000-4000-8000-000000000201`, email verified, with addresses `00000000-0000-4000-8000-000000000301` (Home, 560034, default) and `00000000-0000-4000-8000-000000000302` (Work, 560038), so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another customer with a mailed code
- **THEN** the other customer and its code are gone, `demo@shopperstop.local` has id `00000000-0000-4000-8000-000000000201`, its email verified and exactly the two fixed addresses, and signing in with `demo12345` answers 200

### Requirement: Expired sessions are deleted
Whenever the core service starts a session (customer registration, customer sign-in, staff sign-in) it SHALL first delete every customer and staff session whose expiry is at or before the current time; a session whose expiry is later SHALL be kept.

#### Scenario: Sign-in sweeps expired sessions
- **WHEN** one customer and one staff session have an expiry in the past, one of each is live, and a new session starts
- **THEN** the two expired rows no longer exist and the two live rows and the new one do

### Requirement: The rate limiter trusts a proxy only when told
`SHOPPERSTOP_CORE_TRUST_PROXY` SHALL accept `true` or `false` (surrounding spaces ignored; unset or empty means `false`) and refuse to start naming the variable on any other value. When `true`, the per-IP sign-in and registration limit SHALL key on the first address of `X-Forwarded-For`, trimmed, or on the connection's address when that is empty; when `false`, `X-Forwarded-For` SHALL be ignored.

#### Scenario: Clients behind a trusted proxy
- **WHEN** the proxy is trusted, the per-IP limit is 2, two sign-ins carry `X-Forwarded-For` first address `203.0.113.7`, then a third, then one with `203.0.113.8`
- **THEN** the third answers 429 `rate_limited` and the one from `203.0.113.8` answers 200

#### Scenario: Proxy not trusted
- **WHEN** the proxy is not trusted, the per-IP limit is 2, and three sign-ins from one connection address carry different `X-Forwarded-For` values
- **THEN** the third answers 429 `rate_limited`

#### Scenario: Unknown value refused
- **WHEN** `SHOPPERSTOP_CORE_TRUST_PROXY` is `yes`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_TRUST_PROXY`

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
