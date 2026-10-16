# mobile-P4-L1-T8 - Badge, Chip, Card (mobile-foundation-accounts, task 8)
Status: done
## Doing
Task 8 on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit (`src/ui/marks.test.tsx`), then `feat:` with `badge.tsx`, `chip.tsx`, `card.tsx` and task 8's boxes ticked.
## Found
- Red (8.1), `npx jest --ci src/ui/marks.test.tsx` before the components exist:
  ```
  FAIL src/ui/marks.test.tsx
    Test suite failed to run
    Cannot find module './badge' from 'src/ui/marks.test.tsx'
  Test Suites: 1 failed, 1 total
  Tests:       0 total
  ```
- Green (8.2, 8.3). `badge.tsx` is a `Text` (variant `small`, weight 600 through `fontFamily(600)`) with its own fill and `radius.pill`, so the label and background are one element; variants neutral (`canvas`), success, warning, danger, accent as web's `Badge`. `chip.tsx` is a `Pressable` (`accessibilityRole="button"`, `accessibilityState.selected`, min height 44, padding 16, pill, border 1: `accent` or `lineStrong`; fill `accentSoft` or `surface`; text `accentHover` or `ink`). `card.tsx` is a `View` (`surface`, radius `card`, padding 16, `boxShadow: shadows.card.boxShadow`), no test (Decision 6).
- Chip takes `children: string` and `onPress`; Badge takes `children: string`; neither has a tone prop. Both are plain Text/Pressable with the token colours.
- `npx jest --ci src/ui/marks.test.tsx`: `Tests: 3 passed, 3 total`.

Gates (last lines, this worktree at the feat commit; other workers' files still uncommitted):
```
npm run build --workspace packages/ui          exit 0
npm run lint --workspace apps/mobile           1 error in apps/mobile/src/ui/button.test.tsx (not this task's file)
npm run typecheck --workspace apps/mobile      errors only in src/auth.test.ts, src/ui/button.tsx, src/ui/states.test.tsx (missing modules from other tasks); none in badge/chip/card/marks
npm run test --workspace apps/mobile -- --run  states.test.tsx fails (missing ./empty-state etc., task 9 in progress); marks.test.tsx passes 3 of 3
npm run build --workspace apps/mobile         Exported: dist (exit 0)
openspec validate mobile-foundation-accounts --strict   Change 'mobile-foundation-accounts' is valid
```
## Requests
## Blockers
