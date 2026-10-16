# mobile-P4-L1-T7: Sheet
Status: doing
## Doing
Task 7 (Sheet): red tests committed first, then the component.
## Found
- Sheet is a React Native `Modal` (Decision 8); `onRequestClose` is the Escape, Android back and platform close path.
## Requests
(none)
## Blockers
(none)

## Red (7.1)

`npx jest --ci src/ui/sheet` with only `src/ui/sheet.test.tsx` committed (tests: `sheet shows its title and content`, `sheet closed`, plus `sheet closed title is hidden` for the closed case):

```
FAIL src/ui/sheet.test.tsx
  ● Test suite failed to run

    Cannot find module './sheet' from 'src/ui/sheet.test.tsx'
Test Suites: 1 failed, 1 total
```
