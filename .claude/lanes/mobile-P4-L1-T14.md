# mobile-P4-L1-T14 - Account screen (mobile-foundation-accounts, task 14)
Status: done (open item: a jest open handle in `account.test.tsx`, see Found)
## Doing
Done on `lane/mobile-P4-L1-foundation-accounts`, nothing pushed. Commits, in order: `b52da14` test (account red, 13 scenarios), `54b9110` test (button red), `e883839` feat (Button `accessibilityLabel` and `icon`), `159c4ac` feat (account screen, `setDefaultAddress`, `deleteAddress`, `useBack` exported, boxes 14.1 to 14.3 ticked), `16f211c` refactor (one `splitError`). Team lead's decisions applied: Button approved in this lane, `useBack` exported, Link kept (see Found).
## Found
- Red (14.1): full mobile suite before `app/account.tsx` exists: `Test Suites: 5 failed, 17 passed, 22 total`, `Tests: 67 passed, 67 total`; each red suite fails at load with `Cannot find module './app/account' from 'src/account.test.tsx'`. Button red (54b9110): `Received: <View accessibilityRole="button" ...><Text ...>Edit</Text></View>` for `queryByRole('button', { name: 'Edit' })`, which must be null once `accessibilityLabel` names the button.
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
- Non-navigating tests render the screen with `QueryClientProvider` (the root layout supplies it in the app). Navigating tests use the real `src/app` directory with the `shell.test.tsx` font mock, so the root layout provides the query client; one `renderRouter` per file.
- Choice (team lead's point 3): `Link` kept for "Your orders". It renders outside a navigator (the non-navigating tests pass); no press test of it. `router.push` not needed.
- `useMe` is not in `api.ts`, though task 3.2 says it stays there, and nothing in `src` defines it. Defined in `account.tsx` (its only reader). Move it to `api.ts` if a second screen needs it; this is a placement question for the team lead.
- Button additions: `accessibilityLabel` overrides the name from the visible text; `icon` (`ComponentType<{ size?, color? }>`) renders 16 px in the label tone before the text. The icon test uses a probe component, not Lucide, to read the props Button gives it.
- Back in the account header: `useBack` exported from `auth-forms.tsx` (team lead's point 2), imported in `account.tsx`.
- Gates on `16f211c` (last lines): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile -- --run`: `Test Suites: 22 passed, 22 total`, `Tests: 82 passed, 82 total`, exit 0; `npm run build --workspace apps/mobile`: `Exported: dist`, exit 0, `apps/mobile/dist/account.html` present; `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`; `make test-web`: exit 0 (mobile 82 tests inside; web 295 and 153 in the other workspaces).
- Open item, not fixed: jest reports an open `Timeout` handle from `account.test.tsx`. Isolated runs: `Loading account` alone has none; `Core unreachable with nothing held` alone passes and then keeps jest from exiting ("did not exit one second after the test run"). Navigating account files show none. The suites still pass and exit 0, and `make test-web` exits 0; the jest worker warning ("failed to exit gracefully") appears in the mobile run. Diagnosis not finished: likely a timer left by the banner's refetch path. Owner: this lane's reviewer or the next task.
## Deviations and choices (for the team lead)
- Red commit spans six files: the brief's `account.test.tsx` plus the five navigating files it allows.
- The `feat:` commit also changed the red test files: the `QueryClientProvider` wrapper for non-navigating renders, and the real `app` directory for navigating renders (both needed to run the screen, see Found). The red run was recorded before those changes.
- The `button.test.tsx` icon test was rewritten in the `feat:` (its red version queried the icon through `screen.UNSAFE_getAllByType`, which RNTL 14 does not provide), so the red commit's icon test was a test bug, not the feature.
- Header Back uses `useBack` (exported), so no duplicate. Sign out does `router.replace('/')` then `signOut()`, as the spec says.
- Address row errors (set default, delete) show one `alert` line at the top of the addresses card, as web does; the spec does not name the copy.
## Requests
- to mobile-P4-L1 (team lead): decide where `useMe` lives (see Found); the open jest handle needs an owner.
## Blockers
None.
