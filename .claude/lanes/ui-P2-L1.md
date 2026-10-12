# ui-P2-L1 - TabNav scrolls horizontally, OpenSpec change ui-tabnav-scroll
Status: done
## Doing
Acceptance passed on c5e19c1.
## Found
- `openspec/changes/ui-tabnav-scroll/`: MODIFIED "Page header and tab navigation" on `design-system`, new scenario "Tab navigation scrolls instead of wrapping", one task.
- Nav adds `overflow-x-auto whitespace-nowrap [&_a]:shrink-0 [&_a:focus-visible]:outline-offset-[-2px]`. Inset ring because `overflow-x: auto` makes `overflow-y` auto and would clip the 2 px + 2 px offset ring.
- Tap height 46 px (py-3 24 + line 20 + border-b 2). TabNav props unchanged; no app change needed.
- Figma: TabNav component needs a "scrolls horizontally, never wraps" note (orchestrator).
- Acceptance (opsx:verify by hand, 2026-10-12): scenario "Tab navigation scrolls instead of wrapping" -> passing test `tab navigation scrolls instead of wrapping` (tab-nav.test.tsx, 2/2 pass); tasks 1.1-1.3 ticked; commits test 702bd21 (test file only) then feat c5e19c1; diff since 2410c1d touches only tab-nav.tsx, tab-nav.test.tsx, openspec/changes/ui-tabnav-scroll/**, .claude/lanes/ui-P2-L1*.md; `openspec validate ui-tabnav-scroll --strict` valid. Manager's Chrome check (320 px, seven links) confirms scroll and inset focus ring. design.md clarified: focus scrolls natively, only load-time scroll-into-view is out of scope.
## Requests
- answered: ui manager Chrome check done.
## Blockers
