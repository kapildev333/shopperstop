# core-P2-L1-t8 - task 8: staff users and create-admin (GET, POST /admin/staff-users, PATCH /admin/staff-users/{id}, core-admin create-admin)
Status: done
## Doing
Task 8 landed on `lane/core-P2-L1-accounts-auth`: `b5b39e2` (test: staff users and create-admin, red), `8aaa389` (feat: admin staff-users routes and core-admin create-admin), `f3c6963` (chore: tick tasks 8.1 8.2), then this log. Gates: `make test-core` exit 0 (gofmt, vet, `go test -race`: `cmd/core` 1.34 s, `cmd/core-admin` 11.4 s, `internal/app` 49.6 s, `internal/auth` 9.6 s, `config`/`httpx`/`migrate`/`pg` cached); `openspec validate --all --strict` 6 passed. Manual check against the dev database done (below). Ready for task 9 (seed-demo).
## Found
- `auth.CreateStaff(ctx, pool, NewStaff) (Staff, error)` is the one place a staff user is validated and inserted: email, password 8 to 72 bytes, name, role (`admin` or `store_staff`), storeId (canonical uuid for store staff, empty for admins), then cost-12 hash and insert; a taken email is 409 `conflict` field `email`. The admin route, `create-admin` and tests all call it.
- Handlers on `*Auth` in `staff.go`: `CreateStaffUser`, `ListStaff` (`httpx.Page`, `CountStaff`, `ListStaff` by email, `httpx.NewList`), `UpdateStaffUser` (`httpx.PathID` first, then `httpx.ReadPatch` into `name`, `password`, `isActive`; `UpdateStaff` no rows → `pg.Map` → 404). `staffFrom` builds the API `Staff` for the new code. Routes in `app.go` under `RequireAdmin`.
- `isActive` false ends that user's signed-in sessions at their next request (the `StaffSession` join); an admin may deactivate themselves; role and store are not changeable.
- `core-admin create-admin <email>`: `createAdminCmd` loads the config and pool, `createAdmin` reads the first stdin line (strips `\r\n`; empty is "password is required on stdin"), calls `CreateStaff` with name `Admin` and role `admin`, prints `created admin <email>`. Refusals go to stderr as `core-admin: <field>: <message>` (e.g. `core-admin: email: email already registered`), exit 1. Usage line updated; no email exits 2.
- `openapi.json` (still 0.2.0): operations `listStaffUsers`, `createStaffUser` (`/admin/staff-users`), `patchStaffUser` (`/admin/staff-users/{id}`), tag `admin-staff`, `security` bearer on all three, examples on every response, 400/401/403 on all, 404 on PATCH, 409 on POST; schemas `StaffCreate`, `StaffPatch`, `StaffList`. Added as a text splice (461 insertions, 0 deletions). `make gen` and `make postman` not run (task 10).
- `StaffCreate`/`StaffPatch` decode into `NewStaff`/`staffPatch` with JSON tags; the schema is the JSON body, so `NewStaff` carries the tags the brief's shape did not show.
## Manual check (dev env, `shopperstop_core` on localhost:5432, a go-built binary for exit codes)
- `printf 'rootpass123\n' | core-admin create-admin root@example.com` → `created admin root@example.com`, exit 0.
- Same command again → `core-admin: email: email already registered`, exit 1.
- `core-admin create-admin` with no email → `usage: core-admin migrate | seed-demo [--reset] | create-admin <email>`, exit 2. (Through `go run`, the wrapper prints `exit status 2` and exits 1; the binary exits 2.)
- Also: `printf 'short\n' | core-admin create-admin short@example.com` → `core-admin: password: must be 8 to 72 bytes`, exit 1.
- The row `root@example.com` (password `rootpass123`, role admin) is left in the dev database `shopperstop_core`; the brief allowed a note, and `seed-demo --reset` (task 9) truncates it.
## Requests
- to core-P2-L2: `staff_users.store_id` has no foreign key yet, so `storeId` is any canonical uuid until L2 adds it; then map the unknown-store violation on create to 400 `validation` field `storeId` (already in the lane log's Requests).
## Blockers
none
## Judgement calls
- Red commit: the three task 7 gap tests (`TestStaffSignOutEndsOnlyThatSession`, `TestSharedLimiterCountsStaffAndCustomer`, `TestStaffSignInValidation`) pass before the feat commit. They cover behaviour that already existed; a red run would need the behaviour broken. They are folded in as coverage, not as red.
- The cmd test (`TestCreateAdminFromStdin`, `TestCreateAdminEmailTaken`) is red by build failure (`undefined: createAdmin`), the same form task 1 used for a missing package; the app tests are red on 404 and 401 at runtime.
- `TestCreateStoreStaffUser` pays cost 12 twice (create and sign-in), as task 7 asked; `TestStaffPasswordReset` pays it on the PATCH and on the two sign-ins. Other fixtures stay cheap (`insertStaff`).
- `checkRole` validates `storeId` with its own uuid regexp (the one in `httpx/path.go` is unexported). Duplicated pattern; export it from `httpx` only when a third user appears.
- `createAdmin` prefixes API field errors with the field name because `httpx.Error.Error()` drops it. The 409 text is `email: email already registered`, a little redundant but it names the field.
- Password from stdin only (Decision 20): a terminal echoes it; no `x/term`, as the design says.
## Deferred
- `storeId` existence check: core-P2-L2 (stores and the foreign key).
- Regenerating `core.d.ts` and the Postman collection: task 10.
