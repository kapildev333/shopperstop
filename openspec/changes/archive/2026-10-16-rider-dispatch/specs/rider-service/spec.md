## ADDED Requirements

### Requirement: Riders go online and offline
A rider SHALL be offline until they go online. `PUT /me/availability {online}` SHALL set it and answer 200 `Rider`; a missing or `null` `online` SHALL be 400 `validation` on `online`, and a non-boolean one 400 `validation`. Going online SHALL keep the time the rider first went online while they stay online. Going offline SHALL wait for a running dispatcher tick and, in one transaction, set the rider offline and mark their open offer `expired`.

#### Scenario: Online, then offline
- **WHEN** a rider puts `{"online": true}`, reads `GET /me`, puts `{"online": true}` again, then puts `{"online": false}`
- **THEN** the first two answers carry `isOnline` true, the second put keeps the first online time, and the last answers `isOnline` false

#### Scenario: Going offline voids the open offer
- **WHEN** an online rider with an open offer goes offline
- **THEN** the offer is `expired` with an `answeredAt`

#### Scenario: Offline waits for a running tick
- **WHEN** another transaction holds the dispatch key and an online rider puts `{"online": false}`
- **THEN** no answer arrives while the key is held, and the answer is 200 with `isOnline` false once it is released

#### Scenario: Missing value
- **WHEN** a rider puts `{}` or `{"online": "yes"}`
- **THEN** both answers are 400 `validation`, the first with field `online`

## MODIFIED Requirements

### Requirement: Riders sign in with email and password
`POST /api/rider/v1/auth/sign-in` SHALL accept `{email, password}` and answer 200 `{token, rider}` with a new session, without ending the rider's other sessions. `Rider` SHALL be `{id, storeId, email, name, isActive, isOnline}` plus `phone` when set. A wrong password, an unknown email and an inactive rider SHALL all answer the same 401 `unauthorized`, each after one bcrypt comparison.

#### Scenario: Sign-in returns a working token
- **WHEN** an active rider signs in with the right password
- **THEN** the response is 200 with a non-empty `token` and the rider with `isOnline` false, and `GET /me` with that token answers 200 with the same rider

#### Scenario: Refusals look the same
- **WHEN** a client signs in with a wrong password, with an unknown email, and as an inactive rider with the right password
- **THEN** all three responses are 401 with code `unauthorized` and identical messages

### Requirement: Riders sign out and read themselves
`POST /api/rider/v1/auth/sign-out` SHALL delete the session of the bearer token it carries, take the rider offline as going offline does, and answer 204. `GET /api/rider/v1/me` SHALL answer 200 with the signed-in `Rider`.

#### Scenario: Sign-out ends only that session
- **WHEN** a rider holding tokens A and B signs out with A
- **THEN** the response is 204, `GET /me` with A answers 401, and `GET /me` with B answers 200

#### Scenario: Sign-out goes offline
- **WHEN** an online rider with an open offer signs out
- **THEN** the rider is offline and the offer is `expired`

### Requirement: Staff read and update a rider
`GET /api/rider/v1/admin/riders/{id}` SHALL answer the `Rider`; `PATCH` SHALL change `name`, `phone` (empty clears it), `isActive` and `password` and answer the `Rider`. Store staff SHALL get 404 for another store's rider, as for an unknown id. Setting `isActive` false SHALL, in the same transaction, delete the rider's sessions and take the rider offline as going offline does.

#### Scenario: Another store's rider is not found
- **WHEN** store staff of store A read or patch a rider of store B
- **THEN** both responses are 404 with code `not_found`

#### Scenario: Deactivation ends sessions
- **WHEN** an admin patches a signed-in rider with `{"isActive": false}`
- **THEN** the response is 200 with `isActive` false, the rider's token answers 401, and the rider cannot sign in

#### Scenario: Deactivation goes offline
- **WHEN** an admin deactivates an online rider with an open offer
- **THEN** the response has `isOnline` false and the offer is `expired`

#### Scenario: Password reset
- **WHEN** an admin patches a rider with a new 8-byte password
- **THEN** the rider signs in with the new password and not with the old one

### Requirement: Rider schema migrations
`rider-admin migrate` SHALL apply each unrecorded `migrations/NNNN_name.sql` in order, each in its own transaction with its version, under a database-wide advisory lock held for the whole run, and print each applied version or `nothing to apply`. The schema SHALL hold `riders` (store id without a foreign key, unique case-insensitive email) and `sessions` (cascade on rider delete), each with `created_at` and an `updated_at` kept by a trigger.

#### Scenario: Second run applies nothing
- **WHEN** migrations are applied twice to an empty schema
- **THEN** the first run applies `0001_init`, `0002_riders`, `0003_deliveries`, `0004_delivery_payment_status` and `0005_dispatch` in that order and the second applies none

#### Scenario: A failed file leaves no trace
- **WHEN** a migration file fails halfway
- **THEN** none of its statements and no version for it are recorded, and later files are not run

#### Scenario: updated_at follows updates
- **WHEN** a rider row is updated
- **THEN** its `updated_at` is later than its `created_at`

#### Scenario: Concurrent runs serialise
- **WHEN** two migrate runs start together on an empty schema with files `0001_a.sql` and `0002_b.sql`
- **THEN** both succeed, each file is applied by exactly one of them, and `0001_a` and `0002_b` are each recorded once
