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
