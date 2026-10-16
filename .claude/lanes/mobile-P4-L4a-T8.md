# mobile-P4-L4a-T8 - mobile-orders task 8: e2e (apps/mobile/e2e/orders.spec.ts)
Status: done
## Doing
Done. 8.0 (landmark), 8.1 (red), 8.2 (green) ticked. Manager decisions applied: landmark commits `bb1fef9`, label-query test, `32e1626` feat; reload dropped in `3d2f210`. `make e2e` from the worktree root exit 0: admin 15 passed, mobile 7 passed, rider 7 passed, web 45 passed.
## Found
- Commits on lane/mobile-P4-L4a-orders: `d4a613f` chore (e2e script gets `EXPO_PUBLIC_RIDER_URL=http://localhost:18081`, same text as L2's request), `6eb9b89` test (rider card carries its own margin; no-rider renders nothing), `97e1ca2` fix (margin moved into `src/rider-card.tsx`, wrapper dropped from `src/orders-tracking.tsx`; closes the T7 gap), `55dbf1a` test (the three e2e scenarios).
- Tracking and Cancel scenarios pass against core on the web export at 390x844 (2 of 3 passed on the last run). Both reach their order from the Orders tab, not by a direct load, because of blocker 1.
- Blocker 1, reload of `/orders/<id>` on the static export: `expo serve dist-e2e` answers 404 (`curl /orders/<uuid>` gives 404; `/`, `/orders`, `/account` give 200). The export holds `orders/[id].html` with a literal bracket name and no SPA fallback. The History scenario's reload step cannot pass without changing the serving (playwright.config.ts webServer or a serve fallback), which is L2's file. Not worked around; the reload step is kept as the spec says.
- Blocker 2, axe `region` on the tab bar: on the Orders tab, the tab bar (react-navigation markup under the shared `src/app/(tabs)/_layout.tsx`) sits outside every landmark. Three nodes: `<div>` "Home", "Categories", "Orders" inside `a[href="/"]`, `a[href$="categories"]`, `a[href$="orders"]` (WCAG RGAAv4 9.2.1, moderate). The app controls this layout, so the fix is a `navigation` landmark around the tab bar in a shared file (L2). No rule disabled. L1 hit the same rule on the Modal sheet and fixed it in its own scope.
- Staff sign-in in the spec: `koramangala@shopperstop.local` / `staff12345` (brief). Helpers are inline; the spec uses absolute `http://localhost:18080/api/core/v1` URLs. Picks: 0 (tracking), 1 (cancel).
- Gates at `97e1ca2` plus the spec commit: ui build, mobile lint, typecheck exit 0; `npm run test --workspace apps/mobile -- --run` 40 suites, 153 tests passed; `npm run build --workspace apps/mobile` exit 0; `~/.local/bin/openspec validate --all --strict` 20 passed.
- `make e2e` not run: blocked by the two findings above; the shell's `timeout` binary is absent, so long runs need no wrapper.
## Requests
- to mobile-P4-L4a (manager): decide blocker 1 (the reload of `/orders/<id>` on the export: a serve fallback to `index.html` or `orders/[id].html`, in `playwright.config.ts`, is an L2 file) and blocker 2 (a `navigation` landmark around the tab bar, in `src/app/(tabs)/_layout.tsx`, shared with L2). Either comes from L2's scope or a manager decision; I did not edit either file.
- to mobile-P4-L2 (via the manager): add the tab bar landmark (blocker 2); the e2e script line is already on this branch as `d4a613f`, identical to yours.
## Blockers
1. Reload of `/orders/<id>` on the static export returns 404 (stop condition in the brief).
2. axe `region` on the tab bar on the Orders tab (stop condition: react-native-web/react-navigation markup, no rule switched off).
## Resolution (2026-10-16, manager decisions)
- Tab bar: `src/tabs-landmark.test.tsx` (`tab bar in a navigation landmark`) queries by label because RNTL skips the non-accessible wrapper; `(tabs)/_layout.tsx` passes `tabBar` wrapping `BottomTabBar` from `expo-router/js-tabs` in `<View role="navigation" accessibilityLabel="Main">`.
- History: reload step removed (`3d2f210`); every scenario reaches its order from the Orders tab.
- Gates: mobile lint, typecheck, build exit 0; `npm run test --workspace apps/mobile -- --run` 41 suites, 154 tests; `openspec validate --all --strict` 20 passed.
