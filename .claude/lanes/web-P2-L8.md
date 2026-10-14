# web-P2-L8 - web-failed-answers-without-envelope: a failed answer without core's error envelope is still a failure (team lead)
Status: started
## Doing
Proposed 2026-10-13; one worker task ready (tasks.md, task 1). Waiting for the worker, then `/opsx:verify`.
## Found
- Change: `openspec/changes/web-failed-answers-without-envelope/` (proposal; `web-app` delta: 1 ADDED requirement "Customer failed answers without the error envelope", 8 scenarios; design with the audit table; tasks, one task). No `docs/design/web-P2-L8.md`: design.md is enough.
- Confirmed against `openapi-fetch` 0.17.0 (`dist/index.mjs` lines 157-201, read from `.worktrees/admin-P2-L4/node_modules`; the root checkout has no `node_modules/openapi-fetch`) and by running a client with a `fetch` that returns real responses: not ok + empty body gives `error: ""` (`undefined` with `Content-Length: 0`), HTML gives the string, other JSON gives that value, 204 gives `data: undefined` and no error.
- Audit: six writes report success for such a failure (`clearCart`, profile save, address add and edit, set default, delete address). `setLine`, `mergeGuestCart`, sign-in, register and sign-out are safe through their own guards. The nine reads reach the error state, by accident (a string, a `TypeError` or TanStack Query's "data is undefined").
- Fix: `authMiddleware.onResponse` in `apps/web/src/api.ts` only; no call site, `call()` unchanged (it has no response to look at; the one client carries the middleware). The same design with the fix applied was run against the same eight answers: every failure yields `error.error`, 204 and 200 untouched.
- The replacement `Response` must not copy the original headers: `Content-Length: 0` makes `openapi-fetch` answer `error: undefined` again.
- Ceilings: body and status text dropped, not logged; a non-envelope 4xx is `internal` with the "Could not reach" copy; `useProduct` still shows "Product not found" for a bare 404 (status check first); a second client without the middleware would bring the bug back.
- For web-P2-L4: every failed answer is `{ error: { error: ApiError } }`, code `internal` when core did not write it, `response.status` unchanged. Place the order through `call()` on the shared `api`, capture `data` as `cart.ts:115-121` does, treat `error || !data` as failure, create no second client. `internal` on `POST /orders` does not prove the order was not placed (a proxy can answer 502 after core committed): re-read before a blind retry.
- Archive rehearsed on a scratch copy: `web-app` gets 1 requirement (41 in all), `openspec validate --all --strict` passes, the new requirement is 490 characters (longest existing 498). `web-checkout-orders` in web-P2-L4's worktree has no delta yet; it must not reuse this requirement's name.
- Not run by this lane: Vitest (the worktree has no `node_modules`). Red and green are stated from the library source and the probe; the worker's 1.1 run confirms them.
## Requests
## Blockers
