# web-P4-L1 - web swaps to @shopperstop/ui/app (OpenSpec change web-app-shared-swap)
Status: started
## Doing
Worker task 1 landed (3e0fd09 test, e72abe7 feat; gates green: lint, typecheck clean, Vitest 164 passed). Waiting for team lead acceptance 2.1 and manager verification 2.2.
## Found
- Change `openspec/changes/web-app-shared-swap/`: proposal; delta `specs/web-app/spec.md` MODIFIED "Customer session token" (401 clears only when it answers a request carrying the currently held token; new scenario "Stale 401 keeps the newer session") and "Customer failed answers without the error envelope" (wording: "the client" for "the response middleware"); design.md with the exact after-code from a spike; tasks.md one worker task plus acceptance. `openspec validate web-app-shared-swap --strict` valid; `--all --strict` 20 passed. No `docs/design/web-P4-L1.md`: design.md carries the code.
- Spike on a9d11d2 (reverted): swap plus rewritten `api.test.ts` gives lint and typecheck clean, Vitest 26 files 164 passed (163 before + 1); the new test file against today's code fails only `stale 401 keeps the newer session` (`expected undefined to be 't-new'`).
- Worker run: the new `api.test.ts` against the old code failed only `stale 401 keeps the newer session` (`expected undefined to be 't-new'`); after the swap all 13 file tests pass and the suite is 164 passed.
- No time-helper swap: web has no `since`/`useSince`/`when` copy. `formatWhen` stays (browser zone, D47); `lastSeen` words differ ("Last seen 1 minute ago"); `order-parts.tsx` counts down. The work-package line "time helpers to since/useSince/when" does not apply to web.
- `session.ts` keeps `getToken`/`setToken`/`useToken`, so no importer changes. `riderApi` keeps sharing the customer session (now under the current-token rule). `openapi-fetch` stays in web's package.json (satisfies ui's peer); no lockfile change.
- `authMiddleware` was exported and imported only by `api.test.ts`; the tests now drive `api` through a fake `globalThis.fetch` (process boundary, as test-setup.ts does). Two response-identity assertions become status/body equality; the Content-Length-0 header pin moves to ui's client tests (already there).
## Requests
None.
## Blockers
None.
