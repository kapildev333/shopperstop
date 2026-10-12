# platform
Scope: root files, `deploy/`, `.github/`, `openspec/`, `docs/`, `Makefile`, `README.md`, `CLAUDE.md`
Depends on: none
Spec: Spec 1 §3, §5.1, §6, §7, §11, §12; plan tasks 1, 3, 4, 12, 13, 15 (tasks 1 and 2 done by the orchestrator)
## Doing
No platform lane running. Phase 1 platform tasks are all on main; the only open item is the first green CI run (account billing). No `make e2e` running.
## Lanes
| Lane | Task | Scope | Status |
|------|------|-------|--------|
| platform-P1-L3 | Task 3 OpenSpec seed (`platform`, `design-system` specs) | `openspec/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (diff gate, validate); PR #3 merged; archived in #5 |
| platform-P1-L4 | Task 4 deploy files and `make db` | `deploy/`, `Makefile` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (`make db` healthy, `select 1` as shopperstop_core on `_test`, role owns 3 databases); PR #4 merged; archived in #6 |
| platform-P1-L9 | Task 13 CI workflow and Makefile | `.github/workflows/`, `Makefile` | done 2026-10-12: reviewer approve, acceptance pass with task 3.1 (first green CI run) open because GitHub Actions is disabled by account billing; manager verified skip targets, dry runs, e2e isolation, YAML; PR #15 merged; change `platform-ci-makefile` stays open until a real CI run ticks 3.1, then archive |
| platform-P1-L8 | Task 12 Postman | `scripts/`, `docs/postman/` | done 2026-10-12: reviewer approve, acceptance pass, manager verified (10/10 tests, double `make postman` clean, HTTP replay of the collection against core :8080 both 200); PR #36 merged; archived #38; `make postman` runs the tests (#37) |
| platform-P1-L11 | Task 15 README, CLAUDE.md | `README.md`, `CLAUDE.md` | done 2026-10-12: reviewer changes-needed then fixed, acceptance pass, manager verified (`check-docs.sh` ok, validate, every make target dry-runs); PR #42 merged; archived #43 |
| orchestrator | Task 14 Figma | Figma file, `docs/figma.md` | done 2026-10-12 (D17): https://www.figma.com/design/pUvvBVQbwM8287Q3Fji8G1 |
## Requests

## Found
- 2026-10-12: chores landed: e2e guard on web or admin (#30), `make postman` runs the generator tests (#37), Node floor (#10), root build script (#13).
- Backlog from lanes: `make dev` could run `npm ci` when `node_modules` is absent (L11 request); pin sqlc when `sqlc.yaml` lands (L9); tighten the lane guard regex to word boundaries (reviewers hit `merge-base`).
- 2026-10-12: GitHub Actions blocked by account billing (PLAN.md Blockers); first `ci` run on PR #15 started no steps.
- 2026-10-12: `psql` is not installed on this host; ad-hoc database checks use a Go pgx client. Recorded for the README.
- 2026-10-12: the lane guard hook denies `git merge-base` and `git fetch` to reviewers (pattern matches `merge`); reviewers work around with `git rev-parse` and three-dot diffs. Harmless; tighten the regex to word boundaries if it bites again.
- The Phase 1 plan spells out only Tasks 1 to 4; Tasks 12, 13 and 15 are written as OpenSpec changes from Spec 1 §6, §7, §11, §12.
## Backlog
