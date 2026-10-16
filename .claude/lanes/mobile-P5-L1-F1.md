# mobile-P5-L1-F1 - reviewer R1 fixes (link height, verify query, retype)
Status: done
## Doing
Done. Four commits on the branch: link style test and fix, verify-email query and retype test and fix. Gates green.
## Found
- R1 #1: `lineHeight: 20` on `link` in src/auth-forms.tsx and src/app/verify-email.tsx. Style assertions in src/verify-email.test.tsx and src/password-forgot-link.test.tsx (`toHaveStyle` on lineHeight 20 and paddingVertical 12).
- R1 #2: the verify query sets `retry: false`, `retryOnMount: false`, `refetchOnMount: false`, `refetchOnWindowFocus: false`. `retryOnMount` is the option that matters for an errored query on remount (TanStack 5.104.2 loads an errored query on mount unless it is off); `refetchOnMount` alone does not cover it. Test: refused code, unmount, remount, focus, one POST in total.
- R1 #3: submit() calls `verify.refetch()` when the typed value equals the current code, else `setEntered`. Test: refused `old`, retyped `old`, second POST returns 204.
- R1 #4: covered by the #2 test; nothing added.
- The e2e worker (T4) edits the same worktree; src/app/verify-email.tsx changed under it. Its e2e run must be read against these commits.
## Requests
- to mobile-P5-L1 manager: the e2e slot is still held by T4 for 4.1 and 4.2; this lane ran no e2e and started no servers.
## Blockers
None.

## Commits
- 7a9df2d chore(mobile): reviewer log R1 for P5-L1
- a2f8c3c test: link rows hold a 44 pt target
- 81b7453 fix: 20 pt line on link rows so the 44 pt target holds
- d964133 test: refused verify code is not re-posted; a retyped one is sent
- 95f651c fix: a refused verify code is posted once; retyping it sends it again

## Gates
- `npm run lint` (apps/mobile): clean
- `npm run typecheck`: clean
- `npx jest --ci` run twice: 98 suites, 383 tests passed both times
- `openspec validate --all --strict`: 20 passed, 0 failed
