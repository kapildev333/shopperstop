## MODIFIED Requirements

### Requirement: Staff sessions
Staff routes SHALL require a bearer token naming a live staff session of an active staff user and answer 401 `unauthorized` otherwise, including for customer tokens; a service token SHALL answer 403 `forbidden` instead, except where the platform requirement "Services reach the rider's admin routes" admits it. A staff session SHALL expire 12 hours after it was created and SHALL NOT be extended by use. Deactivating a staff user SHALL make their existing sessions fail at once.

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

#### Scenario: Service token on a staff route
- **WHEN** `GET /admin/me` carries the rider service's token
- **THEN** the response is 403 with code `forbidden`

### Requirement: Admin-only routes
Routes reserved for admins SHALL answer 403 `forbidden` to a signed-in store-staff user and to a service token, except where the platform requirement "Services reach the rider's admin routes" admits it, and 401 `unauthorized` to a request with neither a staff session nor a service token.

#### Scenario: Store staff on staff users
- **WHEN** a store-staff user requests `GET /admin/staff-users`
- **THEN** the response is 403 with code `forbidden`

#### Scenario: Service token on staff users
- **WHEN** the rider service's token requests `GET /admin/staff-users`
- **THEN** the response is 403 with code `forbidden`
