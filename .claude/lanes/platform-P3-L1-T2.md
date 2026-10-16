# platform-P3-L1-T2 - postman collection per service and rider environment (OpenSpec change platform-rider-wiring, tasks 2.1 to 2.3)
Status: started (task 2.1 red committed; generator and environment next)
## Doing
Red committed (`test: rider postman collection and environment`). Next: `scripts/postman.mjs` per design.md, the four environment variables, green gates.
## Found
- Red (2.1, `node --test scripts/postman.test.mjs`, before the generator change):
  - `# tests 17`, `# pass 11`, `# fail 6`
  - failing: `rider URLs read the rider base URL`, `rider routes read their tokens`, `rider sign-in stores riderToken`, `rider and delivery ids read environment variables`, `postman CLI skips an absent rider contract`, `environment holds the eleven variables`
  - passing on the current code, as expected: the eleven core and generic tests, `rider collection follows the rider contract` (no rider contract, so it asserts the file is absent), and `two runs give identical bytes` (the rider case is deterministic even though the service argument is ignored today).
- `riderFixture` is the design's table (six operations, tags `platform`, `rider-service`, `deliveries`, server `/api/rider/v1`).
## Requests
## Blockers
none
