# ui-P4-L1 - tokens export (OpenSpec change ui-tokens-export)
Status: started
## Doing
Team lead: change proposed and valid; waiting for workers on tasks 1 and 2 (parallel, disjoint files), then acceptance (3.1).
## Found
- Change `openspec/changes/ui-tokens-export/`: proposal, `specs/design-system/spec.md` (ADDED "Token values as a TypeScript module", "Token module shape"; MODIFIED "Semantic colour tokens only", "Price shows MRP when discounted", every existing scenario kept), design.md, tasks.md (2 worker tasks, 1 acceptance/verification task). `openspec validate ui-tokens-export --strict` valid; `--all --strict` 16 passed. No `docs/design/ui-P4-L1.md`: design.md fixes the generator, output format and file placement.
- Prototyped in this worktree and reverted (nothing committed): the generator as designed produces the expected module; the drift and shape tests pass; `tsc` (both configs) and ESLint are clean; the build emits `dist/tokens.js` and `dist/format.js`. Without the exemption, `no-literal-colors.test.ts` fails on `tokens.ts` (hex and `rgba(`), hence design 3.
- `tsc` needs no declaration for `gen-tokens.mjs` when the test loads it through a computed `import(pathToFileURL(...).href)`; a literal `import './gen-tokens.mjs'` would fail typecheck (no `allowJs`).
- Decisions (D13): entry `@shopperstop/ui/format` (the existing `price.tsx` imports `cn` and is JSX, so it is not DOM-free); `formatInr` moves to `src/format.ts` and `price.tsx` re-exports it, so `@shopperstop/ui` is unchanged. Entries point at `dist/` like `.`. Values Spec 1 states but `tokens.css` does not declare (pill 9999, spacing unit 4 / gutter 16 / grid gap 12, sheet 200 ms) are a `FIXED` constant in the generator. Shadows export the CSS string as `boxShadow` plus parsed `offsetX/offsetY/blur/color/opacity`. Weights are numbers. No font family in the module. `gen:tokens` not wired into `make gen`.
- For mobile once on main: `import { colors, radius, spacing, type, motion, shadows } from '@shopperstop/ui/tokens'` and `import { formatInr } from '@shopperstop/ui/format'`; both resolve to `packages/ui/dist/`, so `packages/ui` must be built first (`make test-web` does); Metro and Jest must resolve package `exports`. `type.*.weight` is a number: map to `Inter_400Regular`/`Inter_600SemiBold`/`Inter_700Bold`. `shadows.*.boxShadow` works with RN's new-architecture `boxShadow`; the parts map to iOS shadow props. The app's own literal-colour test should not scan `node_modules`.
## Requests
- to mobile (via the orchestrator, when merged): the import notes above under Found.
- to platform (optional, not needed): `make gen` could also run `npm run gen:tokens --workspace packages/ui --if-present`; the drift test already fails CI on a stale module.
## Blockers
None.
