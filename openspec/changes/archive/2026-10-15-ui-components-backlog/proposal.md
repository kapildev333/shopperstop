## Why
The apps queued nine `packages/ui` requests during Phase 2 (`.claude/areas/ui.md` `## Requests` and `## Backlog`; PLAN.md D34) and carry app-level copies until they land: admin's `apps/admin/src/image.tsx` tile, `idle` classes for `aria-disabled`, an `sr-only` status paragraph and a Sheet that steps aside for its Dialog; web's product image tile and checkout's `Chip` address choice with `aria-pressed`. The rider app (Phase 3, D29) needs the same single-choice control and live region. This change lands them once, in the package, each with a test.

## What Changes
- New `ImageTile`: 1:1 tile, `canvas` placeholder with a Lucide icon when there is no image; `alt` required at the type level (`alt=""` is the explicit decorative choice).
- New `ChoiceGroup` and `Choice`: a `radiogroup` of pill `radio` buttons, arrow keys move and select, one tab stop. `chip.tsx` exports `chipClass(selected)` so `Chip` and `Choice` share one pill recipe.
- New `VisuallyHidden`: `sr-only` text; `live` makes it an `aria-live="polite"` region.
- `Button` and `ButtonLink` look disabled under `aria-disabled="true"` and stay focusable.
- `Button` `size="compact"`: 44 px tall on phone, 32 px from `sm`, tighter padding, for an order number in a card or table cell.
- `Dialog` and `Sheet` stack: only the top layer handles Escape and Tab; each layer returns focus to its own opener.
- `Table` `stack`: the in-cell label sits on its own line above the value at phone width.
- `IconButton` accepts `type` (default `button`), so it can submit a form.
- `TabNav` scrolls the current link into view when it mounts.

## Capabilities
### New Capabilities
None.

### Modified Capabilities
- `design-system`: MODIFIED "Shared components", "Button variants and loading", "IconButton has an accessible name", "Modal focus management", "Table stack mode", "Page header and tab navigation"; ADDED "Image tile", "Single-choice group", "Visually hidden text and live region", "Unavailable buttons stay focusable".

## Impact
- Area: ui. Files: `packages/ui/src/` only (listed in design.md). No new dependency (`lucide-react` is already a dependency).
- Contracts: new `@shopperstop/ui` exports `ImageTile`, `ChoiceGroup`, `Choice`, `VisuallyHidden`, `chipClass`; `ButtonSize` gains `compact`; every existing export keeps its props. Colours only from `tokens.css`; no token changes.
- Consumers: web-P3-L1 and admin-P3-L1 swap their app-level copies once this is on main; the rider app composes `ChoiceGroup` and `VisuallyHidden live`.
- Out of scope: swapping the apps' copies (their lanes), a `Textarea`, an `initialFocus` prop on `Dialog`/`Sheet`, `Button` swallowing clicks under `aria-disabled`, image load-error fallback, disabled choices, generated rider types (ui-P3-L2).
