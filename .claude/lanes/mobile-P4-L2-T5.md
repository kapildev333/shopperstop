# mobile-P4-L2-T5 - L1 primitive leftovers (mobile-serviceability-catalog task 5)
Status: started
## Doing
5.1 red done: four new tests (skeleton tiles, try again is a button, empty state level, tabular input) fail. Next: 5.2 feat.
## Found
- Red run `cd apps/mobile && npx jest --ci src/ui/states.test.tsx src/ui/form-field.test.tsx` -> Tests: 4 failed, 11 passed. Failing: `skeleton tiles` (no aspectRatio on blocks), `try again is a button` (accessibilityState undefined, Pressable not Button), `empty state level` (aria-level 2, no level prop), `tabular input` (no fontVariant).
- RNTL 14.1 has no `level` option on getByRole (silently ignored), so the level test asserts the `aria-level` prop.
## Requests
## Blockers
