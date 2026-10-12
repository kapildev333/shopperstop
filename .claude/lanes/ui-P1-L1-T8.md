# ui-P1-L1-T8 - packages/ui task 8: Dialog, DialogFooter, Sheet, ErrorBanner, use-modal (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 8 done on lane/ui-P1-L1-t8-modals: red test commit 7a5c401, then feat commit (use-modal hook, Dialog, DialogFooter, Sheet, ErrorBanner). All four gates green on Node 22.23.3 (lint, typecheck, test 29/29, build). Waiting for review.
## Found
- `useModal` keeps `onClose` in a ref (synced in an effect) so the focus effect is keyed on `open` only, as design.md says; an inline `onClose` would otherwise re-run the effect and steal focus on every render.
- Tab with no focusable element inside the panel is `preventDefault`ed so focus stays on the panel (design.md does not cover this case).
- `className` is accepted on Dialog, DialogFooter, Sheet and ErrorBanner and merged last via `cn`, per design.md's general rule (the per-component lists do not name it).
- Sheet header `<h2>` is `text-h3` with no colour, literally as design.md lists it; it inherits the body colour.
- `DialogFooter` `children` is optional so a footer with only Cancel is valid.
- Lint, typecheck and build clean; `use-modal.ts` is not exported from `index.ts` (index.ts untouched).
## Requests
## Blockers
