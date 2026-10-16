# admin-P3-L1-T5 - admin-riders task 5: against core and the rider service (the manager's e2e slot)

- LANE-ID: admin-P3-L1, area `admin`, OpenSpec change `admin-riders`, task 5. Run by the area manager; a worker only for a recorded failure.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/admin-P3-L1`, branch `lane/admin-P3-L1-riders`
- Waits on: tasks 1 to 4 landed and reviewed; the branch rebased onto main; the e2e slot (D35: take and release by SendMessage and `## Doing`); core's demo seed giving SS-DEMOAAAB `riderName` "Arjun Rao" with rider events (design.md "Requests"; without it `e2e/orders.spec.ts` fails on "Rider: Arjun Rao", and the fallback is the owner's call).

## Scenarios
Riders against the rider service; Orders against core › Store staff take the placed order to delivered, Admin sees the dashboard and a store's orders; End-to-end suite with axe › both; Core reached through a same-origin proxy › Preview proxies to the rider service.

## Steps
1. `make e2e`. Expect admin `15 passed` (`auth` 2, `smoke` 2, `stores` 2, `catalog` 3, `stock` 2, `staff` 1, `orders` 2, `riders` 1) and web as on main. While the preview runs, `curl -s http://localhost:15174/api/rider/v1/healthz` answers `{"status":"ok"}`.
2. Walk in Chromium against core, rider and the demo seeds: `/riders` as admin (filter, create, edit) and as koramangala@ (own store, no selector), at desktop and 390 px; a stacked cancel dialog over the order sheet (Escape closes only the dialog); a card out for delivery naming its rider; the dashboard's Open badge; axe clean on each.
3. A failure is recorded in the lane log first, then fixed by a worker with `fix: <what>` inside `apps/admin/e2e/` (or the file at fault, named by the team lead), never by weakening an assertion. Tick 5.1.

Sign-in budget: one run signs in admin@ about 8 times and koramangala@ about 5 times against core's 10 per email per hour per process. Restart core before a second run.
