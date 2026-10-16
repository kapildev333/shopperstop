# mobile-P4-L1-T2 - session and core client (mobile-foundation-accounts, task 2)
Status: done
## Doing
Task 2 done on `lane/mobile-P4-L1-foundation-accounts`: red commit `test:` (14 tests in `session.test.ts` and `api.test.ts`), then the `feat:` commit with `session.ts`, `api.ts`, `fake-core.ts`, the `jest.setup.ts` resets and boxes 2.1 to 2.3 ticked. Nothing pushed.
## Found
- Red (2.1), `npm run test --workspace apps/mobile -- --run` before the modules existed:
  ```
  FAIL src/api.test.ts
    Test suite failed to run
    Cannot find module './api' from 'src/api.test.ts'
  FAIL src/session.test.ts
    Test suite failed to run
    Cannot find module './session' from 'src/session.test.ts'
  Test Suites: 2 failed, 2 total
  Tests:       0 total
  ```
- Green (2.2 and 2.3):
  - `npx jest --ci src/api.test.ts src/session.test.ts`: `Tests: 14 passed, 14 total`.
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 0.
  - `npm run typecheck --workspace apps/mobile` exit 0.
  - `npm run test --workspace apps/mobile -- --run`: `Test Suites: 4 passed, 4 total`, `Tests: 21 passed, 21 total` (includes T4's `text.test.tsx`, which passed at the time of the run).
  - `npm run build --workspace apps/mobile` exit 0; `Exported: dist`.
  - `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`.
- Scope: `session.ts` (Decision 5: `Platform.OS === 'web'` uses `localStorage`, else `SecureStore`; `deleteItemAsync(...).catch` for the clear; storage in `try`/`catch`; `useToken` with a server snapshot of `undefined`), `api.ts` (`coreUrl` from `EXPO_PUBLIC_CORE_URL`, `authMiddleware` with admin's 401 rule and web's non-envelope rewrite, `api`, `queryClient`, `call`, `unreachable`), `fake-core.ts` (`fakeCore` and `json`/`apiError` helpers, admin's shape without `vi`), `jest.setup.ts` (after-each `setToken(undefined)` and `queryClient.clear()`).
- Not added (later tasks name them): `splitError`, `useMe`, `safeReturnTo`, `signIn`, `register`, `signOut`, `auth.ts`, address functions, `errorKind`. The brief scope is task 2 only.
## Deviations and choices (for the team lead)
- The brief and tasks.md say the session test loads `session.ts` with `jest.isolateModules`. The lint rule `@typescript-eslint/no-require-imports` forbids the `require()` that form needs, and a dynamic `import()` is not transformed in this jest setup (`A dynamic import callback was invoked without --experimental-vm-modules`). The two tests use `jest.resetModules()` then `jest.requireActual<typeof import('./session')>('./session')` (and `./api` for the default-URL test). Same fresh module instance, no lint exemption. Each reset is the last test that needs a fresh module in its file.
- The `feat:` commit also carries the `require` to `requireActual` edit to the two test files, because the red commit's `require` failed lint. The assertions are unchanged.
- `session.ts` writes `SecureStore.deleteItemAsync(key).catch(() => undefined)`: its promise can reject, which the surrounding `try` does not catch. Design Decision 5 asks for every storage call in `try`/`catch`; this is the one place the promise needs its own handler.
- `fake-core.ts` takes `(request: Request)` as admin's does, so the `fetch` replacement is `as typeof fetch`.
## Requests
- none
## Blockers
None.
