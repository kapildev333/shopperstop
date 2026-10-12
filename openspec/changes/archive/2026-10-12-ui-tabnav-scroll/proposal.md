## Why
Admin's seven nav links overflow the `TabNav` strip at 375 px and axe flags the overflowing labels. Admin's e2e work waits on this.

## What Changes
- `TabNav` scrolls horizontally instead of wrapping or squeezing: `overflow-x-auto` and `whitespace-nowrap` on the nav, `shrink-0` on its links.
- The focus ring of a link is drawn inset (`outline-offset: -2px`) so the scroll container cannot clip it.

## Capabilities
### Modified Capabilities
- `design-system`: requirement "Page header and tab navigation" (TabNav scrolls; new scenario).

## Impact
- Area: ui. Files: `packages/ui/src/tab-nav.tsx`, `packages/ui/src/tab-nav.test.tsx`.
- Contract: the `@shopperstop/ui` export `TabNav` keeps its props; only styling changes. Consumed by `apps/admin` (and `apps/web` where used); no app change needed.
- Out of scope: scrollbar styling, scroll-into-view of the current link, fade/arrow affordances, any other component.
