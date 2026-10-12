# core-P1-L1 task 1 - configuration (plan task 5)
Status: done
## Doing
Done: config.Load per design Decision 1, tasks 1.1 and 1.2 ticked. Gates green. Awaiting reviewer.
## Found
- `services/core/go.mod` created (module github.com/kapildev333/shopperstop/services/core, go 1.27); later tasks add chi and pgx to it.
- `config.Load(getenv func(string) string) (Config, error)`; every problem joined with errors.Join.
- Pepper length is checked on the raw value (not trimmed); DATABASE_URL, ADDR and LOG_LEVEL are trimmed.
## Requests
(none)
## Blockers
(none)
