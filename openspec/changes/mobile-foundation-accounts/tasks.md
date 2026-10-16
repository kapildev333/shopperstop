Every task runs in `.worktrees/mobile-P4-L1` on branch `lane/mobile-P4-L1-foundation-accounts`, after `export PATH=$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH`. Read first: this change's `specs/mobile-app/spec.md` (the scenarios named), `design.md` (Decisions 5 to 12 are binding, Decision 7 above all: tokens only from `@shopperstop/ui/tokens`, never a hex value, never the root `@shopperstop/ui`), and `docs/design/mobile-P4-L1.md` (layout, copy, token names, interfaces). The worker logs in `.claude/lanes/mobile-P4-L1-T<n>.md`, never runs `make db`, `make dev`, `make prod-local` or docker, never pushes, and stops and reports on any design choice this change does not settle, on any dependency not in design.md Decision 2, and on any file outside its scope.

Commits per task: `test: <scenario or behaviour>` with the failing test (its failure pasted into the log), then `feat: <what>`; a refactor with the suite green may follow. Tick this file's boxes in the `feat:` commit.

Gates for every task (paste the last lines into the log):

```
npm run build --workspace packages/ui
npm run lint --workspace apps/mobile
npm run typecheck --workspace apps/mobile
npm run test --workspace apps/mobile -- --run
npm run build --workspace apps/mobile
openspec validate mobile-foundation-accounts --strict
```

Order: 1, then 2 and 4 in parallel; 3 after 2; 5, 6, 8 and 9 in parallel after 4; 7 after 5; 10 after 5 and 9; 11 after 3, 5 and 6; 12 after 3, 6 and 7; 13 after 3, 6, 7 and 8; 14 after 10 to 13; 15 after 14. Parallel tasks touch disjoint files.

## 1. Workspace scaffold

Scope: `apps/mobile/{package.json,app.json,tsconfig.json,eslint.config.js,jest.config.js,jest.setup.ts,.gitignore}`, `apps/mobile/src/env.d.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx` (a bare `Text` "ShopperStop"; task 10 replaces it), `apps/mobile/src/no-literal-colors.test.ts`, root `package-lock.json` (mechanical, from `npm install`).
Scenarios: Root test arguments ignored, Web export built, No literal colours in the app.
Starts from: `src/no-literal-colors.test.ts`: `no literal colours in src` (`findLiteralColors` from `@shopperstop/ui/testing` over `src`, expects `[]`) and `scanner finds literal colours` (the local quoted-colour-name regex plus `matchLiteralColors` find `#fff`, `rgba(0,0,0,0.5)` and `'white'` in a sample string); red until the workspace and the regex exist.

- [x] 1.1 `package.json` (`@shopperstop/mobile`, private, `main: "expo-router/entry"`, no `"type"`), the exact versions of design.md Decision 2 (no async-storage), scripts of Decision 4 without `e2e`; `npm install` from the repository root
- [x] 1.2 `app.json` per Decision 3; `tsconfig.json` extends `expo/tsconfig.base`, `strict`, includes `src`, `e2e`, `*.ts`, `types: ["jest", "node"]` as needed; `eslint.config.js` per Decision 11 ignoring `dist`, `dist-e2e`, `.expo`; `.gitignore` `.expo/`, `dist/`, `dist-e2e/`, `test-results/`, `playwright-report/`, `expo-env.d.ts`
- [x] 1.3 `jest.config.js` and `jest.setup.ts` per Decision 12 (fetch throws `TypeError('Network request failed')`, in-memory `expo-secure-store` fake with `getItem`, `setItem`, `deleteItemAsync`, cleared after each test)
- [x] 1.4 Red, then green: the two tests; `npm run test --workspace apps/mobile -- --run` exits 0 (arguments ignored); `npm run build --workspace apps/mobile` exits 0 and `ls apps/mobile/dist` shows `index.html`; record the build time in the log; if the export cannot resolve a hoisted package, add Expo's monorepo `metro.config.js` and say so
- [x] 1.5 `make test-web` exits 0; `git status --short` shows only the scope files

## 2. Session and core client

