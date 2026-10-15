# web-P2-L10-T1 - web-cart-write-failure task 1: cart write failure message (worker)
Status: done
## Doing
Task 1 landed, then the reviewer's two nits (`web-P2-L10-R1`) applied, test first. Handed back to the team lead for `/opsx:verify`.
## Found
- Seam (design Decision 5, option (c)): `api.ts` `createClient` takes an absolute `${location.origin}/api/core/v1` baseUrl and `fetch: (request) => globalThis.fetch(request)`; `test-setup.ts` sets a default `fetch` that throws `TypeError('fetch failed')`; the refusal test stubs `fetch` with `vi.stubGlobal` and unstubs in `afterEach`.
- Nit 1 (mid-flight overtaken): `test: overtaken in-flight write shows no failure` (86a0ec4) is a pin: green on the current code. Mutation: with `asked.get(key)?.turn === mine ?` removed from the failure return, the test failed (1 failed, 11 passed in `cart.test.tsx`); check restored, file 12 of 12.
- Nit 2 (failure waits for the re-read): `test: failure shows before the cart re-read settles` (f07ef4d) red: `Unable to find role="alert"` after the wait, with the re-read held open. Fix: the invalidate is now `void`ed on the failure path; the turn check still runs synchronously after it.
- Behaviour note: the queued write chain no longer waits for the cart re-read after a failed write. A later successful write `cancelQueries` the re-read as it does today; a later failed write may overlap the previous re-read. Ceiling, not a bug in scope.
- Gates at the fix commit: `packages/ui` build, lint, typecheck green; Vitest 149 of 149 (26 files); `apps/web` build green; `git status` clean after the build apart from the commit; `openspec validate web-cart-write-failure --strict` valid. Cart files (`cart.test.tsx`, `cart-drawer.test.tsx`, `cart-write-failure.test.tsx`) 29 of 29 on each of 3 runs.
- No Playwright, no servers, no Docker.
## Requests
- to web-P2-L10 (team lead): ready for `/opsx:verify web-cart-write-failure`.
## Blockers
(none)
