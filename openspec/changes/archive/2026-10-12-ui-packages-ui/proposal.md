# Proposal

## Why
Both web apps (plan Tasks 10 and 11) compose their pages from `@shopperstop/ui`, and the seeded `design-system` spec already names the tokens and components they must use, but `packages/ui` does not exist. Plan Task 9 builds it: tokens mapped into Tailwind 4, the shared components of Spec 1 §10 with a test each, the literal-colour matcher every app's `no-literal-colors.test.ts` uses, and the Figma token check of Spec 1 §9.

## What Changes
- New workspace package `packages/ui`, published inside the repo as `@shopperstop/ui`, built by `tsc` to `dist/`, with `lint`, `typecheck`, `test` and `build` scripts.
- `src/tokens.css`: the 20 semantic colours of Spec 1 §8.1 on `:root`, mapped into Tailwind 4 `@theme` with the default palette and shadows switched off, plus the type scale, radii, the two shadows, Inter, motion defaults, the focus ring and the reduced-motion rule. It is the Tailwind preset: apps import it after `tailwindcss`.
- Components: Button, ButtonLink, IconButton, Input (+ `inputClass`), FormField, Select, Stepper, Badge, Chip, Card, Dialog + DialogFooter, Sheet, Table (with `stack`), EmptyState, ErrorBanner, StatusMessage, Skeleton, PageHeader, TabNav, Price (+ `formatInr`), `cn`.
- `@shopperstop/ui/testing`: `matchLiteralColors` and `findLiteralColors`, the shared matcher behind each app's `no-literal-colors.test.ts`.
- `scripts/check-figma-tokens.mjs`: diffs a Figma variables JSON export against the colours in `tokens.css`; run by hand, tested against fixtures.
- ADDED requirements on `design-system` that pin what the seed leaves open (token mapping, component contracts, contrast of the pairs components use, the matcher, the Figma check). The seed's four requirements are not repeated; their scenarios that concern this package get tests here (see tasks.md).

Area: ui. Out of scope: `src/api/core.d.ts` (deferred until `services/core/openapi.json` exists, see design.md), the apps' own `no-literal-colors.test.ts` and pages (web, admin), the "Axe on every e2e page" scenario (web and admin Playwright suites), Figma components and Code Connect (orchestrator Task 14), dark mode, Storybook.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `design-system`: ADDED requirements only; no seeded requirement is changed.

## Impact
- Files: `packages/ui/**` and this change folder. The root `package-lock.json` changes mechanically when workers run `npm install`; no other root file changes.
- Cross-area contracts this change creates: the `@shopperstop/ui` exports (`.` components, `./testing` matcher, `./tokens.css` preset) consumed by `apps/web` and `apps/admin`; `tokens.css` token names consumed by the Figma file. Relies on: root `package.json` workspaces (platform, landed). Will rely on, later: `services/core/openapi.json` (core) for `src/api/core.d.ts`.
- Apps consume the package as: `index.css` = `@import "tailwindcss"; @import "@shopperstop/ui/tokens.css";`, components from `@shopperstop/ui`, the matcher from `@shopperstop/ui/testing`. `packages/ui` must be built (`npm run build --workspace packages/ui`) before an app typechecks, tests or builds.
