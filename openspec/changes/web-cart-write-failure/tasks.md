# Tasks

One task, one worker, on branch `lane/web-P2-L10-cart-write-failure` in `.worktrees/web-P2-L10`. Read `design.md` first: Decisions 2 to 5 are the code, Tests are the test names. Brief: `briefs/task-1.md`.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-cart-write-failure --strict`

No Playwright by the worker. Commit as the repo's configured author, no trailers.

## 1. Cart write failure message

Scope: `apps/web/src/api.ts`, `apps/web/src/cart.ts`, `apps/web/src/product-card.tsx`, `apps/web/src/routes/p.$slug.tsx`, `apps/web/src/cart-drawer.tsx`, `apps/web/src/cart.test.tsx`, `apps/web/src/cart-drawer.test.tsx`, `apps/web/src/cart-write-failure.test.tsx` (new), `apps/web/src/test-setup.ts`, `apps/web/src/auth.test.ts` (comment), this file's checkboxes, `.claude/lanes/web-P2-L10-T1.md`.
Scenarios: Customer cart write failure › both; Customer cart write failure cleared › all three.
Failing tests:
- `src/cart.test.tsx`: "failed write tells the customer", "next tap clears the failure", "overtaken write shows no failure"
- `src/cart-write-failure.test.tsx`: "core's refusal is shown"
- `src/cart-drawer.test.tsx`: "failed write in the drawer"

- [ ] 1.1 The five tests committed (`test: cart write failure message`, then `test: core's refusal through the fetch seam`, design Decision 5); lint and typecheck green; Vitest shows the five new tests red and nothing else red
- [ ] 1.2 Decisions 2 to 5 (`feat: cart write failure message`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-cart-write-failure` after 1.2 lands.
- Area manager archives the change by PR after the feature PR merges.
