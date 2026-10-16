# platform-P4-L1-T1 - core and rider origins for the mobile web export, mobile docs (OpenSpec change platform-mobile-wiring, task 1)
Status: done
## Doing
Task 1 done on `lane/platform-P4-L1-mobile-wiring`: 1.1 red recorded, 1.2 edits applied, 1.3 gates green, 1.4 tree holds the four files, tasks.md and this log. Committed as `feat: core and rider origins for the mobile web export and mobile docs`. Task 2 (acceptance) is the team lead's and the manager's.
## Found
- Red (1.1), `sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh` on the unchanged tree (157cfa5):
  ```
  mobile wiring check: 24 failures
  FAIL: make -n core lacks: SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'
  FAIL: make -n rider lacks: SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176'
  FAIL: make -n e2e npm run e2e lacks: SHOPPERSTOP_CORE_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'
  FAIL: make -n e2e npm run e2e lacks: SHOPPERSTOP_RIDER_WEB_ORIGINS='http://localhost:15173,http://localhost:15174,http://localhost:15175,http://localhost:15176'
  FAIL: Makefile: want localhost:5176 exactly twice
  ```
- Edits (1.2): applied with the Edit tool from design.md "The edits". One slip while applying: the E2E_ENV line lost the space before `SHOPPERSTOP_CORE_SERVICE_TOKENS` and `SHOPPERSTOP_RIDER_CORE_URL` (the new text dropped the old text's trailing space). Caught by reading the diff, fixed; the E2E_ENV line now equals the HEAD line with only the two origin lists changed (`cmp` against the expected text). The check script does not test that space, so it was not the catch. Worth a line in the reviewer's checklist.
- `git diff -- Makefile`: 3 changed lines (`CORE_WEB_ORIGINS ?=`, `RIDER_WEB_ORIGINS ?=`, `E2E_ENV =`).
- Green (1.3):
  - `sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh`: `mobile wiring check: ok`
  - `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh`: `docs check: ok`
  - `sh openspec/changes/archive/2026-10-15-platform-rider-wiring/check-wiring.sh deploy ci docs`: `wiring check: ok`
  - `openspec validate --all --strict`: `Totals: 15 passed, 0 failed (15 items)`, exit 0
  - `make -n core` and `make -n e2e` (dry run only) print the new origin lists.
- Nothing run with a real start: no `make db`, `make dev`, `make seed`, `make e2e` or `make prod-local`; no docker commands.
## Requests
## Blockers
