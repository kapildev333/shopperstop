## ADDED Requirements

### Requirement: PATCH bodies refuse explicit null
A PATCH body SHALL be a JSON object, and a member whose value is `null` SHALL be refused with 400 `validation` naming that member in `field`; members that are absent leave their value unchanged.

#### Scenario: Null phone
- **WHEN** a signed-in customer sends `PATCH /api/core/v1/me` with `{"phone":null}`
- **THEN** the response is 400 with code `validation` and field `phone`

### Requirement: Lists are paged
Every list response SHALL be `{items, page, pageSize, total}` with `items` always an array, read `page` (default 1, at least 1) and `pageSize` (default 24, 1 to 100) from the query string, and refuse any other value with 400 `validation` naming the parameter.

#### Scenario: Defaults
- **WHEN** a list is requested without `page` or `pageSize`
- **THEN** the response has `page` 1, `pageSize` 24 and an `items` array (empty when there is nothing)

#### Scenario: Page size over the maximum
- **WHEN** a list is requested with `pageSize=101`
- **THEN** the response is 400 with code `validation` and field `pageSize`

### Requirement: Malformed path ids are not found
A path id that is not a uuid in canonical hyphenated form SHALL answer 404 `not_found`, the same as an id that does not exist.

#### Scenario: Not a uuid
- **WHEN** a signed-in customer sends `DELETE /api/core/v1/me/addresses/abc`
- **THEN** the response is 404 with code `not_found`

### Requirement: The request log names the signed-in subject
The request log line SHALL carry `subjectType` (`customer` or `staff`) and `subjectId` when the request was authenticated, and neither field otherwise.

#### Scenario: Signed-in customer
- **WHEN** a signed-in customer requests `GET /api/core/v1/me`
- **THEN** the request log line has `subjectType` `customer` and `subjectId` the customer's id

#### Scenario: Anonymous request
- **WHEN** a request without a token is answered
- **THEN** the request log line has no `subjectType` and no `subjectId`

### Requirement: Authenticated operations declare bearer security
`services/core/openapi.json` SHALL declare `components.securitySchemes.bearer` as HTTP bearer, and an operation SHALL carry `security: [{"bearer": []}]` exactly when the router answers that operation 401 to a request without a token; the service test suite SHALL fail otherwise, naming the operation.

#### Scenario: Protected route without security
- **WHEN** the router answers `GET /api/core/v1/extra` 401 without a token and its operation has no `security`
- **THEN** the contract test fails naming `GET /api/core/v1/extra`

#### Scenario: Public route with security
- **WHEN** an operation carries `security` and the router answers it without a token with a status other than 401
- **THEN** the contract test fails naming that operation
