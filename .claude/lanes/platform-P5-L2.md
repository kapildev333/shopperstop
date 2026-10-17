# platform-P5-L2 - platform-postman-offer-id (team lead)
Status: done (acceptance pass, 2026-10-16)
## Doing
Acceptance passed; archive (task 2.2) left to the area manager after merge.
## Found
- Change: `openspec/changes/platform-postman-offer-id/` (MODIFIED platform: "Path ids read environment variables", "Local Postman environment", "Postman environment carries the rider variables"). Bodies 485, 482, ~480 chars.
- Core and rider seed tests read the env file by key, so a fifteenth key does not break them.
- Offer route in the scenario is `POST /me/offers/{id}/accept`, from `.claude/areas/rider.md` rider-P5-L2.
- offerId value `...0902` is rider's; this lane cannot check it against a seed that is not on main. Rider's seed summary test ties it.
- Acceptance (/opsx:verify platform-postman-offer-id): PASS. T1 landed 023a835 (test) then 3e66814 (feat), review 6316d28. Re-ran: `node --test scripts/postman.test.mjs` 28 pass 0 fail; `make postman` twice, `git status --porcelain` empty; `openspec validate --all --strict` 20 passed; `make test-core` and `make test-rider` 0 FAIL (seed packages ok).
- Scenario to test: Offer id -> `offer ids read environment variables`; Environment variables and Rider ids are fixed -> `environment holds the fifteen variables`; Order id -> `path ids read environment variables`; Rider and delivery ids -> `rider and delivery ids read environment variables`; Payment ids -> `payment ids read environment variables`; Slug keeps its example -> `slug path variables keep their example value`; Saved responses read the same ids -> `saved responses read environment ids`; Ids are the seeded rows -> core `TestSummaryMatchesSeed`.
- Diff vs origin/main: only `scripts/postman.mjs` (+1), `scripts/postman.test.mjs`, the environment file (+1 entry), the change folder and the two lane files. No collection changed.
## Requests
- to rider-P5-L2: run `make postman` in your PR once your openapi.json has the offer routes; your seed summary test should mark `offerId` like `riderId`/`deliveryId`.
## Blockers

## T1 review
Verdict: approve. No findings.
- Script diff of the three MODIFIED requirements against `openspec/specs/platform/spec.md`: only the intended edits (`offers`/`{{offerId}}`, "four" to "five rider variables", `offerId` in the key list, the offerId value in the rider-ids requirement and scenario, the new "Offer id" scenario). Nothing dropped; no scenario removed. Bodies 485, 482, 485 characters.
- feat 3e66814: one `ID_VARS` line, one environment entry after `deliveryId` (`serviceToken` still last), tasks ticked, brief log. Test commit 023a835 touches only `scripts/postman.test.mjs`; both tests cover the scenarios (Offer id, Environment variables, Rider ids are fixed) and fail without the feat (fifteen keys, `f1` stays). Order proposal, test, feat. Scope clean; no collection changed.
- Gates: `node --test scripts/postman.test.mjs` pass 28, fail 0; `make postman` twice, exit 0 both, `git status --porcelain` empty; `openspec validate --all --strict` 20 passed, 0 failed.
- Minor note: the `Local Postman environment` scenario says "all four token variables have type secret" while only three tokens are named; pre-existing wording, left alone.
