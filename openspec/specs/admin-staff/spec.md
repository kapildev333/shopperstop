# admin-staff Specification

## Purpose
Staff accounts for the admin panel: staff sign-in and sessions, the two roles (admin, store staff), management of staff users by admins, the first admin from the command line, and the dashboard. Store staff are scoped to one store; admins see every store.

## Requirements

### Requirement: Staff sign in and out
`POST /api/core/v1/admin/auth/sign-in` SHALL check `{email, password}` against staff users only and answer 200 `{token, staff}`, where `staff` is `{id, email, name, role, isActive}` plus `storeId` for store staff. Wrong password, unknown email, customer credentials and inactive staff SHALL answer 401 `unauthorized` with one message; attempts share the accounts rate limits. `POST /admin/auth/sign-out` SHALL delete its session (204) and `GET /admin/me` SHALL answer the signed-in staff user.

#### Scenario: Store staff signs in
- **WHEN** an active store-staff user signs in with the right password
- **THEN** the response is 200 with a string `token`, `staff.role` `store_staff` and `staff.storeId`, and `GET /admin/me` with that token answers 200 with the same staff user

#### Scenario: Inactive staff cannot sign in
- **WHEN** a staff user whose `isActive` is false signs in with the right password
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Customer credentials on the staff sign-in
- **WHEN** a registered customer's email and password are sent to `/admin/auth/sign-in`
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Staff sign-in is rate limited
- **WHEN** 10 staff sign-in attempts for one email were made within an hour and an 11th follows
- **THEN** the 11th response is 429 with code `rate_limited`

#### Scenario: Staff sign-out
- **WHEN** a staff user signs out with their token
- **THEN** the response is 204 and `GET /admin/me` with that token answers 401

### Requirement: Staff sessions
Staff routes SHALL require a bearer token naming a live staff session of an active staff user and answer 401 `unauthorized` otherwise, including for customer tokens. A staff session SHALL expire 12 hours after it was created and SHALL NOT be extended by use. Deactivating a staff user SHALL make their existing sessions fail at once.

#### Scenario: Use does not extend a staff session
- **WHEN** a staff session created 11 hours ago is used for `GET /admin/me`
- **THEN** the response is 200 and the session's expiry is unchanged

#### Scenario: Twelve hours pass
- **WHEN** a staff session's expiry is in the past
- **THEN** `GET /admin/me` with its token answers 401

#### Scenario: Deactivated while signed in
- **WHEN** an admin sets a signed-in staff user's `isActive` to false
- **THEN** that user's next `GET /admin/me` answers 401

#### Scenario: Customer token on a staff route
- **WHEN** `GET /admin/me` carries a customer bearer token
- **THEN** the response is 401 with code `unauthorized`

### Requirement: Admin-only routes
Routes reserved for admins SHALL answer 403 `forbidden` to a signed-in store-staff user and 401 `unauthorized` to a request without a staff session.

#### Scenario: Store staff on staff users
- **WHEN** a store-staff user requests `GET /admin/staff-users`
- **THEN** the response is 403 with code `forbidden`

### Requirement: Admins manage staff users
An admin SHALL list staff users at `GET /api/core/v1/admin/staff-users` as a paged list ordered by email, create one at `POST` from `{email, password, name, role, storeId?}` answering 201, and change one at `PATCH /admin/staff-users/{id}` with any of `name`, `password` (resets it) and `isActive`, answering 200. An unknown id SHALL answer 404 `not_found`.

#### Scenario: Create a store-staff user
- **WHEN** an admin creates `{"email":"hsr@example.com","password":"staff12345","name":"HSR","role":"store_staff","storeId":"<uuid>"}`
- **THEN** the response is 201 with `isActive` true and that `storeId`, and the new user can sign in with `staff12345`

#### Scenario: Password reset
- **WHEN** an admin patches a staff user with `{"password":"newpass123"}`
- **THEN** signing in with the old password answers 401 and with `newpass123` answers 200

#### Scenario: Unknown staff user
- **WHEN** an admin patches a staff id that does not exist
- **THEN** the response is 404 with code `not_found`

### Requirement: Staff user fields are validated
Staff users SHALL follow the customer rules for `email`, `password` and `name`; `role` SHALL be `admin` or `store_staff`; `storeId` SHALL be a uuid, required for `store_staff` and refused for `admin`. A bad value SHALL answer 400 `validation` naming the field; an email taken without regard to case SHALL answer 409 `conflict` with field `email`.

#### Scenario: Unknown role
- **WHEN** an admin creates a staff user with role `owner`
- **THEN** the response is 400 with code `validation` and field `role`

#### Scenario: Role and store disagree
- **WHEN** an admin creates a `store_staff` user without `storeId`, or an `admin` with a `storeId`
- **THEN** the response is 400 with code `validation` and field `storeId`

#### Scenario: Taken email
- **WHEN** an admin creates a staff user whose email differs from an existing one only in case
- **THEN** the response is 409 with code `conflict` and field `email`

### Requirement: First admin from the command line
`core-admin create-admin <email>` SHALL read the password from the first line of standard input, create an active admin named `Admin` under the same rules as the API, print `created admin <email>` and exit 0; on a taken email or an invalid email or password it SHALL print the problem to standard error and exit 1 without creating anything.

#### Scenario: Create the first admin
- **WHEN** `create-admin root@example.com` runs with `rootpass123` on standard input
- **THEN** an active admin `root@example.com` exists and signing in with `rootpass123` succeeds

#### Scenario: Email already used
- **WHEN** `create-admin root@example.com` runs again
- **THEN** it exits 1 naming the conflict and there is still exactly one staff user with that email

### Requirement: Demo admin
`core-admin seed-demo --reset` SHALL delete every staff user and session it does not define and leave the active admin `admin@shopperstop.local`, password `admin12345`, id `00000000-0000-4000-8000-000000000101`, so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another staff user and some sessions
- **THEN** the other staff user and every session are gone, `admin@shopperstop.local` has id `00000000-0000-4000-8000-000000000101`, and signing in at `/admin/auth/sign-in` with `admin12345` answers 200

### Requirement: Store staff belong to an existing store
Creating a store-staff user whose `storeId` names no store SHALL answer 400 `validation` with field `storeId` and create nothing.

#### Scenario: Unknown store
- **WHEN** an admin creates a `store_staff` user with `storeId` `00000000-0000-4000-8000-000000000000` and no such store exists
- **THEN** the response is 400 with code `validation` and field `storeId`

### Requirement: Demo store staff
`core-admin seed-demo --reset` SHALL also leave the active store-staff users `koramangala@shopperstop.local` (id `00000000-0000-4000-8000-000000000102`, store `00000000-0000-4000-8000-000000000401`) and `indiranagar@shopperstop.local` (id `00000000-0000-4000-8000-000000000103`, store `00000000-0000-4000-8000-000000000402`), both with password `staff12345`.

#### Scenario: Store staff signs in after reset
- **WHEN** `seed-demo --reset` has run and `koramangala@shopperstop.local` signs in at `/admin/auth/sign-in` with `staff12345`
- **THEN** the response is 200 with `staff.role` `store_staff` and `staff.storeId` `00000000-0000-4000-8000-000000000401`
