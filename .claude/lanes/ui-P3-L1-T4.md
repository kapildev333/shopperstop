# ui-P3-L1-T4 - ImageTile and VisuallyHidden
Status: done
## Doing
Task 4 landed: test commit, then feat commit with the components and the two index.ts lines. Gates run; see report.
## Found
- Shared worktree: while this task ran, another worker's commit (8b48899, Dialog stacking tests) was rebuilt by an `--amend` of mine, so the decorative-tile assertion fix in `packages/ui/src/image-tile.test.tsx` sits in that commit, not in mine. My original `test:` commit 13fbe7a is red for all six scenarios. Test-only, no behaviour change.
- `ImageTile` takes `alt=""` as the decorative switch; decorative test asserts `getByRole('presentation')`.
## Requests
- to ui-P3-L1 lane owner: rebase-free history on this branch now mixes two workers' test files in 8b48899; the reviewer should read that commit with this note.
## Blockers
none
