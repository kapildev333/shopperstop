# core-P2-L3-t5 - image uploads and the file route (tasks 5.1, 5.2 of core-catalog, plus the task 4 review nits)
Status: done (task 5 of 6)
## Doing
Task 5 landed on `lane/core-P2-L3-catalog`: red tests, then `images.go`, the three routes, `openapi.json`, the regenerated files, the tick and this log. Task 6 (demo catalog in seed-demo) is next and not started.
## Found
- Commits: `4fb71da` test: image uploads, file route, product create validation (red: the upload and file routes answered 404, the two image gate rows failed), `41c4edc` feat: product and category image uploads; GET /files (`internal/catalog/images.go`, `app.go` routes, `openapi.json`, `packages/ui/src/api/core.d.ts`, the Postman collection), then the tick commit and this log.
- Routes: `PUT /admin/products/{id}/image`, `PUT /admin/categories/{id}/image` under `RequireAdmin`; `GET /files/{kind}/{name}` public. Operation ids `putAdminProductImage`, `putAdminCategoryImage`, `getFile`; tags `admin-catalog` (uploads, with `security`) and `catalog` (file route, new tag). Schema `ImageUpload` (multipart object, required `file`, binary).
- The SQL `SetProductImage` and `SetCategoryImage` already generated in task 1; no query change.
- Gates, all from the worktree root:
  - `GOFLAGS=-count=1 make test-core` exit 0, wall 49.2 s (`-race`, gofmt and go vet clean): cmd/core 1.4 s, cmd/core-admin 19.5 s, app 48.1 s, auth 9.1 s, blob 1.7 s, catalog 3.1 s, config 2.5 s, httpx 3.3 s, migrate 2.8 s, pg 3.6 s, seed 39.0 s. `TestContract` and `TestContractSecurity` ran and passed.
  - `make gen postman` exit 0 (postman `node --test` 11 of 11); the generated files are committed in `41c4edc`.
  - `openspec validate --all --strict`: 8 passed, 0 failed.
- Task 4 review nits folded in: `ProductPatch.isActive` now reads "Unchanged when omitted." (ProductCreate keeps "Defaults to true."); `TestCreateProductFieldBounds` covers name (empty, 101), brand (61), unitLabel (empty, 31), description (2001), mrpCents (0, 100 000 001), each answering 400 `validation` with that field.
- Judgement calls for the manager:
  1. `TestCreateProductFieldBounds` passed on its first run (it is not red). The bounds were implemented in task 4, so the test pins existing behaviour rather than driving new code. Reported as such; the red step for it did not happen.
  2. Upload order as design Decision 11: `PathID`, then `GetProduct`/`GetCategory` (404 before the body is read), then the body, then `files.Put` under the row's own id (canonical lowercase), then the `image_key` update.
  3. Non-file parts are read and dropped through `io.Copy(io.Discard, ...)`, so the 16 MiB limit covers them too. The 17 MiB test answers 400 `body too large` (no field); the Go client did not see a reset.
  4. A type switch (PNG then JPEG) leaves the old `.png` on disk, per Decision 12; a same-type re-upload replaces the bytes in place (tested).
  5. Content-Type for the file route is a fixed map from the stored extension (`png`, `jpg`, `webp`), not `mime.TypeByExtension`, since webp is not in every system table.
  6. The `If-Modified-Since` header was documented as a parameter first; removed again because the Postman generator wrote the placeholder `"string"` into the collection's request header. The 304 response and the operation description carry it.
  7. Extra tests beyond the names in tasks.md: `TestUploadUnknownCategory` (the category route's 404), a case in `TestUploadOver5MiB` that exactly 5 MiB is accepted (the boundary of "at most 5 MiB"), and the category row in the 404 gate. The admin gate rows for both image routes use the unknown id, so an allowed admin gets 404 before the body is read.
- Not changed: `internal/app/app_test.go` (TestMain already passes the temp files dir), `categories.go`, `products.go`, `catalog.go`, `blob`, `seed`.
## Requests
- to core-P2-L4: nothing new. `imageURL` and `toProduct` already carry the image URL on every product shape; the store reads should reuse `imageURL` for `imageUrl`.
- to core-P2-L5: nothing new.
- to manager: confirm judgement 6 (the `If-Modified-Since` parameter is out of the openapi file) and judgement 1 (the validation table is a pin, not a red-green cycle).
## Blockers
- none
