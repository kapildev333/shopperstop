# platform-P1-L3 - OpenSpec change platform-seed-specs: seed openspec/specs/platform and design-system
Status: started
## Doing
Change planned and validated (`openspec validate platform-seed-specs --strict` green); waiting for the worker on task 1 (sync + validate).
## Found
- OpenSpec 1.14.1 has no CLI sync; `/opsx:sync` is agent-driven. Chosen: worker syncs by writing the two spec files, which must equal the plan's Task 3 text byte for byte (checked with diff). Scratch dry run: change + synced specs give `--all --strict` 3 passed, 0 failed; a later `openspec archive` says "Specs already in sync; no files changed".
- `openspec/config.yaml` `rules.tasks` items contain an unquoted `: `, so YAML reads them as mappings: every CLI call warns and the tasks rules are ignored. Fix is quoting the two scalars; not in this change.
## Requests
- to platform area manager: decide who fixes the `openspec/config.yaml` quoting (one-line chore, platform scope).
## Blockers
