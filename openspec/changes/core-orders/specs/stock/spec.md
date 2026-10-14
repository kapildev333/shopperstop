## MODIFIED Requirements

### Requirement: Concurrent reservations never oversell
Two transactions reserving the same stock at once SHALL never take more than the stored quantity, and reservations that name the same products in different orders SHALL not deadlock. A reservation, a release and a staff bulk stock update that name the same products in different orders SHALL not deadlock with one another either: each SHALL complete without being aborted.

#### Scenario: Racing for the last unit
- **WHEN** two transactions each reserve 1 of a product with quantity 1 at the same time and both try to commit
- **THEN** exactly one succeeds, the other reports that product out of stock, and the quantity is 0

#### Scenario: Opposite order
- **WHEN** two transactions reserve P and Q at the same time, one listing P first and the other Q first, with enough of both
- **THEN** both succeed and each quantity dropped by the sum of the two reservations

#### Scenario: Release against a reservation
- **WHEN** one transaction releases 1 of Q and 1 of P, listing Q first, while another reserves 1 of P and 1 of Q, listing P first, with enough of both
- **THEN** both commit and P and Q hold the quantities they started with

#### Scenario: Bulk update against a reservation
- **WHEN** one transaction writes the bulk stock update for Q and P, listing Q first, while another reserves 1 of P and 1 of Q, listing P first, with enough of both
- **THEN** both commit
