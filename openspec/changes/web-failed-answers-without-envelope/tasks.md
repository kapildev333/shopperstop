# Tasks

One task, one worker, on branch `lane/web-P2-L8-non-json-errors` in `.worktrees/web-P2-L8`. Read `design.md` first: Decision 1 is the code, Decision 3 the tests.

Gates, from the worktree root, Node 22.12+ (D11), prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"` (`npm ci` first: the worktree has no `node_modules`): `npm run build --workspace packages/ui`, `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web -- --run`, `npm run build --workspace apps/web`, `git status` clean after the build, `openspec validate web-failed-answers-without-envelope --strict`. No Playwright and no docker by the worker. Commit as the repo's configured author, no trailers.

## 1. A failed answer without the error envelope is a failure

Scope: `apps/web/src/api.ts`, `apps/web/src/api.test.ts`, this file's checkboxes, the lane log `.claude/lanes/web-P2-L8-T1.md`. Not in scope: every other file (no call site changes, `call()` keeps its signature and body, `api` gets no `fetch` option).
Scenarios: Customer failed answers without the error envelope › all eight.
Failing tests, appended to `apps/web/src/api.test.ts`, named after the scenarios:
1. "empty failed answer becomes internal" (red)
2. "HTML failed answer becomes internal" (red)
3. "other JSON failed answer becomes internal" (red)
4. "enveloped failure passes through" (green on arrival, a pin)
5. "bare 401 drops the session and becomes internal" (red)
6. "no content answer untouched" (pin)
7. "ok JSON answer untouched" (pin)
8. "failed write reports an error" (red: `call()` resolves to `undefined`)

Say in the `test:` commit body which five are red and which three are pins.

Easy to get wrong:
- Tests 1 to 7 call `authMiddleware.onResponse!({ response } as never)` and `await` it, as "expired session dropped" does. Assert on what comes back: `status`, and `await out.json()`.
- Tests 4, 6 and 7: `expect(out).toBe(response)` (the same object), then read the body from `out` (4 and 7: `json()` equals what was sent; 6: `text()` is `''`). Reading it proves the middleware read a clone. Build 204 with `new Response(null, { status: 204 })`.
- Test 8: a local client in the test, `createClient<paths>({ baseUrl: 'http://localhost/api/core/v1', fetch: async () => new Response('', { status: 502 }) })`, then `.use(authMiddleware)`, then `await call(() => client.PATCH('/me', { body: { name: 'A', phone: '' } }))` equals `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }`. The base URL is absolute: a relative one fails under jsdom. No `vi.mock`, no `vi.stubGlobal`.
- The fix: keep `if (response.status === 401) setToken(undefined)` first; return ok answers before reading anything; read with `response.clone()`, never the response itself; return the original object when the body is the envelope.
- The new `Response` gets the original status and only a `Content-Type: application/json` header. Do not copy the original headers.
- Reuse the `unreachable` constant (move it above the middleware). No new copy, no new export, no change to `call()`, `splitError` or `useMe`.
- "expired session dropped" and "bearer attached" stay as they are and stay green.

- [x] 1.1 The eight tests committed (`test: a failed answer without the error envelope is a failure`); lint and typecheck green; Vitest shows 1, 2, 3, 5 and 8 red and nothing else red
- [ ] 1.2 `onResponse` as in design.md, Decision 1 (`fix: a failed answer without the error envelope is a failure`); all gates green

## Workflow follow-up
- [ ] Team lead runs `/opsx:verify web-failed-answers-without-envelope` after 1.2 lands.
- Area manager archives the change by PR after the fix PR merges.
