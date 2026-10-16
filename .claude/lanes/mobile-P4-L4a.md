# mobile-P4-L4a - mobile-orders: order history, tracking with the rider card, cancel (team lead)
Status: done (9.1 accepted)
## Doing
9.1 accepted at 8c7a160; 9.2 (gates, make e2e, walk, PR) is the manager's.
## Found
- Change `openspec/changes/mobile-orders/`: proposal; `specs/mobile-app/spec.md` (22 ADDED requirements, 46 scenarios); design.md (web-app mirror table, 10 decisions, requests, contract audit, scenario-to-test map); tasks.md (8 worker tasks in groups A: 1, 2; B: 3, 4, 5, 6; C: 7; D: 8; plus acceptance). `docs/design/mobile-P4-L4a.md` carries artboards 6, 15, 16, 18, 19 and the module interfaces. `openspec validate --all --strict` green.
- Contract audit (D42): no gap in core or rider. The customer bearer is accepted by the rider delivery read; core and rider accept origins 5176 and 15176. Core's seed gives SS-DEMOAAAB `riderName` "Arjun Rao".
- Rider fakes in Jest need no change to `src/fake-core.ts`: key rider routes by their full path (`GET /api/rider/v1/orders/<id>/delivery`).
- e2e product picks: this lane takes indices 0 and 1 of web's `orderPick` rule; L4b should take 2 and up.
- 2026-10-16 manager decisions on T8's stops, folded into the change: (1) the History e2e scenario drops the reload of `/orders/<id>` (static export 404s dynamic routes; ceiling in design.md Decision 9, backlog: direct load on the export, native deep links); (2) new requirement "Mobile tab bar landmark" and task 8.0: `src/app/(tabs)/_layout.tsx` wraps `BottomTabBar` (from `expo-router/js-tabs`, no new dependency) in `View role="navigation" accessibilityLabel="Main"` (design.md Decision 10); test `src/tabs-landmark.test.tsx`. 23 requirements, 47 scenarios; `openspec validate --all --strict` 20 passed.
- 9.1 verify (8c7a160, after the manager's npm ci): ui build, lint, typecheck, build exit 0; mobile Jest 41 suites, 154 tests; openspec 20 passed; all 47 scenarios map to same-named tests; tasks 1 to 8.2 ticked; scope clean but for the two approved extensions (package.json e2e line d4a613f; tab bar landmark 32e1626 + src/tabs-landmark.test.tsx). Deferred list in design.md "Deferred". Accepted.
## Requests
- to mobile-P4-L2 (via the manager): (1) `src/ui/dialog.tsx` `Dialog({ open, title, onClose, children })` + `DialogFooter` (API in design.md Requests); T6 falls back to `Sheet` if absent. (2) `package.json` `e2e` script: `EXPO_PUBLIC_RIDER_URL=http://localhost:18081`; needed before T8. (3) optional: TanStack `focusManager` + `AppState` in `src/app/_layout.tsx`.
- to mobile-P4-L5a (via the manager): README device notes add `EXPO_PUBLIC_RIDER_URL=http://<lan-ip>:8081`.
## Blockers
None.
