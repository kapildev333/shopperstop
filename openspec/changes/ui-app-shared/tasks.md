Lane ui-P4-L2, area ui. Every task: worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/ui-P4-L2`, branch `lane/ui-P4-L2-app-shared`; `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`, `test -d node_modules || npm ci` at the worktree root. Design in `design.md` (decision numbers below). Commits: `test: <scenarios>` (only the test files, the new tests red) then `feat: <change>`; commit with a pathspec, never amend; leave this file's checkboxes to the team lead. Gates from the worktree root: `npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`, then `make test-web`. Order: tasks 1 and 2 in parallel (disjoint files), task 3 after both.

## 1. Package entry and token store (design 1, 2, 3, 6)
Scope: `packages/ui/package.json`, `package-lock.json` (mechanical, from `npm install` only), `packages/ui/src/app/index.ts`, `packages/ui/src/app/session.ts`, `packages/ui/src/app/session.test.ts`, `packages/ui/src/app/package.test.ts`. Scenarios: "Package exports the app entry", "Stored token is read at creation", "Set and clear persist and notify", "Unsubscribed listener is not called", "Blocked storage keeps the token in memory". Failing tests: `packages/ui/src/app/package.test.ts` › `package exports the app entry`; `packages/ui/src/app/session.test.ts` › `stored token is read at creation`, `set and clear persist and notify`, `unsubscribed listener is not called`, `blocked storage keeps the token in memory`. Commits: `test: app entry and token store scenarios`, then `feat: @shopperstop/ui/app entry with createTokenStore`.

- [x] 1.1 Add the failing tests; commit `test:`
- [x] 1.2 `openapi-fetch` 0.17.0 under `devDependencies` (npm install, exact) and `peerDependencies` (by hand), `exports["./app"]` after `./format`, `src/app/session.ts`, `src/app/index.ts` with `export * from './session'` only; `npm install` at the root; commit `feat:` (lockfile included)
- [x] 1.3 Gates green; `git diff origin/main -- package-lock.json` touches only the `packages/ui` entry; `dist/app/index.js` exists after the build

## 2. Time helpers (design 5)
Scope: `packages/ui/src/app/time.ts`, `packages/ui/src/app/time.test.tsx`. Scenarios: "Relative times in whole minutes", "Stamp in the stores' time zone", "useSince keeps its text current". Failing tests: `packages/ui/src/app/time.test.tsx` › `relative times in whole minutes`, `stamp in the stores' time zone`, `useSince keeps its text current`. Commits: `test: relative and stamped times`, then `feat: since, useSince and when in the app entry`.

- [x] 2.1 Add the failing tests (they fail on the missing `./time`); commit `test:`
- [x] 2.2 `src/app/time.ts` per design 5; do not touch `index.ts`; commit `feat:`
- [x] 2.3 Gates green

## 3. API client (design 2, 4)
Scope: `packages/ui/src/app/client.ts`, `packages/ui/src/app/client.test.ts`, `packages/ui/src/app/index.ts`, `packages/ui/src/app/index.test.ts`. Scenarios: "Client attaches the bearer token", "No session, no header", "Empty session, no header", "401 to the current token clears it and reports the loss", "401 to a signed-out request keeps a session set meanwhile", "401 to a replaced token keeps the new session", "Other failures keep the session", "Plain-text 502 becomes internal", "Empty failure uses the client's message", "Enveloped failure passes unchanged", "Bare 401 ends the session and becomes internal", "Entry exports the shared helpers". Failing tests: `packages/ui/src/app/client.test.ts` › the eleven scenario names in lower case; `packages/ui/src/app/index.test.ts` › `entry exports the shared helpers`. Commits: `test: app API client scenarios`, then `feat: createApiClient with the shared session and envelope middleware`.

- [x] 3.1 Add the failing tests; commit `test:`
- [x] 3.2 `src/app/client.ts` per design 4; add `export * from './client'` and `export * from './time'` to `index.ts`; commit `feat:`
- [x] 3.3 Gates green; from a scratch directory outside the repo with `node_modules/@shopperstop/ui` symlinked to the worktree's `packages/ui`, `node --input-type=module -e "import { since, when, createApiClient, createTokenStore } from '@shopperstop/ui/app'; console.log(since('2026-10-13T09:00:00Z', Date.parse('2026-10-13T10:15:00Z')), when('2026-10-13T09:20:00Z'), typeof createApiClient({ baseUrl: 'http://x' }).GET, createTokenStore('k').get())"` prints `1 h 15 min ago 13 Oct 2026, 2:50 pm function undefined` with no DOM global (Node follows the symlink, so `react` and `openapi-fetch` resolve from the worktree's root `node_modules`)

## 4. Acceptance (team lead) and verification (manager)
- [x] 4.1 Team lead `/opsx:verify`: every scenario in the delta has a passing same-named test, tasks 1 to 3 ticked, test-first order per task, diff only in the files design.md lists plus this change and the ui-P4-L2 lane logs
- [ ] 4.2 Manager: `make test-web` green on the lane head (every workspace), `openspec validate --all --strict`; nothing under `apps/` changed
