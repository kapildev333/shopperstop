# ui-P4-L2 T3 - API client and the full entry (task 3)
Status: started
## Doing
Committed `test: app API client scenarios` (80a749a, red: missing `./client` and the missing exports). `feat:` adds `src/app/client.ts` per design 4 and the `client` and `time` export lines in `index.ts`; the 20 app tests are green. Then a `refactor:` commit types the test stubs so lint and typecheck pass; gates and the scratch check follow.
## Found
- `createApiClient<Paths>` returns openapi-fetch's `Client<Paths>`; the 401 rule and the envelope check run in one `onResponse` middleware (design 4).
- `index.ts` now re-exports session, client and time; `@shopperstop/ui/app` is complete for the apps' swap.
## Requests
None.
## Blockers
None.
