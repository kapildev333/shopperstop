# admin-P2-L3-T3 - product form: create and change (task 3 of admin-catalog)
Status: done
## Doing
Task 3 landed: `test: product create and change` (8bb2214, red), then `feat: product create and change` (code and tick 3.2). Awaiting team-lead / reviewer.
## Found
- Red run (after the `test:` commit, before any code): `Tests  8 failed | 68 passed (76)`, `Test Files  1 failed | 11 passed (12)`. Failing: "a second product save sends only its own change", "a validation error from core is shown on its field", "a value the form cannot send is flagged without a request", "an unknown product shows not found", "any other product save error shows a banner", "create a product and open it", "edit sends only the changed fields and confirms", "the products table shows a saved change".
- Green run: `Tests  76 passed (76)`, 12 files. `make test-web` exit 0 (ui 54, admin 76, web 20 passed). `routeTree.gen.ts` unchanged. `openspec validate admin-catalog --type change --strict` valid.
- `src/product-form.tsx`, `products/new.tsx` and `products/$productId.tsx` are the task-3 blocks from design.md, byte for byte (checked with `diff` against the design.md fences). `$productId.tsx` has no `DeleteProduct` and no `ImageUpload`.
- Process note: in step 1 I first extracted all four design.md blocks, then reverted the code files to the placeholders before running the red tests, so the red run was against the placeholders only.
## Requests
## Blockers
