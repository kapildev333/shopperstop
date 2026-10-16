# ui-P3-L1-T2 - IconButton type, Table stack label, TabNav current link (design §7, §8, §9)
Status: done
## Doing
Done: tests committed first (`test:` commit), then the code (`feat:` commit). Gates run in the worktree; see the report.
## Found
- `IconButton`: `type="button"` now sits before `{...rest}`, so a caller's `type="submit"` reaches the DOM.
- `Table` stacked label span gets `block`; `sm:hidden` still wins from `sm` up.
- `TabNav` calls `scrollIntoView` once on mount for the `[aria-current="page"]` link (optional call; jsdom has no `scrollIntoView`). Ceiling in design §9: a programmatic navigation to an off-screen tab does not scroll it.
## Requests
None.
## Blockers
None.
