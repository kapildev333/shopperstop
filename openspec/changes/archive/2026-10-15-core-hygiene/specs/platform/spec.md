## MODIFIED Requirements

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?,"productIds"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `method_not_allowed`, `internal`. `productIds` SHALL be present only with `out_of_stock` and list the offending product ids.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

#### Scenario: Out of stock names the products
- **WHEN** an error with code `out_of_stock` and product ids is written
- **THEN** the body is `{"error":{"code":"out_of_stock","message":...,"productIds":[...]}}` with those ids, and an error without product ids has no `productIds` member

#### Scenario: The contract lists every code
- **WHEN** the core service answers with code `method_not_allowed`
- **THEN** that code is in the `Error` schema's `code` enum in `services/core/openapi.json`

## ADDED Requirements

### Requirement: A wrong method on a known route answers 405
A request whose path the core router serves but not with the request's method SHALL answer 405 with code `method_not_allowed` and an `Allow` header listing every method the router serves on that path, in the order GET, POST, PUT, PATCH, DELETE, joined by `, `. A path the router does not serve SHALL stay 404 `not_found`, and a CORS preflight from an allowed origin SHALL stay 204.

#### Scenario: One method served
- **WHEN** a client sends `DELETE /api/core/v1/healthz`
- **THEN** the response is 405 with code `method_not_allowed` and `Allow: GET`

#### Scenario: Two methods served
- **WHEN** a client sends `PUT /api/core/v1/me`
- **THEN** the response is 405 with code `method_not_allowed` and `Allow: GET, PATCH`

#### Scenario: Preflight still answered
- **WHEN** an allowed origin sends `OPTIONS` with `Access-Control-Request-Method: PATCH` to a path served with GET and PATCH
- **THEN** the response is 204 with the CORS headers

### Requirement: Migration runs do not interleave
`core-admin migrate` SHALL hold a database-wide advisory lock from before it reads or creates `schema_migrations` until it ends, so a second run against the same database waits and then applies only the files still unrecorded.

#### Scenario: Two runs at once
- **WHEN** two migrate runs start together on an empty database with files `0001_a.sql` and `0002_b.sql`
- **THEN** both succeed, each file is applied by exactly one of them, and `0001_a` and `0002_b` are each recorded once
