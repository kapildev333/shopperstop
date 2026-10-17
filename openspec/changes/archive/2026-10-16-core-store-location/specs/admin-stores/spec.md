## MODIFIED Requirements

### Requirement: Admins list and read stores
`GET /api/core/v1/admin/stores` SHALL answer a paged list of stores ordered by name, and `GET /admin/stores/{id}` one store, each store being `{id, name, city, location, addressLine, pincode, isOpen, deliveryFeeCents, freeDeliveryAboveCents, minOrderCents, promisedMinutes}`, where `pincode` is the store's own address pincode, and `city` and `location` are omitted when the store has none. An unknown or malformed id SHALL answer 404 `not_found`.

#### Scenario: Paged list
- **WHEN** an admin requests `GET /admin/stores?pageSize=1` while two stores exist
- **THEN** the response is 200 with one item (the first by name), `page` 1, `pageSize` 1 and `total` 2

#### Scenario: Unknown store
- **WHEN** an admin requests `GET /admin/stores/00000000-0000-4000-8000-000000000000`
- **THEN** the response is 404 with code `not_found`

### Requirement: Admins create stores
`POST /api/core/v1/admin/stores` SHALL accept `{name, addressLine, pincode, promisedMinutes}` with optional `city`, `location`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents` and `minOrderCents`, and answer 201 with the new store. An absent `city` or `location` SHALL mean none, an absent `isOpen` closed and an absent money field 0. A new store serves no pincode until its service areas are set.

#### Scenario: Create a store
- **WHEN** an admin posts `{"name":"HSR Layout","addressLine":"27th Main, HSR Layout","pincode":"560102","promisedMinutes":12,"deliveryFeeCents":2500}`
- **THEN** the response is 201 with a new `id`, no `city` and no `location` member, `isOpen` false, `deliveryFeeCents` 2500, `minOrderCents` 0, and `GET /serviceability?pincode=560102` still answers 404 `not_serviceable`

#### Scenario: Create a store with a city
- **WHEN** an admin creates a store with `"city":"  Bengaluru "`
- **THEN** the response is 201 with `city` `Bengaluru`, and `GET /admin/stores/{id}` answers the same city

#### Scenario: Create a store with a location
- **WHEN** an admin creates a store with `"location":{"lat":12.9352,"lng":77.6245}`, and another with `"location":{"lat":-90,"lng":180}`
- **THEN** both responses are 201 with that `location`, and `GET /admin/stores/{id}` answers the same `location`

### Requirement: Demo stores
`core-admin seed-demo --reset` SHALL delete every store it does not define and leave two open stores in city `Bengaluru`: Koramangala, id `00000000-0000-4000-8000-000000000401`, at lat 12.9352, lng 77.6245, serving `560034` and `560095`, and Indiranagar, id `00000000-0000-4000-8000-000000000402`, at lat 12.9719, lng 77.6412, serving `560038` and `560008`, so two consecutive runs leave the same rows.

#### Scenario: Reset twice
- **WHEN** `seed-demo --reset` runs twice on a database that also holds another store
- **THEN** the other store is gone, `GET /serviceability?pincode=560095` answers store `00000000-0000-4000-8000-000000000401` with `location` `{"lat":12.9352,"lng":77.6245}` and `GET /serviceability?pincode=560008` answers store `00000000-0000-4000-8000-000000000402` with `location` `{"lat":12.9719,"lng":77.6412}`, both with `isOpen` true and `city` `Bengaluru`

## ADDED Requirements

### Requirement: Store locations
A store's `location` SHALL be `{lat, lng}` in degrees, `lat` from -90 to 90 and `lng` from -180 to 180, both or neither, which the database enforces too. On create and on change a present `location` SHALL carry both: an out-of-range coordinate answers 400 `validation` field `location.lat` or `location.lng`, a missing one or a `null` location field `location`, and nothing changes. A change with a location replaces it, one without keeps it; none clears it.

#### Scenario: Refused on create
- **WHEN** an admin creates a store with `location` `{"lat":90.5,"lng":77.6}`, `{"lat":12.9,"lng":-180.5}`, `{"lat":12.9}` or `null`
- **THEN** the responses are 400 `validation` with field `location.lat`, `location.lng`, `location` and `location`, and no store is created

#### Scenario: Set and keep on change
- **WHEN** an admin patches a store with `{"location":{"lat":12.9719,"lng":77.6412}}`, then with `{"name":"Renamed"}`
- **THEN** both answer 200 and `GET /admin/stores/{id}` answers `location` `{"lat":12.9719,"lng":77.6412}`

#### Scenario: Refused on change
- **WHEN** an admin patches a store at lat 12.9719, lng 77.6412 with `location` `{"lat":-91,"lng":77.6}`, `{"lat":12.9,"lng":181}`, `{"lng":77.6}` or `null`
- **THEN** the responses are 400 `validation` with field `location.lat`, `location.lng`, `location` and `location`, and the store's location is unchanged

#### Scenario: Both or neither in the database
- **WHEN** SQL sets `lat` to null on a store that has a location
- **THEN** the database refuses the update
