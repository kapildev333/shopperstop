# web-P5-L1 - web-account-security (team lead)
Status: started
## Doing
Task 2 landed: test `439f1f7`, feat `6594da1` (tasks 2.1 and 2.2 ticked). Task 3 (e2e, mail reader and core log) next, with the web manager and the e2e slot.
## Found
- Change `openspec/changes/web-account-security/`: 11 ADDED `web-app` requirements (all under 500 characters, largest 486), no MODIFIED. No `docs/design/web-P5-L1.md`: design.md settles every choice.
- Playwright starts core with `shell: true` and ignores its stdout in the runner process; tests cannot read it. Decision: core's webServer command becomes `go run ./cmd/core > <apps/web/e2e/.tmp/core.log>` (gitignored dir), `e2e/mail.ts` reads the `mail` JSON line (format specified by `accounts` "Mail is logged until a transport exists"). No core change needed.
- Baseline at 29e571a in this worktree: web lint and typecheck clean, Vitest 26 files, 164 tests.
- Tasks run one after another: Tasks 1 and 2 both regenerate `src/routeTree.gen.ts`.
- Task 1 gates (worktree): web lint clean, typecheck clean, Vitest 28 files / 173 tests green (baseline 26 / 164 plus 9 new), `vite build` ok, `openspec validate web-account-security --strict` valid. `auth-forms`, `checkout`, `account` test files unchanged against main.
- Task 1 notes: "verified customer sees no banner" passes before the feature (there is no banner yet), so it guards rather than goes red. The send-failure test finds its alert by text because `/account` also shows an addresses alert when `/addresses` is stubbed to fail.
- Task 2 notes: the "Sign in" success link is scoped to `main` in the test because the header also has a "Sign in" link. That scoping went into the feat commit, not the test commit. Gates: web lint and typecheck clean, Vitest 29 files / 183 tests green, `vite build` ok, `openspec validate web-account-security --strict` valid. `auth-forms.test.tsx` is unchanged against main.
## Requests
- to core (via the area plan): put a link in the mail body (`<web origin>/verify-email?token=<code>` and `/reset-password?token=<code>`) once core knows the web origin; until then the pages are reachable only by typed URL. Not blocking.
## Blockers