Scope: `apps/mobile/src/{session.ts,api.ts,fake-core.ts,session.test.ts,api.test.ts}`, `apps/mobile/jest.setup.ts` (reset `setToken(undefined)` and `queryClient.clear()` after each test).
Scenarios: Mobile session token (3), Mobile lost session (3), Mobile failed answers without the error envelope (7), Mobile client reaches core (1).
Starts from: `src/session.test.ts`: `token persisted and cleared`, `token restored on load` (set the fake store, then `jest.isolateModules` to load `session.ts`); `src/api.test.ts`: `default core URL`, `bearer attached`, `401 to the current token`, `401 without a token keeps a new session`, `401 to a replaced token keeps the new session`, `empty failed answer becomes internal`, `HTML failed answer becomes internal`, `enveloped failure passes through`, `bare 401 ends the session and becomes internal`, `no content answer untouched`, `failed write reports an error`, `unreachable core reports an error`. All through `api` and `fakeCore` (the fake `fetch` is the boundary), as `apps/web/src/api.test.ts` and `apps/admin/src/api.ts` do.

- [x] 2.1 Red: the two test files fail (modules absent)
- [x] 2.2 `session.ts` per Decision 5 (`Platform.OS === 'web'` uses `localStorage`; else `SecureStore.getItem`/`setItem`, `deleteItemAsync` to clear; all in `try`/`catch`); `api.ts` per Decision 5 and the interfaces in `docs/design/mobile-P4-L1.md`; `fake-core.ts` per Decision 12
- [x] 2.3 Gates green

## 3. Sign in, register, sign out

Scope: `apps/mobile/src/{auth.ts,auth.test.ts}`.
Scenarios: Unsafe returnTo ignored; supports Mobile return after sign-in and Mobile account screen (sign out).
Starts from: `src/auth.test.ts`: `unsafe returnTo ignored`, `sign in stores the token and the customer` (fake 200 session: `getToken()` is the token, `queryClient.getQueryData(['me', token])` is the customer), `sign in failure returns the error` (fake 401 envelope: resolves to it, no token), `register stores the token`, `sign out ends the session` (fake 204: `POST /auth/sign-out` sent with the bearer, no token, cache empty).

