# rider-P3-L3-T1 - workspace, shell, session and sign-in (worker)
Status: started
## Doing
Test commit done (red); next: session, api, format, router, routes and the shell (feat commit).
## Found
- Root `npm install` with the new workspace crashes npm 10.9.9 (`Cannot read properties of null (reading 'edgesOut')`): a fresh resolution of `vitest@5.0.4` in a new workspace hits its optional peer `@vitest/browser-playwright`. `npm install --legacy-peer-deps` rewrites ~1550 lines of other areas' entries; npm 11 rewrites admin's nested vite entries. Workaround used: the rider's lock entries were seeded from `apps/admin`'s identical nested tree (`apps/admin/node_modules/*` copied to `apps/rider/node_modules/*`, the `apps/admin` entry copied to `apps/rider`, the `@shopperstop/rider` link added), then npm 10 `install --package-lock-only` validated it. Result: 12 keys added, 0 changed, 0 removed, all under `apps/rider` or `node_modules/@shopperstop/rider`.
## Requests
## Blockers

## Red run (`npm run test --workspace apps/rider -- --run`, exit 1)
```
 FAIL  src/api.test.ts [ src/api.test.ts ]
 FAIL  src/format.test.ts [ src/format.test.ts ]
 FAIL  src/no-literal-colors.test.ts [ src/no-literal-colors.test.ts ]
 FAIL  src/session.test.ts [ src/session.test.ts ]
 FAIL  src/shell.test.tsx [ src/shell.test.tsx ]
 FAIL  src/sign-in.test.tsx [ src/sign-in.test.tsx ]
 Test Files  6 failed (6)
Error: Failed to resolve import "./api" from "src/api.test.ts". Does the file exist?
Error: Failed to resolve import "./format" from "src/format.test.ts". Does the file exist?
Error: Failed to resolve import "./session" from "src/session.test.ts". Does the file exist?
Error: Failed to resolve import "./session" from "src/shell.test.tsx". Does the file exist?
Error: Failed to resolve import "./session" from "src/sign-in.test.tsx". Does the file exist?
Error: Failed to resolve import "@shopperstop/ui/testing" from "src/no-literal-colors.test.ts". Does the file exist?
Error: rootRouteNode must not be undefined. Make sure you've added your root route into the route-tree.
```
