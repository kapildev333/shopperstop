# mobile-P4-L1-T13 - Address sheet (mobile-foundation-accounts, task 13)
Status: done
## Doing
Task 13 done on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit (`src/address-sheet.test.tsx`, four scenarios), then `feat:` with `addresses.ts`, `address-sheet.tsx` and boxes 13.1 to 13.3 ticked. Nothing pushed. `setDefaultAddress` and `deleteAddress` not added (T14).
## Found
- Red (13.1), `npm run test --workspace apps/mobile -- --run src/address-sheet.test.tsx` before the modules existed:
  ```
  FAIL src/address-sheet.test.tsx
    Test suite failed to run
      Cannot find module './address-sheet' from 'src/address-sheet.test.tsx'
  Test Suites: 1 failed, 1 total
  Tests:       0 total
  ```
- Green (13.2): `src/address-sheet.test.tsx` 4 of 4 pass (`address added`, `edit sheet prefilled`, `address sheet checks fields`, `envelope field error in the sheet`), no act or console warnings.
- `addresses.ts` exports `Address`, `AddressValues` (`label`, `line1`, `line2`, `pincode`, `isDefault`), `useAddresses()` (key `['addresses', token]`, throws `error.error`, returns `items`) and `saveAddress(id | undefined, values)` (POST without `line2` when empty, PATCH with `line2` as sent, invalidates `['addresses']` on success). Imports `unreachable` from `api.ts`.
- `address-sheet.tsx` exports `AddressSheet({ open, address?, onClose })`. The form mounts only while `open`, so each open starts from the address or the defaults (label Home, default off).
- Gates (13.3), last lines, this worktree:
  - `npm run build --workspace packages/ui` exit 0.
  - `npm run lint --workspace apps/mobile` exit 0.
  - `npm run typecheck --workspace apps/mobile` exit 2, not in my files: `src/auth-forms.test.tsx` (T11, uncommitted, missing `./app/sign-in`, `./app/register`, `toHavePathname`). `npx tsc -p tsconfig.json | grep -i address` finds nothing.
  - `npm run test --workspace apps/mobile -- --run`: `Test Suites: 2 failed, 12 passed, 14 total`, `Tests: 56 passed, 56 total`. The two failed suites are `src/auth-forms.test.tsx` (T11) and `src/shell.test.tsx` (T10), both uncommitted in the shared worktree. `address-sheet.test.tsx` passes.
  - `npm run build --workspace apps/mobile` exit 0, `Exported: dist`.
  - `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`.
## Deviations and choices (for the team lead)
- Local `splitError` in `address-sheet.tsx`, not shared. Web's `splitError` is not in mobile `api.ts`, and the spec puts a `splitError` in `auth-forms.tsx` (T11). The two copies should fold into one helper once T11 lands (team lead to decide where it lives; not moved here, scope is this task's files).
- Alert in the sheet is an inline `View accessible accessibilityRole="alert"` (dangerSoft, radius control, padding 12), not a shared component: no shared alert exists yet. Fold into the shared alert when T11 or a later lane makes one.
- The Switch's accessible name is the Switch's `accessibilityLabel`; the sentence beside it is a plain `Text`, not a pressable label.
- The pincode `FormField` cannot take the tabular-numbers style: `FormField` omits `style` (T6 decision). Design section 12 asks for tabular numbers on the pincode; not met here. Needs a `FormField` change (outside this scope) or a caller-given style prop.
- Sheet body gap is the literal `14` (design section 12 says gap 14; the token module has no 14). Ceiling: literal, not a token.
- Validation: the pincode check is `/^\d{6}$/` as web does, not core's `^[1-9]`; a leading 0 comes back as the envelope's `pincode` field error, shown under the field.
- Edit of the default address: turning the switch off sends `isDefault: false` in the PATCH; core decides what that means.
## Requests
- to mobile-P4-L1 (team lead): decide where `splitError` lives (see Deviations); tabular numbers on the pincode field needs a `FormField` style decision.
## Blockers
None.
