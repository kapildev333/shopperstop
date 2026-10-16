# mobile-P4-L1-T12 - Edit profile sheet (mobile-foundation-accounts, task 12)
Status: done
## Doing
Task 12 done on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit, a `test:` commit that awaits the field changes, then the `feat:` commit with `profile-sheet.tsx` and boxes 12.1 to 12.3 ticked. Nothing pushed.
## Found
- Red (12.1), `npx jest --ci src/profile-sheet.test.tsx` before the module existed:
  ```
  FAIL src/profile-sheet.test.tsx
    ● Test suite failed to run
      Cannot find module './profile-sheet' from 'src/profile-sheet.test.tsx'
  Test Suites: 1 failed, 1 total
  Tests:       0 total
  ```
- The first version of the test did not await `fireEvent.changeText`; the phone never reached the form (body sent `"phone": ""`) and the overlapping act warnings appeared. Fixed in its own `test:` commit (the same test file, awaits only). Same lesson as T7: await every event.
- Green (12.2): `Tests: 3 passed, 3 total` for `profile saved`, `bad phone from the envelope`, `empty name checked`.
- Gates (12.3), last lines:
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 0.
  - `npm run typecheck --workspace apps/mobile` exit 2, not in my files: `src/auth-forms.test.tsx(124,38): Property 'toHavePathname' does not exist` (T11 uncommitted), and `src/address-sheet.test.tsx(2,30): Cannot find module './address-sheet'` (T13 uncommitted). No `profile-sheet` line.
  - `npm run test --workspace apps/mobile -- --run`: `Test Suites: 2 failed, 12 passed, 14 total`, `Tests: 56 passed, 56 total`. The two failed suites are `src/shell.test.tsx` (T10) and `src/auth-forms.test.tsx` (T11), both uncommitted in other workers' scope. `src/profile-sheet.test.tsx` passes.
  - `npm run build --workspace apps/mobile` exit 0, `Exported: dist`.
  - `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`.
## Choices (small, within the design)
- `ProfileSheet` renders the form only while `open`, so each opening is prefilled from the current `customer` with no reset effect. The slide-out animation shows no field content; accepted.
- Name is trimmed and checked; the phone is trimmed and sent as `""` when empty, which core takes as "clear the phone" (openapi `PATCH /me`). Only changed-by-form fields are not diffed: both always go, as the spec body shows.
- Request goes through `call` from `api.ts` (the same wrapper `auth.ts` uses), so a network failure becomes the `unreachable` error and shows in the alert.
- Errors: `field` `name` or `phone` shows under that field through `FormField`'s `error`; anything else (or no field) shows in an `accessibilityRole="alert"` text above Save. The sheet stays open on every error.
- Success: the `['me', getToken()]` cache entry is replaced with core's answer, then `onClose()`.
- Save is `Button size="lg"` with `loading` while the request is in flight, which also blocks a second submit.
## Deviations
- The non-field alert is an inline `Text` with `accessibilityRole="alert"`, not a shared alert component: `packages/ui` and `src/ui` have no alert primitive yet, and T11's `auth-forms.tsx` may build one. If it does, the account screen (T14) can swap this line to it; not done here, outside scope.
- The form gap is a local `StyleSheet` `gap` of `spacing.unit * 3` (12), a layout value from the token module; no new token.
## Requests
(none)
## Blockers
(none)
