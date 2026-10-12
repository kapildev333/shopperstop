# ui-P1-L1-T6 - packages/ui task 6: EmptyState, StatusMessage, PageHeader, TabNav (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 6 done on lane/ui-P1-L1-t6-feedback-nav: red test commit, feat commit (four components, tasks 6.1 and 6.2 ticked). Lint, typecheck, test and build exit 0 on Node 22.23.3. Waiting for review.
## Found
- Every component takes an optional `className` merged last through `cn`, as design.md's general rule asks, though the per-component signature lists omit it.
- `PageHeader` wraps title and description in a plain `<div>` so they stack inside the `justify-between` row; design.md does not name that wrapper. `EmptyState` uses `gap-2` between its children (spacing not pinned in design.md).
- `StatusMessage` imports `AlertTriangle` and `CheckCircle2` (the design.md names); lucide-react 1.55.0 still exports them.
- `TabNav` has a one-line comment on the router-agnostic `aria-current` contract.
## Requests
## Blockers
