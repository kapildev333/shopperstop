## MODIFIED Requirements

### Requirement: Store administration is for admins only
Every route under `/api/core/v1/admin/stores` SHALL answer 401 `unauthorized` without a staff session or a service token (a customer token included) and 403 `forbidden` to a store-staff user whatever store the path names, their own, another or none, so the answer never reveals whether a store exists. A service token SHALL read `GET /admin/stores` and `GET /admin/stores/{id}` and get 403 on the other routes of this capability.

#### Scenario: Customer token
- **WHEN** `GET /admin/stores` carries a customer token
- **THEN** the response is 401 with code `unauthorized`

#### Scenario: Store staff on their own store and on another
- **WHEN** a store-staff user requests `GET /admin/stores/{id}` with their own store's id, and again with another store's id
- **THEN** both responses are 403 with code `forbidden`

#### Scenario: Service token
- **WHEN** the rider service's token requests `GET /admin/stores/{id}` for an existing store, then `PATCH /admin/stores/{id}` and `GET /admin/stores/{id}/service-areas`
- **THEN** the first response is 200 and the other two are 403 with code `forbidden`
