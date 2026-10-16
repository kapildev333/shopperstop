# mobile-P4-L2-T4 - StatusMessage and ImageTile (mobile-serviceability-catalog task 4)
Status: done (tasks 4.1 to 4.3 ticked)

## Doing
4.1 red: src/ui/status-message.test.tsx and src/ui/image-tile.test.tsx written from the brief's five names, failing (Cannot find module)
4.2 feat: StatusMessage and ImageTile per the design file, tests green (5 of 5)
4.3 gates run; task 4 ticked

## Found
- Red run: `npx jest --ci src/ui/status-message.test.tsx src/ui/image-tile.test.tsx` -> Test Suites: 2 failed, 2 total (Cannot find module './status-message' and './image-tile')
- RNTL 14 has no `UNSAFE_getByType` / `UNSAFE_queryByType` (on screen or on the render result); the first red commit used them, so a second `test:` commit corrects the queries. The first red commit was not amended: another worker had committed on top of it.
- Lucide-react-native does not forward `testID` to its svg, so the icon colour cannot be read from the tree. The "tones use tokens" test checks the tone's background and the text colour; the icon colour is set from `colors` in the component and is not asserted.
- The image is `importantForAccessibility="no-hide-descendants"` (spec), so its query passes `includeHiddenElements`; the success icon wrapper is hidden from AT and is queried the same way.
- The status region is `accessible` so RNTL's `getByRole('status')` finds it (it also makes the message one announcement); it has `role="status"` and `accessibilityLiveRegion="polite"`.
- Gates (worktree, PATH prefix):
  - `npm run build --workspace packages/ui`: exit 0
  - `npm run lint --workspace apps/mobile`: exit 0, no output
  - `npm run typecheck --workspace apps/mobile`: exit 0, no output
  - `npm run test --workspace apps/mobile -- --run`: Test Suites: 30 passed, 30 total; Tests: 116 passed, 116 total
  - `npm run build --workspace apps/mobile`: `Exported: dist`
  - `openspec validate mobile-serviceability-catalog --strict`: Change 'mobile-serviceability-catalog' is valid
- Staging: `openspec/changes/mobile-serviceability-catalog/tasks.md` had another worker's unstaged edits (2.1 to 2.3 unticked in the working tree); the feat commit stages only the 4.1 to 4.3 ticks, built from HEAD, and leaves that worker's edits unstaged.

## Requests
## Blockers
None.
