# web-P2-L5 - web-e2e-flows: the two Spec 2 §13 cross-app flows (team lead)
Status: started
## Doing
Change written and valid; brief `briefs/task-1.md` ready for the manager to launch worker web-P2-L5-T1. Then: answer worker questions here; acceptance (`/opsx:verify web-e2e-flows`) after 1.2 and the manager's green `make e2e`.
## Found
- Change: `openspec/changes/web-e2e-flows/` (proposal; `web-app` delta: MODIFIED "Customer site end-to-end suite with axe" (+ "Admin preview served for the cross-app flows"), ADDED "Customer cross-app end-to-end flows" (2 scenarios); design; tasks, one task; `briefs/task-1.md`). No `docs/design/web-P2-L5.md`: design.md is enough. `openspec validate web-e2e-flows --strict` valid, `--all --strict` 16 of 16.
- Files the task touches: `apps/web/playwright.config.ts` (one `webServer` entry: `npx vite preview`, `cwd: '../admin'`, url `http://localhost:15174/admin/`, `reuseExistingServer`), new `apps/web/e2e/flows.spec.ts`. `shopper.ts` unchanged.
- Decisions (D13): one task (test: spec file, then feat: config), because the only red the pages allow is the missing admin origin; serve only, no admin build in the web config (`make e2e` builds first); `npx` so admin's own vite binary runs (vite is not hoisted); Flow 1 uses `orderPick` 7 and 8 and adds through search (picks are on core's page 2, not on a category's first screen); quantity of the first pick computed to reach the store minimum; Flow 2 product named `Zzz E2E Paneer <base36 ms>` with stock 5 so it sorts after "Zucchini" (last of 148 seeded) and never shifts or joins `orderPick`/`homePicks`; product left in place (seed reset per run).
- Sign-ins per web run: admin@ 4 to 5 (3 API + browse's optional 1 + Flow 2's 1), koramangala@ 1, under core's 10 per email per process. Ceiling: one core reused across both suites puts admin@ at about 12 and trips 429.
- Red/green: worker shows lint + typecheck green and `grep -c 15174` = 0 on the test commit; manager's red `make e2e` on the test commit: web 40 passed, 2 failed at `http://localhost:15174/admin/sign-in`; green on feat: admin 14, web 42.
## Requests
None to other areas.
## Blockers
None.
