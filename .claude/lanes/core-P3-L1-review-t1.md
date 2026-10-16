# core-P3-L1 review, Task 1 (258f4fc..cbf0632)

Verdict: APPROVE. No blocking findings.

Gates (review worktree at cbf0632): gofmt -l empty; go vet clean; go test -race -count=1 ./... all ok (app, auth, config, seed, cmd/core-admin included); make gen postman: git status clean, postman node tests 17/17; openspec validate --all --strict 15/15.

Checked
- Test-first order: each feat is preceded by a test commit that fails (config: no field; auth: New arity; app: 401 on the five routes, contract probe).
- Every listed scenario has a test: config (valid/unset/bad/no token echo), auth (admitted, logged as service/rider, 403 behind RequireStaff/Admin logged, customer 401, wrong token 401, none configured, store staff unchanged), app (four reads 200, staff routes 403 "staff only", customer routes 401, PATCH store and service-areas 403), contract (toy probes plus real TestContractSecurity).
- Security: sha256 digest plus subtle.ConstantTimeCompare over all entries, no early exit; token never in config errors (tested); unscoped only via auth.Service in staffScope; only the five app.go routes changed; RequireCustomer untouched. Code equals design.md.
- openapi: x-service-token on exactly the five; 403 + example on the other secured /admin ops. The worker deviation (sentence on 403 response descriptions) is what design.md line 781 prescribes: accept.
- Scope: all files within the brief.

Non-blocking notes
1. config.go serviceTokens: name and token are not trimmed around ":" (e.g. "rider: tok" keeps a leading space in the token, which a Bearer header would never carry). Fails closed (401), only a config papercut. Optional: reject whitespace in name/token.
2. RequireStaff hashes every bearer on each staff request for the service check: one sha256, negligible.
3. Known and accepted: service POST status with a real body is 500 until Task 2.
