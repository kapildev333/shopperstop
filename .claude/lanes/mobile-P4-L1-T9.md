# mobile-P4-L1-T9: EmptyState, ErrorBanner, Skeleton (mobile-foundation-accounts, task 9)
Status: done
## Doing
Task 9 done on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit (`src/ui/states.test.tsx`, five tests), then the `feat:` commit with `empty-state.tsx`, `error-banner.tsx` (with `errorKind`), `skeleton.tsx` and boxes 9.1 to 9.3 ticked. Nothing pushed.
## Found
- Red (9.1), `npm run test --workspace apps/mobile -- --run` (the test file alone, before the components existed):
  ```
  FAIL src/ui/states.test.tsx
    ● Test suite failed to run
      Cannot find module './empty-state' from 'src/ui/states.test.tsx'
  Test Suites: 1 failed, 1 total
  Tests:       0 total
  ```
- Green (9.2): `src/ui/states.test.tsx` 5 of 5 pass. Two first-run failures were fixed in the components, not the test: RNTL's `getByRole('alert')` needs an `accessible` element (added to the banner's root View, which also reads the banner as one announcement); `getAllByTestId('skeleton-block')` does not find blocks hidden by `accessibilityElementsHidden` (dropped from the blocks; an empty unlabelled View is not announced anyway).
- Gates (9.3):
  ```
  npm run build --workspace packages/ui                 exit 0
  npm run lint --workspace apps/mobile                  eslint . no output (exit 0)
  npm run typecheck --workspace apps/mobile            tsc exit 0, no output
  npm run test --workspace apps/mobile -- --run         Test Suites: 9 passed, 9 total; Tests: 46 passed, 46 total
  npm run build --workspace apps/mobile                 Exported: dist
  openspec validate mobile-foundation-accounts --strict Change 'mobile-foundation-accounts' is valid
  ```
- `errorKind(error)`: `'server'` when the error is an object with a string `code` (core's envelope), otherwise `'offline'` (a thrown `TypeError` from a refused network).
- Components: `EmptyState({ title, description?, icon?, action? })` (title `h2` with `heading={2}`); `ErrorBanner({ error, onRetry })` (alert, copy per `errorKind`, "Try again" as a plain `Pressable` of 44 px minimum height on `accent`); `Skeleton({ count = 1 })` (accessible column labelled "Loading", `count` blocks of 64 px on `line`, radius `card`). Tokens come only from `./tokens`; no hex value.
- tasks.md: the index staged only task 9's three boxes. The working tree also holds another worker's uncommitted ticks for task 5, which this lane did not commit.
## Deviations and choices (for the team lead)
- Icon dropped. Design (docs/design/mobile-P4-L1.md, artboard 19) puts a `CircleAlert` 20 icon in the banner. Importing `lucide-react-native` under this Jest config fails: `Must use import to load ES Module: .../lucide-react-native/dist/esm/lucide-react-native.mjs`. The fix belongs in `apps/mobile/jest.config.js` (outside this brief's scope). The banner renders without the icon until someone fixes that config.
- The title in `ErrorBanner` uses `Text variant="body"` with `fontFamily(600)`, because no `Text` variant is body size at weight 600 (`button` is 14/20 600 but is a button label).
- The "Try again" button is a `Pressable`, not `Button` (`button.tsx` is still uncommitted in the worktree).
- `Skeleton` has no pulse (design Decision 6 says so).
## Requests
- to mobile-P4-L1 (team lead): `apps/mobile/jest.config.js` needs a fix so `lucide-react-native` loads under Jest (a `moduleNameMapper` to its CJS entry, or the `require` condition). Until then no test can render an icon. Affects T5 (`IconButton` takes a Lucide icon) and T8 (`Chip`/`Badge`, if they use icons).
## Blockers
None.
