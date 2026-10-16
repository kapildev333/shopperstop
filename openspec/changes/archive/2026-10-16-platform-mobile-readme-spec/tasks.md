No worker task: `README.md` and `CLAUDE.md` on `main` already meet the refreshed scenarios (design.md Decision 1), so the change is spec-only. The test is `check-readme-mobile.sh` in this folder, run from the repository root.

## 1. Spec delta and check (team lead)

- [x] 1.1 Red: the check fails on the pre-#259 `README.md` and `CLAUDE.md` (6 failures, scratch copy)
- [x] 1.2 Delta: MODIFIED "Repository documentation matches the tree" and "CLAUDE.md and docs/figma.md describe the tree", scenarios only
- [x] 1.3 Green: `sh openspec/changes/platform-mobile-readme-spec/check-readme-mobile.sh` prints `readme mobile check: ok`; `openspec validate platform-mobile-readme-spec --strict` and `openspec validate --all --strict` pass

## 2. Acceptance

- [x] 2.1 Team lead: `/opsx:verify`: each refreshed scenario maps to a passing check line, `git diff --stat origin/main...HEAD` holds only this folder and the lane log
- [x] 2.2 Manager: re-run the 1.3 commands in the worktree; record in the lane status cell
- [x] 2.3 Manager: archive after merge
