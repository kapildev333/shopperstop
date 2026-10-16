# mobile-P4-L1-T14 - Account screen (mobile-foundation-accounts, task 14)
Status: blocked
## Doing
Red `test:` committed (b52da14, six files, 13 scenarios). Green (`feat:`) stopped on a primitive gap in `ui/button.tsx`, outside this brief's scope; waiting for a decision. Nothing pushed. Boxes 14.1 to 14.3 not ticked.
## Found
- Red (14.1), full mobile suite before `app/account.tsx` exists: `Test Suites: 5 failed, 17 passed, 22 total`, `Tests: 67 passed, 67 total`. Each red suite fails at load with:
  ```
  FAIL src/account.test.tsx
    Test suite failed to run
      Cannot find module './app/account' from 'src/account.test.tsx'
  ```
  `npm run typecheck`: `TS2307: Cannot find module './app/account'` in the five account test files only.
- Scenario to file map (test names as tasks.md names them):
  | Scenario | File: test |
  |---|---|
  | Profile shown | `src/account.test.tsx`: `Profile shown` |
  | Profile saved (card half) | `src/account.test.tsx`: `Profile saved (card half)` |
  | Sign out | `src/account-sign-out.test.tsx`: `Sign out` |
  | Addresses and default | `src/account.test.tsx`: `Addresses and default` |
  | Address deleted | `src/account.test.tsx`: `Address deleted` |
  | No addresses | `src/account.test.tsx`: `No addresses` |
  | Signed-out account redirect | `src/account-redirect.test.tsx`: `Signed-out account redirect` |
  | Sign in returns to the account | `src/account-sign-in.test.tsx`: `Sign in returns to the account` |
  | Account button opens the account | `src/account-home.test.tsx`: `Account button opens the account` |
  | Loading account | `src/account.test.tsx`: `Loading account` |
  | Core unreachable with nothing held | `src/account.test.tsx`: `Core unreachable with nothing held` |
  | Core failure with nothing held | `src/account.test.tsx`: `Core failure with nothing held` |
  | Failed refetch keeps the account | `src/account.test.tsx`: `Failed refetch keeps the account` |
  Non-navigating scenarios render the screen directly (no router, one render per test); the five navigating ones each sit in their own file (one `renderRouter` per file).
- Blocker, the gap: the account scenarios name buttons that `Button` (`src/ui/button.tsx`, T5) cannot produce. `Button` takes `children`, `variant`, `size`, `loading`, `disabled`, `onPress` and nothing else: no `accessibilityLabel`, no icon. The spec and design need "Edit profile" (ghost compact, visible "Edit"), "Edit <label>", "Set <label> as default", "Delete <label>" (ghost-danger) and the "Add" button named "Add address" with a `Plus` 16 icon. A wrapping `View` with a label would nest two controls; a local `Pressable` in `account.tsx` would be the one-off recipe CLAUDE.md forbids.
- Smaller items for the same decision: the profile card's `Edit` and the `Your orders` row use `Link` (expo-router) outside a navigator in the non-navigating tests; not verified yet, it may need the `renderRouter` path for those tests.
- Held cleanup (`refactor:` one splitError), verified, then reverted because the suite is not green: `address-sheet.tsx` imports `splitError` from `./auth-forms` and calls `splitError(error, fieldNames)`; its local `splitError` and the `ApiError` import go. With it, the 67 non-account tests pass and typecheck is clean outside the account files. Re-apply after the `feat:`.
- `addresses.ts` `setDefaultAddress` and `deleteAddress` are not written yet: they are only reachable through the screen, so they go in with the `feat:` that makes "Addresses and default" and "Address deleted" pass (no untested code).
- Back button in the account header: `useBack` in `auth-forms.tsx` is not exported. Planned as three inline lines in `account.tsx`, not a shared helper; say if it should be exported instead (that is T11's file).
## Deviations and choices (for the team lead)
- Red commit lists six files, not one: the brief's `account.test.tsx` plus the five navigating files it allows (`account-*.test.tsx`).
- Test name `Profile saved (card half)` follows tasks.md; the spec scenario is `Profile saved`.
## Requests
- to mobile-P4-L1 (team lead): decide the `Button` gap. Proposed: a `feat:` in this lane on `src/ui/button.tsx` (T5's file, approved by you) adding an optional `accessibilityLabel?: string` passed through to the `Pressable`, and an optional `icon?` (Lucide, 16 px in the compact and md sizes) before the label. Then the account screen composes `Button` as the design says. Alternatives: a `ui` lane task for it, or accept a one-off in `account.tsx` (not recommended). Green is blocked until this is decided.
- to mobile-P4-L1 (team lead): confirm `useBack` may be duplicated inline in `account.tsx`, or export it from `auth-forms.tsx`.
## Blockers
- Button primitive gap above (no `accessibilityLabel`, no icon). Blocks 14.2 and 14.3.
