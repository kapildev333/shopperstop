Runs in the worktree `.worktrees/platform-P5-L2` on branch `lane/platform-P5-L2-postman-offer-id`. Run `npm ci` once if `node_modules` is absent. Never run `make db`, `make dev`, `make prod-local`, `make core`, `make rider`, `make payment` or `make e2e`, the archived `check-wiring.sh` or `check-mobile-wiring.sh`, and never touch containers.

## 1. offerId in the Postman generator and environment (worker)

Scope: `scripts/postman.mjs`, `scripts/postman.test.mjs`, `docs/postman/local.postman_environment.json`, this file's 1.x checkboxes, `.claude/lanes/platform-P5-L2-T1.md`.
Scenarios: "Path ids read environment variables" (Offer id), "Local Postman environment" (Environment variables), "Postman environment carries the rider variables" (Rider ids are fixed).
Starts from: `scripts/postman.test.mjs` tests `environment holds the fifteen variables` (renamed from `... fourteen ...`) and `offer ids read environment variables`, both failing.
Commits: `test: offerId postman variable`, then `feat: offerId postman variable`.

- [ ] 1.1 Red: rename the environment test to `environment holds the fifteen variables`, insert `'offerId'` after `'deliveryId'` in its key list and assert `byKey.offerId` is `00000000-0000-4000-8000-000000000902`; add test `offer ids read environment variables` generating a rider fixture with `POST /me/offers/{id}/accept` and asserting its path variables are `[['id', '{{offerId}}']]`. `node --test scripts/postman.test.mjs`: exactly these two fail. Paste `# pass` / `# fail` and the failing names into the log; commit `test: offerId postman variable`
- [ ] 1.2 Add `offers: 'offerId',` to `ID_VARS` after `deliveries` in `scripts/postman.mjs`; add `{"key": "offerId", "value": "00000000-0000-4000-8000-000000000902", "type": "default", "enabled": true}` after `deliveryId` in the environment file (two-space JSON, same shape as its neighbours)
- [ ] 1.3 Green: `node --test scripts/postman.test.mjs` all pass, 0 fail; `make postman` twice leaves `git status --porcelain -- docs/postman` showing only the environment file and the core, rider and payment collections byte-identical to `origin/main`; `make test-core` and `make test-rider` pass; `openspec validate --all --strict` passes. Paste the outputs; commit `feat: offerId postman variable`
