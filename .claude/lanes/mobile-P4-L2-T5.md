# mobile-P4-L2-T5 - L1 primitive leftovers (mobile-serviceability-catalog task 5)
Status: done
## Doing
5.3 gates green. Task 5 done.
## Found
- Red run `cd apps/mobile && npx jest --ci src/ui/states.test.tsx src/ui/form-field.test.tsx` -> Tests: 4 failed, 11 passed. Failing: `skeleton tiles` (no aspectRatio on blocks), `try again is a button` (accessibilityState undefined, Pressable not Button), `empty state level` (aria-level 2, no level prop), `tabular input` (no fontVariant).
- RNTL 14.1 has no `level` option on getByRole (silently ignored), so the level test asserts the `aria-level` prop.
- jest.config.js: `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')` throws ERR_PACKAGE_PATH_NOT_EXPORTED (lucide's exports map blocks the subpath). Using `require.resolve('lucide-react-native')`, which resolves to the same CJS file under Node's require condition.
- Gates (final): ui build, lint, typecheck clean; `npm run test --workspace apps/mobile -- --run` 30/30 suites, 116/116 tests, 7/7 script tests; mobile build exported dist; `openspec validate mobile-serviceability-catalog --strict` valid.
- Gap-check: ErrorBanner gap 10 and text gap 2 became gridGap 12 and unit 4 (spacing.unit multiples per the brief); the retry Button's pressed state is accentHover (Button's own).
## Requests
## Blockers
