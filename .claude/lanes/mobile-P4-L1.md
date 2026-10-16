# mobile-P4-L1 - mobile-foundation-accounts: Expo workspace, client, session, RN primitives, sign in, register, account, addresses (team lead)
Status: blocked (16.1 not accepted: one gap, task 15.4)
## Doing
16.1 `/opsx:verify` done: not accepted until 15.4 (cold-cache Jest timeout) lands; then re-verify and tick 16.1.
## Found
- Change `openspec/changes/mobile-foundation-accounts/`: proposal; `specs/mobile-app/spec.md` (22 ADDED requirements, 58 scenarios, seeds `mobile-app`); design.md (18 decisions, web-app mirror table, scenario-to-test map, deferred list); tasks.md (15 worker tasks + 15.4 + acceptance). `docs/design/mobile-P4-L1.md` carries the canvas data.
- 16.1 verify (2026-10-16, head after 2bf3a46):
  - Gates: ui build, mobile lint, typecheck exit 0; `npm run test --workspace apps/mobile -- --run` 25 suites, 91 tests passed (warm cache); `npm run build` exit 0, dist holds index, sign-in, register, account, categories, orders, +not-found; `openspec validate --all --strict` 19 passed. e2e not run here (manager's 16.2); T15 third pass recorded `make e2e` exit 0, mobile 4 of 4.
  - Scenario map: all 58 scenarios map to a named test (design.md "Scenario to test"); the 7 added at 16.1 cover behaviour T15 landed with tests but no scenario (Enter submits, row action sent once, default switch state, sheet scroll, dialog name, static and screen titles).
  - Tasks: 1 to 15.3 ticked; 15.4 added (open).
  - Scope: everything outside the task scope lists is recorded under 16.1 in tasks.md and in design.md Decisions 8, 14 to 18; nothing landed outside apps/mobile except the change, docs/design/mobile-P4-L1.md, lane logs, package-lock.json.
  - GAP: on a cold Jest cache the router tests exceed the 5 s default: `npx jest --ci` (first run) 6 failed (account-sign-in, account-redirect, shell-tabs, account-home, shell, account-sign-out), `npx jest --ci --no-cache` 2 failed (account-sign-in, account-sign-out), "Exceeded timeout of 5000 ms". CI runners start cold. Fix brief: tasks.md 15.4 (`testTimeout: 60_000` in apps/mobile/jest.config.js).
- T15 decisions folded into design.md: Decision 8 (dialog name, dialog role and Escape only after the slide ends, 80% scroll cap), 14 (Toggle replaces RN Switch), 15 (+html.tsx static title, per-screen "<Screen> · ShopperStop"), 16 (Enter submits, row guard, screen-support.ts), 17 (sign-out `leaving` state; the old "replace first" note in Decision 5 was wrong and is replaced), 18 (e2e global-setup reseed, eslint.config.mjs, one navigating router test per file).
- Worker requests answered: T9 lucide under Jest (moduleNameMapper, in place); T10 split router files (Decision 18); T13 splitError (screen-support.ts) and pincode tabular-nums (deferred to L2); T14 useMe (now in api.ts), open jest handle (not seen at 16.1).
- Deferred (design.md "Deferred to later lanes"): L2 inline-style cleanup and ErrorBanner reusing Button, pincode tabular-nums; L3 "Your cart stays as it is." copy; jest.config.js hard-coded lucide path (next lane touching it); R1 finding 7 hydration watch.
## Requests
- to mobile manager: launch task 15.4 (brief in tasks.md and in the team-lead report); then I re-run 16.1. 16.2 (gates, `make e2e`, walk) is yours.
- to platform (via manager): task 1 rewrote the root `package-lock.json` (mechanical).
## Blockers
- 16.1 waits on 15.4.
