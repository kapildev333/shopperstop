# web-P2-L10-T1 - web-cart-write-failure task 1: cart write failure message (worker)
Status: done
## Doing
Task 1 landed on the branch: `test:` 24436e4 (five red), `test:` 9b3fdf6 (seam, still five red), `feat:` (Decisions 2 to 5). Handed back to the team lead for `/opsx:verify`.
## Found
- Seam (design Decision 5, team lead's option (c)): `api.ts` `createClient` takes `baseUrl: \`${location.origin}/api/core/v1\`` and `fetch: (request) => globalThis.fetch(request)`, so `fetch` is looked up per call. `test-setup.ts` sets a default `fetch` that throws `TypeError('fetch failed')`. The refusal test uses `vi.stubGlobal` with a 400 envelope and `vi.unstubAllGlobals` in `afterEach`. No Request shim, no `vi.resetModules`.
- Red at 9b3fdf6: 5 failed, 142 passed of 147; all five `Unable to find role="alert"`. Lint and typecheck green.
- Gates at the feat commit: `packages/ui` build, lint, typecheck green; Vitest 147 passed of 147 (26 files); `apps/web` build green; `git status` clean after the build apart from the commit; `openspec validate web-cart-write-failure --strict` valid. Cart files (`cart.test.tsx`, `cart-drawer.test.tsx`, `cart-write-failure.test.tsx`) 27 of 27 on each of 3 runs.
- Rejected earlier: the `vi.hoisted` stub (test-setup imports `api.ts` first) and the `Request` shim (a global platform replacement). The api-level cover in `api.test.ts` is unchanged.
- Other lanes: none addressed to this lane. No Playwright, no Docker.
## Requests
- to web-P2-L10 (team lead): ready for `/opsx:verify web-cart-write-failure`.
## Blockers
(none)
