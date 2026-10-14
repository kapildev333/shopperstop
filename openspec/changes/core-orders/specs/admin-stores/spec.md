## ADDED Requirements

### Requirement: Stores with orders are kept
`DELETE /api/core/v1/admin/stores/{id}` SHALL answer 409 `conflict` and keep the store when any order belongs to it.

#### Scenario: Store with an order
- **WHEN** an admin deletes a store that has one order and no staff users
- **THEN** the response is 409 with code `conflict` and `GET /api/core/v1/admin/stores/{id}` still answers 200
