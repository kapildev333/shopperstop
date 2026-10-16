# mobile-P4-L1-T7: Sheet
Status: done
## Doing
Task 7 done: Sheet green, boxes 7.1 to 7.3 ticked.
## Found
- Sheet is a React Native `Modal` (Decision 8): `transparent`, `animationType="slide"`, `visible={open}`, `onRequestClose={onClose}` (Android back, Escape on the web export).
- The Modal's `onRequestClose` is reached in the test by walking up from the title to the instance that has the prop and calling it. `fireEvent(text, 'requestClose')` bubbles with a warning, and `UNSAFE_getByType` is gone in RNTL 14. Also, the jest-expo mock Modal is not the imported `Modal` type, so a type check would not find it.
- Test presses are `await`ed; un-awaited presses in the same test caused "overlapping act()" warnings.
## Requests
(none)
## Blockers
(none)

## Red (7.1)

First red, `npx jest --ci src/ui/sheet` with only `src/ui/sheet.test.tsx` committed (commit `test: sheet shows title, closes by close, backdrop and modal request`):

```
FAIL src/ui/sheet.test.tsx
  ● Test suite failed to run

    Cannot find module './sheet' from 'src/ui/sheet.test.tsx'
Test Suites: 1 failed, 1 total
```

Refined before green (commit `test: sheet closes through the Modal handler without act warnings`): the same file with the component moved aside gives the same module-not-found failure (`Test Suites: 1 failed, 1 total`, `Tests: 0 total`), so the red still stands for the final test file.

## Green (7.2, 7.3)

`src/ui/sheet.tsx`: `Sheet({ open, title, onClose, children })`. Modal, a full-screen backdrop `Pressable` named "Close sheet" (`ink`, opacity 0.5), a `KeyboardAvoidingView` (`padding` on iOS), the panel in a `SafeAreaView edges={['bottom']}` (`surface`, top radius `card`, `shadows.sheet.boxShadow`, padding 8 16, bottom 28 plus the safe area), `accessibilityViewIsModal`; header row with the title (`Text` `h2`, `heading={2}`) and `IconButton` "Close" (`X`).

Deviation, small: the panel's safe-area bottom uses `SafeAreaView` from `react-native-safe-area-context` (already in `apps/mobile/package.json`, no new dependency), not the `useSafeAreaInsets` hook, which needs a provider and would make a bare `render(<Sheet>)` throw.

Tests: `sheet shows its title and content`, `sheet closed`, `sheet closed title is hidden` (3 of 3 pass, no act warnings).

Gates, run in the worktree (last lines):

```
npm run build --workspace packages/ui                 exit 0
npm run lint --workspace apps/mobile                  exit 0
npm run typecheck --workspace apps/mobile             tsc exit 0
npm run test --workspace apps/mobile -- --run         49 of 49 tests pass in 10 suites; suite src/shell.test.tsx FAILS (task 10 WIP, uncommitted, another worker's file); exit 1
npm run build --workspace apps/mobile                 Exported: dist (57 s)
openspec validate mobile-foundation-accounts --strict Change 'mobile-foundation-accounts' is valid
```

Not mine: `src/shell.test.tsx` (T10 uncommitted), `src/app/_layout.tsx`, `src/app/(tabs)/`, `src/app/+not-found.tsx` belong to the T10 worker and are not in this commit.

`tasks.md`: task 7 boxes 7.1, 7.2, 7.3 ticked; the diff holds only those three lines.
