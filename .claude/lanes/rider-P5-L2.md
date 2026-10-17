# rider-P5-L2 - rider dispatch (OpenSpec change rider-dispatch)
Status: started
## Doing
Team lead, 2026-10-16: change proposed, validated strict, six worker briefs written (`rider-P5-L2-T1.md` to `T6.md`). Waiting for the manager to launch T1. I answer worker questions relayed here.
## Found
- Change `openspec/changes/rider-dispatch/`: new capability `dispatch` (13 requirements) and `rider-service` (ADDED "Riders go online and offline"; MODIFIED sign-in (`Rider.isOnline`), sign-out, staff read and update (deactivation goes offline), migrations (0005)). No `deliveries` delta: the claim, the ready list and the delivery reads are unchanged (design.md Decision 3). Every requirement is 500 characters or fewer (longest 499, "A tick offers free ready orders to free candidates").
- Every hand-written change is a patch in `openspec/changes/rider-dispatch/code/` (13 files: `T1-test`, `T1-feat`, `T2-fix`, `T2-test`, `T2-feat`, ..., `T6-feat`). They were spiked on a scratch copy of 150d5e5 and checked there: the patches apply in order to a clean checkout; after `sqlc generate`, `GOFLAGS=-count=1 make test-rider` is green with all 11 packages ok, every feat state is green, and every test state is red with the failures listed in tasks.md. Under `-race`, the accept-versus-claim and accept-versus-decline race tests passed 60 runs.
- Found and fixed in the plan: `coretest.adminOrder` read the order outside the fake's lock (a data race the new race test hit about 1 in 15 runs under `-race`). `T2-fix.diff` lands as a `fix:` before T2's tests.
- Found and designed around: advisory locks are database-wide, and `make test-rider` runs packages in parallel on one test database. So the dispatch key is `(727102, hashtext(current_schema()))`, which is global in production (one schema) and separate per test package.
- Location task (T6): written against core-P5-L2's merged contract (`Store.location {lat, lng}` on `GET /stores/{id}`, omitted when unset; checked in `origin/main`'s `services/core/openapi.json`). core-P5-L2 is on main (#360), so T6 does not wait; it is last in the normal order. T6's brief requires the lane branch to have merged origin/main first.
- For admin-P5-L2, the dispatch read contract is in design.md "Contract for admin-P5-L2".
## Requests
- to platform (through the rider area plan): `scripts/postman.mjs` `ID_VARS` gains `offers: 'offerId'`, and `docs/postman/local.postman_environment.json` gains `offerId` = `00000000-0000-4000-8000-000000000902`. After that, a rider lane adds `"offerId"` to the environment key list in `TestSummaryMatchesSeed` (the `ponytail:` comment marks the line).
- to admin (admin-P5-L2) and rider-P5-L3: add `isOnline` to the `Rider` fixtures (`apps/admin/src/riders-fake.ts`, `apps/rider/src/fake-api.ts`). After that, a rider lane adds `isOnline` to `Rider.required` in `services/rider/openapi.json` (design.md Decision 10).
## Blockers
None.
