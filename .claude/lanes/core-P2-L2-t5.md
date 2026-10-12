# core-P2-L2-t5 - staff store check, demo stores and store staff, final gate (tasks 5.1, 5.2)
Status: done (gates green 2026-10-12)
## Doing
Task 5 landed on `lane/core-P2-L2-stores-serviceability`: test commit `f161fa1` (test: unknown staff store, demo stores and store staff), feat commit `59baa12` (feat: staff store check; seed-demo loads the demo stores and store staff), then the tick commit (chore: tick tasks 5.1 5.2, with this log). Change core-stores-serviceability is 10 of 10 ticked; ready for `/opsx:verify`.
## Found
- Gates, from the worktree root: `GOFLAGS=-count=1 make test-core` exit 0 (gofmt and vet clean; `go test -race`: cmd/core 1.3 s, cmd/core-admin 25.4 s, internal/app 54.4 s, auth 9.0 s, config 1.9 s, httpx 1.7 s, migrate 3.2 s, pg 2.7 s, seed 82.4 s, store 2.2 s). `make gen postman`: 11 of 11 pass, `git status --short` empty. `openspec validate --all --strict`: 8 passed, 0 failed.
- Dev database (`shopperstop_core`, dev env): `migrate` reports "nothing to apply". `seed-demo --reset` run twice, exit 0 both times; output: `seed-demo: demo accounts loaded` / `admin admin@shopperstop.local (staff, admin)` / `customer demo@shopperstop.local (2 addresses)`.
- Over HTTP against the dev core (built `cmd/core`, :8080): `GET /serviceability?pincode=560095` answers Koramangala `...0401` open; `560008` answers Indiranagar `...0402` open; `koramangala@shopperstop.local` / `staff12345` signs in 200 `role` store_staff `storeId` `...0401`; `indiranagar@` 200 `storeId` `...0402`; admin sign-in 200. `POST /admin/staff-users` with the zero store id answers 400 `validation` field `storeId` "no such store". A stray store created through `POST /admin/stores` (pincode 560099) was removed by `seed-demo --reset`: `GET /admin/stores` total 2, pincode 560099 answers 404.
- `auth.CreateStaff` maps `23503` only when `ConstraintName` is `staff_users_store_id_fkey` (the other FK-free insert path cannot raise it); everything else still goes through `pg.Map`.
- Seed loader order: admin, customer, addresses, stores, service areas, store staff. Truncate list ends `store_service_areas, stores`. One bcrypt hash (cost 12) serves both store-staff users, so `hashDemo` now does three hashes per reset.
- Store names and staff names are not in design.md's table: stores `Koramangala` and `Indiranagar` (as in openapi's examples), staff `Koramangala Staff` and `Indiranagar Staff`, store addresses `80 Feet Rd, Koramangala` and `100 Feet Rd, Indiranagar`, both open, 2500 / 19900 / 9900, 10 and 12 minutes.
- Requests addressed to this lane are answered: core-P2-L1's foreign key, the 400 mapping, the fixtures (task 1 inserts a store before store staff), the demo users `...0102` and `...0103` (this task). Nothing else outstanding.
## Requests
- to core-P2-L1: none. Its L1 test `TestResetTwiceLeavesDemoAccounts` now expects 3 staff users; the admin row is read with `where role = 'admin'` (the single-row scan would pick an arbitrary one of three).
- to the core area plan: `seed-demo` prints only the admin and the customer. Stores and store staff are loaded and tested, but not listed in its output. The printer is in `cmd/core-admin`, outside this lane's scope; decide whether it should list them (a small follow-up in `cmd/core-admin`).
- to platform: none new.
## Blockers
- none
## Judgement calls
- Perf (coordinator review, 2026-10-12): `hashDemo` is `sync.OnceValues(computeHashes)`, so the three demo hashes are computed once per process (the demo passwords are public constants). Gates after the change, `GOFLAGS=-count=1 make test-core`: cmd/core 1.3 s, cmd/core-admin 16.4 s, internal/app 51.2 s, auth 9.6 s, config 1.9 s, httpx 2.6 s, migrate 2.9 s, pg 2.5 s, seed 22.7 s (was 82.4 s), store 3.3 s; all ok. The seed package is still about 23 s, not the ~10 s estimated: the first call per test binary pays three cost-12 hashes under -race, and the sign-in tests pay their own.
- `seed` package time rose from 38.6 s (L1 tail) to 82.4 s under `-race`: the store-staff hash (cost 12) runs on every reset, and the seed tests reset a dozen times. The brief said about 5 s; the real cost is about 40 s over the whole package. Ceiling: a shared cheaper hash for seed tests would need a test-only path in `seed`, which I did not add.
- `CreateStaff` maps the FK by constraint name rather than checking `store.Get` first. Design allowed either; the FK check has no race and no extra query.
- `TestResetTwiceLeavesDemoStores` plants a stray store (pincode 110001 with a service area) and checks that both resets remove it, so the reset-clears-stores rule has a test, not only the dev run.
## Deferred
- `seed-demo` output does not list stores or store staff (see Requests above).
- No `openapi.json` change: the staff-users 400 example already names the validation shape, and the contract tests pass.
