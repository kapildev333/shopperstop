# admin-P2-L3 - admin catalog pages (OpenSpec change admin-catalog)
Status: blocked
## Doing
Stopped for the day (manager's wrap-up). Blocked on the admin-stores merge and rebase in any case. Resume here.
## Found
- Done: `openspec/changes/admin-catalog/` proposal.md; delta `specs/admin-app/spec.md` (19 ADDED requirements, 33 scenarios); `openspec validate admin-catalog --type change --strict` valid. design.md is a draft: assumptions A1-A12, decisions 1-13. `spike.patch` holds the full spiked code and tests (main + admin-stores base): tsc, eslint, Vitest 84/84 (3 runs), vite build, and the catalog e2e passed against a page.route fake on port 25174 with axe clean. The real-core e2e has not run.
- Missing: tasks.md (no `tasks` artifact yet), the design's files-per-task table, scenario-to-test table and risks, and the worker briefs.
- Resume order: (1) write tasks.md: 0 recheck after the rebase; 1 e2e spec written first + `catalog.ts`, `image.tsx` (ImageTile only), fixtures, products table, placeholders `products/new.tsx` and `products/$productId.tsx`, routeTree; 2 categories page (dialogs without ImageUpload); 3 product form (new, $productId without delete and image); 4 ImageUpload (product card + category dialog line); 5 product delete with "Deactivate instead"; 6 e2e run (needs the e2e slot). Sequential on one worktree; 2 and 3 are file-disjoint if the manager wants parallel worktrees. (2) Fold `spike.patch` into design.md per task, or keep it as the workers' source and delete it before the PR. (3) Cut briefs. (4) After the manager rebases onto main with admin-stores merged: recheck A12 (stores.ts `toCents`/`toRupees`, fake-core helpers, placeholders), re-apply `spike.patch`, re-run the gates.
- Mutation guards (spiked, each turns its test red): drop the tree invalidation in `CategoryDialog`; drop `setQueryData` in `ProductForm`; diff against `product` instead of `parse(initial(product))` (needs the fixture `tonedMilk` without a description); drop the upload invalidation; drop the `?v=` counter.
- `/files` needs no proxy change: `imageUrl` is `/api/core/v1/files/...`. FILES_DIR reaches core and the seed through the inherited env.
## Requests
- to ui (via the area plan): an `ImageTile` (1:1, placeholder) in `packages/ui` with a test and a Figma component. Admin is the second app needing it (web has the same recipe in `web-serviceability-catalog`). Admin ships an app-level copy until then. Optional later: a `Textarea` for the description.
- to core (information): deleting a product leaves its uploaded file in FILES_DIR; harmless for e2e (gitignored dir).
## Blockers
- admin-P2-L2 `admin-stores` must merge and the lane must be rebased onto it before any worker starts.
