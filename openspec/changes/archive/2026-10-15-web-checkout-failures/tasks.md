# Tasks

One task, one worker, on branch `lane/web-P2-L11-checkout-failures` in `.worktrees/web-P2-L11`. Read `design.md` first: Decisions 1 to 3 are the code, Tests are the test names. Brief: `briefs/task-1.md`.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-checkout-failures --strict`

No Playwright by the worker (the manager runs `make e2e`). Commit as the repo's configured author, no trailers.

## 1. Checkout failures

Scope: `apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`, this file's checkboxes, `.claude/lanes/web-P2-L11-T1.md`.
Scenarios: Customer cart write failure › Failed removal at checkout; Customer checkout refusals › Placement fails; Customer checkout unconfirmed placement › both.
Failing tests (`src/checkout.test.tsx`): "failed removal at checkout", "core cannot be reached at placement", "unconfirmed placement that emptied the cart"; "placement fails" changed (green before and after).

- [x] 1.1 The tests committed (`test: checkout failures`); lint and typecheck green; Vitest shows exactly the three new tests red
- [x] 1.2 Decisions 1 to 3 (`feat: checkout failures`); all gates green

## Workflow follow-up
- [x] Team lead runs `/opsx:verify web-checkout-failures` after 1.2 lands.
- Area manager archives the change by PR after the feature PR merges.
