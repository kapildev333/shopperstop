## Why
The customer mobile app (Phase 4, D36 to D40) styles React Native views with `StyleSheet`, so it cannot read `tokens.css` and must not copy hex values. It needs the same token values as plain TypeScript data, and `formatInr` without pulling React DOM components through `@shopperstop/ui`.

## What Changes
- New `@shopperstop/ui/tokens`: `src/tokens.ts`, generated from `src/tokens.css` by `scripts/gen-tokens.mjs` (`npm run gen:tokens`), output committed. Exports `colors` (camelCase semantic names), `radius`, `spacing`, `type`, `motion`, `shadows`. A Vitest test regenerates in memory and fails when the committed module and `tokens.css` disagree.
- New `@shopperstop/ui/format`: `formatInr` moves to `src/format.ts`, a module with no imports; `price.tsx` re-exports it, so `@shopperstop/ui` still exports `formatInr` unchanged.
- `src/no-literal-colors.test.ts` exempts the generated `tokens.ts`.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `design-system`: ADDED "Token values as a TypeScript module"; MODIFIED "Semantic colour tokens only" (the generated module is the one other place colour values live) and "Price shows MRP when discounted" (`formatInr` is DOM-free and has its own entry).

## Impact
- Area: ui. Files: `packages/ui/package.json` (two `exports` entries, one script), `packages/ui/scripts/gen-tokens.mjs` and `gen-tokens.test.ts`, `packages/ui/src/tokens.ts` (generated), `packages/ui/src/format.ts` and `format.test.ts`, `packages/ui/src/price.tsx`, `packages/ui/src/no-literal-colors.test.ts`.
- Contracts relied on: `packages/ui/src/tokens.css` (source, unchanged), the `@shopperstop/ui` exports (unchanged; two entries added). Consumer: `apps/mobile` (mobile-P4-L1).
- Out of scope: changing any token value or `tokens.css`; `scripts/check-figma-tokens.mjs`; wiring `gen:tokens` into `make gen` (platform's Makefile; the drift test makes it unnecessary); font family names for React Native (the mobile app maps weights to `@expo-google-fonts/inter` faces); a dark theme; anything in `apps/`.
