# mobile-P4-L2-T5 - L1 primitive leftovers (mobile-serviceability-catalog task 5)
Status: started
## Doing
5.1 red done (155b6e5). 5.2 feat done (props, Button reuse, icon, tabular, level); refactor next: StyleSheet in error-banner, chip, skeleton; jest.config mapping.
## Found
- Red run `cd apps/mobile && npx jest --ci src/ui/states.test.tsx src/ui/form-field.test.tsx` -> Tests: 4 failed, 11 passed. Failing: `skeleton tiles` (no aspectRatio on blocks), `try again is a button` (accessibilityState undefined, Pressable not Button), `empty state level` (aria-level 2, no level prop), `tabular input` (no fontVariant).
- RNTL 14.1 has no `level` option on getByRole (silently ignored), so the level test asserts the `aria-level` prop.
- jest.config.js: `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')` throws ERR_PACKAGE_PATH_NOT_EXPORTED (lucide's exports map blocks the subpath). Using `require.resolve('lucide-react-native')`, which resolves to the same CJS file under Node's require condition.
- Full `npx jest --ci` after the feat: 29 suites pass; `status-message.test.tsx` (task 4's file) failed in that run, outside this task.
## Requests
## Blockers
