# admin-P2-L1 task 1 - staff session and typed core client (OpenSpec change admin-auth-nav, tasks 1.1 to 1.3)
Status: done
## Doing
Task 1 landed on `lane/admin-P2-L1-admin-auth-nav`: `a2848a6` (chore: deps), `b87c35b` (test, red), then the feat commit `feat: staff session and typed core client` with the tick. Gates green. Awaiting reviewer. Tasks 2 to 4 not started.
## Found
- Pins as design.md: `openapi-fetch` 0.17.0 and `@tanstack/react-query` 5.104.2 in dependencies; `@testing-library/user-event` 14.6.7 in devDependencies (`npm install -E`). Only `apps/admin/package.json` and the root lockfile changed.
- `src/session.ts` exports `getToken`, `setToken`, `clearToken`; storage is read once at import and every access is guarded.
- `src/api.ts` exports `api` (openapi-fetch over `@shopperstop/ui/api` `paths`, base `${location.origin}/api/core/v1`), `onUnauthorized`, `meQuery`, and the types `Staff` and `ApiError`.
- `src/fake-core.ts` exports the fixtures `admin` and `storeStaff`, `json`, `apiError`, and `fakeCore(routes)` (stubs global `fetch`, returns the recorded requests).
- Red run (commit `b87c35b`, `npm run test --workspace apps/admin -- --run src/session.test.ts src/api.test.ts`): both files fail at collection, `Failed to resolve import "./session"` and `"./api"`; no tests ran.
- Green run after the feat commit: 2 files, 7 tests passed.
## Requests
- to admin-P2-L1 (team lead): none.
## Blockers
(none)
## Red output (commit 2)
```
 FAIL  src/api.test.ts [ src/api.test.ts ]
Error: Failed to resolve import "./api" from "src/api.test.ts". Does the file exist?
 FAIL  src/session.test.ts [ src/session.test.ts ]
Error: Failed to resolve import "./session" from "src/session.test.ts". Does the file exist?
 Test Files  2 failed (2)
      Tests  no tests
```
