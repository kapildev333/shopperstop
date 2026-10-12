# platform-P1-L3 - OpenSpec change platform-seed-specs: seed openspec/specs platform and design-system
Status: done
## Doing
Task 1 (1.1 sync, 1.2 validate) landed in one docs commit on lane/platform-P1-L3-openspec-seed; both gates green; awaiting reviewer and area manager PR.
## Found
- OpenSpec 1.14.1 has no CLI sync; `/opsx:sync` is agent-driven. Done by hand: each main spec is the plan's fenced block verbatim (header, Purpose, Requirements, delta requirements), checked with diff and by comparing the requirement sections against the delta files.
- `openspec validate --all --strict`: 3 passed, 0 failed.
- `openspec/config.yaml` `rules.tasks` items contain an unquoted `: `, so YAML reads them as mappings: every CLI call warns and the tasks rules are ignored. Fix is quoting the two scalars; not in this change.
## Requests
- to platform area manager: decide who fixes the `openspec/config.yaml` quoting (one-line chore, platform scope).
## Blockers
