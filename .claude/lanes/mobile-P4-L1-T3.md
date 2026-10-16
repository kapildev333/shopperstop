# mobile-P4-L1-T3 - sign in, register, sign out (mobile-foundation-accounts, task 3)
Status: done
## Doing
Task 3 done on `lane/mobile-P4-L1-foundation-accounts`: red `test:` commit e416b4c (`auth.test.ts`, five scenarios), green `feat:` commit a0ab7b7 (`auth.ts`, boxes 3.1 to 3.3 ticked). Nothing pushed.
## Found
- Red (3.1), `npm run test --workspace apps/mobile -- --run` before `auth.ts` existed:
  ```
  FAIL src/auth.test.ts
    ● Test suite failed to run
      Cannot find module './auth' from 'src/auth.test.ts'
  Test Suites: 1 failed, 8 passed, 9 total   (plus another worker's untracked button.test.tsx)
  ```
- Green (3.2): `src/auth.ts` exports `safeReturnTo`, `signIn`, `register`, `signOut`, plus the private `openSession` and `startSession`. `useMe` was not added: no T3 test needs it, and task 3 names it only as "stays in `api.ts`" for a later task.
- Gates on the committed state (a0ab7b7 plus the other workers' landed commits): `npm run build --workspace packages/ui` exit 0; `npm run lint --workspace apps/mobile` exit 0; `npm run typecheck --workspace apps/mobile` exit 0; `npm run test --workspace apps/mobile -- --run`: `Test Suites: 9 passed, 9 total`, `Tests: 46 passed, 46 total`; `npm run build --workspace apps/mobile` exit 0 in 2 s (`dist` holds `index.html`, `+not-found.html`, `_sitemap.html`; `sign-in.html` and `register.html` come with task 11); `openspec validate mobile-foundation-accounts --strict`: `Change 'mobile-foundation-accounts' is valid`.
## Deviations and choices (for the team lead)
- The signed-in cache key is `['me', token]` with the `Customer` from the answer, as the brief says. `CustomerSession` is `{ token, customer }` in `services/core/openapi.json`, so the answer is read from `data`.
- Sign-in and register answer `200` and `201` respectively; `openSession` treats any non-error answer with a session as success. A success without a session body returns the `internal` error (copied from web's wording), which no scenario tests.
- `signOut` ignores the result of `POST /auth/sign-out` (a 401 or unreachable core still clears the session), as the spec and design say.
- Commit hygiene: the shared index and worktree carried another worker's unstaged 5.x ticks in `tasks.md`. The `feat:` commit was built from a HEAD copy of `tasks.md` with only 3.1 to 3.3 ticked, staged by blob, so the other worker's 5.x ticks are not in a commit of mine.
## Requests
- none
## Blockers
None.
