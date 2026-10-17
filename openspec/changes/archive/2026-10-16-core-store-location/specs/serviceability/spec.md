## MODIFIED Requirements

### Requirement: Public store view
`GET /api/core/v1/stores/{id}` SHALL answer, without a session, 200 with exactly the public store fields `id`, `name`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents`, `minOrderCents` and `promisedMinutes`, plus `city` and `location` (`{lat, lng}`) when the store has them (each omitted when it has none), open or closed. The same object SHALL be the `store` of a serviceability answer. An unknown or malformed id SHALL answer 404 `not_found`.

#### Scenario: Public fields only
- **WHEN** a client without a token requests `GET /stores/{id}` for an existing store with no city and no location
- **THEN** the response is 200 with exactly the keys `id`, `name`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents`, `minOrderCents`, `promisedMinutes`

#### Scenario: Store with a city
- **WHEN** a store in city `Bengaluru` with no location serves `560034` and a client requests `GET /stores/{id}` and `GET /serviceability?pincode=560034`
- **THEN** both store objects have exactly the seven public keys plus `city`, and `city` is `Bengaluru`

#### Scenario: Store with a location
- **WHEN** a store with no city at lat 12.9352, lng 77.6245 serves `561105` and a client requests `GET /stores/{id}` and `GET /serviceability?pincode=561105`
- **THEN** both store objects have exactly the seven public keys plus `location`, and `location` is exactly `{"lat":12.9352,"lng":77.6245}`

#### Scenario: Unknown store
- **WHEN** a client requests `GET /stores/00000000-0000-4000-8000-000000000000`, or `GET /stores/abc`
- **THEN** the response is 404 with code `not_found`
