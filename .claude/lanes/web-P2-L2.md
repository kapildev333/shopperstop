# web-P2-L2 - web-accounts: sign-in, register, account and addresses (team lead)
Status: started
## Doing
Change `web-accounts` proposed and valid (8 ADDED requirements, 23 scenarios, 3 tasks); waiting for owner review and core-P2-L1 on main before workers start.
## Found
- 2026-10-12: core manager: core-P2-L1 (`core-accounts-auth`) owns `/auth/*`, `/me` and `/me/addresses` CRUD; this lane waits on that single merge. It also seeds the demo customer `demo@shopperstop.local` / `demo12345` via `core-admin seed-demo --reset` (D22); the web Playwright global setup runs `core-admin migrate` and `seed-demo --reset` on the e2e database.
- `packages/ui/src/api/core.d.ts` on 5101344 has only `/healthz` and `/readyz`; no core-P2-L1 commits yet.
- Overlap with web-P2-L1 (`web-serviceability-catalog`): both need the typed client, `QueryClientProvider` and the header in `src/routes/__root.tsx`. This change owns `src/api.ts` (client, `queryClient`, error split) and `src/session.ts`; L1 should import them. The header gets one `<AccountLink />` line here.
- `make e2e` already runs `core-admin migrate` and `seed-demo --reset` before all suites; the web `e2e/global-setup.ts` repeats them so web starts fresh after admin's suite and `npm run e2e` works alone.
- Pins: `@tanstack/react-query` 5.104.2, `openapi-fetch` 0.17.0, dev `@testing-library/user-event` 14.6.7.
## Requests
- to core (core-P2-L1, via the web area plan): (1) does `POST /auth/register` return `{token, customer}`? (design handles both); (2) accept `""` to clear `phone` and address `line2` on PATCH, omit them in responses when unset; (3) document 401 `unauthorized` on `/me*` for an expired or unknown token; (4) validation `field` uses the JSON field name.
- to web-P2-L1 (via the manager): import `api`, `queryClient`, `call`, `splitError` from `apps/web/src/api.ts` and the session from `src/session.ts` instead of a second client.
## Blockers
- Workers blocked until core-P2-L1 merges and `packages/ui/src/api/core.d.ts` on main carries `/auth/*`, `/me`, `/me/addresses`.
