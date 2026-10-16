## MODIFIED Requirements

### Requirement: Admins list and read stores
`GET /api/core/v1/admin/stores` SHALL answer a paged list of stores ordered by name, and `GET /admin/stores/{id}` one store, each store being `{id, name, city, addressLine, pincode, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`, where `pincode` is the store's own address pincode and `city` is omitted when the store has none. An unknown or malformed id SHALL answer 404 `not_found`.

#### Scenario: Paged list
- **WHEN** an admin requests `GET /admin/stores?pageSize=1` while two stores exist
- **THEN** the response is 200 with one item (the first by name), `page` 1, `pageSize` 1 and `total` 2

#### Scenario: Unknown store
- **WHEN** an admin requests `GET /admin/stores/00000000-0000-4000-8000-000000000000`
- **THEN** the response is 404 with code `not_found`

### Requirement: Admins create stores
`POST /api/core/v1/admin/stores` SHALL accept `{name, addressLine, pincode, promisedMinutes}` with optional `city`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents` and `minOrderCents`, and answer 201 with the new store. An absent `city` SHALL mean none, an absent `isOpen` closed and an absent money field 0. A new store serves no pincode until its service areas are set.

#### Scenario: Create a store
- **WHEN** an admin posts `{"name":"HSR Layout","addressLine":"27th Main, HSR Layout","pincode":"560102","promisedMinutes":12,"deliveryFeeCents":2500}`
- **THEN** the response is 201 with a new `id`, no `city` member, `isOpen` false, `deliveryFeeCents` 2500, `minOrderCents` 0, and `GET /serviceability?pincode=560102` still answers 404 `not_serviceable`

#### Scenario: Create a store with a city
- **WHEN** an admin creates a store with `"city":"  Bengaluru "`
- **THEN** the response is 201 with `city` `Bengaluru`, and `GET /admin/stores/{id}` answers the same city

### Requirement: Store fields are validated
On create and on change, `name` SHALL be 1 to 100 characters, `city` at most 100 and `addressLine` 1 to 200 after trimming (each stored trimmed), `pincode` six digits with a first digit from 1 to 9, each money field an integer from 0 to 10000000 cents, and `promisedMinutes` an integer from 1 to 240. A bad value SHALL answer 400 `validation` naming the field and change nothing.

#### Scenario: Negative fee
- **WHEN** an admin creates a store with `deliveryFeeCents` -1
- **THEN** the response is 400 with code `validation` and field `deliveryFeeCents`

#### Scenario: Blank name on change
- **WHEN** an admin patches a store with `{"name":"  "}`
- **THEN** the response is 400 with code `validation` and field `name`, and the store's name is unchanged

#### Scenario: Promised minutes missing
- **WHEN** an admin creates a store without `promisedMinutes`
- **THEN** the response is 400 with code `validation` and field `promisedMinutes`

#### Scenario: City too long or null
- **WHEN** an admin creates a store with a 101-character `city`, or with `"city":null`
- **THEN** the response is 400 with code `validation` and field `city`, and no store is created

### Requirement: Admins change stores
`PATCH /api/core/v1/admin/stores/{id}` SHALL change any subset of the store fields and answer 200 with the store; absent fields stay unchanged, and `city` `""` clears the city. An unknown id SHALL answer 404 `not_found`.

#### Scenario: Close a store
- **WHEN** an admin patches the store serving `560034` with `{"isOpen":false}`
- **THEN** the response is 200 with `isOpen` false, its other fields unchanged, and `GET /serviceability?pincode=560034` answers 200 with `store.isOpen` false

#### Scenario: Set, keep and clear the city
- **WHEN** an admin patches a store with `{"city":" Bengaluru "}`, then `{"name":"Renamed"}`, then a 101-character `city`, then `{"city":""}`
- **THEN** the first three leave `city` `Bengaluru` (the third answering 400 `validation` field `city`), and the last answers 200 with no `city` member

#### Scenario: Change an unknown store
- **WHEN** an admin patches `00000000-0000-4000-8000-000000000000`
- **THEN** the response is 404 with code `not_found`

### Requirement: Demo stores
`core-admin seed-demo --reset` SHALL delete every store it does not define and leave two open stores in city `Bengaluru`: Koramangala, id `00000000-0000-4000-8000-000000000401`, serving `560034` and `560095`, and Indiranagar, id `00000000-0000-4000-8000-000000000402`, serving `560038` and `560008`, so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another store
- **THEN** the other store is gone, `GET /serviceability?pincode=560095` answers store `00000000-0000-4000-8000-000000000401` and `GET /serviceability?pincode=560008` answers store `00000000-0000-4000-8000-000000000402`, both with `isOpen` true and `city` `Bengaluru`
