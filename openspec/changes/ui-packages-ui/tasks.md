# Tasks

Every task: work in your own worktree, read `design.md` (it fixes every interface and class list), test first. Commit order `test: <scenario>` (red) then `feat: <what>` (green on all gates); task 1 starts with one `chore:` scaffold commit because no test can run before the package exists. Gates, from the worktree root, Node 22.12 or newer (D11: `export PATH=~/.local/node-v22.23.3/bin:$PATH`):
`npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`.

Waves: task 1 alone; then tasks 2 to 7 in parallel, each on a branch from task 1's landed commit; then task 8 after task 2 has landed (it imports Button and IconButton). Every task owns its files exclusively; `src/index.ts` is written once by task 1 and never edited again.

## 1. Scaffold, tokens, cn, literal-colour matcher

Scope: `packages/ui/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,eslint.config.js}`, `packages/ui/src/{index.ts,test-setup.ts,tokens.css,tokens.test.ts,cn.ts,cn.test.ts,no-literal-colors.test.ts}`, `packages/ui/src/testing/**`, the placeholder files `packages/ui/src/{button,icon-button,input,form-field,select,price,stepper,badge,chip,card,table,skeleton,empty-state,status-message,page-header,tab-nav,dialog,sheet,error-banner}.tsx` (each exactly `export {}`), root `package-lock.json` (mechanical).
Scenarios: Token stylesheet is the Tailwind preset (all three), Inter is bundled, Motion and focus defaults (both), Component colour pairs meet contrast, Literal colour matcher for every app (all three), Class names join without a library; seed scenario "Literal colour fails the gate".
Failing tests: `src/tokens.test.ts` › "token values match the palette", "semantic utilities compile", "default palette and shadows are off", "font comes from the package", "reduced motion turns transitions off", "focus ring uses the focus token", "used pairs pass"; `src/cn.test.ts` › "falsy parts are dropped"; `src/testing/literal-colors.test.ts` › "each literal kind is matched", "token utilities are not matched", "directory scan names the file"; `src/no-literal-colors.test.ts` › "no literal colours in src".
Commits: `chore: packages/ui scaffold`, `test: tokens, cn and literal-colour matcher`, `feat: tokens, cn and literal-colour matcher`.

- [x] 1.1 Scaffold committed: package files per design.md "Packaging", `npm install` run, index and placeholders; typecheck, lint and build green
- [x] 1.2 The four test files committed red
- [x] 1.3 `tokens.css`, `cn.ts`, `testing/literal-colors.ts` make them green; all four gates green

## 2. Button, ButtonLink, IconButton

Scope: `packages/ui/src/{button,icon-button}.tsx`, `packages/ui/src/{button,icon-button}.test.tsx`.
Scenarios: Button variants and loading (all three), ButtonLink looks like a Button, IconButton has an accessible name (both).
Failing tests: `src/button.test.tsx` › "default type is button", "loading blocks clicks", "primary uses the accent", "link keeps href and button style"; `src/icon-button.test.tsx` › "name comes from aria-label", "missing label does not compile".
Commits: `test: button variants, loading and icon button name`, `feat: Button, ButtonLink, IconButton`.

- [ ] 2.1 Tests committed red
- [ ] 2.2 Components green; all four gates green

## 3. Input, FormField, Select

Scope: `packages/ui/src/{input,form-field,select}.tsx` and their `.test.tsx`.
Scenarios: Form fields are labelled and described (all three).
Failing tests: `src/form-field.test.tsx` › "label finds the control", "error describes the control"; `src/select.test.tsx` › "select changes value"; `src/input.test.tsx` › "input forwards props and ref".
Commits: `test: labelled and described form fields`, `feat: Input, FormField, Select`.

- [ ] 3.1 Tests committed red
- [ ] 3.2 Components green; all four gates green

## 4. Price, Stepper, Badge, Chip

