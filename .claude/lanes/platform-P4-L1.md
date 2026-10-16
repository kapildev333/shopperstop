# platform-P4-L1 - mobile wiring: core origins, README, CLAUDE.md, figma.md (OpenSpec change platform-mobile-wiring)
Status: started (change proposed and committed; task 1 ready for a worker)
## Doing
Team lead: change ready; waiting for the manager to launch the task 1 worker, then acceptance (tasks 2.1).
## Found
- Change `openspec/changes/platform-mobile-wiring/`: proposal, `specs/platform/spec.md` (amended 2026-10-16 per the orchestrator: the rider service also accepts 5176 and 15176; 3 MODIFIED: "make dev runs the rider service and app", "make e2e gives the rider an isolated environment", "Repository documentation matches the tree"; 5 new scenarios), design (exact edits for Makefile, README, CLAUDE.md, docs/figma.md), tasks (1 worker task, 1 acceptance task), `check-mobile-wiring.sh` (sections make, docs). `openspec validate platform-mobile-wiring --strict` valid; `--all --strict` 15 passed. No `docs/design/platform-P4-L1.md`: design.md is enough.
- Red on 8dc76d1: `check-mobile-wiring.sh` 24 failures (after the rider amendment). Prototyped the design's edits on a scratch copy (git archive HEAD): `mobile wiring check: ok`, `check-docs.sh` ok, archived `check-wiring.sh deploy ci docs` ok.
- `.claude/commands/orchestrate.md` and `manage.md` already name the `mobile` area and scope; CLAUDE.md already lists the area. Not touched; the check confirms them.
- Archived `check-wiring.sh make` asserts core's old three-origin lists and fails on exactly four lines after this change (core and rider, dev and e2e); the new check filters those four and fails on any other.
- Mobile workspace constraints for riding on `make test-web` / `make e2e` (design Decision 2): jest rejects the root `-- --run` (verified: `npx jest@29 --run` exits 1, `sh -c 'jest --ci' -- --run` exits 0); `make e2e` builds without E2E_ENV so the web export must be re-exported with `EXPO_PUBLIC_CORE_URL=http://localhost:18080` in the `e2e` script; same `@playwright/test` version as apps/web; Expo's default port 8081 clashes with the rider service, so `--port 5176`.
- Figma has no `Mobile` page (three pages, D17); docs say so instead of "stays empty".
## Requests
- to orchestrator: answered (yes, rider origins too; change amended). Note: the e2e values share one `E2E_ENV` line, so `git diff -- Makefile` shows three changed lines, not four.
- to mobile (via area plan): the four constraints above.
## Blockers
