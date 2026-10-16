# ui-P3-L1-R4 - review of Task 4 (ImageTile, VisuallyHidden)
Status: done
## Doing
Verdict: approve. Commits 13fbe7a, the image-tile hunk of 8b48899, dfbf044.
## Found
- Gates: vitest image-tile, visually-hidden, no-literal-colors 7/7 pass; lint clean; typecheck fails only on src/choice-group.test.tsx (Task 5, ChoiceGroup not yet exported), nothing from Task 4.
- Placeholder with src absent and non-empty alt exposes nothing, which is what the spec requires ("expose nothing to assistive technology"); alt is ignored there by design.
- Hunk in 8b48899 does not weaken the test: the original asserted an explicit role attribute the component never sets; the new one asserts alt="" and the implicit presentation role via getByRole, which is the spec wording. Test-first order holds (13fbe7a red, dfbf044 green); the amend into another task's commit is a history blemish only.
- Tokens only (bg-surface, bg-canvas, text-ink-muted, rounded-control, sr-only); no scope creep.
## Requests
none
## Blockers
none
