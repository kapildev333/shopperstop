# web-P3-L1-T4 - web-rider-tracking task 4: e2e against core and rider (worker)
Status: done
## Doing
2026-10-15: commit 1 `b2e8d80` test (red): three e2e tests (smoke "web preview proxies to rider", orders "seeded delivered order against core and rider", "rider picked up and located against core and rider"). Commit 2 `d0ba11a` feat (design Decision 8): Vite `/api/rider` proxy first on both servers, Playwright rider webServer on 18081, global setup resets the rider seed behind the `_e2e` guard. Tasks 4.1 and 4.2 ticked in the feat commit (4.1 was not ticked in commit 1; not amended).
## Found
- Red on commit 1 (`make -n e2e` env copied, `npm run e2e --workspace apps/web`): 42 passed, 3 failed:
  - `e2e/smoke.spec.ts` "web preview proxies to rider": 404 on `/api/rider/v1/healthz` (proxied to core).
  - `e2e/orders.spec.ts` "seeded delivered order against core and rider": "Arjun Rao" not visible in the Rider region.
  - `e2e/orders.spec.ts` "rider picked up and located against core and rider": rider sign-in 404 (no rider service; `orderPick(request, 9)` did not throw).
- Green on commit 2: `45 passed (42.9s)`, then `45 passed (41.2s)` on the second run (reseed idempotent). Both runs with the env of `make -n e2e`, after `npm run build --workspaces --if-present`.
- Port check before the runs: 18080, 18081, 15173, 15174 free; Postgres on 5432 is the local container, not touched.
- Gates on commit 2: `npm run lint --workspace apps/web` exit 0; `npm run typecheck --workspace apps/web` exit 0; `npm run test --workspace apps/web -- --run` 26 files, 163 tests passed; `npm run build --workspace apps/web` exit 0; `git status` clean after the build; `openspec validate web-rider-tracking --strict`: "Change 'web-rider-tracking' is valid"; `npx playwright test --list` shows the three new tests (45 tests in 9 files).
- Prettier was not applied to the two spec files: the repo's files are not stdin-prettier clean with the default config, and a full reformat would rewrite every line. Edits follow the file's own style by hand.
- Coordinator note (core-P3-L3, main aecc9e7 / #228): the seeded-order test asserts only the text "Arjun Rao" in the Rider region, "Delivered" and no Maps link. Both sources give the name (`Order.riderName` on the new seed, the rider read on the old one), and the rider seed still has no position, so no test change. Not merged main here; the manager's re-run after merging main is the check.
## Requests
None.
## Blockers
None.
