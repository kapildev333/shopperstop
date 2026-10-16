# mobile-P4-L5a - mobile-release-config: EAS profiles, icon and splash from the tokens, device run notes (team lead)
Status: started
## Doing
Change proposed and valid (`openspec validate --all --strict` 20 passed); waiting for the manager to launch workers on tasks 1 and 2.
## Found
- Change `openspec/changes/mobile-release-config/`: proposal, `specs/mobile-app/spec.md` (4 ADDED requirements, 6 scenarios), design.md (6 decisions, scenario-to-test map), tasks.md (3 worker tasks + acceptance). No `docs/design/` file: design.md fixes every interface, the mark geometry and the JSON.
- Expo 58 has no top-level `splash` key; the native splash needs the `expo-splash-screen` config plugin and package (not installed, not in D37). Task 3 waits on that dependency; tasks 1 and 2 need nothing outside their scope.
- The `node --test` checks in `apps/mobile/scripts/` are outside Jest's `roots`, so `make test-web` does not run them until `package.json`'s `test` script does.
## Requests
- to mobile manager -> orchestrator: decide adding `expo-splash-screen` 58.0.10 (Expo SDK module) to D37's runtime list; if no, drop task 3 and the splash requirement.
- to mobile-P4-L2 (via manager): in `apps/mobile/package.json`, `"test": "sh -c 'jest --ci && node --test scripts/*.test.mjs' --"`; and, if the decision above is yes, `"expo-splash-screen": "58.0.10"` with the lockfile.
- to platform (via manager and orchestrator, optional): root README "Mobile app" still says `apps/mobile` is not on `main` (stale since #253); add a pointer to `apps/mobile/README.md` for preview builds and icons.
## Blockers
- Task 3 only: the `expo-splash-screen` dependency.
