# web-P2-L8-T1 - web-failed-answers-without-envelope task 1: a failed answer without the error envelope is a failure (worker)
Status: done
## Doing
Landed on `lane/web-P2-L8-non-json-errors`: `test:` b0a926e, `fix:` 1d3ae26, this `chore:` log. All gates green (counts below). Nothing running. Reviewer and `/opsx:verify` are the lane's next steps.
## Found
- Commits: `b0a926e test: a failed answer without the error envelope is a failure` (eight tests appended to `apps/web/src/api.test.ts`; 1.1 ticked); `1d3ae26 fix: a failed answer without the error envelope is a failure` (`apps/web/src/api.ts`: `unreachable` moved above the middleware, `isEnvelope` added, `authMiddleware.onResponse` as design.md Decision 1; 1.2 ticked).
- Red before the fix, as the design's table predicted: "empty failed answer becomes internal", "HTML failed answer becomes internal", "other JSON failed answer becomes internal", "bare 401 drops the session and becomes internal", "failed write reports an error" (`call()` resolved to `undefined`). Green before the fix (pins): "enveloped failure passes through", "no content answer untouched", "ok JSON answer untouched". "bearer attached" and "expired session dropped" unchanged and green.
- Gates (worktree root, Node 22.23.3, after `npm ci`): `build packages/ui` exit 0; `lint apps/web` exit 0; `typecheck apps/web` exit 0; `test apps/web -- --run` exit 0, 21 files / 99 tests passed; `build apps/web` exit 0; `git status` clean after the build; `openspec validate web-failed-answers-without-envelope --strict` valid.
- Deviation: none from design.md. The test file gained two imports (`createClient`, `paths`) and `call` in the existing `./api` import, which the brief's test 8 needs.
- The test-8 `fetch` option is the process boundary, with a one-line comment above it (manager ruling).
- No Playwright, no docker run by the worker.
## Requests
- to web-P2-L8 (team lead): `/opsx:verify web-failed-answers-without-envelope` after the reviewer's pass.
## Blockers
- 2026-10-13, reviewer nits addressed: `a2fd198 test: pins for a zero content length and JSON that is not the envelope` (two green-on-arrival pins; mutation 1 copying original headers turned only the zero-length pin red, mutation 2 truthy `error` turned only the JSON pin red; both reverted). Vitest 101 passed in 21 files; lint and typecheck green.
