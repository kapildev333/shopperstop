# ui-P1-L1-T7 - packages/ui task 7: Figma token check (OpenSpec change ui-packages-ui)
Status: done
## Doing
Task 7 done on lane/ui-P1-L1-t7-figma-check: test commit (red, 3 failing), feat commit (script green, 7.1 and 7.2 ticked). Gates in the lane report; awaiting review.
## Found
- `scripts/check-figma-tokens.mjs` skips leaves whose value is not a hex colour (design.md says colours only); it does not fail on them.
- Output prints the normalised values (upper-cased, FF alpha dropped), so `css #F8CB46` is the CSS value after normalisation.
- `npm ci` from the worktree root left `package-lock.json` unchanged.
## Requests
## Blockers
