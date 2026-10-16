# ui-P4-L2-T3 - brief: API client and the full entry (task 3)
Status: brief
LANE-ID ui-P4-L2, task T3, area ui. Change `ui-app-shared`, task 3 (design 2, 4). Starts after T1 and T2 have landed on the branch (`src/app/index.ts`, `session.ts`, `time.ts` and the `openapi-fetch` dev dependency exist).

Worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/ui-P4-L2`, branch `lane/ui-P4-L2-app-shared` (shared with the other ui-P4-L2 workers). Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; at the worktree root `test -d node_modules || npm ci`. Read `openspec/changes/ui-app-shared/{proposal,design,tasks}.md` and the delta `specs/design-system/spec.md` first; design.md has the exact interfaces.

Rules: test first. Commit 1 is `test: ...` with only your test files, and the new tests must fail (run them and paste the failure in your report). Commit 2 is `feat: ...`, the smallest code that passes. Commit with a pathspec (`git commit -- <your files>`), never `git add -A`, never amend, never push. Commit identity `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no attribution trailers. Do not edit `tasks.md` (the team lead ticks it) or anything outside your scope; on any open design choice, stop and write it under Blockers in your log.

Gates (worktree root), all green before you report: `npm run lint --workspace packages/ui`, `npm run typecheck --workspace packages/ui`, `npm run test --workspace packages/ui -- --run`, `npm run build --workspace packages/ui`, then `make test-web`. Never run `docker compose` or touch containers.

Keep your own log `.claude/lanes/<your id>.md` (format in `.claude/lanes/README.md`) current; commit it with your feat commit.

## Scope
`packages/ui/src/app/client.ts`, `packages/ui/src/app/client.test.ts`, `packages/ui/src/app/index.ts`, `packages/ui/src/app/index.test.ts`, `.claude/lanes/ui-P4-L2-T3.md`.

## Scenarios and the failing tests to start from
- `packages/ui/src/app/client.test.ts` (jsdom) › `client attaches the bearer token`, `no session, no header`, `empty session, no header`, `401 to the current token clears it and reports the loss`, `401 to a signed-out request keeps a session set meanwhile`, `401 to a replaced token keeps the new session`, `other failures keep the session`, `plain-text 502 becomes internal`, `empty failure uses the client's message`, `enveloped failure passes unchanged`, `bare 401 ends the session and becomes internal`. Type the client with `import type { paths } from '../api/core'` and use `GET /admin/me` on `http://localhost/api/core/v1`. Session: `createTokenStore('test-token')` from `./session`. Fake the network only: create the client first, then `vi.stubGlobal('fetch', vi.fn(async (request: Request) => new Response(...)))` (this also proves the per-call lookup); for the signed-out and replaced cases the stub calls `session.set(...)` before answering. `afterEach`: `localStorage.clear()`, `vi.unstubAllGlobals()`.
- `packages/ui/src/app/index.test.ts` › `entry exports the shared helpers`: import `* as app from './index'`; `createTokenStore`, `createApiClient`, `since`, `useSince`, `when` are functions; the source of `index.ts` (read with `node:fs` as in `src/format.test.ts`) has no line importing a `.css` file.

## Commits
1. `test: app API client scenarios` (red: missing `./client` and the missing exports).
2. `feat: createApiClient with the shared session and envelope middleware`: `src/app/client.ts` exactly per design 4 (`new Response(JSON.stringify(...), { status, headers: { 'Content-Type': 'application/json' } })`, envelope = string `code` and string `message`, default message `The server did not answer as expected.`); add `export * from './client'` and `export * from './time'` to `index.ts`.

## Done when
Gates green, and the scratch check from tasks.md 3.3 prints `1 h 15 min ago 13 Oct 2026, 2:50 pm function undefined` (paste it).
