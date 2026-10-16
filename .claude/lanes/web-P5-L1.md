# web-P5-L1 - web-account-security (team lead)
Status: started
## Doing
Change proposed and valid (`openspec validate web-account-security --strict`); three worker briefs handed to the web manager; waiting for Task 1, reachable for worker questions here.
## Found
- Change `openspec/changes/web-account-security/`: 11 ADDED `web-app` requirements (all under 500 characters, largest 486), no MODIFIED. No `docs/design/web-P5-L1.md`: design.md settles every choice.
- Playwright starts core with `shell: true` and ignores its stdout in the runner process; tests cannot read it. Decision: core's webServer command becomes `go run ./cmd/core > <apps/web/e2e/.tmp/core.log>` (gitignored dir), `e2e/mail.ts` reads the `mail` JSON line (format specified by `accounts` "Mail is logged until a transport exists"). No core change needed.
- Baseline at 29e571a in this worktree: web lint and typecheck clean, Vitest 26 files, 164 tests.
- Tasks run one after another: Tasks 1 and 2 both regenerate `src/routeTree.gen.ts`.
## Requests
- to core (via the area plan): put a link in the mail body (`<web origin>/verify-email?token=<code>` and `/reset-password?token=<code>`) once core knows the web origin; until then the pages are reachable only by typed URL. Not blocking.
## Blockers
