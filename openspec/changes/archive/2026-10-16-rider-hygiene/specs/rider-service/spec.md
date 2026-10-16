## MODIFIED Requirements

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

### Requirement: Rider schema migrations
`rider-admin migrate` SHALL apply each unrecorded `migrations/NNNN_name.sql` in order, each in its own transaction with its version, under a database-wide advisory lock held for the whole run, and print each applied version or `nothing to apply`. The schema SHALL hold `riders` (store id without a foreign key, unique case-insensitive email) and `sessions` (cascade on rider delete), each with `created_at` and an `updated_at` kept by a trigger.

#### Scenario: Second run applies nothing
- **WHEN** migrations are applied twice to an empty schema
- **THEN** the first run applies `0001_init` and `0002_riders` and the second applies none

#### Scenario: A failed file leaves no trace
- **WHEN** a migration file fails halfway
- **THEN** none of its statements and no version for it are recorded, and later files are not run

#### Scenario: updated_at follows updates
- **WHEN** a rider row is updated
- **THEN** its `updated_at` is later than its `created_at`

#### Scenario: Concurrent runs serialise
- **WHEN** two migrate runs start together on an empty schema with files `0001_a.sql` and `0002_b.sql`
- **THEN** both succeed, each file is applied by exactly one of them, and `0001_a` and `0002_b` are each recorded once
