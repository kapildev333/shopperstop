# mobile-P4-L2-T13 - product screen (mobile-serviceability-catalog task 13)
Status: done (tasks 13.1 to 13.3 ticked in the feat commit; task 10's worker runs in this worktree in parallel)
## Doing
Nothing open in this task.
## Found
- Commits on `lane/mobile-P4-L2-serviceability-catalog`: `ed0b7c7` test (red: `src/catalog-product.test.tsx`, five scenarios; failure `Cannot find module './app/product/[slug]'`); `1510e76` test (red: `src/catalog-product-count.test.tsx`, same failure); `038024d` feat (`src/app/product/[slug].tsx`, `src/catalog.ts` additions, ticks 13.1 to 13.3); this log's chore commit follows.
- Test names are the brief's scenario names: `product with a discount`, `plenty in stock`, `out of stock product`, `unknown product`, `more in the category`, `count follows the product across screens`. None of the product tests navigates; each file renders its screen with a map-based `renderRouter` and `QueryClientProvider`, as T12 does. The tests assert on rendered content only, not on the path.
- Green after the feat: `src/catalog-product.test.tsx` and `src/catalog-product-count.test.tsx`, `Tests: 6 passed, 6 total`, no act or console warnings.
- T9's deferred items added to `src/catalog.ts`: `findCategoryById` (parallel to `findCategory`, by id), `useProduct` (404 read as `null` through `response.status`), `useMoreIn` (page 1, `pageSize` 11, the product removed, sliced to 10; key `['products', storeId, 'more', product.id]`).
- Deviation, flagged, same as T12's precedent: `useProduct(storeId: string | undefined, slug)`, disabled until a store is open (`enabled: !!storeId`), where the design signature took a string. The screen computes the store and the queries in the outer component so the document title can use the product's name; the body renders only inside `StoreGate`.
- Design choice, within the design file: the Back button is an absolute overlay outside the gate (so it works on every notice), not inside the image block. The image block is still under it.
- Layout values (bar padding, `paddingBottom: 120` under the bar, the 47% pairs) are from the design file; no test covers them and the device walk has not run.
- Gates (worktree root, PATH line from the brief):
  - `npm run build --workspace packages/ui`: exit 0.
  - `npm run lint --workspace apps/mobile`: exit 0 (`eslint .`, no output).
  - `npm run typecheck --workspace apps/mobile`: exit 0 (`tsc -p tsconfig.json`).
  - `npm run test --workspace apps/mobile -- --run`: exit 1 from task 10's committed red tests only: `Test Suites: 2 failed, 43 passed, 45 total`, `Tests: 2 failed, 157 passed, 159 total`. The failures are `src/pincode-sign-in.test.tsx` `sign-in link when signed out` (`Expected "/sign-in" Received "/"`) and `src/pincode-first-visit.test.tsx` `first visit opens the pincode sheet` (`Unable to find an element with text: Where should we deliver?`), committed in `5058dea`, `9d57884`, `58f19ee`. Not touched here.
  - `npm run build --workspace apps/mobile`: exit 0 (`Exported: dist`).
  - `openspec validate mobile-serviceability-catalog --strict`: `Change 'mobile-serviceability-catalog' is valid`.
## Requests
None.
## Blockers
None for task 13. Full suite red only on task 10's red tests (see Gates).
