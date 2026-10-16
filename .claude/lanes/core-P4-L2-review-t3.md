# core-P4-L2-review-t3

Verdict: APPROVE (Task 3, 9cb12f2 test, 61dbc89 feat). No blocking findings.

Test-first: 9cb12f2 red (does not compile, `localDatabase` undefined), 61dbc89 green. TestSeedDemoExitCodes stays green.

Scenarios covered (platform "Seed-demo refuses a database on another machine"): Remote host refused (TestSeedDemoRefusesRemoteDatabase, with and without --reset); Local hosts accepted, incl. the localhost,db.example.com list (TestLocalDatabase); Force skips the check (TestSeedDemoForceSkipsTheGuard); Repeated or unknown flag (TestRunRefusesBadArguments).

Findings (non-blocking):
1. Info: `LOCALHOST` in upper case, `127.0.0.2` and `::ffff:127.0.0.1` are refused. Fail-safe; `--force` covers them.
2. Low: TestLocalDatabase lacks key=value DSN, PGHOST and `?host=` with a remote host cases.
3. Low: TestSeedDemoForceSkipsTheGuard does a DNS lookup on `db.invalid` (RFC 6761, never resolves; a slow resolver only slows the test, bounded by connect_timeout=2).

Scope: main.go and main_test.go only, plus ticks. No openapi.json change; make gen postman clean.

Gates: gofmt -l empty; go vet clean; go test -race -count=1 ./... ok; openspec validate --all --strict passed.
