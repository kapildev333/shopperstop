# admin-P2-L3-T5 - product delete with "Deactivate instead" (task 5 of admin-catalog)
Status: done
## Doing
Task 5 landed: `test: product delete with deactivate instead` (4d03366, red), then `feat: product delete with deactivate instead` (code, the `PageHeader` `actions` prop, and ticks 5.1 and 5.2). Awaiting team-lead / reviewer.
## Found
- `packages/ui` built once before the first run (exit 0).
- Red run (after `test:`, before code): `Tests  2 failed | 82 passed (84)`, `Test Files  1 failed | 13 passed (14)`.
  - Failing: "delete asks first, then removes the product", "an ordered product offers to deactivate instead".
  - Both fail on `Unable to find role="button" and name "Delete product"` (the page had no delete control yet).
- Green run (after `feat:` code): `Tests  84 passed (84)`, `Test Files  14 passed (14)`.
- `make test-web` exit 0: ui 54, admin 84, web 20 passed (lint and typecheck inside it, exit 0). `routeTree.gen.ts` unchanged.
- `openspec validate admin-catalog --type change --strict`: valid.
- `products/$productId.tsx`: the design.md task-5 block applied (`DeleteProduct`, widened imports, `actions={<DeleteProduct product={product.data} />}`). No review change to the file existed after task 4; the diff against task 4 is those three things only.
- 5.1 tick was made before the `test:` commit and is committed with the `feat:` (same as task 4's practice).
## Requests
## Blockers
