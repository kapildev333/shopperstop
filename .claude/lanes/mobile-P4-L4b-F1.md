# mobile-P4-L4b-F1 - cart reads throw core's inner error
Status: done
## Doing
Done: test commit 16b6624, fix commit 8f9de62 (apps/mobile/src/cart.ts, one line).
## Found
- `cartOptions` (GET /me/cart) threw core's whole envelope; now throws `error.error`, so ErrorBanner reads `code` ("Something went wrong on our side" for a 500 instead of "You're offline").
- Only `throw error` on an openapi-fetch result in cart.ts; every other throw in the file already reads `error.error`. No other file in apps/mobile/src has a bare `throw error` on a client result.
- Gates: `npx jest --ci src/cart.test.ts` 11/11 pass; `npm run lint` exit 0; `npm run typecheck` exit 0. Full `npx jest --ci` in this shared worktree: only failing suite is src/checkout-address.test.tsx (task 2 of the other workers, in progress, not touched here).
## Requests
- to mobile-P4-L4b: checkout-address.test.tsx currently fails in the shared worktree; owned by the task-2 worker.
## Blockers
none
