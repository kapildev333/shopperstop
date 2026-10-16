Lane ui-P3-L1, area ui. Every task: worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/ui-P3-L1`, branch `lane/ui-P3-L1-components-backlog`; design in `design.md` (section number per task); commits `test: <scenarios>` (only the test file(s), suite red for the new tests) then `feat: <change>`; gates from the worktree root with Node 22.23.3: `npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`. Tasks 1 to 5 have disjoint files and can run in parallel; tasks 4 and 5 both add one line to `index.ts` at the separate anchors design.md names.

## 1. Button: aria-disabled styling and compact size (design 2, 3)
Scope: `packages/ui/src/button.tsx`, `packages/ui/src/button.test.tsx`. Scenarios: "Compact size keeps the phone tap target", "aria-disabled looks disabled and keeps focus". Failing tests: `packages/ui/src/button.test.tsx` › `compact size keeps the phone tap target` (inside `describe('Button variants and loading')`) and `aria-disabled looks disabled and keeps focus` (new `describe('Unavailable buttons stay focusable')`). Commits: `test: compact size keeps the phone tap target; aria-disabled looks disabled and keeps focus`, then `feat: Button compact size and aria-disabled styling`.

- [ ] 1.1 Add both failing tests; commit `test:`
- [ ] 1.2 Add `compact` to `ButtonSize` and `sizeClass`, append the two `aria-disabled:` classes to `base`; commit `feat:`
- [ ] 1.3 Gates green

## 2. IconButton type, Table stack label, TabNav current link (design 7, 8, 9)
Scope: `packages/ui/src/icon-button.tsx`, `packages/ui/src/icon-button.test.tsx`, `packages/ui/src/table.tsx`, `packages/ui/src/table.test.tsx`, `packages/ui/src/tab-nav.tsx`, `packages/ui/src/tab-nav.test.tsx`. Scenarios: "IconButton submits when asked", "Stack label sits above the value", "Tab navigation reveals the current link". Failing tests: `icon-button.test.tsx` › `IconButton submits when asked` (inside `describe('IconButton has an accessible name')`), `table.test.tsx` › `stack label sits above the value`, `tab-nav.test.tsx` › `tab navigation reveals the current link` (stub `Element.prototype.scrollIntoView` with `vi.fn()`, restore after). Commits: `test: IconButton submits when asked; stack label sits above the value; tab navigation reveals the current link`, then `feat: IconButton type, stacked Table label above value, TabNav scrolls current link into view`.

- [ ] 2.1 Add the three failing tests; commit `test:`
- [ ] 2.2 `type="button"` before the spread in `IconButton`; `block` on the stacked label `span`; the mount effect with `scrollIntoView?.(...)` in `TabNav`; commit `feat:`
- [ ] 2.3 Gates green

## 3. Stacking Dialog and Sheet (design 6)
Scope: `packages/ui/src/use-modal.ts`, `packages/ui/src/dialog.test.tsx`. Scenarios: "Stacked modals close top first", "Tab stays in the top modal". Failing tests: `dialog.test.tsx` › `stacked modals close top first` and `tab stays in the top modal`, inside `describe('Modal focus management')`, composing a `Sheet` (imported from `./sheet`) opened from a page button and a `Dialog` opened from a button inside the Sheet, both with `useState` harnesses. Commits: `test: stacked modals close top first; tab stays in the top modal`, then `feat: Dialog and Sheet stack, the top layer handles Escape and Tab`.

- [ ] 3.1 Add both failing tests; commit `test:`
- [ ] 3.2 Module-level `layers` array in `use-modal.ts`: push on open, splice in cleanup before refocusing, `onKeyDown` returns unless the panel is last; commit `feat:`
- [ ] 3.3 Gates green; the existing Dialog and Sheet tests still pass unchanged

## 4. ImageTile and VisuallyHidden (design 1, 5)
Scope: `packages/ui/src/image-tile.tsx`, `packages/ui/src/image-tile.test.tsx`, `packages/ui/src/visually-hidden.tsx`, `packages/ui/src/visually-hidden.test.tsx`, `packages/ui/src/index.ts` (two lines: after `./table` and after `./error-banner`). Scenarios: "Tile shows the image", "Placeholder without an image", "Decorative tile", "Missing alt does not compile", "Hidden text names a control", "Live variant is polite". Failing tests: `image-tile.test.tsx` › `tile shows the image`, `placeholder without an image`, `decorative tile`, `missing alt does not compile` (`// @ts-expect-error alt is required`), and `visually-hidden.test.tsx` › `hidden text names a control`, `live variant is polite`; both files import from `./index`. Commits: `test: image tile and visually hidden scenarios` (test files only; they fail on the missing export), then `feat: ImageTile and VisuallyHidden`.

- [ ] 4.1 Add both failing test files; commit `test:`
- [ ] 4.2 Create both components and their two `index.ts` lines; commit `feat:`
- [ ] 4.3 Gates green

## 5. ChoiceGroup and Choice (design 4)
Scope: `packages/ui/src/choice-group.tsx`, `packages/ui/src/choice-group.test.tsx`, `packages/ui/src/chip.tsx`, `packages/ui/src/index.ts` (one line, after `./stepper`). Scenarios: "Click chooses", "Arrow keys move and choose", "One tab stop", "Choices can sit anywhere inside the group". Failing tests: `choice-group.test.tsx` › `click chooses`, `arrow keys move and choose`, `one tab stop`, `choices can sit anywhere inside the group` (choices inside `<ul><li>`), importing from `./index`. Commits: `test: single-choice group scenarios`, then `feat: ChoiceGroup and Choice sharing chipClass with Chip`.

- [ ] 5.1 Add the failing test file; commit `test:`
- [ ] 5.2 Export `chipClass` from `chip.tsx` (Chip uses it), create `choice-group.tsx`, add the `index.ts` line; commit `feat:`
- [ ] 5.3 Gates green; `chip.test.tsx` passes unchanged

## 6. Acceptance (team lead) and verification (manager)
- [ ] 6.1 Team lead `/opsx:verify`: every scenario in the delta has a passing same-named test, tasks 1 to 5 ticked, diff only in the files design.md lists
- [ ] 6.2 Manager: `make test-web` (ui, web, admin green: the apps render `TabNav`, `Dialog`, `Sheet`, `Table`), `openspec validate --all --strict`, and a Chrome check at 390 px and 1280 px of a stacked Table, a compact ghost Button, a ChoiceGroup by keyboard and a Dialog over a Sheet
