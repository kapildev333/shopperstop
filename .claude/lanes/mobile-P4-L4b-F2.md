# mobile-P4-L4b-F2 - account profile test flake (`src/account.test.tsx`)
Status: done
## Doing
Done: fix committed (e886eee); six full-suite runs green.
## Found
- Cause: test-side race. The `Account` screen renders the "My account" heading before `GET /me` answers; the profile card shows a skeleton until then. `Profile shown` waited for the heading, then read `Asha Rao` synchronously with `getByText`. Whether `/me` had landed by that point depended on react-query's macrotask scheduling, so it passed alone and failed under load.
- Reproduced deterministically by delaying the `/me` fake by 50 ms: `Unable to find an element with text: Asha Rao`. CPU saturation alone (10 busy loops) did not reproduce it in four runs.
- Fix: `findByText('Asha Rao')` instead of `getByText`. The email and phone render in the same card, so the name is enough. Verified green with the 50 ms delay still in place, then the delay was removed.
- `RNTL asyncUtilTimeout` and `jest.setup.ts` were not the cause; no app code involved.
## Requests
## Blockers
