# platform-P4-L2 - refresh the platform README/CLAUDE.md mobile scenarios (OpenSpec change platform-mobile-readme-spec)
Status: done (team-lead acceptance passed, 2.1 ticked; 2.2 is the manager's)
## Doing
Done: change proposed, validated, committed. Waiting for manager 2.2, reviewer, PR, archive.
## Found
- Change `openspec/changes/platform-mobile-readme-spec/`: proposal, `specs/platform/spec.md` (2 MODIFIED requirements, bodies unchanged; 3 scenarios edited: "README has the quick start", "README says how to run the mobile app", "CLAUDE.md names the mobile workspace"), design, tasks, `check-readme-mobile.sh`. No `docs/design/platform-P4-L2.md`.
- Spec-only: README.md and CLAUDE.md on main (d4c87f1) already meet the refreshed scenarios. No worker.
- Nothing in `make test`, CI (`.github/workflows/ci.yml`) or `scripts/` greps these README/CLAUDE.md strings; only archived `check-*.sh` scripts did, and nothing runs them.
- Check: `readme mobile check: ok` on this branch; 6 failures on the pre-#259 README.md/CLAUDE.md in a scratch copy (red).
- `openspec validate platform-mobile-readme-spec --strict`: valid. `openspec validate --all --strict`: Totals: 20 passed, 0 failed (20 items).
- Stale on main, no scenario covers it: CLAUDE.md intro "Phases 1 and 2 are on `main` (`v0.1.0`, `v0.2.0`); Phase 3 adds ..." misses `v0.3.0`. For the platform backlog.
## Requests
## Blockers

## Review (reviewer, Sonnet 5.5)
Verdict: approve.
- Requirement bodies and every unedited scenario in both MODIFIED requirements are byte-identical to `openspec/specs/platform/spec.md` (diffed by script); only the 3 intended scenario lines differ. Nothing dropped.
- Refreshed scenarios are true of README.md and CLAUDE.md on this branch (Status names v0.3.0 and Phase 4 in progress on `main`; Mobile app section and link; no "not on `main` yet"; no "once `apps/mobile` lands"; CLAUDE.md layout line, Phase 4, 15176, 5176, npx expo start all present).
- No sibling scenario still describes a tree without `apps/mobile` (grep of the living spec: the only hits are the 3 refreshed lines). Other mobile scenarios (5176 origin, 15176 e2e) already match.
- No scope creep; no needless complexity. The check script is greps only.
- Gates: `openspec validate --all --strict` 20 passed, 0 failed; `bash .../check-readme-mobile.sh` prints `readme mobile check: ok`.
- Nit 1: no 500-character rule exists in `openspec/config.yaml`; if the manager means one, `proposal.md` line 3 (Why) is 542 characters, spec.md lines are all under 500 (longest ~398 plus prefix). The OpenSpec validator accepts it.
- Nit 2: the check script has a `#!/bin/sh` header but mode 644, and `ok` uses `eval`; fine for a change-folder script run with `sh`/`bash`.
- Nit 3 (spec-wide, not this change): CLAUDE.md intro still says "Phases 1 and 2 are on `main`", already logged for the backlog.
