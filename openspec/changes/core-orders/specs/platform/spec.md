## MODIFIED Requirements

### Requirement: Error envelope
Every error response SHALL be JSON `{"error":{"code","message","field"?,"productIds"?}}` with `code` one of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited`, `internal`. `productIds` SHALL be present only with `out_of_stock` and list the offending product ids.

#### Scenario: Unknown route
- **WHEN** a client requests a path the router does not serve
- **THEN** the response is 404 with code `not_found`

#### Scenario: Panic in a handler
- **WHEN** a handler panics
- **THEN** the response is 500 with code `internal` and the panic is logged with the request id

#### Scenario: Out of stock names the products
- **WHEN** an error with code `out_of_stock` and product ids is written
- **THEN** the body is `{"error":{"code":"out_of_stock","message":...,"productIds":[...]}}` with those ids, and an error without product ids has no `productIds` member
