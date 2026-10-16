# ui-P4-L2 - shared app client, token store and time helpers (OpenSpec change ui-app-shared)
Status: started
## Doing
Team lead: change proposed and valid (strict); briefs T1, T2, T3 written; waiting for the manager to launch T1 and T2 (parallel), then T3.
## Found
- Change `openspec/changes/ui-app-shared/`: proposal, delta `specs/design-system/spec.md` (6 ADDED requirements, largest body 436 characters, 20 scenarios), design.md (comparison table of the four apps' copies, exact interfaces, files per task, test strategy), tasks.md (3 worker tasks, 1 acceptance/verification task). `openspec validate ui-app-shared --strict` valid; `--all --strict` 20 passed. No `docs/design/ui-P4-L2.md`: design.md is enough.
- New entry `@shopperstop/ui/app`: `createTokenStore(key)` ({ get, set, subscribe }, `undefined` = no token), `createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })`, `since`, `useSince`, `when`. Nothing in existing exports changes; nothing in `apps/`.
- Differences resolved: the 401 rule is admin/rider/mobile's (current token only; web today clears on any 401, so web's swap modifies its `web-app` requirement); the envelope check is web's stricter one (`code` and `message` strings) with `new Response` and only `Content-Type`; the fallback message is a per-client option (admin/rider default, web/mobile pass "Could not reach ShopperStop. Try again."). Expiry is server-side in every app (30-day sliding for customer and rider sessions in core and the rider service); the client store holds none.
- Out of scope with reasons in proposal/design: router factory (binds each app's routeTree and Register; would add two TanStack runtime deps to ui), web/mobile `call`/`splitError`, `itemCount`, web's `formatWhen`, a `useToken` hook.
- `openapi-fetch` 0.17.0 becomes a peer and dev dependency of `packages/ui` (runtime import; D10 covers tooling only) and root `package-lock.json` changes mechanically in T1: both for the orchestrator to record.
## Requests
- to orchestrator: record `openapi-fetch` 0.17.0 as a peer dependency of `packages/ui` (D10 extension) and accept the mechanical root `package-lock.json` change in this lane.
- to web, admin, rider (after merge, via their area plans): swap `api.ts`/`session.ts` (and admin `orders.ts`, rider `format.ts` time helpers) to `@shopperstop/ui/app`; web also MODIFIES its `web-app` token requirement to the current-token 401 rule.
- to mobile (optional): `createApiClient` with `session: { get: getToken, set: setToken }` and `failureMessage`; the time helpers.
## Blockers
