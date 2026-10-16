# Proposal

## Why
PLAN.md D29 gives the rider service its own contract, `services/rider/openapi.json` (on main since #207), and a generated `packages/ui/src/api/rider.d.ts` that `apps/rider` (rider-P3-L3) imports. Today `gen:api` and the stale test know only `core.d.ts`. Platform (platform-P3-L1) asked that `make gen` stay clean on a tree without `services/rider`.

## What Changes
- `gen:api` generates `src/api/core.d.ts` as today, then `src/api/rider.d.ts` from `../../services/rider/openapi.json` when that file exists; otherwise prints one line, `gen:api: services/rider/openapi.json absent, skipping`, and exits 0.
- `src/api/rider.d.ts`: generated, committed.
- Export `"./api/rider": { "types": "./src/api/rider.d.ts" }`: types only, like `./api`. One added entry; nothing else in `exports` moves.
- `src/api/core.test.ts` becomes `src/api/api.test.ts`: the stale check runs for core and rider, a rider type test pins two shapes through `@shopperstop/ui/api/rider`, and a test runs the `gen:api` script in a temp tree without a rider contract.
- MODIFIED requirement "Generated API types" on `design-system`.

Area: ui. Out of scope: any change to either `openapi.json` (core, rider); the rider app's client (rider-P3-L3); the Makefile (`make gen` already calls `gen:api`, platform); a shared client factory.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `design-system`: "Generated API types" now covers both contracts and the absent-contract skip.

## Impact
- Files: `packages/ui/package.json`, `packages/ui/src/api/rider.d.ts` (new, generated), `packages/ui/src/api/core.test.ts` renamed to `packages/ui/src/api/api.test.ts`, this change folder.
- Cross-area contracts relied on: `services/core/openapi.json` (core), `services/rider/openapi.json` (rider). Contract created: `@shopperstop/ui/api/rider` (`paths`, `components`, `operations`) for `apps/rider`.
- Coupling created (D19 extended): a rider PR that changes `services/rider/openapi.json` fails this package's test until it runs `make gen` and commits `packages/ui/src/api/rider.d.ts` in the same PR, as a mechanical change.
