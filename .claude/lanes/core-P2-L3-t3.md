# core-P2-L3-t3 - admin categories and the files store wired into the app (tasks 3.1, 3.2 of core-catalog)
Status: done (task 3 of 6)
## Doing
Task 3 landed on `lane/core-P2-L3-catalog`: tests red, then the category routes, `app.New(pool, origins, a, files)`, `cmd/core` wiring, openapi entries and regenerated files. Task 4 (admin products) is next and not started.
## Found
- Commits: `1a24327` test: admin categories (red: `slugify`/`pattern` undefined, `app.New` arity), `8590fbb` feat: admin categories; app takes the files store (includes `openapi.json`, `packages/ui/src/api/core.d.ts`, the Postman collection), `cad6292` chore: tick tasks 3.1 3.2, then this log.
- `app.New(pool, origins, a, files blob.Store)`. `cmd/core` passes `blob.Disk{Dir: cfg.FilesDir}`. Every test server passes `blob.Disk{Dir: filesDir}` (app `TestMain`, a temp dir removed after the run); `TestContract` passes nil; the seed test passes `t.TempDir()`.
- Names kept for L4: `catalog.New(pool, files) *Catalog`, `Category`, `CategoryNode` (embeds `Category`, `Children []Category` never nil), `CategoryTree {items}`, `tree`, `pattern`, `imageURL`, `mapErr`, `toCategory`, `slugify`. Schemas `Category`, `CategoryNode`, `CategoryTree`, `CategoryCreate`, `CategoryPatch` in `openapi.json`, tag `admin-catalog`.
- Routes under `RequireAdmin`: `GET|POST /admin/categories`, `PATCH|DELETE /admin/categories/{id}`. Unknown or non-uuid ids answer 404 through `httpx.PathID`.
- `Catalog` keeps `files` (unused until task 5). `slugify` and `pattern` live in `slug.go` (the brief's scope) rather than `catalog.go` as design.md's file list says; same package, same names.
- `mapErr` handles only `categories_parent_id_fkey` (400 `parentId` "unknown category") and falls back to `pg.Map`. The `23514` price rule and the product foreign key cases belong with task 4, where they are tested.
- The race path (parent deleted between `GetCategory` and insert) is not tested: it needs a concurrent delete. The check itself is tested through `GetCategory`.
- Gates (`GOFLAGS=-count=1 make test-core`, run with `-race`, exit 0, wall 48 s): cmd/core 1.3 s, cmd/core-admin 18.8 s, app 46.7 s, auth 9.5 s, blob 1.4 s, catalog 3.0 s, config 2.1 s, httpx 2.4 s, migrate 2.7 s, pg 3.2 s, seed 38.9 s. `make gen postman` exit 0 and clean afterwards; the postman `node --test` suite 11 of 11. `openspec validate --all --strict`: 8 passed.
- `packages/ui` and `apps/*` have no `node_modules` in a fresh worktree; `npm ci` ran in this worktree to run `make gen postman`. The root checkout was not touched.
## Requests
- none new. Task 4 relies on `catalog.mapErr` (extend it with the `23514` and `products_category_id_fkey` cases there, tested).
## Blockers
- none
