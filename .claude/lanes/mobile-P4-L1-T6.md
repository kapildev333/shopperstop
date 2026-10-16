# mobile-P4-L1-T6 - FormField (mobile-foundation-accounts, task 6)
Status: done
## Doing
Task 6 done on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit (six tests in `form-field.test.tsx`), then the `feat:` commit with `form-field.tsx` and the boxes 6.1 to 6.3 ticked. Nothing pushed.
## Found
- Red (6.1), `npx jest --ci src/ui/form-field.test.tsx` before the module existed:
  ```
  FAIL src/ui/form-field.test.tsx
    Test suite failed to run
    Cannot find module './form-field' from 'src/ui/form-field.test.tsx'
  Test Suites: 1 failed, 1 total
  Tests:       0 total
  ```
- Green (6.2): the same file, `Tests: 6 passed, 6 total`.
- Gates (6.3), last lines:
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 1, not in my files: `src/ui/button.test.tsx` 6:15 `'_props' is defined but never used` (another worker's uncommitted file). `npx eslint src/ui/form-field.tsx src/ui/form-field.test.tsx` exit 0.
  - `npm run typecheck --workspace apps/mobile` exit 2, not in my files: `src/ui/states.test.tsx(4,26): Cannot find module './skeleton'` (task 9 in progress). No `form-field` line in the output.
  - `npm run test --workspace apps/mobile -- --run`: `Test Suites: 2 failed, 7 passed, 9 total`, `Tests: 36 passed, 36 total`. The two failed suites are `src/auth.test.ts` (task 3 in progress) and `src/ui/states.test.tsx` (task 9 in progress), both outside my scope; `form-field.test.tsx` passes.
  - `npm run build --workspace apps/mobile` exit 0, `Exported: dist`.
  - `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`.
- `tasks.md` carried another worker's uncommitted ticks on task 8. The task 6 commit stages the task 6 lines against HEAD only (`git update-index`), so the task 8 ticks stay in the working tree for their own worker.
## Deviations and choices (for the team lead)
- Frame testID: the design names no test handle for the bordered frame. `form-field.tsx` sets `testID="form-field-frame"` on the frame View so the border (`danger` on error) and the trailing slot can be checked. One field per test is assumed; a second field on the same screen would need a caller-given id. Flagged, not decided.
- Label weight: the label is `Text variant="body"` with `fontFamily(600)` overridden in its style, since the type scale has no body-600 variant (`button` is 14/20 600 but is the wrong role). A ceiling, not a new token.
- `(optional)` is a sibling `Text` in a row with a 4 px gap, not nested in the label, so `getByText('(optional)')` finds it.
- Hint and error share one `Text` below the frame; the input's `accessibilityHint` is `error ?? hint` (the hint also reaches VoiceOver when no error is shown).
- Trailing node is a caller-supplied `ReactNode`, not an `IconButton`: the test uses a plain `Pressable` with a label, as the brief allows, so task 6 does not import task 5's file.
- Props are `TextInputProps` minus `style` (`Omit`), so the field's look cannot be overridden by callers; everything else passes through to `TextInput`.
- No new dependency. Literal `6` (margins) and `12` / `16` (sizes) are not colours and are not from the token module, because the token module has no 6 or 12 spacing: `spacing.unit` is 4 and `gridGap` 12. `paddingHorizontal: 12` could read `spacing.gridGap`; left literal, a cleanup if the team wants token names only.
