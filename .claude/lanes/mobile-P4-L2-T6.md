# mobile-P4-L2-T6 - pincode store (mobile-serviceability-catalog task 6)
Status: done
## Doing
6.5 gates green. Task 6 done; ticked 6.1 to 6.5 in the feat commit.
## Found
- Commits: `952efc6` chore (package.json + lock: async-storage 2.2.0, e2e `EXPO_PUBLIC_RIDER_URL`); `5c25430` test (red: `src/pincode.test.ts` plus the jest.setup storage mock line); `c694a05` feat (`src/pincode.ts`, jest.setup resets, green test, ticks).
- Red run `cd apps/mobile && npx jest --ci src/pincode.test.ts` -> `Cannot find module './pincode' from 'src/pincode.test.ts'`, 0 tests run (the storage mock line was added first so the failure is the missing module).
- Lock diff: 34 added lines, 0 removed. Root workspace entry gains `@react-native-async-storage/async-storage`; new packages `node_modules/@react-native-async-storage/async-storage` 2.2.0, `merge-options` 3.0.4, `is-plain-obj` 2.1.0. No other version changed.
- npm reordered `@expo/metro-runtime` in `apps/mobile/package.json`; restored by hand. Final package.json diff: the e2e script line and one added dependency line.
- Test loader: the late-read and restore scenarios load the store, the storage mock and the RNTL `pure` renderer in one `jest.isolateModules` graph via `jest.requireActual` / `jest.requireMock`. The storage mock is per registry, so the test reads the storage from that graph. The default RNTL entry registers an afterEach, which Jest refuses inside a test, hence `pure`.
- Deviation from the brief's literal text, for lint: `jest.setup.ts` factory uses `jest.requireActual(...async-storage-mock)` instead of `require(...)` (`@typescript-eslint/no-require-imports`). The test file uses `jest.requireActual`/`requireMock` for the same reason. Same module, same behaviour.
- Store shape: `usePincode()` returns the state object `{ pincode?, loaded }` (replaced on each change, so useSyncExternalStore is stable); the one read starts in a `useEffect`, not in render, so the static Node render never reads storage. A `setPincode` before the read settles sets `loaded` and the read result is dropped.
- Gates (final, after the lint fix): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile -- --run` exit 0: jest `Test Suites: 31 passed, 31 total`, `Tests: 121 passed, 121 total`, node:test `# pass 7 # fail 0`; `npm run build --workspace apps/mobile` exit 0 (`Exported: dist`); `openspec validate mobile-serviceability-catalog --strict` exit 0 (`is valid`).
- Not in scope, left alone: the `test` script and `expo-splash-screen` (L5a's, Decision 12).
## Requests
- to mobile-P4-L5a (via mobile manager): `.claude/lanes/mobile-P4-L5a.md` asks L2 to change `"test"` to `jest --ci && node --test scripts/*.test.mjs`. The brief for task 6 says keep `test` as it is on the branch, and design.md Decision 12 says the `test` script is L5a's. Not changed here; the manager decides whether L5a's edit reaches this branch by rebase or L2 changes it in a later task.
## Blockers
None.
