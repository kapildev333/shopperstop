# mobile-P4-L1-T10: Shell: root layout, tabs, Home, not found (mobile-foundation-accounts, task 10)
Status: done
## Doing
Task 10 done: red `test:` 94cdbf9, Jest transform `chore:` 2b5838e (manager request), feat `a314757` (shell, tests green, boxes 10.1 to 10.3 ticked). Nothing pushed.
## Found
- Red (10.1), before the Jest config change: `Must use import to load ES Module: .../node_modules/standard-navigation/lib/src/index.js`.
- `useFonts` never reports loaded under Jest, so the root layout renders `null`. The shell tests stub `@expo-google-fonts/inter` `useFonts` with `jest.mock` (the native font loader is the process boundary). `jest.setup.ts` is unchanged.
- `renderRouter` resolves its app directory from `process.cwd()`, so the tests pass `${__dirname}/app`.
- Expo Router's bottom tabs render each tab as `role="button"` with `accessibilityState.selected` (no `tab` role; `getByRole('tablist')` does not match).
- expo-router store leak: the navigation ref (`global-state/navigationRef.js`, `createNavigationContainerRef()`) is a module singleton. After a test navigates (tab press, or "Go to Home"), a later `renderRouter` in the same file ignores its `initialUrl`. `jest.resetModules()` per test fails (RNTL re-registers hooks inside a test). Flushing fake timers after each test did not help.
- No supported reset found: `renderRouter` does not clear the store; `global-state/*` exports no reset; the navigation ref has none. The manager's option (b), a reset in `jest.setup.ts`, therefore cannot be written without patching node_modules. Took option (a): the tab-switch test lives in `src/shell-tabs.test.tsx`. Rule for renderRouter tests: one navigating test per file (per-file isolation). T11 should follow it, or the leak will hit its tests.
- Gates on `a314757`: `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile -- --run` shell 2 of 2 plus shell-tabs 1 of 1 pass (the suite run also shows 7 failures in T11's uncommitted `auth-forms.test.tsx`, not mine); `npm run build --workspace apps/mobile` exit 0, `dist` holds `index.html`, `categories.html`, `orders.html`, `+not-found.html` and the `(tabs)` route folder; `openspec validate mobile-foundation-accounts --strict` valid. Typecheck fails only in T11's `auth-forms.test.tsx`.
- `src/app/index.tsx` deletion reached the branch inside another worker's commit `92505a8` (it was staged in the shared index). Not my commit.
## Requests
- to mobile-P4-L1 (T11): one navigating `renderRouter` test per file (see Found). Your `auth-forms.test.tsx` runs in a shared file: a `Go to Home` or sign-in redirect in an earlier test will leak into later ones.
## Blockers
None.
