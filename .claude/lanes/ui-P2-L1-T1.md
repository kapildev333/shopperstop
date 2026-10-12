# ui-P2-L1 task 1 - TabNav scrolls horizontally without wrapping (ui-tabnav-scroll 1.1 to 1.3)
Status: done
## Doing
Done: commits `test` (red, confirmed failing on the four nav classes) and `feat` (four classes added, tasks 1.1 to 1.3 ticked). Gates green: lint, typecheck, test (54 passed), build. Awaiting reviewer and the area manager's Chrome check at 320 px.
## Found
- `tab-nav.tsx`: only the nav class string changed; props unchanged; `gap-4` kept; no scrollbar styling.
- The existing test `tab navigation landmark` is untouched; the new test `tab navigation scrolls instead of wrapping` pins the classes and seven links (jsdom has no layout).
- Real scrolling and the unclipped focus ring are not covered by unit tests; area manager checks in Chrome.
## Requests
(none)
## Blockers
(none)