- [x] 3.1 Red
- [x] 3.2 `auth.ts` per Decision 5 (web's `auth.ts` without the cart merge and `signOutAndGoHome`); `useMe` stays in `api.ts`
- [x] 3.3 Gates green

## 4. Tokens and Text

Scope: `apps/mobile/src/ui/{tokens.ts,text.tsx,text.test.tsx}`.
Behaviour: Decision 6 (Text) and Decision 7 (tokens).
Starts from: `src/ui/text.test.tsx`: `body text by default` (style `fontFamily` `Inter_400Regular`, `fontSize` 14, `lineHeight` 20, `color` `colors.ink`), `variant picks the family by weight` (`display` gives `Inter_700Bold` 28/34; `h3` `Inter_600SemiBold`), `tone` (`inkMuted`, `danger`, `accent`, `onBrand`, `onAccent`), `heading is announced` (`heading={1}` is found by `getByRole('heading', { name })`), `tabular numbers` (`fontVariant` `['tabular-nums']`).

- [x] 4.1 Red
- [x] 4.2 `tokens.ts` re-exports `colors, radius, spacing, type, motion, shadows` from `@shopperstop/ui/tokens` and adds `fontFamily(weight: 400 | 600 | 700)`; `text.tsx` per Decision 6 (`role="heading"`, `aria-level` through the one cast)
- [x] 4.3 Gates green

## 5. Button and IconButton

Scope: `apps/mobile/src/ui/{button.tsx,button.test.tsx}`.
Starts from: `src/ui/button.test.tsx`: `button presses` (role button, label text, `onPress` once), `disabled button does not press` (`accessibilityState.disabled`), `loading button is busy and disabled`, `variants use tokens` (primary background `colors.accent` and text `colors.onAccent`; secondary border `colors.lineStrong`; danger text `colors.danger`; ghost text `colors.accent`), `sizes` (md min height 44, lg 48), `icon button needs a label` (found by `getByRole('button', { name: 'Close' })`, hit area 44 × 44).

- [x] 5.1 Red
- [x] 5.2 `Button` and `IconButton` per Decision 6 and the shared-pieces table of `docs/design/mobile-P4-L1.md` (`Pressable`, `accessibilityRole="button"`, Lucide icon prop for `IconButton`)
- [x] 5.3 Gates green

## 6. FormField

Scope: `apps/mobile/src/ui/{form-field.tsx,form-field.test.tsx}`.
Starts from: `src/ui/form-field.test.tsx`: `input named by its label` (`getByLabelText('Email')`), `hint shown`, `error replaces the hint` (error text shown, hint gone, input `accessibilityHint` is the error, border `colors.danger`), `optional suffix` ("(optional)" after the label), `trailing slot` (a trailing `IconButton`-like node renders inside the frame), `typing calls onChangeText`.

- [x] 6.1 Red
- [x] 6.2 `FormField` (label, `TextInput` props passed through, `hint`, `error`, `optional`, `trailing`)
- [x] 6.3 Gates green

## 7. Sheet

Scope: `apps/mobile/src/ui/{sheet.tsx,sheet.test.tsx}`.
Scenario: Sheet closed.
Starts from: `src/ui/sheet.test.tsx`: `sheet shows its title and content` (title as header, children rendered), `sheet closed` (choosing "Close", choosing the backdrop "Close sheet", and the `Modal`'s `onRequestClose` each call `onClose`; with `open` false the title is not shown).

- [x] 7.1 Red
- [x] 7.2 `Sheet({ open, title, onClose, children })` per Decision 8 and the Sheet section of `docs/design/mobile-P4-L1.md`
- [x] 7.3 Gates green

## 8. Badge, Chip, Card

Scope: `apps/mobile/src/ui/{badge.tsx,chip.tsx,card.tsx,marks.test.tsx}`.
Starts from: `src/ui/marks.test.tsx`: `badge shows its text` (variant `accent` background `colors.accentSoft`), `chip selected state` (`accessibilityState.selected` true, border `colors.accent`; unselected border `colors.lineStrong`; `onPress` once), `chip tap target` (min height 44). `Card` has no test (Decision 6).

- [x] 8.1 Red
- [x] 8.2 The three components (Badge variants neutral, success, warning, danger, accent, as web)
- [x] 8.3 Gates green

## 9. EmptyState, ErrorBanner, Skeleton

Scope: `apps/mobile/src/ui/{empty-state.tsx,error-banner.tsx,skeleton.tsx,states.test.tsx}`.
Supports: Mobile screens keep data when a refetch fails.
Starts from: `src/ui/states.test.tsx`: `empty state` (title as header, description, action), `offline error` (`new TypeError('Network request failed')`: alert with "You're offline" and "Check your connection and try again."), `server error` (`{ code: 'internal', message: 'x' }`: "Something went wrong on our side" and "Please try again in a moment."), `try again` (choosing "Try again" calls `onRetry`), `skeleton labelled loading` (`getByLabelText('Loading')`, `count` blocks).

- [x] 9.1 Red
- [x] 9.2 The three components and `errorKind` per `docs/design/mobile-P4-L1.md`
- [x] 9.3 Gates green

## 10. Shell: root layout, tabs, Home, not found

Scope: `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/app/index.tsx` (deleted), `apps/mobile/src/app/(tabs)/{_layout.tsx,index.tsx,categories.tsx,orders.tsx}`, `apps/mobile/src/app/+not-found.tsx`, `apps/mobile/src/shell.test.tsx`.
Scenarios: Home in the tabs, Tab switch, Unknown path.
Starts from: `src/shell.test.tsx` with `renderRouter` (Decision 12): `home in the tabs`, `tab switch`, `unknown path`.

- [ ] 10.1 Red
- [ ] 10.2 Root layout: `useFonts` (Inter 400, 600, 700), render nothing until loaded, `QueryClientProvider` with `queryClient`, `SafeAreaProvider`, `Stack` without headers; tabs per the Tab bar section; Home, Categories, Orders and not found per `docs/design/mobile-P4-L1.md`; each screen's root `View` has `role="main"`
- [ ] 10.3 Gates green; `ls apps/mobile/dist` shows `index.html`, `categories.html`, `orders.html`

## 11. Sign-in and register screens

Scope: `apps/mobile/src/{auth-forms.tsx,auth-forms.test.tsx}`, `apps/mobile/src/app/{sign-in.tsx,register.tsx}`.
Scenarios: Sign-in screen, Password shown on request, Required fields checked, Short password on register, Field error from the envelope, Non-field error in an alert, Register lands on Home.
Starts from: `src/auth-forms.test.tsx`, the scenario names; `renderRouter` with `sign-in`, `register` and a one-line `index` route; `fakeCore` for the answers; "no request is sent" asserts the `fakeCore` call list is empty. Password bytes by `new TextEncoder().encode(p).length`.

- [ ] 11.1 Red
- [ ] 11.2 `auth-forms.tsx` (both forms, checks, `splitError`, alert) and the two route files per sections 9 and 10 of `docs/design/mobile-P4-L1.md`; on success `router.replace(safeReturnTo(returnTo))`; Back calls `router.back()` when it can, else `router.replace('/')`
- [ ] 11.3 Gates green; `dist` holds `sign-in.html` and `register.html`

## 12. Edit profile sheet

Scope: `apps/mobile/src/{profile-sheet.tsx,profile-sheet.test.tsx}`.
Scenarios: Mobile edit profile sheet (Profile saved: the sheet half; Bad phone from the envelope); the empty-name check.
Starts from: `src/profile-sheet.test.tsx`: `profile saved` (`PATCH /me` body `{"name":"Asha Rao","phone":"9876543210"}`, `onClose` called, `['me', token]` cache holds the answer), `bad phone from the envelope`, `empty name checked` ("Enter your name", nothing sent).

- [x] 12.1 Red
- [x] 12.2 `ProfileSheet({ open, customer, onClose })` per the Edit profile section
- [x] 12.3 Gates green

## 13. Address sheet

Scope: `apps/mobile/src/{addresses.ts,address-sheet.tsx,address-sheet.test.tsx}`.
Scenarios: Address added, Edit sheet prefilled, Address sheet checks fields, Envelope field error in the sheet.
Starts from: `src/address-sheet.test.tsx`, the scenario names (`fakeCore`; request bodies read from the recorded `Request`s).

- [x] 13.1 Red
- [x] 13.2 `addresses.ts`: `useAddresses`, `saveAddress` (interfaces in `docs/design/mobile-P4-L1.md`); `AddressSheet({ open, address?, onClose })` per section 12
- [x] 13.3 Gates green

## 14. Account screen

Scope: `apps/mobile/src/app/account.tsx`, `apps/mobile/src/addresses.ts` (add `setDefaultAddress`, `deleteAddress`), `apps/mobile/src/account.test.tsx`.
Scenarios: Profile shown, Profile saved (card half), Sign out, Addresses and default, Address deleted, No addresses, Signed-out account redirect, Sign in returns to the account, Account button opens the account, Loading account, Core unreachable with nothing held, Core failure with nothing held, Failed refetch keeps the account.
Starts from: `src/account.test.tsx`, the scenario names; `renderRouter` with the real `(tabs)/index`, `sign-in` and `account` screens; refetch recipe from Decision 12.

- [ ] 14.1 Red
- [ ] 14.2 `account.tsx` per section 11 and the pattern of Decision 10; no token renders `<Redirect href="/sign-in?returnTo=%2Faccount" />`; "Sign out" does `router.replace('/')` and then `signOut()`
- [ ] 14.3 Gates green; `make test-web` exits 0

## 15. End-to-end suite

Scope: `apps/mobile/package.json` (`e2e` script only), `apps/mobile/playwright.config.ts`, `apps/mobile/e2e/accounts.spec.ts`.
Scenarios: Demo customer signs in, Register with a field error, Addresses against core, Sign out against core.
Starts from: `e2e/accounts.spec.ts` with the four scenario names, written before the script and config exist (red: `npm run e2e` missing). Token key in `localStorage`: `shopperstop.customer-token`.

- [ ] 15.1 Red recorded; then the `e2e` script (Decision 4) and `playwright.config.ts` (Decision 13)
- [ ] 15.2 With the e2e slot announced by the manager: `make e2e` exits 0, the mobile suite 4 of 4; an axe violation on markup the app does not control stops the task (report, no rule switched off)
- [ ] 15.3 Gates green

## 16. Acceptance

- [ ] 16.1 Team lead: `/opsx:verify`: every scenario maps to a passing named test (design.md table), every task ticked, nothing outside the scope lists landed
- [ ] 16.2 Manager: re-run the gates and `make e2e`; walk sign in, register, account, address add and default, sign out at 390×844 on the web export against core with the demo seed; record in the lane status cell
