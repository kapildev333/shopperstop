## Why

Phase 4 builds the customer mobile app (PLAN.md D36 to D40). Nothing of it exists yet: this first change puts the Expo workspace in `apps/mobile` so `make test-web` and `make e2e` pick it up, gives it the core client and the customer session every later screen uses, the React Native primitives that mirror `@shopperstop/ui`, the bottom tabs, and the account screens of the design canvas (artboards 9 Sign in, 10 Register, 11 Account, 12 Add address, 18 Loading, 19 Error). It seeds the capability `mobile-app` (D4, D38).

## What Changes

- New npm workspace `apps/mobile`: Expo SDK 58 (React Native 0.88, React 19.3), Expo Router with routes in `src/app/`, TypeScript strict, `jest-expo` with React Native Testing Library, ESLint, Playwright with axe; npm scripts `lint`, `typecheck`, `test` (ignores the root's extra `-- --run`), `build` (`expo export --platform web` into `dist/`) and `e2e` (re-exports the web build against core :18080 and serves it on 15176).
- `src/api.ts` and `src/session.ts`: `openapi-fetch` client on `${EXPO_PUBLIC_CORE_URL}/api/core/v1` (default `http://localhost:8080`), bearer token from the device's secure store (localStorage on the web export), a failed answer without core's envelope becomes `internal`, and a 401 ends the session only when the request carried the current token.
- `src/auth.ts`: sign in, register, sign out, the safe `returnTo`.
- `src/ui/`: `tokens.ts` (re-exports `@shopperstop/ui/tokens`), `Text`, `Button`, `IconButton`, `FormField` with its input, `Badge`, `Chip`, `Card`, `Sheet`, `EmptyState`, `ErrorBanner`, `Skeleton`; a `no-literal-colors` test for the app.
- Screens: bottom tabs Home, Categories and Orders (Home holds the account button; Categories and Orders are empty until L2 and L4), Sign in, Create account, My account (profile, edit profile sheet, saved addresses with default, sign out), the add and edit address sheet, Page not found; every screen that reads core uses the loading and error pattern.
- Playwright suite at 390×844 on the web export: sign in, register, account, addresses, sign out, axe on every screen it visits.

Out of scope: pincode, store, catalog and search (L2); cart and its merge at sign-in (L3); checkout, orders, tracking (L4); app icon, splash and EAS profiles (L5); the `Stepper`, `Price`, `Dialog` and `StatusMessage` primitives, built by the lane that first shows them (design.md Decision 6); native device e2e (D37 ceiling).

## Capabilities

### New Capabilities

- `mobile-app`: the customer mobile app: its workspace and gates, its core client and session, its primitives and tabs, and the account screens. Where the behaviour is the web site's, the requirement mirrors the `web-app` requirement named in design.md and writes the mobile scenario out.

### Modified Capabilities

None.

## Impact

- Area: mobile. Files: `apps/mobile/**` (new), this change's folder, `.claude/lanes/mobile-P4-L1*.md`, `docs/design/mobile-P4-L1.md`. One mechanical file outside the area: the root `package-lock.json`, which `npm install` rewrites when the workspace and its dependencies arrive (task 1 only).
- Cross-area contracts relied on: `services/core/openapi.json` through `@shopperstop/ui/api` (Phase 2 routes `/auth/register`, `/auth/sign-in`, `/auth/sign-out`, `/me`, `/me/addresses`, `/me/addresses/{id}`, unchanged); `@shopperstop/ui/tokens` and `@shopperstop/ui/format` (ui-P4-L1, on main since #220; both resolve to `packages/ui/dist/`, built before the mobile gates); `@shopperstop/ui/testing` `findLiteralColors`; core's CORS origins 5176 and 15176 and the `make e2e` environment (platform-P4-L1, on main).
- Dependencies: D37's list plus the packages Expo Router and the web export require as peers (`expo-linking`, `expo-constants`, `@expo/metro-runtime`, `react-native-screens`, `react-dom`, `react-native-web`) and dev tooling implied by the stack (design.md Decision 2). No other runtime dependency.
