# rider-service Specification

## Purpose
The rider service (`services/rider`, `/api/rider/v1`): its runtime (config, health, HTTP conventions copied from core, migrations), rider accounts with email and password and peppered sliding bearer sessions, staff management of riders through core's staff sessions (admins every store, store staff their own), the operator commands and demo seed, and its `openapi.json` contract. Deliveries sit behind the rider session this capability issues.

## Requirements

### Requirement: Rider service configuration fails fast
The rider service SHALL read `SHOPPERSTOP_RIDER_DATABASE_URL`, `SHOPPERSTOP_RIDER_ADDR`, `SHOPPERSTOP_RIDER_SESSION_PEPPER` (at least 32 bytes), `SHOPPERSTOP_RIDER_WEB_ORIGINS` (comma list), `SHOPPERSTOP_RIDER_CORE_URL` (an absolute http or https URL) and `SHOPPERSTOP_RIDER_CORE_SERVICE_TOKEN` as required, and `SHOPPERSTOP_RIDER_LOG_LEVEL` (debug, info, warn, error; default info) as optional. Loading SHALL report every missing or invalid variable in one error.

#### Scenario: Every missing variable is named
- **WHEN** the configuration is loaded from an empty environment
- **THEN** loading fails with one error that names each of the six required variables

#### Scenario: Short pepper and bad core URL
- **WHEN** the pepper is 31 bytes and the core URL is `localhost:8080`
- **THEN** loading fails naming `SHOPPERSTOP_RIDER_SESSION_PEPPER` and `SHOPPERSTOP_RIDER_CORE_URL`

#### Scenario: Full environment loads
- **WHEN** every required variable is set to a valid value and the log level is absent
- **THEN** loading succeeds with the origins trimmed, empty entries dropped, and level info

### Requirement: Rider health and readiness
`GET /api/rider/v1/healthz` SHALL answer 200 `{"status":"ok"}` without touching the database or core. `GET /api/rider/v1/readyz` SHALL answer 200 `{"status":"ok"}` when the database answers a ping within 2 seconds, and 503 with code `internal` otherwise.

#### Scenario: Ready with the database up
- **WHEN** `GET /readyz` is requested and the database answers
- **THEN** the response is 200 `{"status":"ok"}`

#### Scenario: Not ready with the database silent
- **WHEN** the database accepts connections and never answers
- **THEN** `GET /healthz` answers 200 and `GET /readyz` answers 503 with code `internal` after about 2 seconds

### Requirement: Rider HTTP conventions match core
The rider service SHALL answer every error with the envelope `{"error": {"code", "message", "field"?}}` and core's codes, and answer: an unknown path 404 `not_found`; a wrong method on a known path 405 `method_not_allowed` with `Allow` naming the path's methods in GET, POST, PUT, PATCH, DELETE order; a JSON body over 1 MiB, with a NUL byte or malformed 400 `validation`; a PATCH member set to `null` 400 naming it; a non-uuid path id 404. CORS SHALL allow only `SHOPPERSTOP_RIDER_WEB_ORIGINS`.

#### Scenario: Unknown route and wrong method
- **WHEN** a client requests `GET /api/rider/v1/nope`, `DELETE /api/rider/v1/healthz` and `PUT /api/rider/v1/admin/riders/{id}`
- **THEN** the first is 404 `not_found`, the second 405 `method_not_allowed` with `Allow: GET`, the third 405 with `Allow: GET, PATCH`, and `method_not_allowed` is in the `Error` code enum of `services/rider/openapi.json`

#### Scenario: Preflight on a known path still answered
- **WHEN** an allowed origin sends `OPTIONS` with `Access-Control-Request-Method: PATCH` to a path served with GET and PATCH
- **THEN** the response is 204 with the CORS headers

#### Scenario: NUL byte refused
- **WHEN** a client posts a JSON body containing `\u0000` to `POST /api/rider/v1/auth/sign-in`
- **THEN** the response is 400 with code `validation`

#### Scenario: CORS only for configured origins
- **WHEN** a preflight comes from a configured origin and another from `http://evil.example`
- **THEN** the first gets `Access-Control-Allow-Origin` with its origin and the second gets none

### Requirement: Rider request log and request id
The rider service SHALL write one `log/slog` JSON line per request with the method, the route pattern (never the raw path), the status, the duration, the request id and, when signed in, the subject type (`rider` or `staff`) and id. It SHALL keep a client `X-Request-Id` of 1 to 128 bytes, otherwise generate one, and echo it on the response.

