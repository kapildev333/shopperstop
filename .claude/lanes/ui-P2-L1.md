# ui-P2-L1 - TabNav scrolls horizontally, OpenSpec change ui-tabnav-scroll
Status: started
## Doing
Change proposed and valid (`openspec validate ui-tabnav-scroll --strict`); worker task 1 brief handed to the ui manager.
## Found
- `openspec/changes/ui-tabnav-scroll/`: MODIFIED "Page header and tab navigation" on `design-system`, new scenario "Tab navigation scrolls instead of wrapping", one task.
- Nav adds `overflow-x-auto whitespace-nowrap [&_a]:shrink-0 [&_a:focus-visible]:outline-offset-[-2px]`. Inset ring because `overflow-x: auto` makes `overflow-y` auto and would clip the 2 px + 2 px offset ring.
- Tap height 46 px (py-3 24 + line 20 + border-b 2). TabNav props unchanged; no app change needed.
- Figma: TabNav component needs a "scrolls horizontally, never wraps" note (orchestrator).
## Requests
- to ui manager: Chrome check in a 320 px container: nav scrolls, links on one line, focus ring fully visible on first, middle and last link, axe clean.
## Blockers
