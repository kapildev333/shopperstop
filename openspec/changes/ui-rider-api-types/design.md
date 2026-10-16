# Design

## Context
`ui-api-types` (archived 2026-10-12) added `gen:api`, the committed `src/api/core.d.ts`, the types-only `./api` export and `src/api/core.test.ts` (stale check plus type pins). `services/rider/openapi.json` landed with rider-P3-L1 (#207): OpenAPI 3.1, `servers: [{url: "/api/rider/v1"}]`, schemas `Status`, `Error` (seven codes, no `out_of_stock` or `not_serviceable`), `Rider`, `RiderSession`, `SignInRequest`, `RiderCreate`, `RiderPatch`, `RiderList`. `make gen` runs `npm run gen:api --workspace packages/ui --if-present` (platform-P3-L1). Spike on 90a6a96, Node 22.23.3, `openapi-typescript` 7.13.0: everything below was run in a scratch tree.

## Goals / Non-Goals
Goals: a committed `rider.d.ts` and its export for `apps/rider`; one stale gate for both files; `gen:api` that works with and without the rider contract. Non-goals: a client, a generic per-service loop, payment or receipt types (each later service adds one line the same way).

## Decisions

### `gen:api` stays one npm script line
```
openapi-typescript ../../services/core/openapi.json -o src/api/core.d.ts && if test -f ../../services/rider/openapi.json; then openapi-typescript ../../services/rider/openapi.json -o src/api/rider.d.ts; else echo "gen:api: services/rider/openapi.json absent, skipping"; fi
```
`if/else`, not `test -f && gen || echo`: the latter would print the skip line and exit 0 when generation of a present contract fails. A failing core generation still stops the script (`&&`). Measured: absent rider → core written, the skip line, exit 0; present → both written, the file byte-identical to the CLI's stdout. Core stays unconditional: `packages/ui` without `services/core` is not a tree that exists. Simplification: a POSIX `sh` one-liner (npm runs scripts with `sh` on macOS and Linux, the only platforms used; the Makefile already relies on `sh`). Ceiling: when a third contract arrives (payment, Phase 4 or later), move the script to `packages/ui/scripts/gen-api.mjs` with a list of services.

### Export
`"./api/rider": { "types": "./src/api/rider.d.ts" }`, inserted directly after `"./api"`, the same shape (no `default`, `tsc` does not copy `.d.ts` under `src`). Only that entry is added so a parallel ui lane editing `exports` (ui-P4-L1) rebases with a trivial merge. `moduleResolution: bundler` resolves the two keys independently.

### Tests: `src/api/core.test.ts` renamed to `src/api/api.test.ts`
The file now covers both contracts, so the name follows (one `git mv`, in the `test:` commit). Header and helpers as before (`// @vitest-environment node`, CLI path via `createRequire(...).resolve('openapi-typescript/package.json')` then `bin/cli.js`).
- `generated %s types match the contract`: `it.each(['core', 'rider'])`; contract `../../../../services/<name>/openapi.json`, committed `./<name>.d.ts`; `spawnSync(process.execPath, [cli, contract])`, status 0, stdout equals the committed file. Test names come out as `generated core types match the contract` and `generated rider types match the contract`.
- `response types are usable by name`: unchanged, through `@shopperstop/ui/api`.
- `rider response types are usable by name`: `import type { components as RiderComponents, paths as RiderPaths } from '@shopperstop/ui/api/rider'`; `/readyz` 200 is `{ status: 'ok' }`; `Error` code is the seven-code union. A missing export fails `npm run typecheck` with TS2307.
- `gen:api skips an absent rider contract`: `mkdtempSync(join(tmpdir(), 'gen-api-'))`; create `<tmp>/packages/ui/src/api` and copy the real `services/core/openapi.json` to `<tmp>/services/core/openapi.json`; read `scripts['gen:api']` from `packages/ui/package.json`; `spawnSync('sh', ['-c', script], { cwd: '<tmp>/packages/ui', encoding: 'utf8', env: { ...process.env, PATH: <bin> + delimiter + process.env.PATH } })` where `<bin>` = `join(dirname(require.resolve('openapi-typescript/package.json')), '..', '.bin')`; expect status 0, `stdout.split('\n')` to contain `gen:api: services/rider/openapi.json absent, skipping`, `<tmp>/packages/ui/src/api/core.d.ts` to equal the committed `core.d.ts`, and `<tmp>/packages/ui/src/api/rider.d.ts` not to exist; `rmSync(tmp, { recursive: true, force: true })` in `finally`. It runs the real script text, so a script without the skip fails it. Fake at the process boundary only (a temp directory), per Spec 1 §5.2.

No test for "present contract writes `rider.d.ts`": the stale test plus the gate "`make gen` leaves a clean tree" cover it.

### Lint and colour scan
The generated `rider.d.ts` passes `eslint src/api` and `no-literal-colors.test.ts` unchanged (measured), so neither config moves.

## Files
All in area ui: `packages/ui/package.json` (script, one export), `packages/ui/src/api/rider.d.ts` (generated), `packages/ui/src/api/api.test.ts` (renamed from `core.test.ts`), `openspec/changes/ui-rider-api-types/**`. No `package-lock.json` change (no dependency added).

## Risks / Trade-offs
- [rider-P3-L2 (`rider-deliveries`) changes `services/rider/openapi.json` in parallel] → whichever lands second regenerates: if rider-P3-L2 merges first, this branch runs `npm run gen:api --workspace packages/ui` after its rebase and commits the new `rider.d.ts` (the rider type test pins only `/readyz` and the `Error` codes, which L2 does not change). If this lands first, rider-P3-L2 commits `rider.d.ts` under D19 extended.
- [A new error code in the rider contract fails typecheck] → intended, one-line update, same as core.
- [`sh` one-liner] → see the ceiling above.
