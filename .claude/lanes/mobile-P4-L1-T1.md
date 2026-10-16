# mobile-P4-L1-T1 - workspace scaffold (mobile-foundation-accounts, task 1)
Status: started
## Doing
Red commit: `apps/mobile/src/no-literal-colors.test.ts` (two tests). Next: workspace files and the feat commit.
## Found
- Red (1.4), `npm run test --workspace apps/mobile -- --run` on the tree before the workspace exists:
  ```
  npm error No workspaces found:
  npm error   --workspace=apps/mobile
  ```
  npm exits 1; the test cannot run without the workspace and Jest, so this is the red state.
## Requests
## Blockers
