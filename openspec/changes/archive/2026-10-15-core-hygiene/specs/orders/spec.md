## ADDED Requirements

### Requirement: The delivered demo order names its rider
`core-admin seed-demo` SHALL load demo order `00000000-0000-4000-8000-000000000701` (`SS-DEMOAAAB`, `delivered`) with rider name `Arjun Rao`, and its `out_for_delivery` and `delivered` events with actor type `rider`, actor id `00000000-0000-4000-8000-000000000801` and actor name `Arjun Rao`, the rider service's demo rider. No other demo order or event SHALL name a rider.

#### Scenario: Seeded rider
- **WHEN** `seed-demo --reset` runs twice
- **THEN** exactly one order has a rider name, `...0701` with `Arjun Rao`, and exactly two events have actor type `rider`, both on `...0701` by `...0801` `Arjun Rao`
