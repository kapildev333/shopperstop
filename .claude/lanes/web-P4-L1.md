# web-P4-L1 - web swaps to @shopperstop/ui/app (OpenSpec change web-app-shared-swap)
Status: done
## Doing
Team lead acceptance (/opsx:verify web-app-shared-swap) 2026-10-16 at 70bd3e5: PASS. Tasks 1.1 to 1.3 and 2.1 ticked; 2.2 is the manager's (make test-web, make e2e, browser check).
## Found
- Change `openspec/changes/web-app-shared-swap/`: proposal; delta `specs/web-app/spec.md` MODIFIED "Customer session token" (401 clears only when it answers a request carrying the currently held token; new scenario "Stale 401 keeps the newer session") and "Customer failed answers without the error envelope" (wording: "the client" for "the response middleware"); design.md with the exact after-code from a spike; tasks.md one worker task plus acceptance. `openspec validate web-app-shared-swap --strict` valid; `--all --strict` 20 passed. No `docs/design/web-P4-L1.md`: design.md carries the code.
- Spike on a9d11d2 (reverted): swap plus rewritten `api.test.ts` gives lint and typecheck clean, Vitest 26 files 164 passed (163 before + 1); the new test file against today's code fails only `stale 401 keeps the newer session` (`expected undefined to be 't-new'`).
- Worker run: the new `api.test.ts` against the old code failed only `stale 401 keeps the newer session` (`expected undefined to be 't-new'`); after the swap all 13 file tests pass and the suite is 164 passed.
- No time-helper swap: web has no `since`/`useSince`/`when` copy. `formatWhen` stays (browser zone, D47); `lastSeen` words differ ("Last seen 1 minute ago"); `order-parts.tsx` counts down. The work-package line "time helpers to since/useSince/when" does not apply to web.
- `session.ts` keeps `getToken`/`setToken`/`useToken`, so no importer changes. `riderApi` keeps sharing the customer session (now under the current-token rule). `openapi-fetch` stays in web's package.json (satisfies ui's peer); no lockfile change.
- `authMiddleware` was exported and imported only by `api.test.ts`; the tests now drive `api` through a fake `globalThis.fetch` (process boundary, as test-setup.ts does). Two response-identity assertions become status/body equality; the Content-Length-0 header pin moves to ui's client tests (already there).
- Acceptance: 13 of 13 delta scenarios have a same-named passing test; red re-run at 3e0fd09 fails only `stale 401 keeps the newer session`; e72abe7 matches design.md exactly; web lint 0, typecheck clean, Vitest 164 passed. Reviewer notes recorded: `setToken('')` difference (design.md, no caller); Content-Length-0 pin lives in ui's client tests.
## Requests
None.
## Blockers
None.
