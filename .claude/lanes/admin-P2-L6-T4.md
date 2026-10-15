# admin-P2-L6-T4 - admin-staff-e2e task 4: fix worker for the 4.1 e2e failure (worker)
Status: started

## Doing
Fix worker for task 4. Step 1 done (failing output recorded below). Next: decide the side, one wait in `catalog.spec.ts`, `fix:` commit, `make test-web`. Task 4.1 is NOT ticked (the manager re-runs the e2e first).

## Found
- Manager's `make e2e` on the final tree: admin `1 failed | 10 passed`, web 40 passed. `staff.spec.ts` passed. Failing test:
```
[chromium] › e2e/catalog.spec.ts:28:1 › admin runs the catalog
Error: locator.click: Test timeout of 30000ms exceeded.
  - waiting for getByRole('table', { name: 'Products' }).getByRole('link', { name: 'E2E Curd Cup' })
   97 |   await page.getByRole('searchbox', { name: 'Search' }).fill('e2e curd cup')
   98 |   await page.getByRole('button', { name: 'Search', exact: true }).click()
>  99 |   products.getByRole('link', { name: 'E2E Curd Cup' }).click()
```
- Error-context snapshot: /products with heading "Products", EMPTY searchbox, full unfiltered list.
- Manager's diagnosis: `nav.getByRole('link', { name: 'Products' }).click()` (catalog.spec.ts line 96) starts a client navigation from /stock; the next `fill` hits /stock's searchbox (same accessible name "Search") before the route swaps.
- Other navigation-then-control sites checked in the stretch: line 42 (waits on text "Page 1 of 7" first), line 58 (waits on link "New product", which only exists on /products), line 77-79 (full `goto`, waits on the store option first), line 104 (waits on `toHaveURL`). Only line 96 is the real instance.

## Requests
None.

## Blockers
None.
