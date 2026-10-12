# admin-P2-L2-T1 - admin stores table (OpenSpec change admin-stores, task 1)
Status: started
## Doing
Task 1.2 committed red (fixtures and `src/stores.test.tsx`); next 1.3 `feat: stores table` (`src/stores.ts`, `stores/index.tsx`).
## Found
- 1.1 `test: stores pages against core` (aec46fd): `e2e/stores.spec.ts` written from design.md, not run (task 5). `tsc` and eslint clean after `npm run build --workspace packages/ui`.
- 1.2 red, Vitest on apps/admin (design.md fixtures and tests as written): `Test Files 1 failed | 5 passed (6)`, `Tests 4 failed | 31 passed (35)`. The 31 are L1's, green. The four fail against the placeholder:
  - "stores table lists every store": `TestingLibraryElementError: Unable to find role="table" and name "Stores"`
  - "no stores shows the empty state": `Unable to find role="heading" and name "No stores yet"`
  - "stores table shows a skeleton while loading": `Unable to find role="status" and name "Loading"`
  - "stores load failure shows a retry that reloads": `Unable to find role="alert"`
- Placeholder `routes/_staff/_admin/stores/index.tsx` is replaced in place (design.md "replaces the placeholder"); not moved or deleted, so `routeTree.gen.ts` is unchanged.
## Requests
## Blockers
