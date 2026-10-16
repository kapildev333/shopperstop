# mobile-P4-L1 - mobile-foundation-accounts: Expo workspace, client, session, RN primitives, sign in, register, account, addresses (team lead)
Status: done (16.1 accepted)
## Doing
16.1 accepted and ticked (second pass, after 15.4 and the R2 fixes). 16.2 is the manager's.
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
- 16.1 second pass (head ee35d1f + this commit): 15.4 (5bb4c35, `testTimeout: 60_000`) and R2 fixes (d498901, df2d7ab, 33e2709, 550fb73, 9819d93) checked. ui build, lint, typecheck exit 0; `npx jest --ci --no-cache` twice: 94 of 94 both; `npm run test --workspace apps/mobile -- --run` 25 suites, 94 tests; build exit 0; `openspec validate --all --strict` 19 passed. Two scenarios added for the R2 behaviour (Space flips the switch; Failed row action re-enables the rows), 60 scenarios across 22 requirements, all mapped in design.md; R2 notes folded into Decisions 14 and 16. Scope: the R2 and 15.4 commits touch only `src/ui/toggle.tsx`, `src/ui/toggle.test.tsx`, `src/app/account.tsx`, `src/account.test.tsx`, `jest.config.js`; nothing outside apps/mobile, this change, docs/design/mobile-P4-L1.md, the lane logs and package-lock.json. Accepted.
## Requests
- to mobile manager: 16.2 (gates, `make e2e`, walk at 390x844) is yours; then archive by PR after merge.
- to platform (via manager): task 1 rewrote the root `package-lock.json` (mechanical).
## Blockers
None.
