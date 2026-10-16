## MODIFIED Requirements

### Requirement: Rider schema migrations
`rider-admin migrate` SHALL apply each unrecorded `migrations/NNNN_name.sql` in order, each in its own transaction with its version, under a database-wide advisory lock held for the whole run, and print each applied version or `nothing to apply`. The schema SHALL hold `riders` (store id without a foreign key, unique case-insensitive email) and `sessions` (cascade on rider delete), each with `created_at` and an `updated_at` kept by a trigger.

#### Scenario: Second run applies nothing
- **WHEN** migrations are applied twice to an empty schema
- **THEN** the first run applies `0001_init`, `0002_riders`, `0003_deliveries` and `0004_delivery_payment_status` in that order and the second applies none

#### Scenario: A failed file leaves no trace
- **WHEN** a migration file fails halfway
- **THEN** none of its statements and no version for it are recorded, and later files are not run

#### Scenario: updated_at follows updates
- **WHEN** a rider row is updated
- **THEN** its `updated_at` is later than its `created_at`

#### Scenario: Concurrent runs serialise
- **WHEN** two migrate runs start together on an empty schema with files `0001_a.sql` and `0002_b.sql`
- **THEN** both succeed, each file is applied by exactly one of them, and `0001_a` and `0002_b` are each recorded once
