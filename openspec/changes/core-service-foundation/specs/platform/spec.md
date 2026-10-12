## ADDED Requirements

### Requirement: Configured origins are normalised
The core service SHALL trim surrounding whitespace from each comma-separated entry of `SHOPPERSTOP_CORE_WEB_ORIGINS`, ignore empty entries, treat a list with no non-empty entry as missing, and never allow a request whose `Origin` header is empty.

#### Scenario: Spaces and a trailing comma
- **WHEN** `SHOPPERSTOP_CORE_WEB_ORIGINS` is `http://a, http://b,` and a request carries `Origin: http://b`
- **THEN** the response carries `Access-Control-Allow-Origin: http://b`

#### Scenario: Empty origin is never allowed
- **WHEN** a request carries an empty `Origin` header
- **THEN** the response carries no `Access-Control-Allow-Origin` header

#### Scenario: Only commas
- **WHEN** `SHOPPERSTOP_CORE_WEB_ORIGINS` is `,`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_WEB_ORIGINS` as missing

### Requirement: Log level is configurable
The core service SHALL read `SHOPPERSTOP_CORE_LOG_LEVEL` as one of `debug`, `info`, `warn`, `error`, default to `info` when it is unset, and refuse to start on any other value.

#### Scenario: Default level
- **WHEN** `SHOPPERSTOP_CORE_LOG_LEVEL` is unset
- **THEN** the service logs at level `info`

#### Scenario: Unknown level is refused
- **WHEN** `SHOPPERSTOP_CORE_LOG_LEVEL` is `loud`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_LOG_LEVEL`

### Requirement: Schema migrations apply once, in order
`core-admin migrate` SHALL apply every embedded migration file named `NNNN_<name>.sql` that the database has not recorded, in file-name order, each in its own transaction that also records the file's version, and SHALL refuse a `.sql` file whose name does not match that pattern.

#### Scenario: Pending migrations are applied and recorded
- **WHEN** migrate runs on an empty database with files `0001_a.sql` and `0002_b.sql`
- **THEN** both are applied in that order and both versions are recorded

#### Scenario: A second run applies nothing
- **WHEN** migrate runs again with no new file
- **THEN** no migration is applied and the recorded versions are unchanged

#### Scenario: Misnamed file is refused
- **WHEN** the embedded files include `add-stores.sql`
- **THEN** migrate fails naming that file and applies nothing

### Requirement: A failed migration leaves no trace
When a migration file fails, `core-admin migrate` SHALL roll back that file's statements, SHALL NOT record its version, SHALL NOT attempt later files, and SHALL exit non-zero naming the file, so the next run retries it.

#### Scenario: Failure halfway through a file
- **WHEN** `0002_b.sql` creates a table and then runs a statement that fails
- **THEN** migrate fails naming `0002_b.sql`, the table does not exist, and only `0001_a` is recorded

#### Scenario: Retry after the fix
- **WHEN** `0002_b.sql` is corrected and migrate runs again
- **THEN** `0002_b.sql` is applied and recorded

### Requirement: The OpenAPI file matches the router
`services/core/openapi.json` SHALL list exactly the method and path pairs the core router serves under `/api/core/v1`, and each operation SHALL have a `summary`, a `description`, at least one tag and at least one response example; the service test suite SHALL fail otherwise.

#### Scenario: Served route missing from the file
- **WHEN** the router serves `GET /api/core/v1/extra` and `openapi.json` does not list it
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Documented route not served
- **WHEN** `openapi.json` lists `GET /extra` and the router does not serve it
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Operation without an example
- **WHEN** an operation in `openapi.json` has no response example
- **THEN** the contract test fails naming that operation

### Requirement: Graceful shutdown
On SIGINT or SIGTERM the core service SHALL stop accepting new connections, let in-flight requests finish for up to 10 seconds, close its database pool and exit 0.

#### Scenario: In-flight request completes
- **WHEN** the service is asked to stop while a request is being handled
- **THEN** that request receives its full response and the server returns without error
