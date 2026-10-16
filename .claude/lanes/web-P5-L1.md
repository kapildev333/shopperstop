# web-P5-L1 - web-account-security (team lead)
Status: done
## Doing
Acceptance done (team lead, `/opsx:verify` semantics): 19 of 19 Vitest scenarios have passing tests, tasks 1.1 to 3.2 ticked; the two e2e scenarios ("Customer account security end to end") are the manager's `make e2e` run, tracked as task 3.3. design.md ceilings gained the `gcTime` note (reviewer). Gates at 391d6a0 (lane head merged with origin/main): web lint 0, typecheck 0, Vitest 29 files / 183 tests, `vite build` 0, `openspec validate web-account-security --strict` valid, `--all --strict` 20 passed.
## Found
- Change `openspec/changes/web-account-security/`: 11 ADDED `web-app` requirements (all under 500 characters, largest 486), no MODIFIED. No `docs/design/web-P5-L1.md`: design.md settles every choice.
- Playwright starts core with `shell: true` and ignores its stdout in the runner process; tests cannot read it. Decision: core's webServer command becomes `go run ./cmd/core > <apps/web/e2e/.tmp/core.log>` (gitignored dir), `e2e/mail.ts` reads the `mail` JSON line (format specified by `accounts` "Mail is logged until a transport exists"). No core change needed.
- Baseline at 29e571a in this worktree: web lint and typecheck clean, Vitest 26 files, 164 tests.
- Tasks run one after another: Tasks 1 and 2 both regenerate `src/routeTree.gen.ts`.
- Task 1 gates (worktree): web lint clean, typecheck clean, Vitest 28 files / 173 tests green (baseline 26 / 164 plus 9 new), `vite build` ok, `openspec validate web-account-security --strict` valid. `auth-forms`, `checkout`, `account` test files unchanged against main.
- Task 1 notes: "verified customer sees no banner" passes before the feature (there is no banner yet), so it guards rather than goes red. The send-failure test finds its alert by text because `/account` also shows an addresses alert when `/addresses` is stubbed to fail.
- Task 2 notes: the "Sign in" success link is scoped to `main` in the test because the header also has a "Sign in" link. That scoping went into the feat commit, not the test commit. Gates: web lint and typecheck clean, Vitest 29 files / 183 tests green, `vite build` ok, `openspec validate web-account-security --strict` valid. `auth-forms.test.tsx` is unchanged against main.
- Task 3 (e2e): `e2e/.tmp/` is already ignored by the root `.gitignore` (`apps/*/e2e/.tmp/`), so no ignore line was added. Red state documented, not run (the e2e slot belongs to the web manager): with the config unchanged, `mailedCode` finds no `coreLog` file and times out after 10 s with the message `no "<subject>" mail to <email> in <path>/apps/web/e2e/.tmp/core.log`. Core's mail body is `text + " " + token` (core `internal/auth/account.go`), so the last word is the code.
- Task 3 gates (worktree, after the feat commit): lint exit 0, typecheck exit 0, Vitest 29 files / 183 tests green, `npm run build --workspace apps/web` exit 0, `openspec validate web-account-security --strict` valid.
- Task 3 run command for the manager (not run by the worker): `make e2e`, then look for `account-security` in the output: `email verified against core` and `password reset against core`. Playwright also runs every other web spec in the same `make e2e` run.
- Caveat (design ceiling): with `reuseExistingServer` outside CI, a core already on :18080 is reused and writes nothing to `core.log`; `mailedCode` then fails after 10 s naming the file. `make e2e` in a clean state starts a fresh core.
## Requests
- to core (via the area plan): put a link in the mail body (`<web origin>/verify-email?token=<code>` and `/reset-password?token=<code>`) once core knows the web origin; until then the pages are reachable only by typed URL. Not blocking.
## Blockers
