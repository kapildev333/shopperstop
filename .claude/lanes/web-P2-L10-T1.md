# web-P2-L10-T1 - web-cart-write-failure task 1: cart write failure message (worker)
Status: blocked
## Doing
Stopped before commit 2 (`feat:`). Waiting for the team lead's decision on the refusal test's fetch seam (see Blockers). Feature code (Decisions 2 to 4) is in the worktree, uncommitted, and makes every other test green.
## Found
- Commit 1 `24436e4` `test: cart write failure message`: five red tests as the brief lists (no alert today): "failed write tells the customer", "next tap clears the failure", "overtaken write shows no failure" (`cart.test.tsx`), "core's refusal is shown" (`cart-write-failure.test.tsx`), "failed write in the drawer" (`cart-drawer.test.tsx`). Red reason for all five: `Unable to find role="alert"`. Lint and typecheck green. Vitest before the commit: 5 failed, 22 passed.
- Feature code, uncommitted (`api.ts` export of `unreachable`; `cart.ts` `setLine` returns `ApiError | undefined`, `useLineWrite`, `useCartQuantity` returns `[quantity, write, failure]`; `product-card.tsx`, `routes/p.$slug.tsx`, `cart-drawer.tsx` `CartLineRow` with the banner under the row). With it: 146 of 147 Vitest tests pass; `cart.test.tsx` and `cart-drawer.test.tsx` pass 3 of 3 runs (26 tests each run). Lint, typecheck, `packages/ui` build and `apps/web` build green. `openspec validate web-cart-write-failure --strict` valid.
- The brief's stub for "core's refusal is shown" does not work, for two reasons, both verified:
  1. `test-setup.ts` imports `api.ts` before any test file runs, and openapi-fetch takes `globalThis.fetch` as a default argument when `createClient` runs. The `vi.hoisted` stub is set too late for that client.
  2. Even on a fresh client (`vi.resetModules()` then re-import), openapi-fetch builds `new Request('/api/core/v1/...')` with a relative URL. Node's `Request` throws `Invalid URL` before `fetch` is called, so the fake never runs. This is why the existing "cannot reach" path works under jsdom.
- A throwaway experiment, not committed: a `Request` subclass that resolves a leading `/` against `http://localhost`, set in the test before `vi.resetModules()` and the re-import, makes "core's refusal is shown" pass with the feature code (`Received: product not available`, count 1).
- Git history: a second test commit `25b6db0` (the re-import approach) was dropped as unpushed and wrong (its message claimed a fix that does not work). The branch tip is `24436e4`.
## Requests
- to web-P2-L10 (team lead): choose the seam for "core's refusal is shown". Options: (a) a test-only `Request` shim as in the experiment above, in `cart-write-failure.test.tsx` only (a global replacement of a platform class in one file); (b) drop the test and cover the 400 mapping elsewhere (e.g. `api.test.ts` at the middleware, which already calls `authMiddleware` directly); (c) something else. Worker needs the decision before commit 2; not chosen here.
- to web-P2-L10 (team lead): the brief's stub mechanism (`vi.hoisted` before any import) cannot work with `test-setup.ts` importing `api.ts` first; the design's "Under jsdom a relative fetch throws" is right but the throw is `Request`'s, not `fetch`'s. Design wording may need a correction.
## Blockers
- Brief gate `npm run test --workspace apps/web -- --run` is not green: one test ("core's refusal is shown") fails by design of the seam above. Commit 2 not made; gates not complete.
- Deviations from the brief so far: none in code scope. Commit 1 is `test: cart write failure message` as briefed; no other commit on the branch.
