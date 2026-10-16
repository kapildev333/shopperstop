# rider-P3-L3-R3 - review of T3 (ready to pick up), commits 845380e and 506da34
Status: done
## Doing
Verdict: approve with nits. Gates in a detached checkout of 506da34: ui build, rider lint, typecheck, build, `openspec validate --all --strict` (17/17) green; ready.test 11/11 green (red 11/11 at 845380e). Whole rider suite at 506da34 is red only in delivery, location and history tests (other tasks' reds, expected).
## Found
- Nit: the `test:` commit does not typecheck (`exact: true` is not a ByRole option, ready.test.tsx 153, 189, 210); the `feat:` commit edits the test to drop it. Behaviour unchanged.
- Nit: the comment above ReadyCard says only the time text re-renders; `useSince` re-renders the whole card.
- Nit: Cancel while the claim is pending closes the dialog but the request still completes and navigates; a late 409 would also close a different order's dialog opened meanwhile. Negligible.
- Nit: "Your deliveries" appears after its own read, shifting the cards down under the rider's thumb; reads fail silently (matches design Decision 8).
- Not tested (not a scenario): Escape, later-read-fails keeps cards, polling stops on unmount (TanStack observers do this).
## Requests
