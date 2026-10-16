# rider-P4-L3 - rider app on @shopperstop/ui/app (OpenSpec change rider-app-shared-swap)
Status: started
## Doing
Team lead: change written and valid; worker briefs T1 then T2 ready for the manager. Next: answer worker questions here, then `/opsx:verify` after T2.
## Found
- Change `openspec/changes/rider-app-shared-swap/`: proposal; delta `specs/rider-app/spec.md` (ADDED "Rider failure answers without an error envelope", 1 scenario; MODIFIED "Rider lost session", text unchanged, new scenario "401 mid-session returns to sign-in"); design.md with 7 decisions and the exact diffs per task (spiked on 31c7e73, `git apply --check` clean); tasks.md (2 sequential worker tasks, 1 acceptance/verification task). `openspec validate rider-app-shared-swap --strict` valid; `--all --strict` 20 passed. No `docs/design/rider-P4-L3.md`: design.md is enough.
- Spike (reverted): after both diffs rider Vitest 10 files / 61 tests, lint, typecheck, build clean. Test diff alone on the old code: 8 failed / 52 passed. With `onUnauthorized` left out of the shared client all 60 pre-existing tests still passed: nothing pinned the router clean-up, hence the new mid-session scenario.
- One behaviour change: an envelope with `code` but no `message` now becomes `internal` (shared rule). Neither service sends one.
- `getToken()` is `undefined` (was `null`) with no token; only tests compared with null.
- No lockfile or dependency change; `openapi-fetch` stays in `apps/rider/package.json` as the shared module's peer.
- Env: Vitest needs Node 22.23.3 (`~/.local/node-v22.23.3/bin`); the default Node 22.11 fails every file with ERR_REQUIRE_ESM (`@csstools/css-calc`). `npm ci` itself ran clean (no edgesOut crash).
- Branch is one commit behind origin/main (13e2d85, PLAN.md only); no overlap.
## Requests
None to ui: the shared module covers rider fully.
## Blockers
None.
