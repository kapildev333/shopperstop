# Proposal

## Why
Spec 1 §10 lists "`api/core.d.ts` generated from the contract" as part of `@shopperstop/ui`, and Spec 1 §7 has `make gen` write it with `openapi-typescript` so both apps share one typed view of the core API. `ui-packages-ui` deferred it until `services/core/openapi.json` existed; core landed it in core-P1-L1 (#23). This change adds the generated types and a gate that fails when they drift from the contract.

## What Changes
- `openapi-typescript` 7.13.0 as a dev dependency of `packages/ui`, and the package's TypeScript pin moves from 6.0.3 to 5.9.3 because `openapi-typescript` 7 declares the peer `typescript ^5.x` (PLAN.md D18).
- Script `gen:api`: `openapi-typescript ../../services/core/openapi.json -o src/api/core.d.ts`. `make gen` (platform) already calls it with `--if-present`.
- `src/api/core.d.ts`: the generated file, committed.
- Export `"./api": { "types": "./src/api/core.d.ts" }`: types only, no runtime code.
- `src/api/core.test.ts`: regenerates from the contract and compares with the committed file; pins the `/readyz` response shape and the error envelope's code enum through `@shopperstop/ui/api`.
- ADDED requirement "Generated API types" on `design-system`.

Area: ui. Out of scope: an `openapi-fetch` client or client factory (each app adds `openapi-fetch` and calls `createClient<paths>()` itself); the apps' use of the types (web, admin); CI wiring of `make gen` (platform); any change to `openapi.json` (core).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `design-system`: ADDED requirement "Generated API types"; nothing existing changes.

## Impact
- Files: `packages/ui/package.json`, `packages/ui/src/api/core.d.ts`, `packages/ui/src/api/core.test.ts`, and this change folder. Root `package-lock.json` changes mechanically on install.
- Cross-area contracts relied on: `services/core/openapi.json` (core) as the single input. Contract created: the `@shopperstop/ui/api` export (`paths`, `components`, `operations`) for `apps/web` and `apps/admin`.
- Coupling created: any change to `services/core/openapi.json` makes this package's test fail until `src/api/core.d.ts` is regenerated (`make gen`). That is the point of the gate; a core PR that changes the contract regenerates the file in the same PR (PLAN.md D19).
