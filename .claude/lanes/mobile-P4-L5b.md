# mobile-P4-L5b - mobile-e2e-flow: the Spec 2 §13 customer flow on the web export (team lead)
Status: done
## Doing
Accepted (2.1) at 355b604; gates and PR are the manager's.
## Found
- Change `openspec/changes/mobile-e2e-flow/`: proposal, `specs/mobile-app/spec.md` (1 ADDED requirement "Mobile customer flow end-to-end", 1 scenario), design.md (web flow step table, 5 decisions), tasks.md (one worker task T1, acceptance). No `docs/design/mobile-P4-L5b.md`: design.md is enough. `openspec validate --all --strict` 20 passed.
- Product picks: `orderPick` indices 6 and 7 (L4a has 0, 1; L4b 2 to 5; L3 uses page 1, which is also Home's picks).
- The guest merge is inside the flow: the second product is added as a guest after sign-out and merged at sign-in through Home's "Account" (the cart sheet's Proceed is blocked below the minimum for a one-unit guest cart).
- Helpers copied, not extracted (design.md Decision 3); extraction trigger and scope written there.
- 2026-10-16 manager confirmed as proposed: helpers copied (no `e2e/support.ts` now), no mobile admin-product flow (web covers it), guest merge inside the flow, picks 6 and 7.
- Contract audit: no gaps (`POST /admin/orders/{id}/status`, `POST /admin/auth/sign-in`, `GET /stores/{id}`, `GET /stores/{id}/products`).
- 2.1 verify (355b604): the one scenario maps to `e2e/flow.spec.ts` › `Customer order to delivered against core` (3b63982, test-only, the deliverable per Decision 5; bite check recorded in T1's log); every THEN covered: bar `${qa + 1} items` after the merge, sheet groups qa and 1, checkout `<qty> × <unitLabel>` lines, heading `/^Order SS-\w{8}$/` with the placed text, delivered within 15 s without reload, axe after every screen and sheet; tasks 1.1, 1.2 ticked; diff vs origin/main is only the spec file, the change and lane logs; `openspec validate --all --strict` 20 passed. Worker's `make e2e`: admin 15, mobile 26, rider 7, web 45 (manager re-runs). Accepted.
## Requests
- to mobile manager: merge origin/main into `lane/mobile-P4-L5b-e2e-flow` after L3 and L4b land, then launch T1; T1 needs the e2e slot for task 1.2.
## Blockers
None.
