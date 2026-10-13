# admin-P2-L3-T4 - image upload (task 4 of admin-catalog)
Status: done
## Doing
Task 4 landed: `test: catalog image upload` (1ef9f30, red), then `feat: catalog image upload` (code and tick 4.2). Awaiting team-lead / reviewer.
## Found
- Red run (before any code): failing "upload a product image shows the stored image", "a GIF is refused without a request", "a PNG over 5 MB is refused without a request", "a file core refuses is flagged on the field", "any other upload failure shows a banner", "upload a category image from its dialog".
- `packages/ui` built once before the first run (exit 0).
- Red run (after `test:`, before code): `Tests  6 failed | 76 passed (82)`, `Test Files  1 failed | 12 passed (13)`.
- Green run (after `feat:` code): `Tests  82 passed (82)`, `Test Files  13 passed (13)`.
- `make test-web` exit 0: ui 54, admin 82, web 20 passed. `routeTree.gen.ts` unchanged.
- `openspec validate admin-catalog --type change --strict`: valid.
- `image.tsx`, `categories.tsx` and `products/$productId.tsx` are the design.md task-4 blocks (the route page edits applied as the design's two insertions; no review change to the file existed).
- Lint and typecheck ran inside `make test-web` (exit 0). `image.tsx` was written from the design.md fence; the product page diff against HEAD is exactly the two added insertions.
## Requests
## Blockers
