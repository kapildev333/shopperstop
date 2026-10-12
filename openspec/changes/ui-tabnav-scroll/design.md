## Context
`TabNav` is `flex gap-4 border-b border-line` with link styling via `[&_a]` variants. Seven admin links overflow at 375 px.

## Decisions
- Nav classes add `overflow-x-auto whitespace-nowrap [&_a]:shrink-0 [&_a:focus-visible]:outline-offset-[-2px]`. `gap-4` stays; no scrollbar styling.
- Tap height: links are `py-3` (24 px) + `text-body` line height 20 px + `border-b-2` (2 px) = 46 px, at or above 44 px on phone. Unchanged.
- Focus ring: the global `:focus-visible` ring (`tokens.css`) is 2 px with `outline-offset: 2px`, so it reaches 4 px outside the link. `overflow-x: auto` forces `overflow-y` to `auto` too, so the scroll container clips the ring at the top, bottom and at the first and last link. Inset offset (-2 px) keeps the whole ring inside the link box. Chosen over `py-1 px-1` on the nav, which would lift the current-link underline 4 px off the nav border and shift the tabs off the page gutter.
- Test: jsdom has no layout, so the unit test pins the classes on the nav while rendering seven links. Real scrolling and the unclipped ring are checked by the area manager in Chrome in a 320 px container.

## Simplifications and ceilings
- Inset ring sits on the link's own edges; links have no horizontal padding, so the ring hugs the first and last glyph. Ceiling: if that reads as cramped, add `[&_a]:px-1` (layout change, needs a design call).
- No scroll-into-view for the current link: a current link past the fold stays off-screen until scrolled. Add when a nav grows past the phone width with a deep current item.

## Files
- `packages/ui/src/tab-nav.tsx`, `packages/ui/src/tab-nav.test.tsx` (area ui only).

## Figma
- The TabNav Figma component gets a "scrolls horizontally, never wraps" note (orchestrator updates Figma).
