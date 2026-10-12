# serviceability Specification

## Purpose
Which dark store delivers to a pincode: the public serviceability lookup and the public store view with the fields checkout shows (fees, free-delivery threshold, minimum order, promised minutes, open state).

## Requirements

### Requirement: Serviceability by pincode
`GET /api/core/v1/serviceability?pincode=<pincode>` SHALL answer, without a session, 200 `{store}` where `store` is the public view of the one store whose service areas hold that pincode, whether the store is open or not. A pincode that no store serves SHALL answer 404 `not_serviceable`. A missing pincode, or one that is not six digits with a first digit from 1 to 9, SHALL answer 400 `validation` with field `pincode`.

#### Scenario: Served pincode
- **WHEN** an open store serves `560034` and a client without a token requests `GET /serviceability?pincode=560034`
- **THEN** the response is 200 with `store.id` that store's id and `store.isOpen` true

#### Scenario: Closed store
- **WHEN** the store serving `560034` has `isOpen` false and a client requests `GET /serviceability?pincode=560034`
- **THEN** the response is 200 with that store and `store.isOpen` false

#### Scenario: Unserved pincode
- **WHEN** no store serves `110001` and a client requests `GET /serviceability?pincode=110001`
- **THEN** the response is 404 with code `not_serviceable`

#### Scenario: Malformed pincode
- **WHEN** a client requests `GET /serviceability?pincode=56003`, or `GET /serviceability` without a pincode
- **THEN** the response is 400 with code `validation` and field `pincode`

### Requirement: Public store view
`GET /api/core/v1/stores/{id}` SHALL answer, without a session, 200 with exactly the public store fields `id`, `name`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents`, `minOrderCents` and `promisedMinutes`, open or closed. The same object SHALL be the `store` of a serviceability answer. An unknown or malformed id SHALL answer 404 `not_found`.

#### Scenario: Public fields only
- **WHEN** a client without a token requests `GET /stores/{id}` for an existing store
- **THEN** the response is 200 with exactly the keys `id`, `name`, `isOpen`, `deliveryFeeCents`, `freeDeliveryAboveCents`, `minOrderCents`, `promisedMinutes`

#### Scenario: Unknown store
- **WHEN** a client requests `GET /stores/00000000-0000-4000-8000-000000000000`, or `GET /stores/abc`
- **THEN** the response is 404 with code `not_found`
