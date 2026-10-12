## 1. README.md (worker, lane platform-P1-L11, task 1)

Scope: `README.md` (new), this file's 1.x checkboxes, `.claude/lanes/platform-P1-L11-t1.md`. Scenarios: platform "README has the quick start", "README has the step-by-step fold and the screenshots table", "README lists the demo sign-ins", and the README half of "CLAUDE.md names every developer make target" and "Relative links resolve".
Test first: no `test:` commit. Why: prose has no unit test and no dependency may be added; the failing check already exists in this change, `sh openspec/changes/platform-readme-claude/check-docs.sh`, committed with the change. Red step: run it before writing and paste the README failure lines into `.claude/lanes/platform-P1-L11-t1.md`.
Commit: one commit, `docs: readme with quick start, demo sign-ins and commands`.

- [ ] 1.1 Red: run `check-docs.sh`, record the `README.md missing` and `README.md lacks` lines in `.claude/lanes/platform-P1-L11-t1.md`
- [ ] 1.2 `ls apps scripts docs/postman` and record what exists; write `README.md` to design.md "README.md outline", items 1 to 10, describing what exists truthfully
- [ ] 1.3 `check-docs.sh` prints no line starting `FAIL: README.md` and no `make -n` or `broken link` failure for a README target or link
- [ ] 1.4 `openspec validate --all --strict` passes; `git status --short` shows only `README.md`, this file and `.claude/lanes/platform-P1-L11-t1.md`

## 2. CLAUDE.md (worker, lane platform-P1-L11, task 2, after task 1 on the same branch)

Scope: `CLAUDE.md`, this file's 2.x checkboxes, `.claude/lanes/platform-P1-L11-t2.md`. Scenarios: platform "CLAUDE.md names every developer make target", "CLAUDE.md states the current CI, e2e and Figma rules", and the CLAUDE.md half of "Relative links resolve".
Test first: no `test:` commit, same reason as task 1. Red step: the `CLAUDE.md` failure lines of `check-docs.sh` before editing, pasted into `.claude/lanes/platform-P1-L11-t2.md`.
Commit: one commit, `docs: claude.md commands and rules match the makefile, ci and plan decisions`.

- [ ] 2.1 Red: run `check-docs.sh`, record the `CLAUDE.md` lines in `.claude/lanes/platform-P1-L11-t2.md`
- [ ] 2.2 Apply design.md "CLAUDE.md edits" 1 to 8 in place; `git diff -- CLAUDE.md` touches only those passages and the new `## Commands` section
- [ ] 2.3 `check-docs.sh` ends with `docs check: ok` and exits 0
- [ ] 2.4 `openspec validate --all --strict` passes; `git status --short` shows only `CLAUDE.md`, this file and `.claude/lanes/platform-P1-L11-t2.md`

## 3. Acceptance (team lead)

- [ ] 3.1 `/opsx:verify platform-readme-claude`: `check-docs.sh` ok, every scenario covered, both tasks ticked, nothing outside `README.md`, `CLAUDE.md` and this change landed
