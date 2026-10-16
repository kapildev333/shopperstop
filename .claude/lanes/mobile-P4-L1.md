# mobile-P4-L1 - mobile-foundation-accounts: Expo workspace, client, session, RN primitives, sign in, register, account, addresses (team lead)
Status: started
## Doing
Change proposed and committed; waiting for the manager to launch workers (task 1 first). Reachable for worker questions here.
## Found
- Change `openspec/changes/mobile-foundation-accounts/`: proposal; `specs/mobile-app/spec.md` (19 ADDED requirements, 51 scenarios, seeds `mobile-app`); design.md (13 decisions, web-app mirror table, scenario-to-test map); tasks.md (15 worker tasks + acceptance). `docs/design/mobile-P4-L1.md` carries the canvas data (artboards 1, 9 to 12, 18, 19) in token names, because workers cannot open the canvas. `openspec validate mobile-foundation-accounts --strict` valid; `--all --strict` 17 passed.
- Branch rebased onto origin/main 83796f3 (ui-P4-L1 #220 on main): tokens no longer block; design.md Decision 7 holds the six binding rules from ui-P4-L1's requests (imports, dist build first, camelCase keys, shadows via `boxShadow`, scan `src` only, Hermes `formatInr` walk in L2).
- Expo SDK 58.0.11 (`latest` on 2026-10-15), React Native 0.88.0, React 19.3.0 (same as web, one hoisted copy), react-native-web 0.21.4.
- Deviations from the area plan, taken under "smallest design": no `metro.config.js` (SDK 52+ auto-config; added only if export fails); `Stepper`, `Price`, `Dialog`, `StatusMessage`, Skeleton grid deferred to the lane that first shows them; tab bar is Expo Router `Tabs`, not a custom `TabBar`; no refetch "one notice" (web-app has none); no icon or splash (L5); routes in `src/app/`; register without phone (core takes none), phone via an "Edit profile" sheet; token key `shopperstop.customer-token` (secure store keys allow no `:`).
- Read at start and finish: platform-P4-L1 (done), ui-P4-L1 (done, its six requests to mobile are in design.md Decision 7).
## Requests
- to platform (via manager): task 1 rewrites the root `package-lock.json` (mechanical, `npm install` for the new workspace).
## Blockers
None.
