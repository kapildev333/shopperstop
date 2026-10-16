# core-P3-L2-review-t1

Reviewer verdict, Task 1 of core-P3-L2 (22c3154). Verdict: APPROVE. No findings.

Checked
- Test-first: 6650a99 adds TestOrderStoreSnapshot, TestBackfillStoreSnapshot (migrates to 0007, inserts, applies 0008, checks values and NOT NULL) and the seed assertion; they compile and fail before 566e7e9.
- Migration 0008: add nullable, backfill by join on store_id (every order has a store, FK), then NOT NULL; numbered after 0007; one transaction per migrate; table-rewrite-free adds.
- Place copies s.Name / s.PromisedMinutes from the store row already read in the placement transaction.
- Every read path goes through views() (customer list/get, staff list/get, service reads); dashboard embeds no orders. Seed writes Koramangala / 10 for all three orders.
- openapi: 8 Order examples carry both fields plus the schema (required, minimum 1). The "nine" is eight examples plus the schema; design.md's "eight" is right for examples. make gen postman leaves git clean.
- Rider: client decodes with plain json.Decoder (no DisallowUnknownFields); coretest does not model Order. No request to rider.
- Merge 22c3154 brought nothing conflicting.

Gates: gofmt clean; go vet ok; core go test -race -count=1 ./... all ok; make gen postman clean; openspec validate --all --strict 16/16; make test-rider ok; make test-web ok (exit 0).
