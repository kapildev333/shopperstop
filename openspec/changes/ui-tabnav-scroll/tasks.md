## 1. TabNav scrolls instead of wrapping (worker ui-P2-L1 task 1)
Scope: `packages/ui/src/tab-nav.tsx`, `packages/ui/src/tab-nav.test.tsx`. Scenario: "Tab navigation scrolls instead of wrapping". Failing test: `packages/ui/src/tab-nav.test.tsx` › `tab navigation scrolls instead of wrapping`. Commits: `test: tab navigation scrolls instead of wrapping`, then `feat: TabNav scrolls horizontally without wrapping`.

- [ ] 1.1 Add the failing test rendering seven links in a TabNav; assert the nav has `overflow-x-auto`, `whitespace-nowrap`, `[&_a]:shrink-0`, `[&_a:focus-visible]:outline-offset-[-2px]` and still `[&_a[aria-current=page]]:text-accent`, the landmark name and seven links; commit `test:`
- [ ] 1.2 Add those four classes to the nav in `tab-nav.tsx`; commit `feat:`
- [ ] 1.3 Gates green in `packages/ui`: lint, typecheck, test, build