#### Scenario: Route pattern and subject in the log
- **WHEN** a signed-in rider requests `GET /api/rider/v1/me`
- **THEN** the request line has route `/api/rider/v1/me`, status 200, subjectType `rider` and the rider's id

#### Scenario: Request id echoed or generated
- **WHEN** one request carries `X-Request-Id: abc` and another carries none
- **THEN** the first response echoes `abc` and the second carries a generated non-empty id

### Requirement: Rider schema migrations
`rider-admin migrate` SHALL apply each unrecorded `migrations/NNNN_name.sql` in order, each in its own transaction with its version, under a database-wide advisory lock held for the whole run, and print each applied version or `nothing to apply`. The schema SHALL hold `riders` (store id without a foreign key, unique case-insensitive email) and `sessions` (cascade on rider delete), each with `created_at` and an `updated_at` kept by a trigger.

#### Scenario: Second run applies nothing
- **WHEN** migrations are applied twice to an empty schema
- **THEN** the first run applies `0001_init`, `0002_riders`, `0003_deliveries` and `0004_delivery_payment_status` in that order and the second applies none

#### Scenario: A failed file leaves no trace
- **WHEN** a migration file fails halfway
- **THEN** none of its statements and no version for it are recorded, and later files are not run

#### Scenario: updated_at follows updates
- **WHEN** a rider row is updated
- **THEN** its `updated_at` is later than its `created_at`

#### Scenario: Concurrent runs serialise
- **WHEN** two migrate runs start together on an empty schema with files `0001_a.sql` and `0002_b.sql`
- **THEN** both succeed, each file is applied by exactly one of them, and `0001_a` and `0002_b` are each recorded once

### Requirement: Riders sign in with email and password
`POST /api/rider/v1/auth/sign-in` SHALL accept `{email, password}` and answer 200 `{token, rider}` with a new session, without ending the rider's other sessions. `Rider` SHALL be `{id, storeId, email, name, isActive}` plus `phone` when set. A wrong password, an unknown email and an inactive rider SHALL all answer the same 401 `unauthorized`, each after one bcrypt comparison.

#### Scenario: Sign-in returns a working token
- **WHEN** an active rider signs in with the right password
- **THEN** the response is 200 with a non-empty `token` and the rider, and `GET /me` with that token answers 200 with the same rider

#### Scenario: Refusals look the same
- **WHEN** a client signs in with a wrong password, with an unknown email, and as an inactive rider with the right password
- **THEN** all three responses are 401 with code `unauthorized` and identical messages

### Requirement: Rider bearer sessions
Rider routes SHALL require `Authorization: Bearer <token>` naming a live session of an active rider and answer 401 `unauthorized` otherwise. A token SHALL be 32 random bytes in unpadded base64url; only `sha256(token || pepper)` SHALL be stored. A session SHALL expire 30 days after its last use, and its last use SHALL be recorded at most once an hour.

#### Scenario: Missing or foreign token
- **WHEN** `GET /me` is requested with no header, with `Basic abc`, with an unknown token, or with a core staff token
- **THEN** each response is 401 with code `unauthorized`

#### Scenario: Only the peppered hash is stored
- **WHEN** a rider signs in and receives token T
- **THEN** exactly one session row has `token_hash` equal to `sha256(T || pepper)` and no column holds T

#### Scenario: Expiry and sliding
- **WHEN** one session's expiry is past, another was last used 2 hours ago and a third 30 minutes ago, and each is used for `GET /me`
- **THEN** the first answers 401, the second's expiry moves to 30 days from now, and the third's last use and expiry are unchanged

### Requirement: Riders sign out and read themselves
`POST /api/rider/v1/auth/sign-out` SHALL delete the session of the bearer token it carries and answer 204. `GET /api/rider/v1/me` SHALL answer 200 with the signed-in `Rider`.

#### Scenario: Sign-out ends only that session
- **WHEN** a rider holding tokens A and B signs out with A
- **THEN** the response is 204, `GET /me` with A answers 401, and `GET /me` with B answers 200

### Requirement: Rider sign-in is rate limited
The rider service SHALL count rider sign-in attempts in memory per process and SHALL answer 429 `rate_limited` to an attempt beyond 10 per email (compared without case) or beyond 100 per client IP within one hour. Refused attempts count too.

