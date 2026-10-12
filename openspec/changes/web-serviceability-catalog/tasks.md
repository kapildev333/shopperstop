# Tasks

Four tasks, one worker each, in order 1 → 2 → 3 → 4 on branch `lane/web-P2-L1-browsing` (each imports the previous ones). Task 1 starts once core-P2-L2 (`core-stores-serviceability`) is on main and `packages/ui/src/api/core.d.ts` carries `/serviceability` and `Store`; tasks 2 to 4 once core-P2-L4 (`core-stock-cart`, the three store browsing routes) and core-P2-L3 (`core-catalog`, demo catalog and `/files`) are on main too. The branch is rebased on main before each start. Read `design.md`: it fixes files, interfaces, copy and test names. Where the generated types differ from design.md, follow the types and note it in the lane log; stop and report on a behaviour difference.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$PATH"`: `npm install` (after each rebase), `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build (`routeTree.gen.ts` committed), the e2e with the Makefile `E2E_ENV` exported: `CI=1 npm run e2e --workspace apps/web` (ask the manager first: one e2e at a time), and `openspec validate web-serviceability-catalog --strict`. Commit as the repo's configured author, no trailers.

## 1. Pincode, store resolution, banner and store gate

Scope: `apps/web/src/pincode.ts`, `src/pincode.test.ts`, `src/catalog.ts` (`keys`, `useServiceability`), `src/pincode-sheet.tsx`, `src/pincode-sheet.test.tsx`, `src/search-form.tsx`, `src/store-gate.tsx`, `src/store-gate.test.tsx`, `src/routes/__root.tsx` (banner and `<PincodeSheet />`), `src/routes/index.tsx`, `src/shell.test.tsx`, `src/test-setup.ts`, `src/test-data.ts`, `e2e/browse.spec.ts`, `e2e/auth.spec.ts` and `e2e/account.spec.ts` (`beforeEach` only), this file's checkboxes.
Scenarios: Customer site shell › "Home renders in the shell"; Customer search › "Search from the banner"; Customer pincode choice › all three; Customer pincode sheet › all four; Customer store resolution › both; Customer store notices › all four.
Failing tests: `src/pincode.test.ts` › "pincode persisted", "pincode restored on load", "blocked storage tolerated"; `src/pincode-sheet.test.tsx` › "first visit opens the pincode sheet", "invalid pincode refused", "pincode saved from the sheet", "banner control opens the sheet", "banner shows the delivery promise"; `src/store-gate.test.tsx` › "not serviceable notice", "closed store notice", "store lookup fails"; `src/shell.test.tsx` › "home renders in the shell" (updated), "search from the banner"; `e2e/browse.spec.ts` › "pincode resolves against core", "notices against core".

- [ ] 1.1 Tests committed red (`test: pincode, store resolution and notices`), with `src/test-data.ts` and the two e2e `beforeEach` lines (test infrastructure)
- [ ] 1.2 `pincode.ts`, `catalog.ts` (`keys`, `useServiceability`), `pincode-sheet.tsx`, `search-form.tsx`, `store-gate.tsx`, banner, Home behind `StoreGate`, `test-setup.ts` (`feat: pincode sheet, store resolution and notices`); all gates green, e2e green, `smoke.spec.ts`, `auth.spec.ts`, `account.spec.ts` green

## 2. Home and the product card

Scope: `apps/web/src/catalog.ts` (`useCategories`, `usePicked`), `src/cart.ts`, `src/product-card.tsx`, `src/product-card.test.tsx`, `src/home.test.tsx`, `src/routes/index.tsx`, `src/test-data.ts` (`product`, `category`, `renderInRouter`), `e2e/browse.spec.ts` (one test), this file's checkboxes.
Scenarios: Customer product card › "Card links and prices", "Add shows the count"; Customer home page › "Home lists categories and picks", "Home against core".
Failing tests: `src/product-card.test.tsx` › "card links and prices", "add shows the count"; `src/home.test.tsx` › "home lists categories and picks"; `e2e/browse.spec.ts` › "home against core".

- [ ] 2.1 Tests committed red (`test: home and product card`)
- [ ] 2.2 `useCategories`, `usePicked`, `cart.ts`, `product-card.tsx`, Home content (`feat: home with categories and picked for you`); all gates green, e2e green

## 3. Category and search

Scope: `apps/web/src/catalog.ts` (`feedPageSize`, `useProductFeed`, `findCategory`), `src/product-feed.tsx`, `src/routes/c.$slug.tsx`, `src/category.test.tsx`, `src/routes/search.tsx`, `src/search.test.tsx`, `src/routeTree.gen.ts`, `e2e/browse.spec.ts` (two tests), this file's checkboxes.
Scenarios: Customer category page › "Category tabs", "Unknown category", "Browse a category against core"; Customer paged product lists › "Load more while pages remain"; Customer search › "No results suggests categories", "Search and load more against core".
Failing tests: `src/category.test.tsx` › "category tabs", "unknown category", "load more while pages remain"; `src/search.test.tsx` › "no results suggests categories"; `e2e/browse.spec.ts` › "browse a category against core", "search and load more against core".

- [ ] 3.1 Tests committed red (`test: category tabs, paging and search`)
- [ ] 3.2 `useProductFeed`, `findCategory`, `product-feed.tsx`, `/c/$slug`, `/search` (`feat: category and search pages`); all gates green, e2e green

## 4. Product page

Scope: `apps/web/src/catalog.ts` (`useProduct`), `src/routes/p.$slug.tsx`, `src/product.test.tsx`, `src/routeTree.gen.ts`, `e2e/browse.spec.ts` (one test), this file's checkboxes.
Scenarios: Customer product page › all five.
Failing tests: `src/product.test.tsx` › "product with savings", "plenty in stock", "out of stock product", "unknown product"; `e2e/browse.spec.ts` › "product pages against core".

- [ ] 4.1 Tests committed red (`test: product page states`)
- [ ] 4.2 `useProduct`, `/p/$slug` (`feat: product page`); all gates green, e2e green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-serviceability-catalog` after 4.2 lands.
- Area manager archives the change by PR after the feature PR merges.
