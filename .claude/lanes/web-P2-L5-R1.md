# web-P2-L5-R1 - review of task 1 (cross-app flows)
Status: done
## Doing
Reviewed 0d4a7cf, a6185ed against web-e2e-flows. Verdict: approve with nits.
## Found
- Gates re-run: build packages/ui, lint, typecheck (includes e2e/), vitest, build apps/web, `openspec validate --all --strict` (16 passed): all green. Playwright not run (manager).
- Locators checked against web and admin source: all match. Test commit precedes feat; test needs the admin webServer.
- Nit: apps/web/playwright.config.ts:21 serves the admin build; standalone `npm run e2e --workspace apps/web` fails unless apps/admin/dist exists (make e2e builds all first). Comment could say so.
- Nit: flows.spec.ts:61 "cart goes with the session" asserts only the empty Cart button; fine, guest merge is covered by cart.spec.ts (design line 115).
## Requests