#### Scenario: Eleventh attempt for one email
- **WHEN** a client makes 10 sign-in attempts for `slow@example.com` within an hour and then an 11th
- **THEN** the 11th response is 429 with code `rate_limited`

#### Scenario: Window passes
- **WHEN** an hour has passed since the first of 10 attempts for one email
- **THEN** the next attempt is counted in a new window and is not refused

### Requirement: Staff authenticate through core
Every `/api/rider/v1/admin/*` route SHALL forward the request's bearer token to core `GET /api/core/v1/admin/me` and admit the staff user core returns. No token or a core 401 SHALL be 401 `unauthorized`; any other core failure SHALL be 502 with code `internal`, logged with the request id. A staff answer SHALL be cached for 30 seconds per token hash.

#### Scenario: Staff admitted, others refused
- **WHEN** `GET /admin/riders` is requested with a core staff token, with a rider token, and with no token
- **THEN** the first answers 200 and the other two answer 401 with code `unauthorized`

#### Scenario: Core failure is 502
- **WHEN** core answers `GET /admin/me` with 500, or cannot be reached
- **THEN** the rider route answers 502 with code `internal`

#### Scenario: One core call per token within 30 seconds
- **WHEN** one staff token is used three times within 30 seconds and again 31 seconds after the first use
- **THEN** core receives two `GET /admin/me` requests

### Requirement: Staff list riders
`GET /api/rider/v1/admin/riders?store=&page=&pageSize=` SHALL answer `{items, page, pageSize, total}` of riders ordered by email. An admin SHALL see every store's riders, or one store's with `store`; store staff SHALL see their own store's, and a `store` naming another store SHALL be 403 `forbidden`. A `store` that is not a uuid SHALL be 400 `validation` on `store`.

#### Scenario: Admin sees every store and filters
- **WHEN** riders exist at stores A and B and an admin lists riders, then lists with `store=A`
- **THEN** the first list holds both stores' riders and the second only A's

#### Scenario: Store staff see only their store
- **WHEN** store staff of store A list riders, then list with `store=B`
- **THEN** the first list holds only A's riders and the second answers 403 with code `forbidden`

### Requirement: Staff create riders
`POST /api/rider/v1/admin/riders` SHALL accept `{storeId, email, name, password, phone?}` and answer 201 with the active `Rider`. Email, password (8 to 72 bytes), name (1 to 100 characters) and phone (optional `+`, 10 to 15 digits) SHALL be checked as core checks them; store staff SHALL get 403 `forbidden` for another store; a store core does not know SHALL be 400 on `storeId`; a taken email SHALL be 409 on `email`.

#### Scenario: Admin creates a rider at a known store
- **WHEN** an admin posts a valid rider for a store core knows
- **THEN** the response is 201 with the rider active at that store, and the rider can sign in with the password

#### Scenario: Refusals name the field
- **WHEN** a staff user posts a 7-byte password, a store core answers 404 for, and an email already taken in another case
- **THEN** the responses are 400 on `password`, 400 on `storeId`, and 409 `conflict` on `email`

#### Scenario: Fields are checked before the store
- **WHEN** a staff user posts an invalid email with a `storeId` core does not know
- **THEN** the response is 400 on `email` and core receives no store request

#### Scenario: Store staff create only for their store
- **WHEN** store staff of store A post a rider for store B
- **THEN** the response is 403 with code `forbidden` and no rider is created

### Requirement: Staff read and update a rider
`GET /api/rider/v1/admin/riders/{id}` SHALL answer the `Rider`; `PATCH` SHALL change `name`, `phone` (empty clears it), `isActive` and `password` and answer the `Rider`. Store staff SHALL get 404 for another store's rider, as for an unknown id. Setting `isActive` false SHALL delete the rider's sessions in the same transaction.

#### Scenario: Another store's rider is not found
- **WHEN** store staff of store A read or patch a rider of store B
- **THEN** both responses are 404 with code `not_found`

#### Scenario: Deactivation ends sessions
- **WHEN** an admin patches a signed-in rider with `{"isActive": false}`
- **THEN** the response is 200 with `isActive` false, the rider's token answers 401, and the rider cannot sign in

#### Scenario: Password reset
- **WHEN** an admin patches a rider with a new 8-byte password
- **THEN** the rider signs in with the new password and not with the old one

