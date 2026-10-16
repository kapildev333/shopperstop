# Tasks

One task, one worker, on branch `lane/web-P2-L5-e2e-flows` in `.worktrees/web-P2-L5`. Read `design.md` first: Decision 1 is the config entry, Decision 2 the two tests step by step. Brief: `briefs/task-1.md`.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `git status` clean
- `openspec validate web-e2e-flows --strict`

No Playwright by the worker (the manager runs `make e2e`, red on 1.1 and green on 1.2, as design.md "Red and green" says). Commit as the repo's configured author, no trailers.

## 1. Cross-app flows

Scope: `apps/web/e2e/flows.spec.ts` (new), `apps/web/playwright.config.ts`, this file's checkboxes, `.claude/lanes/web-P2-L5-T1.md`.
Scenarios: web-app › "Customer site end-to-end suite with axe" › Admin preview served for the cross-app flows; "Customer cross-app end-to-end flows" › Customer order taken to delivered by store staff, Admin product found by customer search.
Failing tests (`e2e/flows.spec.ts`): "customer order to delivered across both apps", "admin product found by customer search"; red because nothing serves port 15174 in the web suite.

- [x] 1.1 The spec file committed (`test: cross-app flows`); lint and typecheck green; `grep -c 15174 apps/web/playwright.config.ts` prints 0; manager's `make e2e` shows exactly the two new tests red at the admin origin
- [x] 1.2 The admin preview `webServer` (`feat: serve the admin preview in the web suite`); gates green; manager's `make e2e` admin 14, web 42

## Workflow follow-up
- [x] Team lead runs `/opsx:verify web-e2e-flows` after 1.2 lands and the manager's green run is recorded.
- Area manager archives the change by PR after the feature PR merges.
