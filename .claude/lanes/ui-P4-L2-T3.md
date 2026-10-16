# ui-P4-L2 T3 - API client and the full entry (task 3)
Status: done (commits 80a749a test, e70f9cf feat, dc25ba5 test, 77609a8 fix, a0f0a43 refactor; gates green, `make test-web` green)
## Doing
Done. `createApiClient` (design 4) and the `client`/`time` export lines are in. The plain-Node check from tasks.md 3.3 prints the expected line.
## Found
- `createApiClient<Paths>` returns openapi-fetch's `Client<Paths>`; the 401 rule and the envelope check share one `onResponse` middleware.
- The package emits extensionless relative imports everywhere (bundler resolution). Node's ESM loader cannot load `dist/app/index.js` that way, so the app entry now uses `./session.js`, `./client.js`, `./time.js` (77609a8). The other `dist` entries keep the extensionless form; Vite and Metro resolve it. Anyone importing `@shopperstop/ui/app` from plain Node needs this.
- `index.ts` now re-exports session, client and time; the entry is complete for the apps' swap.
## Requests
None.
## Blockers
None.
