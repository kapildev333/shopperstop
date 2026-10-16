# rider-P4-L3 - rider app on @shopperstop/ui/app (OpenSpec change rider-app-shared-swap)
Status: done
## Doing
Team lead: 2026-10-16 acceptance (`/opsx:verify rider-app-shared-swap`) on 0f18d64: PASS. 3.1 and 3.2 ticked with evidence in tasks.md.
## Found
- Change `openspec/changes/rider-app-shared-swap/`: proposal; delta `specs/rider-app/spec.md` (ADDED "Rider failure answers without an error envelope", 1 scenario; MODIFIED "Rider lost session", text unchanged, new scenario "401 mid-session returns to sign-in"); design.md with 7 decisions and the exact diffs per task (spiked on 31c7e73, `git apply --check` clean); tasks.md (2 sequential worker tasks, 1 acceptance/verification task). `openspec validate rider-app-shared-swap --strict` valid; `--all --strict` 20 passed. No `docs/design/rider-P4-L3.md`: design.md is enough.
- Spike (reverted): after both diffs rider Vitest 10 files / 61 tests, lint, typecheck, build clean. Test diff alone on the old code: 8 failed / 52 passed. With `onUnauthorized` left out of the shared client all 60 pre-existing tests still passed: nothing pinned the router clean-up, hence the new mid-session scenario.
- One behaviour change: an envelope with `code` but no `message` now becomes `internal` (shared rule). Neither service sends one.
- `getToken()` is `undefined` (was `null`) with no token; only tests compared with null.
- No lockfile or dependency change; `openapi-fetch` stays in `apps/rider/package.json` as the shared module's peer.
- Env: Vitest needs Node 22.23.3 (`~/.local/node-v22.23.3/bin`); the default Node 22.11 fails every file with ERR_REQUIRE_ESM (`@csstools/css-calc`). `npm ci` itself ran clean (no edgesOut crash).
- Branch is one commit behind origin/main (13e2d85, PLAN.md only); no overlap.
- Acceptance on 0f18d64: scenario to test: "A failure answer without an envelope reaches the caller as internal" `api.test.ts` `a failure answer with %s reaches the caller as an internal error with its status` (3 rows); "401 mid-session returns to sign-in" `a 401 mid-session returns to sign-in`; "Expired session on load" `expired session on load returns to sign-in`; "401 to a replaced token keeps the new session" `a 401 to a replaced token keeps the new session`; "Service unreachable on load" `service unreachable on load shows a retry and keeps the session`; all pass. Red re-proved at fa2a961 in a scratch `git worktree` (9 failed / 52 passed, the nine the T1 brief names); order fa2a961 test, c480eba feat, 0fa5038 refactor; `apps/` diff equals design.md's diffs exactly; rider gates green (61). Manager evidence: `make test-web` (ui 104, admin 326, mobile 302, rider 61, web 163), `make e2e` green (rider 7 incl. cross-app flow), strict 20/20.
- Correction: my tasks.md and design.md said 8 red; the right count is 9 (the mid-session test was added after my first red count). Manager fixed tasks.md (6365933); design.md fixed in the acceptance commit.
## Requests
None to ui: the shared module covers rider fully.
## Blockers
None.
