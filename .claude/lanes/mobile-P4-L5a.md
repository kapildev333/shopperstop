# mobile-P4-L5a - mobile-release-config: EAS profiles, icon and splash from the tokens, device run notes (team lead)
Status: done (4.1 accepted)
## Doing
R1 fix pass done (fixes 1-4 plus coordinator's RIDER_URL README item). Gates green; manager verifies and opens the PR.
## Found
- Change `openspec/changes/mobile-release-config/`: proposal, `specs/mobile-app/spec.md` (4 ADDED requirements, 6 scenarios), design.md (6 decisions, scenario-to-test map), tasks.md (3 worker tasks + acceptance).
- 4.1 verify (2026-10-16, head 21b00f7 + this commit):
  - Gates, Node 22.23.3: `node --test scripts/*.test.mjs` 6 of 6 pass (~3 s); ui build, mobile lint exit 0; mobile Jest 25 suites, 94 tests pass; mobile build exit 0 (the `expo-splash-screen` plugin resolves); `openspec validate --all --strict` 20 passed.
  - Scenario map: all 6 scenarios map to a passing test of the same name (release-config.test.mjs 3, icons.test.mjs 3).
  - Test first: e024a22 before f80a645 (task 1), 00fe5f0 before a638dd4 (task 2), 232e665 and 001a929 before bebf1fe (task 3).
  - Scope against origin/main: only design.md "Files", the lane logs, and the D43 pin (`apps/mobile/package.json` one line, `package-lock.json` +15, commit 22122c3), now recorded in design.md Risks and Files and in the proposal's Impact. `app.json` diff is the icon, adaptiveIcon and splash plugin keys only. No src/, jest or playwright file touched.
  - Accepted.
## Requests
- to mobile-P4-L2 (via manager), still open: in `apps/mobile/package.json`, `"test": "sh -c 'jest --ci && node --test scripts/*.test.mjs' --"`. Until it lands, `make test-web` and CI do not run the six release checks (design.md Decision 6 ceiling); the manager runs them by hand.
- to mobile manager: archive by PR after merge.
## Blockers
- R1 fix pass (2026-10-16): a79a96a test script runs node --test (root `-- --run` still ignored; 6 of 6); 8639ad1 README preview steps: core and rider URLs set before the build, EAS CLI named, and the device run line sets EXPO_PUBLIC_RIDER_URL; d8b00ec/b0e3c7e brandColors throws on non-#RRGGBB (test first); 2ee4f8c splash centre test passed immediately (already on-brand, opaque).
- Gates (Node 22.23.3, apps/mobile): lint 0, typecheck 0, npm test 0 (jest 25 suites / 94 tests; node --test 7 of 7), build 0; openspec validate --all --strict 20 passed.
