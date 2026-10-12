# Design

## Context
`services/core/openapi.json` (OpenAPI 3.1, core-P1-L1) serves `/healthz` and `/readyz` with schemas `Status` and `Error`. `packages/ui` builds with `tsc` into `dist/` and exports `.`, `./testing` and `./tokens.css` (archived change `2026-10-12-ui-packages-ui`, "Packaging"). `make gen` already runs `npm run gen:api --workspace packages/ui --if-present`. Spike run on a scratch copy of origin/main 6ae9c6b, Node 22.23.3, npm 10.9.9: everything below was installed, generated and gated there.

## Goals / Non-Goals
Goals: one committed type file both apps import; a gate that fails when it drifts from the contract. Non-goals: a runtime client, request helpers, runtime validation, generating other services' types.

## Decisions

### TypeScript 5.9.3 in `packages/ui` (PLAN.md D18)
`openapi-typescript` 7.13.0 (latest) declares the peer `typescript ^5.x`. With TypeScript 6.0.3 installed, `npm install -D openapi-typescript@7.13.0 --workspace packages/ui` fails with `ERESOLVE ... peer typescript@"^5.x"` (measured). Options: `--legacy-peer-deps` (repo-wide, hides real conflicts: rejected); a root `overrides` entry (platform scope, and it silences the peer rather than satisfying it: rejected); wait for a TS 6 release of `openapi-typescript` (blocks the apps: rejected); pin TypeScript 5.9.3 in `packages/ui` (chosen, approved as D18). Nothing in the package uses a TypeScript 6 feature; `typescript-eslint` 8.71.2 accepts `>=4.8.4 <6.1.0`. Measured on 5.9.3: `npm install` resolves cleanly with one `typescript` in the tree, and lint, typecheck, test (all existing tests plus the new ones) and build are green.

Exact pins after this change: `typescript` 5.9.3, `openapi-typescript` 7.13.0 (both `devDependencies`, exact). Ceiling: the package stays on TypeScript 5.9 until `openapi-typescript` declares TypeScript 6; then raise both together. Apps that pin TypeScript 6 get their own nested copy; npm resolves that without conflict as long as apps do not depend on `openapi-typescript` themselves.

### Types only, no client
The `./api` export carries only types. `openapi-fetch` stays an app dependency: each app writes `createClient<paths>({ baseUrl: '/api/core/v1' })`. Simplification: no shared client factory. Ceiling: base URL and auth middleware are written once per app (two apps); move a factory here when a third consumer appears or the middleware grows past a few lines.

Paths in the generated file are relative to the server URL (`/healthz`, not `/api/core/v1/healthz`) because `openapi.json` declares `servers: [{ url: "/api/core/v1" }]`; the client's `baseUrl` supplies the prefix.

### Export straight from `src`
`tsc` does not emit or copy a `.d.ts` that sits under `src`, so `dist/` has no `api/`. The export points at the source file: `"./api": { "types": "./src/api/core.d.ts" }` (same pattern as `./tokens.css`). No `default` condition: importing it at runtime is an error by design; consumers use `import type`. No change to `tsconfig.build.json`.

### Generation
Script `"gen:api": "openapi-typescript ../../services/core/openapi.json -o src/api/core.d.ts"` (npm runs workspace scripts from `packages/ui`, so the path is two levels up). Default options: no flags. Output is deterministic (measured: two runs byte-identical; header comment, no timestamp). The generated file passes the existing ESLint config and the literal-colour scan unchanged, so neither is touched.

### Tests: `src/api/core.test.ts`
First line `// @vitest-environment node`; `expect`, `expectTypeOf` and `it` are imported explicitly from `vitest`. Paths are resolved from `import.meta.url`: `contract` = `fileURLToPath(new URL('../../../../services/core/openapi.json', import.meta.url))`, `committed` = `fileURLToPath(new URL('./core.d.ts', import.meta.url))`. The CLI is `join(dirname(createRequire(import.meta.url).resolve('openapi-typescript/package.json')), 'bin', 'cli.js')` (resolving `openapi-typescript/bin/cli.js` directly hits the package's `./*.js` export mapping to `.mjs` and fails). Two tests:
- `generated types match the contract`: `spawnSync(process.execPath, [cli, contract], { encoding: 'utf8' })`, expects status 0 and `stdout` to equal the committed file. Without `-o` the CLI writes the identical text to stdout (measured), so no temp file.
- `response types are usable by name`: `import type { components, paths } from '@shopperstop/ui/api'` (the package's own export, so a missing or wrong export fails typecheck with TS2307, measured), then `expectTypeOf<...>().toEqualTypeOf<...>()` for the `/readyz` 200 body `{ status: 'ok' }` and the nine-code union. Vitest does not check types at runtime; `npm run typecheck` (which includes `src`) is the gate for this test (measured: removing one code from the expected union fails typecheck with TS2344).

## Files
All in area ui: `packages/ui/package.json` (pins, script, export), `packages/ui/src/api/core.d.ts` (generated), `packages/ui/src/api/core.test.ts`, and `openspec/changes/ui-api-types/**`. Root `package-lock.json` changes mechanically.

## Risks / Trade-offs
- [Every `openapi.json` change fails this package's test until `make gen` runs] → intended. PLAN.md D19: a core lane that changes `openapi.json` regenerates `packages/ui/src/api/core.d.ts` in the same PR with `make gen` (or `npm run gen:api --workspace packages/ui`), as a mechanical change; the file is never hand-edited.
- [The type test pins the error code enum] → a new code in core is a deliberate contract change; updating the expected union is one line.
- [TypeScript 5.9 vs 6 across the workspace] → PLAN.md D18 (see Decisions); revisit when `openapi-typescript` supports 6.
