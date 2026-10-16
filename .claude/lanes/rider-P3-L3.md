# rider-P3-L3 - the rider app (OpenSpec change rider-app)
Status: started
## Doing
Team lead: change proposed and committed; waiting for the manager to launch task 1. Reachable for worker questions here.
## Found
- Change `openspec/changes/rider-app/`: proposal, `specs/rider-app/spec.md` (25 ADDED requirements, largest body 464 characters, each with WHEN/THEN scenarios), design.md (19 decisions, files per task, interfaces, test strategy, risks), tasks.md (5 worker tasks, 1 manager task). `openspec validate rider-app --strict` valid; `--all --strict` 17 passed. No `docs/design/rider-P3-L3.md`: design.md is enough.
- Order: 1, then 2, 3, 4, 5 in parallel (disjoint files; task 1 creates every route file so `routeTree.gen.ts` is final), then 6 (manager). Task 2 (e2e) is test-only; its red run is the manager's `make e2e` (6.1).
- Figma not read (no Figma tool in this session): pages designed from Spec 1 §8/§10 and admin's patterns; the manager's walk compares with the `Rider web` section.
- Beyond the package (design Decision 8): a "Your deliveries" section on `/` from `GET /me/deliveries?status=assigned`, so a rider can get back to an open delivery.
- Cross-app flow asserts the rider's name through core `GET /orders/{id}` `riderName` and the rider customer read (Decision 10), not on web's tracking page, until web-P3-L1 is on main.
- `openspec/changes/rider-deliveries/` is not archived in this base (`a665845`): the `deliveries` capability is not in `openspec/specs/` yet. No dependency: this change only ADDs `rider-app`.
- Root `package-lock.json` changes in task 1 (the new workspace), as PLAN.md expects for app PRs.
## Requests
- to web (via the area plan): the rider suite's cross-app flow depends on web's "Place order (COD)" button and tracking texts "Your order is out for delivery." and "Your order was delivered."; when web-P3-L1 lands the rider card, tell rider so the flow adds the on-page rider-name assertion.
- to admin (via the area plan): the flow depends on the Orders board buttons "Accept <number>", "Start packing <number>", "Mark ready <number>" and staff sign-in labels.
## Blockers
