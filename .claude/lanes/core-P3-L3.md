# core-P3-L3 - core hygiene: session sweep, 405, migrate lock, trusted proxy, demo rider (OpenSpec change core-hygiene)
Status: started
## Doing
2026-10-15: change `core-hygiene` written and validated (`--strict`, `--all --strict` 16 passed); four worker briefs in the report; waiting for the manager to launch Task 1.
Worker: 2026-10-15 Task 1: test commit 68e7fe7 red (SQLSTATE 42P07 and 23505, 3 of 3 runs); feat commit applies migrate.go and testdb.go diffs, gates run.

## Found
- Change `openspec/changes/core-hygiene/`: proposal; deltas `platform` (MODIFIED "Error envelope" + scenario "The contract lists every code"; ADDED "A wrong method on a known route answers 405", "Migration runs do not interleave"), `accounts` (ADDED "Expired sessions are deleted", "The rate limiter trusts a proxy only when told"), `orders` (ADDED "The delivered demo order names its rider"); every requirement body under 500 characters. design.md carries every change as a verbatim diff (`git apply --check` clean on bcbb9c9) plus the Python `openapi.json` script; tasks.md four sequential worker tasks. No `docs/design/core-P3-L3.md`: design.md is enough.
- Spike on bcbb9c9 (tree restored before the commit): every new test red before its feat code and green after; `go test -race -count=1 ./...` green; `make gen postman` changes only `core.d.ts`; `make test-rider` green.
- Concurrent migrate test without the lock fails 3 of 3 (SQLSTATE 23505 on `pg_type_typname_nsp_index`).
- `testdb.Migrated` must drop its own advisory lock: keeping it with the same key on a second connection deadlocks against `Apply`'s lock.
- chi v5.4.0 gives a custom `MethodNotAllowed` handler no method list; `Allow` is rebuilt with `Routes.Match` per method on the root mux (flat routes in `app.New`).
- Cross-area break (spike `make test-web`): `packages/ui/src/api/core.test.ts:25` `toEqualTypeOf` the nine-code `Error.code` union fails `tsc` (TS2344) once `core.d.ts` has `method_not_allowed`. Fix (design.md "Cross-area"): `expectTypeOf<...nine codes...>().toExtend<components['schemas']['Error']['error']['code']>()`, typechecks against old and new `core.d.ts`. Web and admin do not break (`apps/admin/src/routes/sign-in.tsx:13` uses `Partial<Record<...>>`).
- Python scripts that edit `openapi.json` must not be named after a stdlib module (`enum.py` shadows `enum` and breaks `import json`).
## Requests
- to ui (through the core area plan, before Task 4 merges): `packages/ui/src/api/core.test.ts`, test `response types are usable by name`: replace `expectTypeOf<components['schemas']['Error']['error']['code']>().toEqualTypeOf<...nine codes...>()` with `expectTypeOf<...the same nine codes...>().toExtend<components['schemas']['Error']['error']['code']>()` (diff in design.md "Cross-area").
- to rider (optional, not blocking): `services/rider/internal/httpx/router.go:23` and the rider migrate runner carry the same 404-for-wrong-method and no-lock ceilings; design.md Decisions 2 and 3 port as is.
## Blockers
None.
