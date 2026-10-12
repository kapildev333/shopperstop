# Proposal

## Why
`openspec/specs/` is empty, so no later change has a living spec to write deltas against and `openspec validate --all --strict` has nothing to check. Spec 1 §5.1 and §12 and PLAN.md D4 make Phase 1 seed the two cross-cutting capabilities, `platform` and `design-system`, before any feature lane starts.

## What Changes
- Add the `platform` capability: configuration fails fast, health endpoints, error envelope, request body limits, CORS, request logging. Text is plan Task 3 step 2, verbatim.
- Add the `design-system` capability: semantic colour tokens only, type scale, shared components, accessibility baseline. Text is plan Task 3 step 3, verbatim.
- Sync both deltas into `openspec/specs/platform/spec.md` and `openspec/specs/design-system/spec.md` on the feature branch, so the living specs exist as soon as the PR merges.

Area: platform. Out of scope: any code, the remaining capabilities (serviceability, catalog, stock, accounts, cart, orders, admin-*), which Phase 2's first change seeds (D4); `openspec/config.yaml`; any requirement not in the plan's text.

## Capabilities

### New Capabilities
- `platform`: cross-cutting behaviour of the core service (configuration, health, error envelope, body limits, CORS, logging).
- `design-system`: the visual system both web apps share (tokens, type, shared components, accessibility).

### Modified Capabilities
None.

## Impact
- Files: `openspec/changes/platform-seed-specs/**`, `openspec/specs/platform/spec.md`, `openspec/specs/design-system/spec.md`. No product code.
- Cross-area contracts: none are changed. The specs name contracts other areas will implement against: `services/core` env vars and routes (core), `packages/ui/src/tokens.css` and the `@shopperstop/ui` exports (ui), `no-literal-colors.test.ts` (ui, web, admin).
- CI: the `spec` job (`openspec validate --all --strict`) gets two specs to check.
