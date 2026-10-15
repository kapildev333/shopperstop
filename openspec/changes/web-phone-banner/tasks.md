# Tasks

One task, one worker, on branch `lane/web-P2-L9-phone-banner` in `.worktrees/web-P2-L9`. Read `design.md` first: Decisions 1 to 3 are the code, Tests are the test names. Brief: `briefs/task-1.md`.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-phone-banner --strict`

No Playwright by the worker: the manager runs e2e on the `test:` commit (red) and on the `fix:` commit (green). Commit as the repo's configured author, no trailers.

## 1. Phone banner and pincode sheet focus

Scope: `apps/web/src/account-link.tsx`, `apps/web/src/pincode-sheet.tsx`, `apps/web/src/pincode-sheet.test.tsx`, `apps/web/e2e/phone-layout.spec.ts`, this file's checkboxes, `.claude/lanes/web-P2-L9-T1.md`.
Scenarios: Customer banner on a phone › both; Customer pincode sheet focus › both.
Failing tests:
- `src/pincode-sheet.test.tsx`: "first visit focuses the pincode field", "banner control focuses the pincode field" (both red)
- `e2e/phone-layout.spec.ts`: `phone` › "signed-in banner on a phone" (red); `six columns` › "signed-in banner on desktop" (pin)

- [x] 1.1 The four tests committed (`test: phone banner and pincode sheet focus`); lint and typecheck green; Vitest shows the two new tests red and nothing else red
- [x] 1.2 Decisions 1 to 3 (`fix: phone banner and pincode sheet focus`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-phone-banner` after 1.2 lands and the manager's e2e is green.
- Area manager archives the change by PR after the fix PR merges.