Scope: `packages/ui/src/{price,stepper,badge,chip}.tsx` and their `.test.tsx`.
Scenarios: Price shows MRP when discounted (all three), Stepper adds and removes (both), Badge and Chip (both); seed scenarios "Price uses tabular numerals", "Price formatting", "Stepper at zero stock", "Stepper at the maximum".
Failing tests: `src/price.test.tsx` › "price formatting", "zero rupees", "price uses tabular numerals", "discounted price shows MRP", "no discount, no MRP"; `src/stepper.test.tsx` › "stepper at zero stock", "stepper at the maximum", "ADD adds one", "decrement reaches zero"; `src/badge.test.tsx` › "badge variant surface"; `src/chip.test.tsx` › "chip toggles".
Commits: `test: price, stepper, badge and chip`, `feat: Price, formatInr, Stepper, Badge, Chip`.

- [ ] 4.1 Tests committed red
- [ ] 4.2 Components green; all four gates green

## 5. Card, Table, Skeleton

Scope: `packages/ui/src/{card,table,skeleton}.tsx` and their `.test.tsx`.
Scenarios: Card surface, Table stack mode (both), Feedback states › "Skeleton count".
Failing tests: `src/card.test.tsx` › "card classes"; `src/table.test.tsx` › "rows and headers render", "stack labels cells"; `src/skeleton.test.tsx` › "skeleton count".
Commits: `test: card, table stack mode and skeleton`, `feat: Card, Table, Skeleton`.

- [ ] 5.1 Tests committed red
- [ ] 5.2 Components green; all four gates green

## 6. EmptyState, StatusMessage, PageHeader, TabNav

Scope: `packages/ui/src/{empty-state,status-message,page-header,tab-nav}.tsx` and their `.test.tsx`.
Scenarios: Feedback states › "Empty state content", "Status message is polite"; Page header and tab navigation (both).
Failing tests: `src/empty-state.test.tsx` › "empty state content"; `src/status-message.test.tsx` › "status message is polite"; `src/page-header.test.tsx` › "page header"; `src/tab-nav.test.tsx` › "tab navigation landmark".
Commits: `test: empty state, status message, page header and tab nav`, `feat: EmptyState, StatusMessage, PageHeader, TabNav`.

- [ ] 6.1 Tests committed red
- [ ] 6.2 Components green; all four gates green

## 7. Figma token check

Scope: `packages/ui/scripts/**`.
Scenarios: Figma token check (all three).
Failing tests: `scripts/check-figma-tokens.test.ts` › "matching export", "drifted export", "usage error".
Commits: `test: figma token check against fixtures`, `feat: check-figma-tokens script`.

- [x] 7.1 Fixtures and tests committed red
- [x] 7.2 Script green; all four gates green

## 8. Dialog, Sheet, ErrorBanner (after task 2 landed)

Scope: `packages/ui/src/{use-modal.ts,dialog.tsx,sheet.tsx,error-banner.tsx}`, `packages/ui/src/{dialog,sheet,error-banner}.test.tsx`.
Scenarios: Modal focus management (all three), DialogFooter puts Cancel first, Sheet placement, Feedback states › "Error banner retries"; seed scenario "Dialog closes on Escape".
Failing tests: `src/dialog.test.tsx` › "dialog closes on Escape", "focus is trapped", "focus returns on close", "cancel comes first"; `src/sheet.test.tsx` › "sheet closes on Escape and on its close button", "placement classes"; `src/error-banner.test.tsx` › "error banner retries".
Commits: `test: modal focus, dialog footer, sheet and error banner`, `feat: Dialog, DialogFooter, Sheet, ErrorBanner`.

- [ ] 8.1 Tests committed red
- [ ] 8.2 Components green; all four gates green

## Seed scenarios (openspec/specs/design-system) and where they are tested
- Literal colour fails the gate → task 1, `src/no-literal-colors.test.ts` and `src/testing/literal-colors.test.ts` (the apps add their own in web and admin)
- Price uses tabular numerals → task 4, `src/price.test.tsx`
- Stepper at zero stock → task 4, `src/stepper.test.tsx`
- Stepper at the maximum → task 4, `src/stepper.test.tsx`
- Price formatting → task 4, `src/price.test.tsx`
- Dialog closes on Escape → task 8, `src/dialog.test.tsx`
- Axe on every e2e page → not in this package: web and admin Playwright suites

## Deferred (not a task of this change)
- `src/api/core.d.ts`, `openapi-typescript`, `gen:api` and the `./api` export: a follow-up ui change once `services/core/openapi.json` exists (design.md).
