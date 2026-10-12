# Tasks

No automated test: this change adds specification text only, no code. Its gate is `openspec validate --all --strict` plus a `diff` against the plan's text, so there is no `test:` commit; the commit sequence is one `docs:` commit.

## 1. Seed the living specs

- [x] 1.1 Run `/opsx:sync platform-seed-specs`: write `openspec/specs/platform/spec.md` and `openspec/specs/design-system/spec.md` as `# <capability>`, `## Purpose` with the plan's paragraph, `## Requirements`, then the delta's requirements unchanged. Verify: for each capability, `diff` of the file against the plan's fenced text (Task 3 step 2 and step 3 in `docs/plans/2026-10-12-foundation-and-design-system.md`) prints nothing.
- [x] 1.2 Run `openspec validate --all --strict`. Verify: `spec/platform`, `spec/design-system` and `change/platform-seed-specs` pass, 0 failed.

## Workflow follow-up
- After the PR merges and `/opsx:verify` passed, the area manager archives with `openspec archive platform-seed-specs` by PR; it reports the specs already in sync.
