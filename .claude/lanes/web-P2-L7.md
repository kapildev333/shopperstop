# web-P2-L7 - web-phone-card-row: card controls inside the card, wordmark tap target (team lead)
Status: started
## Doing
Change proposed 2026-10-13, strict-valid; waiting for the worker (one task) and the manager's e2e runs, then `/opsx:verify`.
## Found
- Change: `openspec/changes/web-phone-card-row/` (proposal; `web-app` delta: 2 ADDED requirements, 4 scenarios; design; tasks, one task). No `docs/design/web-P2-L7.md`: design.md is enough.
- Card: `Price` above `Stepper` at every width (`flex flex-col items-start gap-2`), not only on a phone. Read from the classes, the row is also too wide at 640 to about 830 px and 1024 to about 1230 px, so a `sm:` breakpoint would leave the defect; `flex-wrap` would move the control on the Add tap. Not measured in a browser by this lane; the six-column scenario (1024 px) is there to confirm it.
- Wordmark: `-my-2 inline-flex min-h-11 items-center`; the box is 44 px, the banner grows 2 px on a phone, nothing from `sm`. Plain `min-h-11` would add 18 px at 390 px, where the wordmark sits alone on its row.
- "Inside the card" is measured against the content area (the product link's box), not the border box: the "₹70" + Stepper overflow is 3 px, inside the padding.
- Ceilings: the quantity group (112 px) fits a 320 px viewport with 0 px to spare, unspecified and untested; "Out of stock" wraps its label to two lines at 320 to about 328 px and 640 to about 652 px. Both would need a narrower Stepper in `packages/ui`; no request made.
- Files: `apps/web/src/product-card.tsx`, `apps/web/src/routes/__root.tsx`, new `apps/web/e2e/phone-layout.spec.ts`. None is a web-P2-L6 file. Both lanes ADD requirements to `web-app` with different names; the archives do not conflict.
- Archive rehearsed on a scratch copy: `web-app` gets 2 requirements (39 in all), `openspec validate --all --strict` passes, longest requirement 498 characters (an existing one; the two new are well under).
- Not in this lane, seen on the way: the product page (`routes/p.$slug.tsx`, web-P2-L6's file) also puts `Price` and `Stepper` together; not reported in the walk-through, not checked.
## Requests
## Blockers
