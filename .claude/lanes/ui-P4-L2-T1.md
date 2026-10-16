# ui-P4-L2-T1 - brief: package entry and token store (task 1)
Status: done (feat commit on lane branch lane/ui-P4-L2-app-shared; gates green)
LANE-ID ui-P4-L2, task T1, area ui. Change `ui-app-shared`, task 1 (design 1, 2, 3, 6). Parallel with T2 (disjoint files); T3 starts after you and T2 land.

Worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/ui-P4-L2`, branch `lane/ui-P4-L2-app-shared` (shared with the other ui-P4-L2 workers). Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; at the worktree root `test -d node_modules || npm ci`. Read `openspec/changes/ui-app-shared/{proposal,design,tasks}.md` and the delta `specs/design-system/spec.md` first; design.md has the exact interfaces.

Rules: test first. Commit 1 is `test: ...` with only your test files, and the new tests must fail (run them and paste the failure in your report). Commit 2 is `feat: ...`, the smallest code that passes. Commit with a pathspec (`git commit -- <your files>`), never `git add -A`, never amend, never push. Commit identity `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution trailers. Do not edit `tasks.md` (the team lead ticks it) or anything outside your scope; on any open design choice, stop and write it under Blockers in your log.

Gates (worktree root), all green before you report: `npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`, then `make test-web`. Never run `docker compose` or touch containers.

Keep your own log `.claude/lanes/<your id>.md` (format in `.claude/lanes/README.md`) current; commit it with your feat commit.

## Scope
`packages/ui/package.json`, `package-lock.json` (only through `npm install`), `packages/ui/src/app/index.ts`, `packages/ui/src/app/session.ts`, `packages/ui/src/app/session.test.ts`, `packages/ui/src/app/package.test.ts`, `.claude/lanes/ui-P4-L2-T1.md`.

## Scenarios and the failing tests to start from
- `packages/ui/src/app/package.test.ts` (`// @vitest-environment node`, reads `../../package.json` like `scripts/gen-tokens.test.ts`) › `package exports the app entry`: `exports["./app"]` is `{ types: './dist/app/index.d.ts', default: './dist/app/index.js' }`; `peerDependencies["openapi-fetch"]` and `devDependencies["openapi-fetch"]` are `0.17.0`; `exports["."]`, `["./format"]`, `["./tokens"]` equal their current values (copy them from package.json into the test).
- `packages/ui/src/app/session.test.ts` (jsdom) › `stored token is read at creation`, `set and clear persist and notify`, `unsubscribed listener is not called`, `blocked storage keeps the token in memory` (spy `Storage.prototype.getItem`/`setItem`/`removeItem` to throw). `afterEach`: `localStorage.clear()`, `vi.restoreAllMocks()`. Exact WHEN/THEN in the delta.

## Commits
1. `test: app entry and token store scenarios` (the two test files; red: missing `./session`, missing entry).
2. `feat: @shopperstop/ui/app entry with createTokenStore`: `npm install --workspace packages/ui --save-dev --save-exact openapi-fetch@0.17.0`; add `"openapi-fetch": "0.17.0"` to `peerDependencies` by hand (alphabetical, before `react`); `"./app"` entry right after `"./format"`; `src/app/session.ts` per design 2 and 3; `src/app/index.ts` = `export * from './session'` only; `npm install` at the root; commit `packages/ui/package.json package-lock.json packages/ui/src/app/session.ts packages/ui/src/app/index.ts` and your log.

## Done when
Gates green; `git diff origin/main -- package-lock.json` touches only the `packages/ui` entry (paste it); `packages/ui/dist/app/index.js` exists after the build.

## Doing
Done: `test:` 745ee66 (red: missing `./session`; `./app` export missing), then the `feat:` commit with the `@shopperstop/ui/app` entry and `createTokenStore`.

## Found
- `openapi-fetch` 0.17.0 is now a peer and dev dependency of `packages/ui`; root `package-lock.json` diff is two lines in the `packages/ui` entry only.
- `src/app/time.ts` and `time.test.tsx` in the shared worktree belong to T2 and are not in this commit; the build compiles all of `src`, so `dist/app/` also holds T2's `time.*`.
- `npm ci` in this worktree failed twice with ENOTEMPTY while another process installed into the same `node_modules`; it succeeded once that process finished.

## Requests
- to orchestrator: record `openapi-fetch` 0.17.0 as a peer dependency of `packages/ui` (design 6; D10 covers dev tooling only).

## Blockers
None.
