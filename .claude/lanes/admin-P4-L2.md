# admin-P4-L2 - admin swaps to @shopperstop/ui/app (OpenSpec change admin-app-shared-swap)
Status: started
## Doing
2026-10-16: change written and validated; one worker brief out (task 1); then acceptance /opsx:verify.
## Found
- Change `openspec/changes/admin-app-shared-swap/`: proposal; delta `specs/admin-app/spec.md` MODIFIED "Failure answers without core's error body" (envelope = `error.code` and `error.message` strings; new scenario "Envelope without a message"; body 445 characters); design.md with a comparison table and the exact test and code diffs from a spike; tasks.md one worker task plus acceptance. `openspec validate admin-app-shared-swap --strict` valid; `--all --strict` 20 passed. No `docs/design/admin-P4-L2.md`: design.md carries the code.
- 401 rule unchanged: admin already clears only on a 401 to the current token (admin-P2-L4), same as the shared client. "Staff session", "Lost session", "Orders time since placed" keep their text.
- One behaviour change: the envelope check gets stricter (admin needed only a string `code`); only foreign answers are affected.
- `getToken()` now returns `undefined` with no token (shared contract, as rider #304); nine test assertions move from `toBeNull()` to `toBeUndefined()`. Importers untouched (`getToken`/`setToken`/`clearToken` wrappers kept; `onUnauthorized(handler)` kept so `router.ts` is untouched).
- Spike on d5012f0 (reverted): baseline 27 files 326 passed; test diff alone 12 failed / 315 passed; with the code diff lint and typecheck clean, 327 passed; code diff net about -70 lines.
- `openapi-fetch` stays in `apps/admin/package.json` (ui's peer); no lockfile change.
## Requests
None.
## Blockers
None.
