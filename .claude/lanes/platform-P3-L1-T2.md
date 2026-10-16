# platform-P3-L1-T2 - postman collection per service and rider environment (OpenSpec change platform-rider-wiring, tasks 2.1 to 2.3)
Status: done (2.1 red committed as `test: rider postman collection and environment`; 2.2 and 2.3 in the `feat:` commit; not pushed)
## Doing
Done. Waiting for the reviewer and the area manager to land it with tasks 1 and 3.
## Found
- Red (2.1, `node --test scripts/postman.test.mjs`, before the generator change):
  - `# tests 17`, `# pass 11`, `# fail 6`
  - failing: `rider URLs read the rider base URL`, `rider routes read their tokens`, `rider sign-in stores riderToken`, `rider and delivery ids read environment variables`, `postman CLI skips an absent rider contract`, `environment holds the eleven variables`
  - passing on the current code, as expected: the eleven core and generic tests, `rider collection follows the rider contract` (no rider contract, so it asserts the file is absent), and `two runs give identical bytes` (the rider case is deterministic even though the service argument is ignored today).
- `riderFixture` is the design's table (six operations, tags `platform`, `rider-service`, `deliveries`, server `/api/rider/v1`).
- Green (2.2 and 2.3): `node --test scripts/postman.test.mjs` gives `# tests 17`, `# pass 17`, `# fail 0`.
- `make postman` run twice: each run prints `postman: services/rider/openapi.json absent, skipping`, exits 0; `git diff -- docs/postman/shopperstop-core.postman_collection.json` is empty; `ls docs/postman` lists the environment and the core collection only, no rider collection.
- `make test-core` exit 0 (every package `ok`, including the seed package that reads the environment file; Go may show `(cached)` for unchanged packages).
- `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`.
- The design was followed without deviation. The Python one-off was used only to insert the four environment entries, the file stays two-space JSON with a trailing newline.
## Requests
## Blockers
none
