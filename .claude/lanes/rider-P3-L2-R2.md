# rider-P3-L2-R2 - review of T2 (1c3982f, a64dfa6)
Status: done
## Doing
Review finished; verdict approve with nits.
## Found
- Gates at a64dfa6 (detached): gofmt, vet, sqlc diff clean; openspec validate 16/16; go test -race -count=1: all green except migrate (hard-coded list) and seed (truncate), both known and accepted, fixed by T3.
- Claim order is right: core Order read, then one tx insert then ChangeStatus; commit only after core returns; every core error rolls back; unique violation -> 409 "order already claimed"; ErrConflict -> 409 "not ready".
- Nits: (1) tx held open across a core HTTP call (5 s client timeout) so losers of a race hold a pool connection while blocked on the insert; fine at this scale. (2) Commit failing after core moved the order leaves core out_for_delivery with no row; unavoidable without core idempotency, worth one line in design Risks. (3) ponytail comment on ReadyOrders is one very long line. (4) tasks.md 2.5 still open until T3 fixes migrate and seed.
## Requests
## Blockers
