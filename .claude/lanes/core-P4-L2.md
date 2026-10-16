# core-P4-L2 - accounts security: email verification, password reset, seed-demo guard (OpenSpec change core-accounts-security)
Status: started
## Doing
2026-10-16: change `core-accounts-security` written and validated (`--strict`; `--all --strict` 20 passed); three worker briefs (`core-P4-L2-t1.md`, `-t2.md`, `-t3.md`), sequential on the lane branch. Waiting for the manager to launch task 1.
## Found
- Change `openspec/changes/core-accounts-security/`: deltas `accounts` (MODIFIED "Customers register with email and password", "Sign-in and registration are rate limited", "Demo customer"; ADDED "Customers verify their email", "Customers reset a forgotten password", "Mailed codes are single use and expire", "Mail is logged until a transport exists") and `platform` (ADDED "Seed-demo refuses a database on another machine"). Every requirement body under 500 characters. design.md carries every hand-written change as a verbatim diff (chain checked with `git apply` on 49553f4) plus two `openapi.json` scripts. No `docs/design/core-P4-L2.md`: design.md is enough.
- Spike in this worktree, tree restored before the commit: after each task every core package green under `-race -count=1`; `make gen postman` clean (17 Postman tests pass); web, admin, rider, ui typecheck.
- D46 item 3 (expired-session sweep) is already met by core-P3-L3: `startSession` deletes every expired session on each registration and sign-in (accounts "Expired sessions are deleted"). Nothing added; no `sweep-sessions` command (ceiling: an instance with no sign-ins keeps dead rows, harmless, never admitted). Mailed codes need no sweep: one row per customer and purpose.
- `Customer.emailVerified` is required (always-present boolean). Cross-area break (spiked): `apps/mobile/src/profile-sheet.test.tsx` line 7 fails TS2741 at lines 15, 32, 46. Fix typechecks against old and new `core.d.ts`, 3/3 jest green with it.
- `seed.Reset` must truncate `customer_tokens` (FK to customers), done in task 1.
- The guard covers plain `seed-demo` too (demo admin with a public password on a shared database); `--force` overrides.
- Folded in from platform-P4-L3 (manager, 2026-10-16): the `rider` request example of `POST /admin/orders/{id}/status` now precedes `staff` (task 1 script). Postman landing order: whichever of core-P4-L2 and platform-P4-L3 merges second merges main and re-runs `make postman`.
## Requests
- to mobile (through the core area plan and the orchestrator, before task 1 merges): `apps/mobile/src/profile-sheet.test.tsx` line 7: `const customer = { id: '6f1c2a9e-0d7b-4c1e-9a55-2b3c4d5e6f70', email: 'asha@example.test', name: 'Asha Rao', emailVerified: false }`.
- to web, mobile, admin (information, after merge): `Customer.emailVerified`; `POST /me/email-verification` 202/409; `POST /auth/verify-email {token}` 204/400 `token`; `POST /auth/password-reset {email}` always 202 (400 `email`, 429); `POST /auth/password-reset/confirm {token, password}` 204, ends every session (clear the stored token), 400 `password` or `token`. Codes arrive in core's log in development (`msg":"mail"`, last word of `body`).
## Blockers
None.
