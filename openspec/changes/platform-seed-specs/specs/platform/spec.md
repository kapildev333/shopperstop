## ADDED Requirements

### Requirement: Configuration fails fast
The core service SHALL read its configuration from `SHOPPERSTOP_CORE_*` environment variables and refuse to start while naming every missing variable.

#### Scenario: Missing variables are all named
- **WHEN** the service starts with `SHOPPERSTOP_CORE_DATABASE_URL` and `SHOPPERSTOP_CORE_SESSION_PEPPER` unset
- **THEN** it exits non-zero with a message that names both variables

#### Scenario: Short pepper is refused
- **WHEN** `SHOPPERSTOP_CORE_SESSION_PEPPER` is shorter than 32 bytes
- **THEN** the service refuses to start and says the pepper must be at least 32 bytes

### Requirement: Health endpoints
The core service SHALL answer `GET /api/core/v1/healthz` with 200 always and `GET /api/core/v1/readyz` with 200 only when the database answers a ping.

#### Scenario: Ready when the database answers
- **WHEN** the database is reachable
- **THEN** `readyz` answers 200 `{"status":"ok"}`

#### Scenario: Not ready when the database is down
- **WHEN** the database does not answer within 2 seconds
- **THEN** `readyz` answers 503 with the error envelope code `internal`

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `internal`.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

### Requirement: Request body limits
The core service SHALL reject JSON bodies over 1 MiB (16 MiB on image upload), bodies containing a NUL byte, and malformed JSON, with 400 `validation`.

#### Scenario: NUL byte in a field
- **WHEN** a JSON body contains `\u0000` in any string
- **THEN** the response is 400 with code `validation`

#### Scenario: Body too large
- **WHEN** a JSON body exceeds 1 MiB
- **THEN** the response is 400 with code `validation` and message `body too large`

### Requirement: CORS
The core service SHALL allow cross-origin requests only from the origins in `SHOPPERSTOP_CORE_WEB_ORIGINS`, with `Authorization` and `Content-Type` headers and the methods GET, POST, PUT, PATCH, DELETE.

#### Scenario: Allowed origin
- **WHEN** a request carries `Origin: http://localhost:5173` and that origin is configured
- **THEN** the response carries `Access-Control-Allow-Origin: http://localhost:5173`

#### Scenario: Unknown origin
- **WHEN** a request carries an origin that is not configured
- **THEN** the response carries no `Access-Control-Allow-Origin` header

### Requirement: Request logging
The core service SHALL log one JSON line per request with method, route pattern (never the raw path), status, duration and request id, and accept or generate `X-Request-Id`.

#### Scenario: Route pattern, not path
- **WHEN** a client requests `/api/core/v1/stores/123e4567-e89b-12d3-a456-426614174000`
- **THEN** the log line's `route` is `/api/core/v1/stores/{id}`

#### Scenario: Request id echoed
- **WHEN** a request carries `X-Request-Id: abc`
- **THEN** the response carries `X-Request-Id: abc` and the log line has `requestId` `abc`
