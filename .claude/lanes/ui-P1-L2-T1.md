# ui-P1-L2 task 1 - generated API types (ui-api-types 1.1 to 1.3)
Status: done
## Doing
Done: commits `chore` pin, `test` red, `feat` generated types; tasks 1.1 to 1.3 ticked. Gates green. Awaiting reviewer.
## Found
- Installed exact: `typescript` 5.9.3 (was 6.0.3), `openapi-typescript` 7.13.0 (devDependencies of `packages/ui`). Single `typescript` in the tree.
- `gen:api` script and `./api` types export (`./src/api/core.d.ts`) added; generated file is 139 lines, deterministic, no timestamp.
- Test `src/api/core.test.ts` adds `import { expect, ... } from 'vitest'` (design sketch omitted it; globals are off).
- Contract and committed file are resolved from the test file via `import.meta.url`, not from the cwd.
## Requests
(none)
## Blockers
(none)
