# ui-P3-L2-T1 - rider API types (task 1.1 and 1.2 of ui-rider-api-types)
Status: done (gates in report)
## Doing
Commits: 0a3a860 test (red), 9fd25fa feat (green: gen:api rider branch, ./api/rider export, rider.d.ts), then tasks 1.1 and 1.2 ticked.
## Found
- Red on commit 1: `npm run test --workspace packages/ui -- src/api`: "Test Files 1 failed (1) / Tests 2 failed | 3 passed (5)" (`generated rider types match the contract`: ENOENT rider.d.ts; `gen:api skips an absent rider contract`: no skip line in stdout).
- Red: `npm run typecheck --workspace packages/ui`: `src/api/api.test.ts(10,73): error TS2307: Cannot find module '@shopperstop/ui/api/rider'`.
- Green on feat commit: `src/api` vitest 5 passed; typecheck clean. core.d.ts unchanged by gen:api.
## Requests
## Blockers
