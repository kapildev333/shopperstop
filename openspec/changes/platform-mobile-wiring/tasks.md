The task runs in the worktree `.worktrees/platform-P4-L1` on branch `lane/platform-P4-L1-mobile-wiring`, with `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`. The worker keeps its log in `.claude/lanes/platform-P4-L1-T1.md` and never runs `make db`, `make dev`, `make seed`, `make e2e` or `make prod-local` without `-n`, nor any docker command.

The test is `check-mobile-wiring.sh` in this folder, committed with the change before the worker starts (design.md Decision 6): the red step is that script failing on the unchanged tree, recorded in the worker's log; the task's commit is `feat:` (text and Makefile values have no test framework, as in platform-rider-wiring).

## 1. Core origins and the mobile docs (worker)

Scope: `Makefile`, `README.md`, `CLAUDE.md`, `docs/figma.md`, this file's 1.x checkboxes, `.claude/lanes/platform-P4-L1-T1.md`.
Scenarios: "make dev runs the rider service and app" (Core accepts the mobile web export's dev origin, Rider dev defaults; the other three keep passing), "make e2e gives the rider an isolated environment" (e2e core accepts the e2e rider token, e2e services accept the mobile web export preview; Dev rider variables do not leak into e2e keeps passing), "Repository documentation matches the tree" (README says how to run the mobile app, CLAUDE.md names the mobile workspace, docs/figma.md links the mobile design canvas; the other seven keep passing).
Starts from: `sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh`, failing on the unchanged tree.
Commit: `feat: core and rider origins for the mobile web export and mobile docs`.

- [x] 1.1 Red: run `sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh` on the unchanged tree; paste the last line (`mobile wiring check: 24 failures`) and the first five FAIL lines into the log
- [x] 1.2 Make the edits in design.md "The edits", each old text replaced by its new text exactly (Makefile: four values on three lines; README: five places; CLAUDE.md: seven places; docs/figma.md: one line). `git diff -- Makefile` shows exactly three changed lines (the two `?=` defaults and the one `E2E_ENV` line)
- [x] 1.3 Green: `sh openspec/changes/platform-mobile-wiring/check-mobile-wiring.sh` prints `mobile wiring check: ok`; `sh openspec/changes/archive/2026-10-12-platform-readme-claude/check-docs.sh` prints `docs check: ok`; `sh openspec/changes/archive/2026-10-15-platform-rider-wiring/check-wiring.sh deploy ci docs` prints `wiring check: ok`; `openspec validate --all --strict` passes. Paste the four last lines
- [x] 1.4 `git status --short` before the commit shows only the four files, this file and the log

## 2. Acceptance (team lead, then manager)

- [x] 2.1 Team lead: `/opsx:verify` by hand: every scenario of the delta maps to a passing check line, task 1 ticked, `git diff --stat origin/main..HEAD` holds only the scope files, the change folder and lane logs
- [ ] 2.2 Manager: re-run the 1.3 commands and `make -n core`, `make -n e2e` in the worktree; record in the lane status cell
