# ui-P3-L1-T3 - Stacking Dialog and Sheet (OpenSpec change ui-components-backlog, tasks 3.1 to 3.3, design 6)
Status: done
## Doing
Done: tests committed (83c768d), layer stack in use-modal.ts committed. Gates run; ui-only gates green except task 4's red files.
## Found
- `use-modal.ts`: module-level `layers` array; the open effect pushes the panel; `onKeyDown` returns unless the panel is the top layer; cleanup splices the panel before refocusing the opener.
- "Tab stays in the top modal" passes before the change: Dialog's own Tab wrap already handles it and the Sheet's handler does not act while focus is in the Dialog. It stays as a regression guard for the stack; only "Stacked modals close top first" is red before the change.
- Gate outside this task: `typecheck` and two test files (`image-tile.test.tsx`, `visually-hidden.test.tsx`) fail on task 4's not-yet-landed exports. Not touched.
## Requests
None.
## Blockers
None.
