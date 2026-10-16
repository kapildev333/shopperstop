## ADDED Requirements

### Requirement: Expired sessions are deleted
Whenever the core service starts a session (customer registration, customer sign-in, staff sign-in) it SHALL first delete every customer and staff session whose expiry is at or before the current time; a session whose expiry is later SHALL be kept.

#### Scenario: Sign-in sweeps expired sessions
- **WHEN** one customer and one staff session have an expiry in the past, one of each is live, and a new session starts
- **THEN** the two expired rows no longer exist and the two live rows and the new one do

### Requirement: The rate limiter trusts a proxy only when told
`SHOPPERSTOP_CORE_TRUST_PROXY` SHALL accept `true` or `false` (surrounding spaces ignored; unset or empty means `false`) and refuse to start naming the variable on any other value. When `true`, the per-IP sign-in and registration limit SHALL key on the first address of `X-Forwarded-For`, trimmed, or on the connection's address when that is empty; when `false`, `X-Forwarded-For` SHALL be ignored.

#### Scenario: Clients behind a trusted proxy
- **WHEN** the proxy is trusted, the per-IP limit is 2, two sign-ins carry `X-Forwarded-For` first address `203.0.113.7`, then a third, then one with `203.0.113.8`
- **THEN** the third answers 429 `rate_limited` and the one from `203.0.113.8` answers 200

#### Scenario: Proxy not trusted
- **WHEN** the proxy is not trusted, the per-IP limit is 2, and three sign-ins from one connection address carry different `X-Forwarded-For` values
- **THEN** the third answers 429 `rate_limited`

#### Scenario: Unknown value refused
- **WHEN** `SHOPPERSTOP_CORE_TRUST_PROXY` is `yes`
- **THEN** the service refuses to start and names `SHOPPERSTOP_CORE_TRUST_PROXY`
