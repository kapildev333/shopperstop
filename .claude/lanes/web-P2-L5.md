# web-P2-L5 - web-e2e-flows: the two Spec 2 §13 cross-app flows (team lead)
Status: done
## Doing
Acceptance (`/opsx:verify web-e2e-flows`) on 180f307: PASS, 4 of 4 scenarios. Nothing left for this lane but questions; the manager lands the PR and archives.
## Found
- Acceptance 2026-10-15 on 180f307 (0d4a7cf test, a6185ed feat, 180f307 comment-only nits 1 and 2; review R1 approve with nits). Evidence is the manager's: red `make e2e` on 0d4a7cf admin 14, web 40 passed + 2 failed, both `ERR_CONNECTION_REFUSED` at `http://localhost:15174/admin/sign-in` (Flow 1 after its customer half); green on a6185ed admin 14, web 42; mutations (delivered text, search term) each failed on the assertion. Scenario to test:
  - Customer site end-to-end suite with axe › Customer smoke pages pass axe (carried over): `e2e/smoke.spec.ts` › "home passes axe", "not found passes axe" (unchanged, in the green 42).
  - Customer site end-to-end suite with axe › Admin preview served for the cross-app flows: `e2e/flows.spec.ts` › "admin product found by customer search" step 1 (`staffSignIn` opens `./sign-in` on 15174, axe) and Flow 1 step 11; red without the entry, green with it.
  - Customer cross-app end-to-end flows › Customer order taken to delivered by store staff: `flows.spec.ts` › "customer order to delivered across both apps" (all WHEN steps through the pages; THEN: delivered text within 15 s, no reload, history ends Delivered; axe on every page in both apps).
  - Customer cross-app end-to-end flows › Admin product found by customer search: `flows.spec.ts` › "admin product found by customer search" (unique `Zzz E2E Paneer <run>`, stock 5 at Koramangala, guest search shows the card and "Add").
- Nothing extra landed: diff from 590db39 is `flows.spec.ts` (new), one `webServer` entry plus one comment line in `playwright.config.ts`, `tasks.md` boxes, T1 and R1 logs; `shopper.ts` untouched; no `.only`/`.skip`; `test:` commit holds only the spec. Code matches design Decisions 1 to 3 (number read with `replace`, not `slice`: equivalent). Review nit 3 (`orderPick`, predates this lane) goes to the web backlog.
- Change: `openspec/changes/web-e2e-flows/` (proposal; `web-app` delta: MODIFIED "Customer site end-to-end suite with axe" (+ "Admin preview served for the cross-app flows"), ADDED "Customer cross-app end-to-end flows" (2 scenarios); design; tasks, one task; `briefs/task-1.md`). No `docs/design/web-P2-L5.md`: design.md is enough. `openspec validate web-e2e-flows --strict` valid, `--all --strict` 16 of 16.
- Files the task touches: `apps/web/playwright.config.ts` (one `webServer` entry: `npx vite preview`, `cwd: '../admin'`, url `http://localhost:15174/admin/`, `reuseExistingServer`), new `apps/web/e2e/flows.spec.ts`. `shopper.ts` unchanged.
- Decisions (D13): one task (test: spec file, then feat: config), because the only red the pages allow is the missing admin origin; serve only, no admin build in the web config (`make e2e` builds first); `npx` so admin's own vite binary runs (vite is not hoisted); Flow 1 uses `orderPick` 7 and 8 and adds through search (picks are on core's page 2, not on a category's first screen); quantity of the first pick computed to reach the store minimum; Flow 2 product named `Zzz E2E Paneer <base36 ms>` with stock 5 so it sorts after "Zucchini" (last of 148 seeded) and never shifts or joins `orderPick`/`homePicks`; product left in place (seed reset per run).
- Sign-ins per web run: admin@ 4 to 5 (3 API + browse's optional 1 + Flow 2's 1), koramangala@ 1, under core's 10 per email per process. Ceiling: one core reused across both suites puts admin@ at about 12 and trips 429.
- Red/green: worker shows lint + typecheck green and `grep -c 15174` = 0 on the test commit; manager's red `make e2e` on the test commit: web 40 passed, 2 failed at `http://localhost:15174/admin/sign-in`; green on feat: admin 14, web 42.
## Requests
None to other areas.
## Blockers
None.
