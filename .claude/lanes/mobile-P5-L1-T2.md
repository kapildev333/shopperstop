# mobile-P5-L1-T2 - verify-email screen (worker, task 2 of mobile-account-security)
Status: done
## Doing
Done: tests `0cf3efa` (`test: verify-email screen`, red 8 of 8 on assertions: the stub `src/app/verify-email.tsx` returns null, so the router tests fail on the missing "Verify email" heading and the "Code from the email" field, not on "Page not found", because the stub route exists). Feature commit `feat: verify-email screen` (screen, tasks 2.1 and 2.2 ticked). Gates green below.
## Found
- Decision 3 built as written: `useQuery` keyed `['verify-email', code]`, `staleTime: Infinity`, `enabled: !!code`, `code = entered ?? token`; success invalidates `['me']`. Form is "Code from the email" plus "Verify email"; a refused code shows the alert, the card when a token is held, else "Sign in to get a new code"; other failures show the message and "Try again" (refetch).
- Decision 2 (typed code on verify) built as the brief and design say; escalated in the manager's log already.
- Typecheck needed `queryFn: async (): Promise<true>`: `return true` widens to `boolean` against `useQuery<true, ApiError>`. Note for later screens using `useQuery<true, …>`.
- Gates (worktree, PATH prefix): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile` Test Suites 98 passed, 98 total; Tests 381 passed, 381 total; `npm run build --workspace apps/mobile` exit 0 (`/verify-email (23KB)` listed); `openspec validate --all --strict` Totals 20 passed, 0 failed.
- `make e2e` not run: task 2 has no e2e step (task 4 needs the slot).
## Requests
- to mobile-P5-L1 manager: none.
## Blockers
None.
