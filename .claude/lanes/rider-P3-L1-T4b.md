# rider-P3-L1-T4b - acceptance fixes: field checks before the store, request schemas
Status: done
## Doing
Task 4b complete: red test 5c0dbd7, fix commit with the CreateRider reorder, openapi request schemas and tasks 4b.1 to 4b.3 ticked.
## Found
- Red run (before the fix), `make test-rider` on 5c0dbd7's parent plus the new test:
  ```
  2026/10/15 22:37:54 INFO request method=POST route=/api/rider/v1/admin/riders status=400 durationMs=1 requestId=a73e0ca922aeb0422556b4915d3f51b8 subjectType=staff subjectId=00000000-0000-4000-8000-000000000501
  --- FAIL: TestCreateRiderChecksFieldsBeforeCore (0.00s)
      admin_riders_test.go:280: names field "storeId", want email
  FAIL
  FAIL	github.com/kapildev333/shopperstop/services/rider/internal/app	0.540s
  ```
- `CreateRider` now checks email, name, phone and password, then asks core about the store, then hashes. Core is never asked for a refused field.
- `openapi.json`: `additionalProperties: false` removed from `SignInRequest`, `RiderCreate`, `RiderPatch`. Response schemas keep it. The file was rewritten by a JSON round trip (2-space indent, trailing newline; the round trip of the original was byte-identical).
## Requests
## Blockers
- none
