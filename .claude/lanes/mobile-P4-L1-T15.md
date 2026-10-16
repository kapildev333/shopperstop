# mobile-P4-L1-T15 - End-to-end suite (mobile-foundation-accounts, task 15)
Status: done. 15.2 and 15.3 ticked; `make e2e` exit 0, mobile 4 of 4 (third pass below).
## Doing
15.1 ticked. `make e2e` run from the worktree root: exit 2. The other workspaces' suites passed in the same run (two suites, 7 and 45 tests); mobile 0 of 4. Stopped per the brief: both causes are app code. Nothing else changed, nothing pushed, no dev servers left running (ports 18080, 18081, 15173-15176 free).
## Found
- `make e2e` mobile summary (the last lines before make's error):
  ```
  Running 4 tests using 1 worker
    ✘  1 accounts.spec.ts:38 › demo customer signs in
    ✘  2 accounts.spec.ts:51 › register with a field error
    ✘  3 accounts.spec.ts:68 › addresses against core
    ✘  4 accounts.spec.ts:97 › sign out against core
  4 failed
  npm error Lifecycle script `e2e` failed ... apps/mobile
  make: *** [e2e] Error 1
  ```
  The rider seed TRUNCATE failure from the earlier run did not recur: both seeds ran cleanly.
- Failure 1 (tests 1, 2, 3, axe): `document-title` (serious, WCAG 2.4.2), node `html` (`<html lang="en">`), "Document does not have a non-empty <title> element". The static export has no `<title>` in `dist-e2e/index.html`. Nothing in `apps/mobile/app.json` sets one, and `src/app/_layout.tsx` renders the `Stack` with no `Head` or `Stack.Screen` title. The fix belongs in app code (a `<title>` via `expo-router/head` or a root-layout `Head`), in `src/app`, outside this brief. The axe rule is on app-controlled markup, not react-native-web: no rule was switched off.
- Failure 2 (test 4, sign out): after "Sign out", the URL goes to `/sign-in?returnTo=%2Faccount` instead of `/`. Cause in `src/app/account.tsx`: line 23 `if (!token) return <Redirect href="/sign-in?returnTo=%2Faccount" />`, and the sign-out handler (lines 32-33) does `router.replace('/')` then `void signOut()`. The token clears while the account route is still mounted, so the Redirect fires before the replace lands and the account route wins. The fix is in app code (for example, defer the token-null redirect until navigation finishes), so it is also outside the brief.
- Tests 1 to 3 would also need the title fix before their own assertions run. Tests 2 and 3 have not been checked past axe, so further failures may be hidden.
## Deviations and choices (for the team lead)
- Gates 15.3 not run: the brief runs them only after `make e2e` exits 0.
- No change to `src/app`, `src/`, `app.json` or `e2e/accounts.spec.ts`: each would be out of scope.
## Requests
- to mobile-P4-L1 (team lead): decide whether the title and sign-out fixes land in a T15 fix task with a brief that names `src/app/_layout.tsx` and `src/app/account.tsx`, then rerun `make e2e`.
## Blockers
- Document title missing from the web export (axe `document-title`) and the sign-out redirect race in `src/app/account.tsx`; both in app code, not this lane's scope.

## Second pass (fixes A to F, Escape check)
Branch `lane/mobile-P4-L1-foundation-accounts`, worktree `.worktrees/mobile-P4-L1`. Each fix committed after its failing test (red recorded in the commit's test run).
Commits, oldest first:
- `cf6c87e` test: every screen has a document title (e2e `toHaveTitle('Sign in · ShopperStop')`; red: title `""`)
- `a154f19` fix: every screen names itself in the document title (`expo-router/head` per screen: Sign in, Create account, My account, Home, Categories, Your orders, Page not found, each `· ShopperStop`)
- `c9e692f` fix: sign out lands on Home, not sign-in (e2e red recorded before the fix: URL `/sign-in?returnTo=%2Faccount`; Jest had passed, so the e2e scenario is the red)
- `fbb7a74`, `e44b789`, `c015b53` sheet: test, test corrected to look for the rendered scroll view (red pre-fix), fix (`ScrollView keyboardShouldPersistTaps="handled"`, `maxHeight` 80% of the window)
- `879abfd`, `5e82c2b` address row buttons (Edit, Set as default, Delete) disabled while a row action is pending; red: two requests sent
- `03e8f2b` test: enter in the password field submits sign in and register (`src/auth-forms-enter.test.tsx`, red: no message, no request)
- `03e8f2b` fix: enter in the password field submits sign in and register (`returnKeyType="go"` and `onSubmitEditing={submit}` on Password, sign in and register)
- `b0eda6a` refactor: move useBack and splitError (and the `Errors` type) to `src/screen-support.ts`
- `74ca870` test: Escape closes the address sheet on the web export (e2e step at the end of the addresses scenario, after the axe check on the open sheet). Red, see below.
- `72beaf8` test: exported pages carry the app title in the static shell (`src/html-shell.test.tsx`; red: module absent)
- `a1cdcc0` fix: exported pages carry a static title in the html shell (`src/app/+html.tsx`, `useServerDocumentContext` for head and body nodes, `<title>ShopperStop</title>`)

Found on the way, fixed in `a1cdcc0` (amended before push): the first `+html.tsx` rendered its own head and no bundle scripts, so the export did not hydrate (every e2e failed on `/account`). The supported route is `useServerDocumentContext()`; `headNodes` and `bodyNodes` are rendered. Verified: every `dist/*.html` has `<title>ShopperStop</title>`, and scripts are present.
Why the per-screen titles were not in the static HTML: the root layout returns `null` until the fonts load, so the static renderer never reaches the screens' `Head`. The client sets them after hydration, which the e2e title check sees.

### make e2e (final, from the worktree root, after `a1cdcc0`)
Exit 2. Workspace summaries from the run:
- admin: 15 passed
- mobile: 3 passed, 1 failed (`addresses against core`, line 70)
- rider: 7 passed
- web: 45 passed
Ports 18080, 18081, 15173-15176 are free afterwards. The e2e slot was held for this run.

### Stopped on: axe on react-native-web markup (the rule the brief says to stop on)
`addresses against core` fails the axe check with the Add address sheet open. Nothing is disabled. Violations (all in RN web markup the app does not control):
- `aria-allowed-attr` (critical): `<div aria-modal="true" class="css-g5y9jx r-1p0dtai ...">`, the root of RN web's `Modal`.
- `aria-required-attr` (critical): `<div role="switch" tabindex="0" class="css-g5y9jx r-1loqt21 r-lrvibr" style="height: 20px; width: 40px;">`, RN web's `Switch` (the "Make this my default address" row in `address-sheet.tsx`). No `aria-checked`.
- `nested-interactive` (serious): the same switch div contains `<input aria-label="Make this my default address" role="switch" type="checkbox">`.
- `region` (moderate): the sheet's `<h2>Add address</h2>`, the "Save as" label and the sheet's containers sit in the Modal portal, outside any landmark.
The `Switch` and `Modal` are the app's own choice of RN components, so the owner decides whether to replace the Switch (for example a `Pressable` with `accessibilityRole="switch"` and `accessibilityState`) or accept the RN web markup and scope the rule. Not decided here.

### Escape does not close the sheet (R1 finding 6 was wrong)
Probe (temporary spec, removed, not committed): Escape on the open address sheet leaves the heading in place (count 1). RN web's `Modal` does not handle Escape on the web export; `onRequestClose` is not called. The e2e step `74ca870` is the red. Fix options for the team lead: a `keydown` Escape listener in `ui/sheet.tsx` on web (needs a Jest test with `Platform.OS` set to web and a document fake), or accept the gap. Not changed here, outside the A to F brief.

### Other choices (for the team lead)
- Titles: `· ShopperStop` suffix, mirroring the brief's example. The web app's own `index.html` title is only `ShopperStop`; I did not change it.
- `src/screen-support.ts` is the shared file name for the F refactor.
- Sheet cap: 80% of the window, not 90%, so the header and keyboard fit on a small phone. Change it if the design wants 90%.
- Row buttons disabled: all three (Edit, Set as default, Delete) while any row action is pending.
- 15.2 is not ticked: `make e2e` is not exit 0. 15.3 is ticked (gates below).

### Gates (apps/mobile and root, after `a1cdcc0`)
- `npm run lint --workspace apps/mobile`: clean (`eslint .`, no output)
- `npm run typecheck --workspace apps/mobile`: clean (`tsc -p tsconfig.json`, no output)
- `npm run test --workspace apps/mobile -- --run`: Test Suites 24 passed, Tests 88 passed
- `npm run build --workspace apps/mobile`: `Exported: dist`; `dist/*.html` each carry `<title>ShopperStop</title>`
- `openspec validate --all --strict`: Totals 19 passed, 0 failed

## Requests
- to mobile-P4-L1 (team lead): decide (1) the Switch and Modal axe findings (replace the Switch, or scope the rule with a recorded reason; never disable silently), (2) the Escape close on the web export (fix in `ui/sheet.tsx` or defer). Then rerun `make e2e`; 15.2 follows.
## Blockers
- 15.2: addresses scenario (axe on RN web markup in the address sheet) and the Escape step. Stopped per the brief.

## Third pass (task 15.2: addresses against core, Escape, switch and dialog axe)
Branch `lane/mobile-P4-L1-foundation-accounts`, worktree `.worktrees/mobile-P4-L1`. Red recorded before each fix.
Commits, oldest first:
- `af42d97` test: the default address control is a switch with a checked state (`src/ui/toggle.test.tsx`, address sheet test moved to press and checked; red: module absent, sheet sends `isDefault: false`)
- `6cc2a21` fix: the default address control is a switch with a checked state (`src/ui/toggle.tsx`: Pressable, `accessibilityRole="switch"`, `accessibilityState={{ checked }}`, 44 px row, track and thumb from tokens; `address-sheet.tsx` uses it)
- `0facc02` test: the addresses scenario waits for the sheet's dialog before axe and Escape (e2e; red: axe on the open sheet, see below)
- `ecfb767` test: the sheet dialog is named by its title (`src/ui/sheet.test.tsx`; red: no accessibilityLabel on the Modal)
- `964c395` fix: the sheet dialog is named by its title (`src/ui/sheet.tsx`: `accessibilityLabel={title}` on the Modal)
- `786328c` fix: the switch exposes aria-checked on the web export (`src/ui/toggle.tsx`)

### Dialog and animation (manager's diagnosis, verified)
Confirmed in `react-native-web` 0.21.4 source: `ModalContent` sets `role="dialog"` and its Escape keyup listener only while `active`; `active` is set in `Modal`'s `onShowCallback`, which `ModalAnimation` calls from `onAnimationEnd` of the 250 ms slide. Probe (temporary spec, removed, not committed): on the open address sheet, `getByRole('dialog')` appears about 790 ms after the tap, and Escape then closes the sheet. So the dialog is not missing; it is late. The manager's Escape failure came from pressing Escape before the slide ended. The fix is the e2e waiting for the dialog before axe and Escape, a real user waiting for the slide too. No Sheet animation change: the dialog does appear, so the smallest fix is the wait.

### Switch markup (not accepted as is)
`Switch` nested an input inside `role="switch"` (`nested-interactive`) and had no `aria-checked` (`aria-required-attr`). The `Toggle` replaces it. `accessibilityState` alone does not reach the web DOM in react-native-web 0.21.4 for Pressable (it reads `aria-checked`), so `Toggle` passes both. The jest environment does not forward `aria-checked` from Pressable to the host, so no RNTL test can observe the web attribute: the red for it is the e2e axe run (`aria-required-attr` on the switch, no `aria-checked`), and the e2e is the test for it. The tests for the flip and `accessibilityState` are in `src/ui/toggle.test.tsx`.

### Dialog name
After the wait, axe reported `aria-dialog-name` (serious) on the Modal root: the dialog had no name. `accessibilityLabel={title}` on the Modal reaches the dialog root on web (`ModalProps` includes `ViewProps`). Covered by the sheet test; the e2e check is the proof.

### Deviations and choices
- `src/address-sheet.test.tsx` changed (2 lines): the switch assertions moved from `value` and `valueChange` to `accessibilityState` and `press`. It was outside the brief's list, but the switch it tests is replaced.
- `src/ui/toggle.tsx` is a new primitive in `src/ui/`, with its own test (the brief allowed it; it is cleaner than inline).
- The e2e wait is a test change, not an axe rule change. No rule is disabled or scoped.
- No new dependencies. No change to `src/app`, `app.json` or `playwright.config.ts`.
- A stray `apps/mobile/services/` tree (empty dirs from a bad `FILES_DIR` in my shell env) was created and removed; not committed.

### make e2e (from the worktree root, after `786328c`)
Exit 0. Per workspace from the run:
- admin: 15 passed
- mobile: 4 passed (`demo customer signs in`, `register with a field error`, `addresses against core`, `sign out against core`)
- rider: 7 passed
- web: 45 passed
Ports 18080, 18081, 15173-15176 free afterwards.

### Gates (apps/mobile and root, after `786328c`)
- `npm run lint --workspace apps/mobile`: exit 0
- `npm run typecheck --workspace apps/mobile`: exit 0
- `npm run test --workspace apps/mobile -- --run`: Test Suites 25 passed, Tests 91 passed
- `npm run build --workspace apps/mobile`: exit 0, `Exported: dist`
- `openspec validate --all --strict`: Totals 19 passed, 0 failed

## Requests
- to mobile-P4-L1 (team lead): 15.2 is ticked; ready for 16.1 (`/opsx:verify`) and 16.2 (manager walk).
## Blockers
- none
