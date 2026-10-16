# rider-P4-L1 - rider hygiene: 405 with Allow, migrate lock (OpenSpec change rider-hygiene)
Status: started
## Doing
Team lead: change `rider-hygiene` proposed and validated (`--strict`; `--all --strict` 19 passed); two worker briefs in the report; waiting for the manager to launch Task 1.
## Found
- Change `openspec/changes/rider-hygiene/`: proposal; delta `specs/rider-service/spec.md` (MODIFIED "Rider HTTP conventions match core", body 495 characters, scenario "Unknown route and wrong method" changed, "Preflight on a known path still answered" added; MODIFIED "Rider schema migrations", body 445 characters, scenario "Concurrent runs serialise" added); design.md with verbatim diffs (`git apply --check` clean on a7ce2db); tasks.md (2 sequential worker tasks, 1 acceptance/verification task). No `docs/design/rider-P4-L1.md`: design.md is enough.
- The worktree is on a7ce2db (origin/main after #242), not 98c8996 as the brief says; nothing under `services/rider` differs between the two.
- Spike on a7ce2db (tree restored): `TestApplyConcurrentRunsSerialise` red 3 of 3 (SQLSTATE 23505), green 3 of 3 after; `TestWrongMethodIs405` and `TestUnknownRouteAndWrongMethod` red (404) before the router change, the app test still red on the enum check before the `openapi.json` line; `make test-rider` green after; `make gen` changes only `rider.d.ts` (one line); `make postman` leaves the rider collection unchanged; apps rider, web, admin typecheck.
- Lock key stays 727101 (rider testdb's value; core is 727001). `allowable` keeps core's five methods (rider has no DELETE route) so router.go stays one comment word from core's.
- Cross-area break: `packages/ui/src/api/api.test.ts:73` ("rider response types are usable by name", `toEqualTypeOf` the seven codes) fails `tsc` TS2344 with the new `rider.d.ts`. The `toExtend` fix in design.md "Cross-area" typechecks against old and new `rider.d.ts` (both checked).
## Requests
- to ui (through the rider area plan, before Task 2 merges): `packages/ui/src/api/api.test.ts`, test "rider response types are usable by name": replace `expectTypeOf<RiderComponents['schemas']['Error']['error']['code']>().toEqualTypeOf<...seven codes...>()` with `expectTypeOf<...the same seven codes...>().toExtend<RiderComponents['schemas']['Error']['error']['code']>()` (diff in design.md "Cross-area").
## Blockers
None.
