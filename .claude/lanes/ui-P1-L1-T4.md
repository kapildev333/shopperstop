# ui-P1-L1-T4 - packages/ui task 4: Price, formatInr, Stepper, Badge, Chip (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 4 done on lane/ui-P1-L1-t4-price-stepper: test commit (red, 11 named tests), feat commit (components, tasks 4.1 and 4.2 ticked). All four gates green on Node 22.23.3. Waiting for review.
## Found
- Intl en-IN output for 0, 2 and 4-digit-lakh amounts contains no non-breaking space; the spec strings hold without normalisation.
- `Price`, `Badge` and `Chip` spread remaining native props after destructuring, per the design.md general rule ("spreads remaining native props"); the explicit interface lists were kept.
- `Stepper` at `max <= 0` shows "Out of stock" whatever `value` is (design.md); an out-of-stock cart line therefore has no decrement here.
## Requests
## Blockers