### Requirement: Operators create riders from the command line
`rider-admin create-rider <email> --store <id>` SHALL read the password from the first line of stdin, check the store with core as the API does, create an active rider named `Rider` under the API's rules, and print `created rider <email>`. A refusal SHALL name the field and exit non-zero; wrong arguments SHALL print the usage line and exit 2.

#### Scenario: Rider created from stdin
- **WHEN** `create-rider new@example.com --store <known store>` runs with `password123` on stdin
- **THEN** it prints `created rider new@example.com` and the rider signs in with `password123`

#### Scenario: Unknown store refused
- **WHEN** `create-rider` runs for a store core answers 404 for
- **THEN** it exits non-zero naming `storeId` and no rider is created

### Requirement: Rider demo seed
`rider-admin seed-demo --reset` SHALL, without calling core, empty the rider tables and load four active riders with password `rider12345`: ids `00000000-0000-4000-8000-000000000801` and `...0802` at store `...0401`, `...0803` and `...0804` at store `...0402`, emails `rider1-koramangala@shopperstop.local`, `rider2-koramangala@...`, `rider1-indiranagar@...`, `rider2-indiranagar@...`. It SHALL print the sign-ins and ids.

#### Scenario: Reset twice leaves the demo riders
- **WHEN** a database holding other riders and sessions is reset twice
- **THEN** exactly the four demo riders remain and each signs in with `rider12345`

#### Scenario: Summary matches seed and Postman
- **WHEN** the seed is loaded
- **THEN** every id the summary prints names one row, every sign-in it prints answers 200, and the Postman environment's `riderId` equals the id the summary marks

#### Scenario: Seed needs no core
- **WHEN** `seed-demo --reset` runs with core unreachable
- **THEN** it succeeds

### Requirement: Rider API contract
`services/rider/openapi.json` SHALL list exactly the served routes, joined with `servers[0].url` `/api/rider/v1`, each with a summary, a description, a tag and an example on every response that has content. Every authenticated operation SHALL declare `security: [{"bearer": []}]` and a 401, and every other operation SHALL declare none. `make postman` SHALL leave the committed rider collection unchanged.

#### Scenario: Router and contract agree
- **WHEN** the contract test walks the router and reads `openapi.json`
- **THEN** it reports no route served but undocumented, none documented but unserved, and no operation missing a summary, description, tag or example

#### Scenario: Security matches the router
- **WHEN** every documented operation is requested without a token
- **THEN** exactly the operations that declare security answer 401

### Requirement: Expired rider sessions are deleted
Whenever the rider service starts a rider session (rider sign-in) it SHALL first delete every rider session whose expiry is at or before the current time, whichever rider it belongs to; a session whose expiry is later SHALL be kept.

#### Scenario: Sign-in sweeps expired sessions
- **WHEN** two rider sessions have an expiry in the past, two are live, and a new session starts
- **THEN** the two expired rows no longer exist and the two live rows and the new one do

### Requirement: The rider sign-in limiter trusts a proxy only when told
`SHOPPERSTOP_RIDER_TRUST_PROXY` SHALL accept `true` or `false` (surrounding spaces ignored; unset or empty means `false`) and refuse to start naming the variable on any other value. When `true`, the per-IP rider sign-in limit SHALL key on the first address of `X-Forwarded-For`, trimmed, or on the connection's address when that is empty; when `false`, `X-Forwarded-For` SHALL be ignored.

#### Scenario: Clients behind a trusted proxy
- **WHEN** the proxy is trusted, the per-IP limit is 2, two sign-ins carry `X-Forwarded-For` first address `203.0.113.7`, then a third, then one with `203.0.113.8`
- **THEN** the third answers 429 `rate_limited` and the one from `203.0.113.8` answers 200

#### Scenario: Empty forwarded address falls back to the connection
- **WHEN** the proxy is trusted, the per-IP limit is 2, two sign-ins carry an empty and a blank `X-Forwarded-For`, and a third carries the connection's own address
- **THEN** the third answers 429 `rate_limited`

#### Scenario: Proxy not trusted
- **WHEN** the proxy is not trusted, the per-IP limit is 2, and three sign-ins from one connection address carry different `X-Forwarded-For` values
- **THEN** the third answers 429 `rate_limited`

#### Scenario: Unknown value refused
- **WHEN** `SHOPPERSTOP_RIDER_TRUST_PROXY` is `yes`, `1` or `TRUE`
- **THEN** loading the configuration fails naming `SHOPPERSTOP_RIDER_TRUST_PROXY`
