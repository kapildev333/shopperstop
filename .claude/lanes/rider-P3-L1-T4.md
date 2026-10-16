# rider-P3-L1-T4 - staff routes through core
Status: started
## Doing
Red tests committed (internal/app/admin_riders_test.go, TestMain starts the core fake); next the feat commit.
## Found
- Red run: every admin route answers 404 (not registered), so each new test fails on its assertion, not on a build error.
- The feat commit changes auth.New to take the core client, so it also updates the three 3-argument callers in internal/auth/auth_test.go, internal/app/app_test.go and internal/app/riders_test.go and the TestMain of internal/app.
## Requests
- none
## Blockers
- none
