# Tasks

One task, one worker, on branch `lane/web-P2-L7-phone-card-row` in `.worktrees/web-P2-L7`. Read `design.md` first: it fixes the two class lists, the test file, the test names and what "inside the card's content area" measures.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`: `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build, `openspec validate web-phone-card-row --strict`. No Playwright by the worker: the manager runs e2e on the `test:` commit (red) and on the `fix:` commit (green). Commit as the repo's configured author, no trailers.

## 1. Card controls stay inside the card; wordmark tap target

Scope: `apps/web/e2e/phone-layout.spec.ts` (new), `apps/web/src/product-card.tsx` (the class list of the `Price`/`Stepper` wrapper only), `apps/web/src/routes/__root.tsx` (the class list of the "ShopperStop" link only), this file's checkboxes, the lane log `.claude/lanes/web-P2-L7-T1.md`. Not in scope: `packages/ui`, every other file under `apps/web/src` (web-P2-L6 is editing `store-gate.tsx`, `routes/index.tsx`, `routes/c.$slug.tsx`, `routes/p.$slug.tsx`, `test-data.ts` and four test files), the other e2e files, any Vitest file.
Scenarios: Customer product card layout › all three; Customer banner tap targets › "Wordmark tap target on a phone".
Failing tests, `e2e/phone-layout.spec.ts`: `phone` › "card controls stay inside the card on a phone" (red: "ADD" about 15 px past the content area, the quantity group about 47 px), "card controls stay inside the card in the six-column grid" (red: about 35 px), `phone` › "wordmark tap target on a phone" (red: 26 px tall). Pin, green or red on arrival (say so in the commit body): `phone` › "out-of-stock card on a phone".
Reuse, by copying the few lines (the other spec files export nothing): from `e2e/cart.spec.ts` the `beforeEach` init script that stores pincode `560034`, the `koramangala` store id, `expectNoViolations`, and the `test.describe('phone', ...)` block with `test.use({ viewport: { width: 390, height: 844 } })`; from `e2e/browse.spec.ts` › "product pages against core" the product list read (`pageSize=100`) and the `!item.inStock` find. The six-column test uses `test.use({ viewport: { width: 1024, height: 768 } })` in its own describe.
Easy to get wrong:
- Pick products from core, never by name: the struck one is the first with `inStock`, `quantity >= 1` and `mrpCents > priceCents`; `expect` it to be defined. Reach each card through `/search?q=<encodeURIComponent(name)>`: Home lists only twelve in-stock picks.
- The card is the list item that has the link `a[href="/p/<slug>"]`. Left and right limits come from that link's box, top and bottom from the list item's box, tolerance 0.5 px. Measuring against the card's border box passes on the unfixed code for the Stepper.
- Check every `button` in the card (`.all()`), the quantity group, the struck MRP (`s`) and the price text; `boundingBox()` must not be null.
- After choosing "Add <name>", wait for the group "Quantity of <name>" before measuring.
- Wordmark: `page.getByRole('banner').getByRole('link', { name: 'ShopperStop', exact: true })`; height at least 44; its box intersects no other link, button or search box of the banner (touching edges are not an intersection: allow 0.5 px).
- Names with `exact: true`, as in `cart.spec.ts`. Nothing inside a browser callback may read a Node-side name.
- The fix is two class lists (design.md, Decisions 1 and 2), exactly as written; no wrapper element, no new component, no arbitrary value, no change to `Price` or `Stepper`.

- [ ] 1.1 `e2e/phone-layout.spec.ts` committed (`test: card controls stay inside the card on a phone`); lint and typecheck green; manager's e2e run shows the three red
- [ ] 1.2 The two class lists (`fix: card controls stay inside the card on a phone`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-phone-card-row` after 1.2 lands and the manager's e2e is green.
- Area manager archives the change by PR after the fix PR merges.
