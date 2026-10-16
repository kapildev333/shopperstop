# admin-stores Specification

## Purpose
Admin management of dark stores: create, read, change and delete stores, and replace a store's service areas under the rule that a pincode is served by at most one store.

## Requirements

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

### Requirement: Admins list and read stores
`GET /api/core/v1/admin/stores` SHALL answer a paged list of stores ordered by name, and `GET /admin/stores/{id}` one store, each store being `{id, name, addressLine, pincode, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`, where `pincode` is the store's own address pincode. An unknown or malformed id SHALL answer 404 `not_found`.

#### Scenario: Paged list
- **WHEN** an admin requests `GET /admin/stores?pageSize=1` while two stores exist
- **THEN** the response is 200 with one item (the first by name), `page` 1, `pageSize` 1 and `total` 2

#### Scenario: Unknown store
- **WHEN** an admin requests `GET /admin/stores/00000000-0000-4000-8000-000000000000`
- **THEN** the response is 404 with code `not_found`

### Requirement: Admins create stores
`POST /api/core/v1/admin/stores` SHALL accept `{name, addressLine, pincode, promisedMinutes}` with optional `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents` and `minOrderCents`, and answer 201 with the new store. An absent `isOpen` SHALL mean closed and an absent money field SHALL mean 0. A new store serves no pincode until its service areas are set.

#### Scenario: Create a store
- **WHEN** an admin posts `{"name":"HSR Layout","addressLine":"27th Main, HSR Layout","pincode":"560102","promisedMinutes":12,"deliveryFeeCents":2500}`
- **THEN** the response is 201 with a new `id`, `isOpen` false, `deliveryFeeCents` 2500, `minOrderCents` 0, and `GET /serviceability?pincode=560102` still answers 404 `not_serviceable`

### Requirement: Store fields are validated
On create and on change, `name` SHALL be 1 to 100 characters and `addressLine` 1 to 200 characters after trimming (stored trimmed), `pincode` six digits with a first digit from 1 to 9, each money field an integer from 0 to 10000000 cents, and `promisedMinutes` an integer from 1 to 240. A bad value SHALL answer 400 `validation` naming the field and change nothing.

#### Scenario: Negative fee
- **WHEN** an admin creates a store with `deliveryFeeCents` -1
- **THEN** the response is 400 with code `validation` and field `deliveryFeeCents`

#### Scenario: Blank name on change
- **WHEN** an admin patches a store with `{"name":"  "}`
- **THEN** the response is 400 with code `validation` and field `name`, and the store's name is unchanged

#### Scenario: Promised minutes missing
- **WHEN** an admin creates a store without `promisedMinutes`
- **THEN** the response is 400 with code `validation` and field `promisedMinutes`

### Requirement: Admins change stores
`PATCH /api/core/v1/admin/stores/{id}` SHALL change any subset of the store fields and answer 200 with the store; absent fields stay unchanged. An unknown id SHALL answer 404 `not_found`.

#### Scenario: Close a store
- **WHEN** an admin patches the store serving `560034` with `{"isOpen":false}`
- **THEN** the response is 200 with `isOpen` false, its other fields unchanged, and `GET /serviceability?pincode=560034` answers 200 with `store.isOpen` false

#### Scenario: Change an unknown store
- **WHEN** an admin patches `00000000-0000-4000-8000-000000000000`
- **THEN** the response is 404 with code `not_found`

### Requirement: Admins delete unused stores
`DELETE /api/core/v1/admin/stores/{id}` SHALL delete the store and its service areas and answer 204. While any staff user belongs to the store it SHALL answer 409 `conflict` and delete nothing. An unknown id SHALL answer 404 `not_found`.

#### Scenario: Delete an unused store
- **WHEN** an admin deletes a store with no staff users that serves `560102`
- **THEN** the response is 204, `GET /admin/stores/{id}` answers 404, and `GET /serviceability?pincode=560102` answers 404 `not_serviceable`

#### Scenario: Store with staff users
- **WHEN** an admin deletes a store that a store-staff user belongs to
- **THEN** the response is 409 with code `conflict` and the store still exists

### Requirement: Admins set the pincodes a store serves
`GET /api/core/v1/admin/stores/{id}/service-areas` SHALL answer 200 `{pincodes}`, the store's pincodes in ascending order. `PUT` with `{pincodes}` SHALL replace that list as a whole, ignoring repeats, and answer 200 with the new list; an empty list SHALL be allowed. The list is one document, not a paged list. An unknown store SHALL answer 404 `not_found`.

#### Scenario: Replace the list
- **WHEN** a store serves `560034` and `560095` and an admin puts `{"pincodes":["560095","560047","560047"]}`
- **THEN** the response is 200 `{"pincodes":["560047","560095"]}`, `560034` is no longer serviceable and `560047` resolves to that store

#### Scenario: Empty list
- **WHEN** an admin puts `{"pincodes":[]}` for a store
- **THEN** the response is 200 `{"pincodes":[]}` and none of its former pincodes is serviceable

#### Scenario: Unknown store
- **WHEN** an admin requests `GET` or `PUT` `/admin/stores/00000000-0000-4000-8000-000000000000/service-areas`
- **THEN** the response is 404 with code `not_found`

### Requirement: Service area lists are validated
A `PUT` service-areas body SHALL hold a `pincodes` array of at most 100 entries, each six digits with a first digit from 1 to 9. A missing or null `pincodes`, more than 100 entries or a bad pincode SHALL answer 400 `validation` with field `pincodes` and change nothing.

#### Scenario: Bad pincode in the list
- **WHEN** an admin puts `{"pincodes":["560034","5600"]}`
- **THEN** the response is 400 with code `validation` and field `pincodes`, and the store's list is unchanged

#### Scenario: Too many pincodes
- **WHEN** an admin puts a list of 101 distinct valid pincodes
- **THEN** the response is 400 with code `validation` and field `pincodes`

### Requirement: One store per pincode
A pincode SHALL be served by at most one store. A `PUT /admin/stores/{id}/service-areas` whose list holds a pincode served by another store SHALL answer 409 `conflict` with field `pincodes`, the error carrying `pincode` (the first such pincode in ascending order) and `storeId` (the store that serves it), and change nothing.

#### Scenario: Pincode held by another store
- **WHEN** store B serves `560038` and an admin puts `{"pincodes":["560034","560038"]}` for store A
- **THEN** the response is 409 with code `conflict`, field `pincodes`, `pincode` `560038` and `storeId` store B's id, and store A's list is unchanged

### Requirement: Demo stores
`core-admin seed-demo --reset` SHALL delete every store it does not define and leave two open stores: Koramangala, id `00000000-0000-4000-8000-000000000401`, serving `560034` and `560095`, and Indiranagar, id `00000000-0000-4000-8000-000000000402`, serving `560038` and `560008`, so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another store
- **THEN** the other store is gone, `GET /serviceability?pincode=560095` answers store `00000000-0000-4000-8000-000000000401` and `GET /serviceability?pincode=560008` answers store `00000000-0000-4000-8000-000000000402`, both with `isOpen` true

### Requirement: Stores with orders are kept
`DELETE /api/core/v1/admin/stores/{id}` SHALL answer 409 `conflict` and keep the store when any order belongs to it.

#### Scenario: Store with an order
- **WHEN** an admin deletes a store that has one order and no staff users
- **THEN** the response is 409 with code `conflict` and `GET /api/core/v1/admin/stores/{id}` still answers 200
