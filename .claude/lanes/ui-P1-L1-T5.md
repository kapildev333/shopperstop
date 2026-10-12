# ui-P1-L1-T5 - packages/ui task 5: Card, Table (stack mode), Skeleton (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 5 landed on lane/ui-P1-L1-t5-card-table: `test: card, table stack mode and skeleton` (red, 4 tests failed on the placeholders), then `feat: Card, Table, Skeleton` (green, tasks 5.1 and 5.2 ticked). Gates green on Node 22.23.3: lint, typecheck, test (16 passed), build. Waiting for review.
## Found
- `Table` and `Skeleton` accept `className` merged last through `cn`, following design.md's general rule ("Every component accepts `className`"); their per-component lists in design.md omit it. Not covered by a test.
- Table stack mode puts `max-sm:block` on table, tbody, tr and td, `max-sm:sr-only` on thead, `max-sm:py-2` on tr, and a `sm:hidden` header span in each td.
## Requests
## Blockers
