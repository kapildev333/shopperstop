# ui-P1-L1-T2 - packages/ui task 2: Button, ButtonLink, IconButton (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 2 done on lane/ui-P1-L1-t2-buttons: red test commit, then feat commit (Button, ButtonLink, buttonClass, IconButton). All four gates green on Node 22.23.3. Waiting for review.
## Found
- `buttonVariantClass` is exported from `button.tsx` (not in design.md). IconButton's secondary variant reuses it so the class string is not copied. `index.ts` `export *` makes it public; index.ts was not edited.
- `ref` is typed explicitly on Button, ButtonLink and IconButton props (React 19 plain prop), as design.md's "ref as a plain prop" asks.
- ButtonLink destructures `children` and renders it explicitly: `jsx-a11y/anchor-has-content` cannot see children that arrive through a spread.
- `buttonClass` keeps the required argument object from design.md (no default `= {}`).
## Requests
## Blockers
