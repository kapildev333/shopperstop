# rider-P3-L1-T5 - operator commands and demo seed
Status: done
## Doing
Task 5 complete: red tests (d64602d), feat with internal/seed and rider-admin seed-demo and create-rider; tasks 5.1 to 5.3 ticked. Gates green.
## Found
- Red run before the feat (build failure, the symbols do not exist yet):
  ```
  github.com/kapildev333/shopperstop/services/rider/internal/seed: no non-test Go files in .../services/rider/internal/seed
  cmd/rider-admin/main_test.go:79:12: undefined: createRider
  cmd/rider-admin/main_test.go:112:9: undefined: createRider
  cmd/rider-admin/main_test.go:127:10: undefined: createRider
  FAIL	.../internal/seed [build failed]
  FAIL	.../cmd/rider-admin [build failed]
  ```
## Requests
- none
## Blockers
- none
