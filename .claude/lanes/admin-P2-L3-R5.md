# admin-P2-L3-R5 - review of task 5 (4d03366, b4ecaba) and the whole lane
Status: done
## Verdict
Approve with nits. No fix-now findings.
## Findings
1. nit (nits task) `apps/admin/src/routes/_staff/_admin/products/$productId.tsx:21,28`: no cache handling after delete or deactivate. It works only because the default staleTime is 0 (`router.ts`), so `/products` refetches on mount. But a visitor who already opened `/products` sees the cached list, with the deleted (or now inactive) row, until the refetch ends. The tests start with an empty cache, so they cannot see this. Smallest fix: in both `onSuccess`, `void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] })` (as `image.tsx:55` does) and, for delete, `queryClient.removeQueries({ queryKey: productQuery(product.id).queryKey })`; add a test that visits the list first. Check design.md did not decide this on purpose (it copies design byte for byte, so this is a design nit).
2. nit (nits task) `product-delete.test.tsx`: no test for the generic delete-error banner ("Could not delete the product. Try again."), the deactivate-error banner, or Escape/reopen resetting the 409 state. The behaviour in `close()` exists and is untested; each is a one-test addition.
3. nit (nits task) `$productId.tsx:30`: after a failed deactivate both banners show (the 409 text and the deactivate error). Acceptable; say so or hide the first.
## Checked, fine
- DELETE `/admin/products/{id}` and the 409 `conflict` match `services/core/internal/catalog/products.go:241`. PATCH sends exactly `{ isActive: false }` (asserted). Navigates to /products. Dialog: Cancel first, one action button, `close()` resets both mutations; `Button loading` disables, so a double click cannot fire twice. An already inactive ordered product: delete gives 409, deactivate repeats the PATCH harmlessly.
- Both scenarios have a test that fails if the behaviour breaks (button text, call counts, body, redirect, Inactive row).
- Test-first: judged from the worker log (red `2 failed | 82 passed`, both on the missing "Delete product" button); not re-run. Commit order test then feat is right.
- Scope: only the brief's paths plus the lane log; `routeTree.gen.ts` unchanged by these commits; no package.json change; no `lucide-react` import in `apps/admin/src` (the `image.tsx:7` comment names it only).
## Whole-lane pass
- No dead placeholder code found; the `image.tsx` ImageTile placeholder is a documented ponytail with an upgrade path.
- Wording is consistent ("Could not X the Y. Try again.") across categories, product-form, image and delete.
- Repeated `if (error) throw error.error` in every query/mutation and `as Partial<ApiError>` casts: small, uniform, not worth a helper now.
- tasks.md: 0.1, 1.1 to 5.2 all ticked; only 6.1 (manager e2e) open, as expected.
## Gates
- `make test-web`: exit 0 (ui 54, admin 84, web 20 passed; lint, typecheck, build inside).
- `openspec validate admin-catalog --type change --strict`: valid.
- e2e, Playwright, docker not run.
