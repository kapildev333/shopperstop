## ADDED Requirements

### Requirement: Seed-demo refuses a database on another machine
`core-admin seed-demo`, with or without `--reset`, SHALL refuse a `SHOPPERSTOP_CORE_DATABASE_URL` that names any host other than `localhost`, `127.0.0.1`, `::1` or a Unix socket directory, before connecting: it SHALL print the host and `--force` to standard error, print nothing on stdout and exit 1. With `--force` it SHALL load without the check. `--reset` and `--force` SHALL each appear at most once, in any order.

#### Scenario: Remote host refused
- **WHEN** `seed-demo --reset`, or `seed-demo`, runs with a database URL on `db.example.com`
- **THEN** it exits 1, stdout is empty and standard error names `db.example.com`

#### Scenario: Local hosts accepted
- **WHEN** the database URL names `localhost`, `127.0.0.1`, `[::1]` or a socket directory `/tmp`
- **THEN** the check passes; a URL listing `localhost` and `db.example.com` is refused

#### Scenario: Force skips the check
- **WHEN** `seed-demo --force --reset` runs with a database URL on an unresolvable remote host
- **THEN** it exits 1 with the connection's error, not the refusal

#### Scenario: Repeated or unknown flag
- **WHEN** `seed-demo --reset --reset` or `seed-demo --yes` runs
- **THEN** it prints the usage line and exits 2
