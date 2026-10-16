# core-P3-L2 Task 2 review (6c2614d, 063e264)
Verdict: approve. No findings.
- Test-first: at 6c2614d TestStoreOrdersActive (total 6, active ignored) and TestDashboardIsOpen (isOpen false) fail as designed.
- Query: active predicate identical in StoreOrders and CountStoreOrders, so total and items agree; order by placed_at desc, id desc kept; paging covered (pageSize 2, total 4).
- activeParam: absent/empty no filter, true only, other values 400 field active, with non-empty status 400 field active; status parsed first. Tests cover false, TRUE, 1, true+status, empty.
- Contract: active param (enum true, example), 400 text, isOpen required with description and example; core.d.ts/Postman regenerated (make gen postman leaves tree clean). Scope: only brief paths; tasks ticked.
- Minor, no action: test relies on placed_at default now() differing per insert (separate statements), fine.
Gates: gofmt clean; go vet clean; go test -race -count=1 app, order ok (staff has no tests); make gen postman clean, git status clean; openspec validate --all --strict 16 passed.
