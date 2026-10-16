# mobile-P4-L5b - mobile-e2e-flow: the Spec 2 §13 customer flow on the web export (team lead)
Status: started
## Doing
Proposed; waiting for L3 (`mobile-cart`) and L4b (`mobile-checkout`) to merge before T1 starts. Then acceptance (task 2.1).
## Found
- Change `openspec/changes/mobile-e2e-flow/`: proposal, `specs/mobile-app/spec.md` (1 ADDED requirement "Mobile customer flow end-to-end", 1 scenario), design.md (web flow step table, 5 decisions), tasks.md (one worker task T1, acceptance). No `docs/design/mobile-P4-L5b.md`: design.md is enough. `openspec validate --all --strict` 20 passed.
- Product picks: `orderPick` indices 6 and 7 (L4a has 0, 1; L4b 2 to 5; L3 uses page 1, which is also Home's picks).
- The guest merge is inside the flow: the second product is added as a guest after sign-out and merged at sign-in through Home's "Account" (the cart sheet's Proceed is blocked below the minimum for a one-unit guest cart).
- Helpers copied, not extracted (design.md Decision 3); extraction trigger and scope written there.
- 2026-10-16 manager confirmed as proposed: helpers copied (no `e2e/support.ts` now), no mobile admin-product flow (web covers it), guest merge inside the flow, picks 6 and 7.
- Contract audit: no gaps (`POST /admin/orders/{id}/status`, `POST /admin/auth/sign-in`, `GET /stores/{id}`, `GET /stores/{id}/products`).
## Requests
- to mobile manager: merge origin/main into `lane/mobile-P4-L5b-e2e-flow` after L3 and L4b land, then launch T1; T1 needs the e2e slot for task 1.2.
## Blockers
L3 and L4b not merged.
