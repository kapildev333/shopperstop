## Context

`apps/mobile` does not exist. The customer behaviour it mirrors is `openspec/specs/web-app`; the contract is core's Phase 2 `openapi.json` through `@shopperstop/ui/api`; the screens are the design canvas (D36), translated for the workers into `docs/design/mobile-P4-L1.md` because they cannot open it. Platform-P4-L1 (on main) made core accept the origins 5176 and 15176 and fixed how the workspace must fit the root scripts. ui-P4-L1 (#220, on main since 83796f3) gives `@shopperstop/ui/tokens` and `@shopperstop/ui/format`.

### web-app requirements mirrored

| mobile-app requirement | mirrors web-app | differs |
|---|---|---|
| Mobile session token | Customer session token | secure store on a device, key `shopperstop.customer-token` (secure store keys allow no `:`) |
| Mobile lost session | Customer session token (401) | only a 401 to the current token ends the session (admin-app "Lost session") |
| Mobile failed answers without the error envelope | Customer failed answers without the error envelope | none |
| Mobile client reaches core | Customer site reaches core through a same-origin proxy | no proxy: cross-origin to `EXPO_PUBLIC_CORE_URL` |
| Mobile sign-in and register screens, checks | Customer sign-in and register forms | password toggle; canvas copy |
| Mobile return after sign-in | Customer return after sign-in, Customer account page requires sign-in | `/\` also refused, as web's code does |
| Mobile account screen, edit profile sheet | Customer profile and sign out | profile edited in a sheet ("Edit profile") instead of inline inputs |
| Mobile saved addresses, address sheet, checks | Customer address list, Customer address dialog | bottom sheet, label chips, default switch |
| Mobile screens keep data when a refetch fails | Customer pages keep data when a refetch fails | error copy distinguishes offline and server (artboard 19) |
| Mobile not found | Customer site not found | none |
| Mobile bottom tabs, Mobile sheets | (none: web has a banner and dialogs) | D38 |
| Mobile end-to-end suite with axe | Customer site end-to-end suite with axe | 390×844 only, web export on 15176 |

## Goals / Non-Goals

**Goals:** the workspace on the root gates; client, session and auth every later lane imports; the primitives the account screens need; the tabs; sign in, register, account, addresses; the loading and error pattern; the e2e suite.

**Non-Goals:** anything with a pincode, store, product, cart or order (L2 to L4); icon, splash and EAS (L5); dark mode; native device e2e.

## Decisions

### 1. Expo SDK 58

`npm view expo dist-tags` on 2026-10-15: `latest` = 58.0.11. Pins from Expo 58's `bundledNativeModules.json`: React Native 0.88.0, React 19.3.0 and react-dom 19.3.0 (the same React as `apps/web` and `apps/admin`, so npm hoists one copy), react-native-web 0.21.4. Every Expo package is pinned exactly, as the other workspaces pin theirs.

### 2. Dependencies

Runtime (D37 plus the peers Expo Router and the web export require):

| Package | Version | Why |
|---|---|---|
| `expo` | 58.0.11 | D37 |
| `expo-router` | 58.0.20 | D37 |
| `expo-linking`, `expo-constants`, `@expo/metro-runtime`, `react-native-screens` | 58.0.13, 58.0.12, 58.0.14, 4.30.0 | required peers of `expo-router` |
| `react`, `react-dom`, `react-native`, `react-native-web` | 19.3.0, 19.3.0, 0.88.0, 0.21.4 | Expo 58; `react-dom` and `react-native-web` for the web export |
| `expo-secure-store` | 58.0.2 | D37, token |
| `@expo-google-fonts/inter` | 0.4.2 | D37, fonts (re-exports `useFonts`) |
| `lucide-react-native`, `react-native-svg` | 1.55.0 (same as `lucide-react` in web), 15.16.0 | D37 |
| `react-native-safe-area-context` | 5.10.1 | D37 |
| `@tanstack/react-query` | 5.104.2 (same as web) | D37 |
| `openapi-fetch` | 0.17.0 | D37 |
| `@shopperstop/ui` | `*` | types and tokens |

`@react-native-async-storage/async-storage` (D37) arrives with its first use, the pincode in L2. Dev: `jest-expo` 58.0.11, `jest` 30 (the major `jest-expo` 58 requires; the worker pins the exact version npm resolves), `@react-native/jest-preset` 0.88.0 (a peer of `jest-expo`), `@testing-library/react-native` 14.1.0, `@types/jest` 30.0.0, `@types/react` 19.3.0, `typescript` 5.9.3 (the repository's; Expo's template uses 6.0, and nothing here needs it), `eslint` 9.39.5, `typescript-eslint` 8.71.2, `eslint-plugin-react-hooks` 7.1.1, `@playwright/test` 1.64.0 and `@axe-core/playwright` 4.13.0 (same as `apps/web`, platform request 4). No other runtime dependency; anything more stops the worker.

### 3. Layout, routes and the web export

```
apps/mobile/
  package.json  app.json  tsconfig.json  eslint.config.mjs  jest.config.js  jest.setup.ts  playwright.config.ts  .gitignore
  e2e/accounts.spec.ts  e2e/global-setup.ts
  src/
    env.d.ts                     /// <reference types="expo/types" /> (typed process.env without `expo start`)
    app/                         Expo Router routes
      _layout.tsx                fonts, QueryClientProvider, SafeAreaProvider, Stack (no headers)
      (tabs)/_layout.tsx         Tabs: index (Home), categories, orders
      (tabs)/index.tsx  (tabs)/categories.tsx  (tabs)/orders.tsx
      sign-in.tsx  register.tsx  account.tsx  +not-found.tsx  +html.tsx (static shell, Decision 15)
    api.ts  session.ts  auth.ts  addresses.ts  fake-core.ts (tests only)
    auth-forms.tsx  address-sheet.tsx  profile-sheet.tsx  screen-support.ts (useBack, splitError)
    ui/ tokens.ts text.tsx button.tsx form-field.tsx badge.tsx chip.tsx card.tsx sheet.tsx toggle.tsx empty-state.tsx error-banner.tsx skeleton.tsx
    *.test.ts(x), ui/*.test.tsx
```

Routes live in `src/app/` (Expo Router's supported `src/app` form, as in Expo 58's template) so every source file, routes included, sits under `src/` where the literal-colour scan and Jest look; the area plan's `app/` is read as "the router directory". `app.json`: name "ShopperStop", slug and scheme `shopperstop`, portrait, `userInterfaceStyle` light, `web.output` `static`, plugin `expo-router`; no `typedRoutes` (it needs `expo start` to generate types, which CI never runs). No icon or splash: L5 owns them (its deliverable), and leaving them out keeps `expo-splash-screen` out of this change.

`static` output writes one HTML file per route (`sign-in.html`, `account.html`, ...); `npx expo serve <dir> --port <n>` serves them with clean URLs. Dynamic routes in later lanes (`/orders/[id]`) are reached by in-app navigation; a deep link to one on the static server is L4's to check.

No `metro.config.js`: Expo SDK 52 and later configure Metro for npm workspaces themselves. Ceiling: if `expo export` cannot resolve a hoisted package, task 1 adds the documented monorepo `metro.config.js` and says so.

### 4. Scripts and the root gates

```json
"start": "expo start --port 5176",
"lint": "eslint .",
"typecheck": "tsc -p tsconfig.json",
"test": "sh -c 'jest --ci' --",
"build": "expo export --platform web",
"e2e": "EXPO_PUBLIC_CORE_URL=http://localhost:18080 expo export --platform web --output-dir dist-e2e && playwright test"
```

`test` drops the `-- --run` the root appends (platform request 2). `e2e` arrives with the e2e task only: an `e2e` script with no spec makes Playwright exit 1 under `make e2e`. It re-exports with core's e2e URL because `make e2e` builds every workspace without it (platform request 3) and writes `dist-e2e` so `dist` stays the plain build. Port 5176 because Expo's default 8081 is the rider service's (platform request 1).

### 5. Session and client

- `session.ts` mirrors web's: a module-level token read once at load, `setToken`, `useToken` (`useSyncExternalStore` with a server snapshot of `undefined`, since the static export renders in Node). Storage: on iOS and Android `expo-secure-store`'s synchronous `getItem` and `setItem`, and `deleteItemAsync` to clear (there is no synchronous delete); on the web export (`Platform.OS === 'web'`) `localStorage`, because `expo-secure-store` has no web implementation. Every storage call sits in `try`/`catch`: blocked storage keeps the token in memory only, as on web. Ponytail ceiling: a sign-out followed within milliseconds by a sign-in could let the late delete remove the new token from storage (memory keeps it); chain the writes if that is ever seen.
- `api.ts` is web's `api.ts` with two changes: `baseUrl` is `coreUrl` (Decision 3 of the proposal: `EXPO_PUBLIC_CORE_URL`, default `http://localhost:8080`), and the 401 rule is admin's: clear only when `request.headers.get('Authorization') === 'Bearer ' + getToken()`. The non-envelope rewrite keeps web's message and builds the new answer with only `Content-Type` (web's note on `Content-Length: 0`).
- Queries throw `error.error` (the `ApiError`), as admin's do, so `errorKind` can tell an answer (`code` is a string) from a thrown network error.
- `auth.ts` is web's without the guest-cart merge (L3 adds it) and without `signOutAndGoHome`; the account screen owns the navigation (Decision 17).

### 6. Primitives: what is built now

Built here because the account screens use them: `Text` (type scale, Inter family per weight, tones, `heading` level), `Button` (primary, secondary, danger, ghost, ghost-danger; sizes md, lg, compact; `loading`), `IconButton`, `FormField` (label, input, hint, error, trailing slot; one component for web's `Input` and `FormField`), `Badge`, `Chip`, `Card`, `Sheet`, `EmptyState`, `ErrorBanner` with `errorKind`, `Skeleton` (list form). The tab bar is Expo Router's `Tabs` styled from tokens, not a custom `TabBar`: the router's own tabs already give the roles, the selected state and the safe area.

Not built here, each by the lane that first shows it: `Stepper` and `Price` (L2, product cards), `Dialog` (L2, "Change store?"), `StatusMessage` (first notice that needs it), `Skeleton`'s grid form (L2, Home). Simplifications with their ceilings: no pulse on skeletons (static blocks; add an `Animated` loop when someone asks); no 88 px illustration in the error state; `Card` has no test of its own (a styled `View`; the account tests render it). `formatInr` is not needed until `Price` (L2), which imports it from `@shopperstop/ui/format`; the manager's walk then checks `formatInr(123450)` shows `₹1,234.50` on a Hermes device.

`Text` sets `fontFamily` per weight (`Inter_400Regular`, `Inter_600SemiBold`, `Inter_700Bold`, loaded in the root layout with `useFonts`), never `fontWeight`, because React Native picks a font file by family. Headings use `role="heading"`; on the web export `aria-level` is passed through so axe sees one level-1 heading per screen (React Native's types lack `aria-level`; `text.tsx` holds the one cast).

### 7. Tokens (binding, from ui-P4-L1 #220)

- Imports: `import { colors, radius, spacing, type, motion, shadows } from '@shopperstop/ui/tokens'` and, from L2 on, `import { formatInr } from '@shopperstop/ui/format'`. Never copy a hex value, never reimplement `formatInr`, never import the root `@shopperstop/ui` (it pulls in React DOM and CSS). Only `@shopperstop/ui/tokens`, `/format`, `/api` and `/testing` (tests) are imported.
- Shapes: `colors.*` are hex strings keyed by camelCase token name (`inkMuted`, `lineStrong`, `accentSoft`, `onBrand`, ...); `radius` (`control`, `card`, `pill`), `spacing` (`unit`, `gutter`, `gridGap`) and `type.*.size` / `.lineHeight` are px numbers; `motion.*` durations are ms; `type.*.weight` is 400, 600 or 700 and maps to `Inter_400Regular`, `Inter_600SemiBold`, `Inter_700Bold` (the module has no font family; `src/ui/tokens.ts` adds `fontFamily(weight)`).
- Shadows: `shadows.card` and `shadows.sheet` carry `boxShadow` (a CSS string) and the iOS parts. React Native 0.88 draws the `boxShadow` style on iOS, Android and web, so the app uses `boxShadow: shadows.card.boxShadow` and nothing else (no `elevation`, no `shadowColor`). Ceiling: if a device draws no shadow, switch to the iOS parts plus an Android `elevation` in `tokens.ts`.
- Both entries resolve to `packages/ui/dist/`: build `packages/ui` (`npm run build --workspace packages/ui`) before any mobile gate; `make test-web` does it first. Metro (package `exports` on by default since SDK 53) and Jest 30 resolve package `exports`; the `default` condition is the only one the entries declare.
- `src/ui/tokens.ts` re-exports these and adds `fontFamily`. The literal-colour test scans `apps/mobile/src` only (never `node_modules`) with `findLiteralColors` from `@shopperstop/ui/testing` (hex, colour functions) and adds one regex for quoted CSS colour names (`'white'`, `'black'`, ...), which React Native accepts and the web regexes miss.

### 8. Sheets

React Native `Modal`, not a router presentation: one component works the same on iOS, Android and the web export (react-native-web renders it as a modal dialog with focus kept inside and calls `onRequestClose` on Escape; Android's back gesture calls it too; iOS VoiceOver stays inside through `accessibilityViewIsModal`). Ceiling: focus is not moved to the title on open; the platform puts it inside the modal.

Settled in T15 (react-native-web 0.21.4 source read and probed in the browser):
- The dialog is named by its title: `accessibilityLabel={title}` on the `Modal` reaches the dialog root on the web export (axe `aria-dialog-name`).
- `role="dialog"`, `aria-modal` and the Escape listener arrive only when the 250 ms slide ends (react-native-web's `ModalContent` is `active` from `onAnimationEnd`); the dialog shows about 0.8 s after the tap. Escape pressed earlier does nothing. Accepted: a person cannot press Escape on a sheet before seeing it; the e2e waits for `getByRole('dialog')` before axe and Escape. Ceiling: if a user ever reports a dropped Escape, set `animationType="none"` on web or add a `keydown` listener in `sheet.tsx`.
- The content sits in a `ScrollView` (`keyboardShouldPersistTaps="handled"`) capped at 80% of the window height (`useWindowDimensions`), so the address form and the keyboard fit an iPhone SE class phone with the header in view (R1 finding 1; 80 rather than 90 so the header and keyboard both fit).

### 9. Register without phone; profile in a sheet

Artboard 10 shows an optional phone on register, but `POST /auth/register` takes no phone. Sending a second `PATCH /me` after register would need a rule for when it fails while the account already exists. Instead, register mirrors web (name, email, password) and the phone is set where web sets it, on the account screen, through an "Edit profile" sheet (artboard 11 shows the phone but no edit control; the sheet reuses `Sheet` and `FormField`). The account and sign-out copy follow the canvas ("My account", "Saved addresses", "Sign out" as a danger button).

### 10. Loading and error pattern

Each view decides on its own: `data === undefined ? (isError ? <ErrorBanner/> : <Skeleton/>) : content` (web-P2-L6, no shared helper; a later failed refetch leaves `data` in place, so the view keeps it). The area plan's "one notice" when a refetch fails (admin's `RefetchNotice`) is not built: web-app shows nothing in that case and this change mirrors web. Ceiling, as on web: old data shows with no hint that the refresh failed. One `RefetchNotice` in the root layout is the upgrade.

### 11. Lint

typescript-eslint recommended plus `react-hooks`, as in `apps/web`, without `jsx-a11y` (it checks DOM elements, which React Native code does not render). Accessibility is checked by the tests' role and label queries and by axe on the web export.

### 12. Tests

- Jest with the `jest-expo` preset (iOS platform), `roots: ['<rootDir>/src']`, `setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']`, and `transformIgnorePatterns` extended with `lucide-react-native`, `@expo-google-fonts` and `@shopperstop`.
- `jest.setup.ts`: `globalThis.fetch` throws `TypeError('Network request failed')` unless a test fakes it (no request leaves the process, as in web's setup); `expo-secure-store` is replaced by an in-memory store (`getItem`, `setItem`, `deleteItemAsync`), the device keychain being the process boundary like the file system; after each test `setToken(undefined)`, `queryClient.clear()` and the store emptied.
- `src/fake-core.ts`: admin's `fakeCore(routes)` (keys `"METHOD /path"` under `/api/core/v1`, unknown routes 404 `not_found`, returns the list of requests), `json`, `apiError`, with `jest` in place of `vi`.
- Screens are rendered with `renderRouter` from `expo-router/testing-library`, given the real screen components under their route names and an `initialUrl`; `toHavePathname` and `toHaveSearchParams` check where the app went.
- The web-only branch of `session.ts` is covered by the e2e suite (it asserts the `localStorage` key).
- Refetch scenario recipe (web-P2-L6): `queryClient.setQueryData(key, data, { updatedAt: Date.now() - 61_000 })`, render, wait until the query's state is `error` and `idle`, then assert.

### 13. e2e

`playwright.config.ts`: `testDir: 'e2e'`, Chromium, viewport 390×844, `baseURL` `http://localhost:15176/`, web servers `go run ./cmd/core` in `../../services/core` (health URL on 18080) and `npx expo serve dist-e2e --port 15176`, both `reuseExistingServer: !process.env.CI`, as `apps/web` does. `AxeBuilder({ page }).analyze()` with every rule, as web. Registrations use fresh emails (`e2e-<time>-<random>@example.com`); the demo customer is only signed in.

### 14. Toggle instead of React Native's Switch

`src/ui/toggle.tsx`: a `Pressable` with `accessibilityRole="switch"`, `accessibilityLabel`, `accessibilityState={{ checked }}` and `aria-checked={checked}`, a 44 px row with the label, and a track (`lineStrong` off, `accent` on) and thumb (`surface`) from tokens. React Native's `Switch` on the web export nests an `<input role="switch">` inside a `div role="switch"` with no `aria-checked` (axe `nested-interactive`, `aria-required-attr`), and no axe rule is switched off. `aria-checked` is passed as well as `accessibilityState` because react-native-web 0.21.4 reads only `aria-checked` for a `Pressable`. Jest cannot see the web attribute (the host does not forward it), so the e2e axe run on the open address sheet is its test; `toggle.test.tsx` covers the role, state and flip. Every later on/off control uses `Toggle`.

### 15. Document titles

- `src/app/+html.tsx` is the static shell of every exported page: `<html lang="en">`, `<title>ShopperStop</title>`, and `useServerDocumentContext()`'s head and body nodes (without them the export does not hydrate). The static title is needed because the root layout renders nothing until the fonts load, so the static renderer never reaches a screen's `Head`.
- Each screen sets `<Head><title>{screen} · ShopperStop</title></Head>` from `expo-router/head` (Home, Categories, Your orders, Sign in, Create account, My account, Page not found); the client applies it after hydration. Later screens follow the same pattern. `apps/web` titles stay `ShopperStop`; aligning them is web's call.

### 16. Enter submits; row actions guarded

R1 findings 2 and 3, fixed in T15: Password carries `returnKeyType="go"` and `onSubmitEditing={submit}` on both forms; the account screen disables Edit, Set as default and Delete on every row while one row action is pending (one state for the list, not per row: there is one customer and seldom more than a few addresses). `useBack` and `splitError` moved to `src/screen-support.ts` (R1 finding 4).

### 17. Sign-out navigation

`router.replace('/')` before `signOut()` did not hold: the token clears while `/account` is still mounted and its `<Redirect>` to sign-in wins (T15 e2e red). The account route keeps a `leaving` state set by Sign out; while it is set and no token is held the route renders nothing instead of the redirect, so the replace to `/` lands. The redirect still applies to every other signed-out visit.

### 18. e2e reseed and lint config name

- `e2e/global-setup.ts` runs `core-admin migrate` and `seed-demo --reset` before the suite, as `make e2e` does before every workspace, so a standalone `npm run e2e` starts from the demo customer; it refuses any `SHOPPERSTOP_CORE_DATABASE_URL` whose database name does not end in `_e2e`.
- `eslint.config.mjs`, not `.js`: the workspace has no `"type"` (Expo's entry), and the `.js` name made Node print `MODULE_TYPELESS_PACKAGE_JSON` on every lint run (T1, renamed in T4).
- Router scenarios that navigate are split one per file (`account-home`, `account-sign-in`, `account-sign-out`, `account-redirect`, `auth-forms-register-home`, `auth-forms-sign-in-screen`, `shell-tabs`): expo-router keeps module-level navigation state between tests in one file. Do not merge them.

## Scenario to test

Acceptance (16.1) map: every test named below passed in `npm run test --workspace apps/mobile -- --run` (25 suites, 91 tests) and in the T15 `make e2e` run (mobile 4 of 4).

| Scenario | Test file: test name | Task |
|---|---|---|
| Root test arguments ignored; Web export built | gate commands (`npm run test ... -- --run` exits 0; `npm run build` writes `dist/index.html`, `sign-in.html`, `register.html`, `account.html`) | 1 |
| No literal colours in the app | `src/no-literal-colors.test.ts`: `no literal colours in src`, `scanner finds literal colours` | 1 |
| Default core URL; Bearer attached; 401 to the current token; 401 without a token keeps a new session; 401 to a replaced token keeps the new session; Empty failed answer becomes internal; HTML failed answer becomes internal; Enveloped failure passes through; Bare 401 ends the session and becomes internal; No content answer untouched; Failed write reports an error; Unreachable core reports an error | `src/api.test.ts`: the scenario names | 2 |
| Token persisted and cleared; Token restored on load | `src/session.test.ts`: the scenario names | 2 |
| Unsafe returnTo ignored | `src/auth.test.ts`: `unsafe returnTo ignored` | 3 |
| Sheet closed | `src/ui/sheet.test.tsx`: `sheet closed`, `sheet closed title is hidden` | 7 |
| Sheet content scrolls; Sheet dialog named by its title | `src/ui/sheet.test.tsx`: `sheet content scrolls`, `sheet dialog is named by its title` | 15 |
| Home in the tabs; Unknown path | `src/shell.test.tsx`: `home in the tabs`, `unknown path` | 10 |
| Tab switch | `src/shell-tabs.test.tsx`: `tab switch` | 10 |
| Sign-in screen | `src/auth-forms-sign-in-screen.test.tsx`: `sign-in screen` | 11 |
| Password shown on request; Required fields checked; Short password on register; Field error from the envelope; Non-field error in an alert | `src/auth-forms.test.tsx`: the scenario names (plus `required fields checked on register`) | 11 |
| Register lands on Home | `src/auth-forms-register-home.test.tsx`: `register lands on Home` | 11 |
| Enter in Password submits | `src/auth-forms-enter.test.tsx`: `enter in password signs in`, `enter in password registers` | 15 |
| Profile saved (sheet half: body sent, sheet closed, cache updated); Bad phone from the envelope | `src/profile-sheet.test.tsx`: `profile saved`, `bad phone from the envelope` (plus `empty name checked`) | 12 |
| Address added; Edit sheet prefilled; Address sheet checks fields; Envelope field error in the sheet | `src/address-sheet.test.tsx`: the scenario names | 13 |
| Default switch reports its state | `src/ui/toggle.test.tsx`: `toggle is a switch with its checked state and reports the flip`, `checked toggle reports off on press`; web `aria-checked` by axe in `e2e/accounts.spec.ts`: `addresses against core` | 15 |
| Profile shown; Profile saved (card half); Addresses and default; Address deleted; No addresses; Loading account; Core unreachable with nothing held; Core failure with nothing held; Failed refetch keeps the account | `src/account.test.tsx`: the scenario names | 14 |
| Row action not sent twice | `src/account.test.tsx`: `set default is not sent twice while pending`, `delete is not sent twice while pending` | 15 |
| Account button opens the account | `src/account-home.test.tsx`: `Account button opens the account` | 14 |
| Sign in returns to the account | `src/account-sign-in.test.tsx`: `Sign in returns to the account` | 14 |
| Sign out | `src/account-sign-out.test.tsx`: `Sign out` | 14 |
| Signed-out account redirect | `src/account-redirect.test.tsx`: `Signed-out account redirect` | 14 |
| Static shell title | `src/html-shell.test.tsx`: `exported pages carry the app title in the static shell` | 15 |
| Screen title | `e2e/accounts.spec.ts`: `demo customer signs in` (`toHaveTitle('Sign in · ShopperStop')`) | 15 |
| Demo customer signs in; Register with a field error; Addresses against core; Sign out against core | `e2e/accounts.spec.ts`: the scenario names (Addresses also waits for the dialog, runs axe on the open sheet and closes it with Escape) | 15 |

Tasks 4, 5, 6, 8 and 9 test primitives no scenario names directly (their tests are listed in tasks.md); the scenarios above exercise them through the screens.

## Risks / Trade-offs

- [Hermes `Intl` without full ICU] -> not met in L1 (no prices); the L2 walk checks `formatInr(123450)` on a device.
- [axe on react-native-web output] -> landmarks: each screen's root `View` carries `role="main"` and the tab bar is the router's; if a rule still fails on markup the app does not control, the e2e worker stops and reports (no rule is switched off without the team lead).
- [Jest and the hoisted monorepo] -> `@shopperstop/ui` resolves to `packages/ui` through the workspace link and is transformed by Babel; the `make test-web` order (ui build first) gives `dist/` for `@shopperstop/ui/tokens` and `/testing`; a worker running the mobile gates alone builds `packages/ui` first.
- [Static rendering runs screen modules in Node] -> no module touches `window`, `localStorage` or the secure store outside `try`/`catch` or effects.
- [`expo export` in CI time] -> first export is the slowest step of `make test-web`; measured in task 1's log.
- [Cold Jest cache] -> on a cold transform cache (`jest --no-cache`, as on a fresh CI runner) the router tests transform expo-router inside the test and exceed Jest's 5 s default (16.1 saw 2 to 6 timeouts; warm runs pass 91 of 91). Task 15.4 raises `testTimeout`.

## Deferred to later lanes

- L2: inline style objects and raw numbers in `ui/error-banner.tsx`, `ui/chip.tsx`, `ui/skeleton.tsx` and `app/(tabs)/index.tsx` move to `StyleSheet.create` and `spacing`; `ErrorBanner`'s "Try again" reuses `Button` instead of its own recipe (R1 finding 5).
- L2 (pincode entry on Home): `FormField` takes no `style`, so the address sheet's Pincode is not in `tabular-nums` as `docs/design/mobile-P4-L1.md` section 12 asks (T13); L2 adds an input-style prop to `FormField` and uses it on both pincode inputs.
- L3: the sign-in copy "Your cart stays as it is." (`auth-forms.tsx`) is true only once the cart exists; L3 keeps or rewrites it with the merge (R1 finding 10).
- Any lane next touching `jest.config.js`: the lucide mapping hard-codes `<rootDir>/../../node_modules/lucide-react-native/...`; use `require.resolve('lucide-react-native/dist/cjs/lucide-react-native.js')` so it survives a change in hoisting (R1 finding 8).
- Watch (R1 finding 7): `/account` is exported as the signed-out redirect and hydrates as the account when a token is held; Expo recovers by client render and the T15 reload in `addresses against core` passed axe. Revisit if a hydration warning shows in the walk.
