# rider-P5-L2-R3 - review of T3 (dispatcher config, tick, loop)
Status: done. Verdict: approve with two non-blocking findings. Reviewed 19ce167, aec9bba, 0eef181.

## Gates run (by the reviewer, no go test per instruction)
- gofmt -l and go vet ./... in a detached scratch worktree at aec9bba: clean (scratch removed).
- openspec validate --all --strict: 20 passed, 0 failed.
- Test-first: 19ce167 touches only the two test files; aec9bba holds all product code. Order correct.

## Findings
1. dispatch.go dispatchStore: core is polled (StoreOrders) before the cheap Candidates query. A store whose online riders are all busy, stale or holding offers still costs one core call per store every 3 s, for nothing. Fix: run Candidates first, return when empty, then call core.
2. dispatch.go Tick: the whole tick, including up to 5 s core calls per store, runs inside the transaction holding the dispatch key, so offline paths (LockDispatch) can wait N stores x 5 s. Accepted by design (one tx, R1/R5); ceiling worth a ponytail comment. Minor: Run passes the ticker's time, which can be up to one interval old; time.Now() is more accurate.
Nits: no minimum interval (1ns hammers the loop); core page size 100 is not noted as a ceiling.

## Checked and fine
Config fail-fast with all problems joined, defaults, 0 disables the loop but the dispatcher is built (Enabled drives admin read). Shutdown: deferred stop and wait on the channel runs before pool.Close; goroutine ends with ctx, errors during cancel not logged. Lock key matches auth.sql LockDispatch. Expiry covers TTL and claimed orders. Candidates query: online, fresh location, no assigned delivery, no open offer; refusal rest per order. Oldest first, one offer per rider. Log lines match spec. Rank placeholder (ETA 0) is idle-time order until T6 as designed.
