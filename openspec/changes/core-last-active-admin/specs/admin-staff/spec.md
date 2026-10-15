## MODIFIED Requirements

### Requirement: Admins manage staff users
An admin SHALL list staff users at `GET /api/core/v1/admin/staff-users` as a paged list ordered by email, create one at `POST` from `{email, password, name, role, storeId?}` answering 201, and change one at `PATCH /admin/staff-users/{id}` with any of `name`, `password` (resets it) and `isActive`, answering 200. An unknown id SHALL answer 404 `not_found`. A patch that sets `isActive` false on the only active admin SHALL answer 409 `conflict` with field `isActive` and change nothing; concurrent patches SHALL never leave no active admin.

#### Scenario: Create a store-staff user
- **WHEN** an admin creates `{"email":"hsr@example.com","password":"staff12345","name":"HSR","role":"store_staff","storeId":"<uuid>"}`
- **THEN** the response is 201 with `isActive` true and that `storeId`, and the new user can sign in with `staff12345`

#### Scenario: Password reset
- **WHEN** an admin patches a staff user with `{"password":"newpass123"}`
- **THEN** signing in with the old password answers 401 and with `newpass123` answers 200

#### Scenario: Unknown staff user
- **WHEN** an admin patches a staff id that does not exist
- **THEN** the response is 404 with code `not_found`

#### Scenario: Last active admin cannot be deactivated
- **WHEN** the only active admin patches their own id with `{"name":"Renamed","isActive":false}`
- **THEN** the response is 409 with code `conflict` and field `isActive`, and `GET /admin/me` with their token answers 200 with `isActive` true and the old name

#### Scenario: One of two active admins is deactivated
- **WHEN** exactly two admins are active and one sets the other's `isActive` to false
- **THEN** the response is 200 with `isActive` false

#### Scenario: Two admins deactivate each other at once
- **WHEN** exactly two admins are active and each sets the other's `isActive` to false at the same moment
- **THEN** exactly one response is 200, the other is 409 `conflict` or, when its own session was already ended, 401 `unauthorized`, and exactly one admin is still active

#### Scenario: Store staff and inactive users are not guarded
- **WHEN** only one admin is active and they set `isActive` false on an active store-staff user, and then on an admin who is already inactive
- **THEN** both responses are 200 with `isActive` false
