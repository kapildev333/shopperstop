# Design

## Context
Lane admin-P2-L3, area `admin`, branch `lane/admin-P2-L3-admin-catalog` in `.worktrees/admin-P2-L3`, rebased on origin/main f94423b: admin-stores (#91, archived #92) and core-P2-L3 catalog (#87) with the regenerated `packages/ui/src/api/core.d.ts` are on main. `/categories` and `/products` are `PageHeader` placeholders from admin-P2-L1.

The whole change was spiked twice. 2026-10-12 on main + the unmerged admin-stores branch: tsc, eslint, Vitest 84/84, `vite build`, and `e2e/catalog.spec.ts` 2 passed on a scratch preview (port 25174) against a stateful `page.route` fake core with axe clean on every page and dialog. 2026-10-13 (task 0) on the rebased branch, task by task in the order of tasks.md, tests first: the counts in tasks.md are measured, and `make test-web` passed on the final tree (ui 54, admin 84, web 20). The e2e against the real core has not run; that is task 6.

The code below is that spike, byte for byte. Workers copy it; a worker who finds a block that does not compile, a test that does not go red then green as tasks.md says, or a choice this file leaves open stops and reports.

## Assumptions (verified in task 0 on f94423b)
| # | Assumption | Result |
|---|---|---|
| A1 | paths `/admin/categories` (get, post), `/admin/categories/{id}` (patch, delete), `/admin/categories/{id}/image` (put), `/admin/products` (get, post), `/admin/products/{id}` (get, patch, delete), `/admin/products/{id}/image` (put) | holds: `core.d.ts`; the spike typechecks against it |
| A2 | schemas Category, CategoryNode (+ `children`), CategoryTree `{items}`, Product (`imageUrl?`, `brand?`, `description?`), ProductList `{items,page,pageSize,total}` | holds |
| A3 | list query `q`, `categoryId`, `isActive` `'true'|'false'`, `page`, `pageSize` (default 24, max 100), ordered by name | holds |
| A4 | ProductCreate: core accepts `brand`/`description` `""`; `isActive` default true; limits name 1-100, brand 0-60, description 0-2000, unit 1-30, mrp 1-100000000 cents, price 1..mrp | holds (`services/core` unchanged since the spike base 99195d9) |
| A5 | PATCH members optional, `null` refused, `""` clears brand/description; category PATCH only name/sortOrder (0-9999) | holds |
| A6 | 409 `conflict`: category with children/products; product referenced by an order line | holds |
| A7 | image PUT: multipart part `file`, 200 answers the row, `imageUrl` = `/api/core/v1/files/<kind>/<id>.<ext>`; 400 `validation` field `file`; `/files` is under `/api`, so the existing dev/preview proxies serve it | holds: no vite or Playwright config change |
| A8 | 403 `forbidden` to store staff on every catalog route (L1's `_admin` layout shows not found) | holds |
| A9 | seed: parents sortOrder 10, 20, ..; first Fruits & Vegetables / Fresh Fruits; Dairy, Bread & Eggs has Milk (10) and Paneer & Curd; 148 products incl. one inactive; Sunny Fields Toned Milk 500 ml MRP 3000 price 2799; `--reset` truncates; a product delete leaves its uploaded file in the gitignored FILES_DIR | holds (seed unchanged) |
| A10 | FILES_DIR: `make e2e` exports it in `E2E_ENV`; Playwright webServer and global setup inherit the env | holds (Makefile unchanged) |
| A11 | openapi-fetch 0.17.0 passes a FormData from `bodySerializer` untouched with no Content-Type; jsdom FormData reaches the fake readable by `request.formData()` | holds (image tests green) |
| A12 | admin-stores base on main: `src/stores.ts` `toCents`/`toRupees`, fake-core `json`/`apiError`/`fakeCore`/`admin`, `renderApp`, `_admin` layout, placeholders `categories.tsx` and `products/index.tsx` | holds: `apps/admin` on main is identical to the branch the spike was built on; `spike.patch` applied with `git apply --check` clean |

One thing task 0 changed: the spiked `ImageTile` imported `ImageOff` from `lucide-react`, which `apps/admin/package.json` does not declare (it resolved only because npm hoists `packages/ui`'s copy). See Decision 14.

## Goals / Non-Goals
Goals: the pages in the proposal, composed only from `@shopperstop/ui` components, with every delta scenario mapped to one named test. Non-goals: everything under the proposal's "Out of scope"; any change outside `apps/admin/`; any new dependency.

## Decisions
1. Capability `admin-app`, ADDED requirements (as admin-auth-nav and admin-stores).
2. Modules: `catalog.ts` (queries, types, `categoryOptions` "Parent › Child"), `image.tsx` (`ImageTile`, `ImageUpload`), `categories.tsx` (`CategoryDialog`, `DeleteCategory`), `product-form.tsx`; routes `categories.tsx`, `products/index.tsx`, `products/new.tsx`, `products/$productId.tsx` (holding `DeleteProduct`, as `stores/$storeId.tsx` holds `DeleteStore`). `toCents`/`toRupees` are imported from `stores.ts`, not copied or moved.
3. Cache: every category mutation invalidates the tree, because the page stays mounted under the dialog. A product save writes `setQueryData` (the base of the next diff); the list refetches on mount at staleTime 0, so no invalidation (admin-stores pattern). An upload invalidates `['admin', kind]`.
4. Categories: one flattened `Table` (parent column, children indented from `sm`). Sort order is a numeric field in the edit dialog. Ceiling: no up/down or drag reordering (two PATCHes and a race). Parent is chosen on create only (core never moves a category).
5. Products: `pageSize` 24, Previous/Next pager. Filters live in page state and reset the page to 1. Ceiling: they are lost on leaving the page; move them to the URL search if asked.
6. Product form is the `StoreForm` shape. The PATCH diff is against `parse(initial(product))`, what the form shows for the loaded product, so an absent brand against `""` is no change. No client price <= MRP rule: core's 400 on `priceCents` is mapped to the field.
7. Description is a single-line `Input` (ui has no Textarea; ceiling: 2000 characters in one line). Status is a `Select` Active/Inactive (as admin-stores; ceiling: a ui Switch).
8. The product page waits for the product and the tree: a controlled select needs its options.
9. Delete 409 -> "Deactivate instead" -> `PATCH {isActive:false}` -> `/products`. Leaving the page keeps the form from going stale.
10. Upload: a native `input type=file` inside `FormField`, uploading on pick; client type and size check; one cast (`File as unknown as string`) because openapi-typescript types a binary part as string; a `?v=n` counter so a same-URL re-upload loads the new bytes. Ceiling: no progress bar, no remove (core has no route).
11. `ImageTile` is app-level until ui ships one (request to ui in the lane log).
12. e2e uploads only to a product it creates and deletes; the price it changes is saved back; one admin sign-in per test (core's sign-in rate limit).
13. Test notes: user-event `selectOptions` matches a value or innerHTML (`&` is escaped there), so tests select categories by id; `userEvent.setup({ applyAccept: false })` in the image tests so a refused type reaches the handler.
14. (task 0) The `ImageTile` placeholder is an empty `canvas` square, no icon. `lucide-react` is not an `apps/admin` dependency, and declaring it changes the root `package-lock.json`, outside this lane's scope. Ceiling: an image-less tile is a blank square; the icon comes with ui's `ImageTile`, or earlier if the orchestrator lets admin declare `lucide-react` 1.55.0 (the pin web and ui use). No test or scenario depends on the icon; the tile keeps its `data-placeholder` marker.
15. (task 5b, amends 3 and 9) After a product delete or "Deactivate instead" the kept list pages are removed (`removeQueries` on `['admin', 'products']` with `type: 'inactive'`), so `/products` shows its loading state and then core's answer, never the table kept from before. Not `invalidateQueries`, which review 5 proposed: the lists are not mounted on the product page, so invalidating only marks them stale, which staleTime 0 already does, and it would refetch the mounted product query (a 404 after a delete). The deactivate also writes core's answer into the product's key: the form is built once from the kept product, so without it the page would reopen at Active and the next save would send `isActive: true`. Ceiling: the deleted product's own query is mounted at that moment and is left to expire (5 minutes); going back to its URL in that time shows the kept form until core's 404 arrives.
16. (task 5b) After a successful change the form is reset to `initial(saved)`: core trims text, and a form still holding the typed spaces would send the name again with the next save. Ceiling: an edit typed while the save is in flight is replaced by the saved values. A product kept in the cache and changed elsewhere still opens with the kept values until the page is reloaded; only this form's own saves and the deactivate keep it current.
17. (task 5b) Editing a field clears the error on it: in the product form `set` drops that field's own error next to the `save.reset()` it already had; in the category dialog every field calls `save.reset()` and "Sort order" also drops its own error. The category part for the form's own error was in no review; it is here so both forms follow the one rule in the spec.
18. (task 5b) The file input is never disabled, so it keeps keyboard focus through an upload; `pick` returns while one is pending. "Uploading the image…" (a neutral `StatusMessage`) is new: without `disabled` nothing showed that an upload runs or why a second pick does nothing, and it is the one observable sign of the pending state a test can wait for. Ceiling: the ignored pick is silent beyond that status.
19. (task 5b) `key={product.data.id}` on the product page's `ImageUpload`, as `ProductForm` has. No test: the tile could only keep another product's image when the product id changes in place to a product already kept in the cache, and no link in the app goes from one product to another, so a test would have to drive the router by hand through a state a user cannot reach.

## Files (all under `apps/admin/`)
| Task | Test files (committed first) | Code files |
|---|---|---|
| 1 | `e2e/catalog.spec.ts` (new, not run), `src/fake-core.ts` (fixtures appended), `src/products.test.tsx` (new) | `src/catalog.ts` (new), `src/image.tsx` (new, `ImageTile` only), `src/routes/_staff/_admin/products/index.tsx` (replaces the placeholder), `products/new.tsx` and `products/$productId.tsx` (new placeholders), `src/routeTree.gen.ts` (generated) |
| 2 | `src/categories.test.tsx` (new) | `src/categories.tsx` (new, no image line), `src/routes/_staff/_admin/categories.tsx` (replaces the placeholder) |
| 3 | `src/product-form.test.tsx` (new) | `src/product-form.tsx` (new), `products/new.tsx` and `products/$productId.tsx` (replace task 1's placeholders; no delete, no image) |
| 4 | `src/image.test.tsx` (new) | `src/image.tsx` (`ImageUpload` added), `src/categories.tsx` (two lines), `products/$productId.tsx` (import and card) |
| 5 | `src/product-delete.test.tsx` (new) | `products/$productId.tsx` (`DeleteProduct`, `PageHeader` `actions`) |
| 5b | `src/products.test.tsx`, `src/categories.test.tsx`, `src/product-form.test.tsx`, `src/product-delete.test.tsx`, `src/image.test.tsx` (tests appended, three small edits) | `src/categories.tsx`, `src/product-form.tsx`, `src/image.tsx`, `products/$productId.tsx` |
| 6 | none new: runs `e2e/catalog.spec.ts` | fixes only, after a recorded failure |

Nothing else: no `package.json`, `package-lock.json`, vite, Playwright or eslint config change; nothing in `packages/ui` or `services/core`.

## Tests (scenario -> test)
| Requirement › Scenario | File | Test name | Task |
|---|---|---|---|
| Categories table › Categories listed | `src/categories.test.tsx` | "the categories table lists parents, each followed by its children" | 2 |
| Categories table states › No categories | same | "no categories shows the empty state" | 2 |
| Categories table states › Categories load failure | same | "categories load failure shows a retry that reloads" | 2 |
| Category create › Create a child category | same | "create a child category" | 2 |
| Category change › Change sends only the changed fields and reorders the tree | same | "a change sends only the changed fields and reorders the tree" | 2 |
| Category form errors › Sort order the form cannot send | same | "a sort order the form cannot send is flagged without a request" | 2 |
| Category form errors › Category field error from core | same | "a validation error from core is shown on its field" | 2 |
| Category form errors › Other category save failure | same | "any other category save error shows a banner" | 2 |
| Category delete › Delete a category after confirming | same | "delete asks first, then removes the category" | 2 |
| Category delete › Category in use | same | "a category in use cannot be deleted" | 2 |
| Products table › Products listed | `src/products.test.tsx` | "products table lists a page of products" | 1 |
| Products search and filters › Search and filters from the first page | same | "search and filters ask core again from the first page" | 1 |
| Products pager › Pager | same | "the pager moves between pages" | 1 |
| Products table states › No products | same | "no products shows the empty state" | 1 |
| Products table states › Products loading | same | "products table shows a skeleton while loading" | 1 |
| Products table states › Products load failure | same | "products load failure shows a retry that reloads" | 1 |
| Product create › Create a product | `src/product-form.test.tsx` | "create a product and open it" | 3 |
| Product change › Change sends only the changed fields | same | "edit sends only the changed fields and confirms" | 3 |
| Product change › A second product save sends only its own change | same | "a second product save sends only its own change" | 3 |
| Product change › Saved product shows in the table | same | "the products table shows a saved change" | 3 |
| Unknown product shows not found › Unknown product | same | "an unknown product shows not found" | 3 |
| Product form errors › Amount the form cannot send | same | "a value the form cannot send is flagged without a request" | 3 |
| Product form errors › Product field error from core | same | "a validation error from core is shown on its field" | 3 |
| Product form errors › Other product save failure | same | "any other product save error shows a banner" | 3 |
| Product delete › Delete a product after confirming | `src/product-delete.test.tsx` | "delete asks first, then removes the product" | 5 |
| Ordered product is deactivated instead › Ordered product is deactivated instead | same | "an ordered product offers to deactivate instead" | 5 |
| Catalog image upload › Product image uploaded | `src/image.test.tsx` | "upload a product image shows the stored image" | 4 |
| Catalog image upload › Category image uploaded from its dialog | same | "upload a category image from its dialog" | 4 |
| Image upload errors › File refused before upload | same | "a GIF is refused without a request", "a PNG over 5 MB is refused without a request" (one `test.each`) | 4 |
| Image upload errors › File refused by core | same | "a file core refuses is flagged on the field" | 4 |
| Image upload errors › Other upload failure | same | "any other upload failure shows a banner" | 4 |
| Category create › Create a top-level category | `src/categories.test.tsx` | "create a top-level category sends no parent" | 5b (A) |
| Category delete › Category in use (dialog stays open, one `DELETE`) | same | "a category in use cannot be deleted" (assertions added) | 2, 5b (A) |
| Catalog field errors clear on edit › Sort order error clears on edit | same | "a sort order error clears when the field is edited" | 5b (B) |
| Catalog field errors clear on edit › Category field error from core clears on edit | same | "a field error from core clears when its field is edited" | 5b (B) |
| Catalog field errors clear on edit › Amount error clears on edit | `src/product-form.test.tsx` | "an amount error clears when its field is edited" | 5b (B) |
| Products search and filters › Filter changed on a later page | `src/products.test.tsx` | "a filter changed on a later page asks for the first page" | 5b (A) |
| Products pager › Pager (request for `page` 1 on "Previous") | same | "the pager moves between pages" (assertions added) | 1, 5b (A) |
| Product form shows the saved product › Saved product shown as core stored it | `src/product-form.test.tsx` | "after a save the form shows the product as core stored it" | 5b (B) |
| Product form errors › Product create failure | same | "a failing create shows a banner and stays on the new page" | 5b (A) |
| Product delete › Other delete failure | `src/product-delete.test.tsx` | "any other delete failure shows a banner in the dialog" | 5b (A) |
| Products reload after a delete or a deactivate › Products table after a delete | same | "after a delete the products table loads afresh" | 5b (B) |
| Products reload after a delete or a deactivate › Deactivated product after returning | same | "after deactivate instead the table and the product show it inactive" | 5b (B) |
| Image upload in progress › Pick while an upload is pending | `src/image.test.tsx` | "a pick while an upload is pending is ignored and the field stays enabled" | 5b (B) |
| Catalog against core › Admin runs the catalog | `e2e/catalog.spec.ts` | "admin runs the catalog" | 1 (written), 6 (run) |
| Catalog against core › Store staff open the catalog pages | same | "store staff open the catalog pages" | 1 (written), 6 (run) |

After task 5: 33 scenarios, 31 Vitest (32 runs) and 2 Playwright; Vitest per file products 6, categories 10, product-form 8, image 6, product-delete 2; with admin-stores' 52 the suite is at 84 (measured). After task 5b: 23 requirements, 44 scenarios, 42 Vitest (43 runs) and 2 Playwright; per file products 7, categories 13, product-form 11, image 7, product-delete 5; the suite ends at 95 (expected, not measured: 5b was written without running it). "5b (A)" is a test of behaviour tasks 1 to 5 already built, green when written; "5b (B)" is red until 5b's code.

## Mutation guards (for the reviewer; each re-run on the final tree on 2026-10-13, 84 tests, only the named tests red)
| Mutation | Test that turns red |
|---|---|
| drop the tree `invalidateQueries` in `CategoryDialog` | "create a child category", "a change sends only the changed fields and reorders the tree" |
| drop `setQueryData` in `ProductForm` | "a second product save sends only its own change" |
| diff against `product` instead of `parse(initial(product))` | "edit sends only the changed fields and confirms" (the fixture `tonedMilk` has no description) |
| drop the upload's `invalidateQueries` | "upload a category image from its dialog" |
| drop the `?v=` counter | "upload a product image shows the stored image", "upload a category image from its dialog" |

Task 5b's guards, expected from reading the code, not run (for the reviewer to run on the final tree, 95 tests):
| Mutation | Test expected to turn red |
|---|---|
| drop `removeQueries` from `leave` in `$productId.tsx` | "after a delete the products table loads afresh", "after deactivate instead the table and the product show it inactive" |
| drop the deactivate's `setQueryData` | "after deactivate instead the table and the product show it inactive" (at "Status") |
| drop `setValues(initial(saved))` in `ProductForm` | "after a save the form shows the product as core stored it" |
| drop `setErrors` from `set` in `ProductForm` | "an amount error clears when its field is edited" |
| drop `save.reset()` from the "Sort order" `onChange` in `CategoryDialog` | "a field error from core clears when its field is edited" |
| drop `setSortError(undefined)` from the same `onChange` | "a sort order error clears when the field is edited" |
| drop `if (upload.isPending) return` from `pick` | "a pick while an upload is pending is ignored and the field stays enabled" (two `PUT`s) |
| send `parentId: parentId` always in `CategoryDialog`'s `POST` | "create a top-level category sends no parent" |
| drop `page: 1` from `filter` in `products/index.tsx` | "a filter changed on a later page asks for the first page" |

## Code and tests per task (spiked; workers copy it byte for byte)
Every block below was built in this order on the rebased branch on 2026-10-13, tests first, with the red and green counts in tasks.md. Paths are under `apps/admin/`. A block is the whole file unless its heading says otherwise.

### Task 1: products table, shared modules, placeholders, the e2e spec
#### `e2e/catalog.spec.ts` (new; written first, not run until task 6)
```ts
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Demo rows from core's seed (the e2e database is reset before every run); the test puts back what it changes.
// A 1×1 PNG, built here so the repository carries no binary fixture.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

async function signIn(page: Page, email: string, password: string) {
  await page.goto('./sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
}

async function expectNoAxeViolations(page: Page) {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
}

async function savePrice(page: Page, rupees: string) {
  await page.getByLabel('Price (₹)').fill(rupees)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible()
}

test('admin runs the catalog', async ({ page }) => {
  await signIn(page, 'admin@shopperstop.local', 'admin12345')
  const nav = page.getByRole('navigation', { name: 'Admin' })

  await nav.getByRole('link', { name: 'Categories' }).click()
  const categories = page.getByRole('table', { name: 'Categories' })
  await expect(categories.getByRole('row').nth(1)).toContainText('Fruits & Vegetables')
  await expect(categories.getByRole('row').nth(2)).toContainText('Fresh Fruits')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Edit Milk' }).click()
  await expect(page.getByRole('dialog', { name: 'Edit Milk' }).getByLabel('Sort order')).toHaveValue('10')
  await expectNoAxeViolations(page)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await nav.getByRole('link', { name: 'Products' }).click()
  await expect(page.getByText('Page 1 of 7, 148 products')).toBeVisible()
  await expectNoAxeViolations(page)
  await page.getByRole('searchbox', { name: 'Search' }).fill('sunny fields toned')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const products = page.getByRole('table', { name: 'Products' })
  await expect(products.getByRole('link')).toHaveText(['Sunny Fields Toned Milk'])
  await products.getByRole('link', { name: 'Sunny Fields Toned Milk' }).click()
  await expect(page.getByLabel('Price (₹)')).toHaveValue('27.99')
  await expectNoAxeViolations(page)
  await savePrice(page, '28')
  await page.reload()
  await expect(page.getByLabel('Price (₹)')).toHaveValue('28')
  await savePrice(page, '27.99')

  // The image goes on a new product, so no seeded image is replaced; the product is deleted at the end.
  await nav.getByRole('link', { name: 'Products' }).click()
  await page.getByRole('link', { name: 'New product' }).click()
  await page.getByLabel('Name').fill('E2E Curd Cup')
  await page.getByLabel('Category').selectOption({ label: 'Dairy, Bread & Eggs › Paneer & Curd' })
  await page.getByLabel('Unit').fill('400 g')
  await page.getByLabel('MRP (₹)').fill('40')
  await page.getByLabel('Price (₹)').fill('35.50')
  await expectNoAxeViolations(page)
  await page.getByRole('button', { name: 'Create product' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'E2E Curd Cup' })).toBeVisible()

  await page.getByLabel('Image').setInputFiles({ name: 'tile.png', mimeType: 'image/png', buffer: png })
  await expect(page.getByRole('status').filter({ hasText: 'Image saved.' })).toBeVisible()
  const tile = page.getByRole('img', { name: 'Image of E2E Curd Cup' })
  await expect(tile).toHaveAttribute('src', /^\/api\/core\/v1\/files\/products\/[0-9a-f-]{36}\.png\?v=1$/)
  await expect.poll(() => tile.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1)
  await expectNoAxeViolations(page)

  await page.getByRole('button', { name: 'Delete product' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/admin\/products$/)
  await page.getByRole('searchbox', { name: 'Search' }).fill('e2e curd cup')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'No products found' })).toBeVisible()
})

test('store staff open the catalog pages', async ({ page }) => {
  await signIn(page, 'koramangala@shopperstop.local', 'staff12345')
  for (const path of ['categories', 'products']) {
    await page.goto(`./${path}`)
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/admin/${path}$`))
    await expectNoAxeViolations(page)
  }
})
```

#### `src/fake-core.ts` (edit: two type aliases after the `AdminStore` alias, the fixtures appended at the end)
After the existing line `type AdminStore = components['schemas']['AdminStore']` add:
```ts
type CategoryNode = components['schemas']['CategoryNode']
type Product = components['schemas']['Product']
```
Append at the end of the file (after `storeList`), keeping one blank line before it:
```ts
export const fruits: CategoryNode = {
  id: '00000000-0000-4000-8000-000000000501',
  name: 'Fruits & Vegetables',
  slug: 'fruits-vegetables',
  sortOrder: 10,
  imageUrl: '/api/core/v1/files/categories/seed-fruits-vegetables.png',
  children: [{ id: '00000000-0000-4000-8000-000000000521', name: 'Fresh Fruits', slug: 'fresh-fruits', parentId: '00000000-0000-4000-8000-000000000501', sortOrder: 10 }],
}
export const dairy: CategoryNode = {
  id: '00000000-0000-4000-8000-000000000502',
  name: 'Dairy, Bread & Eggs',
  slug: 'dairy-bread-eggs',
  sortOrder: 20,
  children: [{ id: '00000000-0000-4000-8000-000000000525', name: 'Milk', slug: 'milk', parentId: '00000000-0000-4000-8000-000000000502', sortOrder: 10 }],
}

export function categoryTree(items: CategoryNode[]) {
  return json(200, { items })
}

export const banana: Product = {
  id: '00000000-0000-4000-8000-000000000601',
  name: 'Banana Robusta',
  slug: 'banana-robusta',
  unitLabel: '1 kg',
  mrpCents: 7000,
  priceCents: 7000,
  categoryId: '00000000-0000-4000-8000-000000000521',
  isActive: false,
  imageUrl: '/api/core/v1/files/products/seed-fruits-vegetables.png',
}
export const tonedMilk: Product = {
  id: '00000000-0000-4000-8000-000000000612',
  name: 'Sunny Fields Toned Milk',
  slug: 'sunny-fields-toned-milk',
  brand: 'Sunny Fields',
  unitLabel: '500 ml',
  mrpCents: 3000,
  priceCents: 2799,
  categoryId: '00000000-0000-4000-8000-000000000525',
  isActive: true,
}

export function productList(items: Product[], total = items.length, page = 1) {
  return json(200, { items, page, pageSize: 24, total })
}
```
`tonedMilk` has no `description` on purpose: it keeps "edit sends only the changed fields" red if the form diffs against the product instead of against what the form shows.

#### `src/products.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, banana, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const signedIn = { 'GET /admin/me': () => json(200, admin), 'GET /admin/categories': () => categoryTree([fruits, dairy]) }

// The query of the last product list request.
function lastListQuery(calls: Request[]) {
  const list = calls.filter((call) => new URL(call.url).pathname.endsWith('/admin/products'))
  return Object.fromEntries(new URL(list[list.length - 1].url).searchParams)
}

test('products table lists a page of products', async () => {
  setToken('tok')
  const calls = fakeCore({ ...signedIn, 'GET /admin/products': () => productList([banana, tonedMilk]) })

  renderApp('/products')

  const table = await screen.findByRole('table', { name: 'Products' })
  const rows = within(table).getAllByRole('row').slice(1)
  expect(within(table).getAllByRole('link').map((link) => link.textContent)).toEqual(['Banana Robusta', 'Sunny Fields Toned Milk'])
  expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', `/products/${tonedMilk.id}`)
  expect(rows[1]).toHaveTextContent('Sunny Fields')
  await waitFor(() => expect(rows[1]).toHaveTextContent('Dairy, Bread & Eggs › Milk'))
  expect(rows[1]).toHaveTextContent('500 ml')
  expect(rows[1]).toHaveTextContent('₹27.99')
  expect(rows[1]).toHaveTextContent('MRP ₹30')
  expect(within(rows[1]).getByText('Active')).toBeInTheDocument()
  expect(within(rows[0]).getByText('Inactive')).toBeInTheDocument()
  expect(rows[0]).toHaveTextContent('Fruits & Vegetables › Fresh Fruits')
  expect(screen.getByText('Page 1 of 1, 2 products')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New product' })).toHaveAttribute('href', '/products/new')
  expect(lastListQuery(calls)).toEqual({ page: '1', pageSize: '24' })
})

test('search and filters ask core again from the first page', async () => {
  setToken('tok')
  const calls = fakeCore({ ...signedIn, 'GET /admin/products': () => productList([tonedMilk], 30) })

  renderApp('/products')
  await screen.findByRole('table', { name: 'Products' })
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))

  await userEvent.type(screen.getByRole('searchbox', { name: 'Search' }), ' milk ')
  await userEvent.click(screen.getByRole('button', { name: 'Search' }))
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ q: 'milk', page: '1', pageSize: '24' }))

  await userEvent.selectOptions(screen.getByLabelText('Category'), dairy.children[0].id)
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Inactive')
  await waitFor(() =>
    expect(lastListQuery(calls)).toEqual({ q: 'milk', categoryId: dairy.children[0].id, isActive: 'false', page: '1', pageSize: '24' }),
  )
})

test('the pager moves between pages', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...signedIn,
    'GET /admin/products': (request) =>
      new URL(request.url).searchParams.get('page') === '2' ? productList([tonedMilk], 30, 2) : productList([banana], 30),
  })

  renderApp('/products')
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))

  expect(await screen.findByText('Page 2 of 2, 30 products')).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  expect(lastListQuery(calls).page).toBe('2')
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
})

test('no products shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/products': () => productList([]) })

  renderApp('/products')

  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New product' })).toBeInTheDocument()
})

test('products table shows a skeleton while loading', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/products': () => new Promise<Response>(() => {}) })

  renderApp('/products')

  expect(await screen.findByRole('status', { name: 'Loading' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
})

test('products load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...signedIn, 'GET /admin/products': () => (fail ? apiError(500, 'internal') : productList([banana])) })

  renderApp('/products')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the products.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('link', { name: 'Banana Robusta' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
```

#### `src/catalog.ts` (new)
```ts
import { queryOptions } from '@tanstack/react-query'
import type { components } from '@shopperstop/ui/api'
import { api } from './api'

export type Category = components['schemas']['Category']
export type CategoryNode = components['schemas']['CategoryNode']
export type Product = components['schemas']['Product']
export type ProductFilters = { q: string; categoryId: string; isActive: '' | 'true' | 'false'; page: number }

export const pageSize = 24

// Keys: the tree is ['admin', 'categories']; a product list page ['admin', 'products', filters]; one product ['admin', 'products', id].
export const categoriesQuery = queryOptions({
  queryKey: ['admin', 'categories'],
  queryFn: async () => {
    const { data, error } = await api.GET('/admin/categories')
    if (error) throw error.error
    return data
  },
})

export const productsQuery = (filters: ProductFilters) =>
  queryOptions({
    queryKey: ['admin', 'products', filters],
    queryFn: async () => {
      // Empty filters are left out: core reads an absent filter as "all".
      const query = {
        q: filters.q || undefined,
        categoryId: filters.categoryId || undefined,
        isActive: filters.isActive || undefined,
        page: filters.page,
        pageSize,
      }
      const { data, error } = await api.GET('/admin/products', { params: { query } })
      if (error) throw error.error
      return data
    },
  })

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ['admin', 'products', id],
    queryFn: async () => {
      const { data, error } = await api.GET('/admin/products/{id}', { params: { path: { id } } })
      if (error) throw error.error
      return data
    },
  })

// Every category as a choice, in tree order: a parent by its name, a child as "Parent › Child".
export function categoryOptions(tree: CategoryNode[]) {
  return tree.flatMap((parent) => [
    { id: parent.id, label: parent.name },
    ...parent.children.map((child) => ({ id: child.id, label: `${parent.name} › ${child.name}` })),
  ])
}
```

#### `src/image.tsx` (new; `ImageTile` only, task 4 adds `ImageUpload`)
```tsx
import { cn } from '@shopperstop/ui'

// A 1:1 image tile; the placeholder stands in until an image is uploaded.
// ponytail: an app-level recipe with an empty placeholder (no icon: lucide-react is not an apps/admin dependency); replace with the packages/ui ImageTile when ui adds it.
export function ImageTile({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control border border-line bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <div data-placeholder className="size-full bg-canvas" />
      )}
    </div>
  )
}
```

#### `src/routes/_staff/_admin/products/index.tsx` (replaces the placeholder)
```tsx
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { Badge, Button, Card, EmptyState, ErrorBanner, FormField, Input, PageHeader, Price, Select, Skeleton, Table, buttonClass, type Column } from '@shopperstop/ui'
import { categoriesQuery, categoryOptions, pageSize, productsQuery, type Product, type ProductFilters } from '../../../../catalog'
import { ImageTile } from '../../../../image'

const first: ProductFilters = { q: '', categoryId: '', isActive: '', page: 1 }

function Products() {
  // ponytail: filters live in the page, so they reset when the admin leaves it; move them to the URL search if asked.
  const [filters, setFilters] = useState(first)
  const [search, setSearch] = useState('')
  const products = useQuery(productsQuery(filters))
  const categories = useQuery(categoriesQuery)
  const options = categoryOptions(categories.data?.items ?? [])
  const categoryName = new Map(options.map((option) => [option.id, option.label]))

  const filter = (change: Partial<ProductFilters>) => setFilters((current) => ({ ...current, page: 1, ...change }))
  function submit(event: FormEvent) {
    event.preventDefault()
    filter({ q: search.trim() })
  }

  const columns: Column<Product>[] = [
    { key: 'image', header: 'Image', cell: (product) => <ImageTile src={product.imageUrl} className="w-10" /> },
    {
      key: 'name',
      header: 'Name',
      cell: (product) => (
        <span className="flex flex-col">
          <Link to="/products/$productId" params={{ productId: product.id }} className="font-semibold text-accent hover:underline">
            {product.name}
          </Link>
          {product.brand && <span className="text-small text-ink-muted">{product.brand}</span>}
        </span>
      ),
    },
    { key: 'category', header: 'Category', cell: (product) => categoryName.get(product.categoryId) ?? '' },
    { key: 'unit', header: 'Unit', cell: (product) => product.unitLabel },
    { key: 'price', header: 'Price', cell: (product) => <Price cents={product.priceCents} mrpCents={product.mrpCents} /> },
    {
      key: 'status',
      header: 'Status',
      cell: (product) => <Badge variant={product.isActive ? 'success' : 'neutral'}>{product.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ]

  const pages = products.data ? Math.max(1, Math.ceil(products.data.total / pageSize)) : 1
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Products" actions={<Link to="/products/new" className={buttonClass({})}>New product</Link>} />
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <form role="search" aria-label="Products" noValidate onSubmit={submit} className="flex items-end gap-2">
          <FormField label="Search">
            <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
          </FormField>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <FormField label="Category">
          <Select value={filters.categoryId} onChange={(event) => filter({ categoryId: event.target.value })}>
            <option value="">All categories</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={filters.isActive} onChange={(event) => filter({ isActive: event.target.value as ProductFilters['isActive'] })}>
            <option value="">Active and inactive</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </Select>
        </FormField>
      </Card>
      {products.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : products.isError ? (
        <ErrorBanner message="Could not load the products." onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No products found" description="Change the search or the filters, or create a product." />
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <Table stack caption="Products" columns={columns} rows={products.data.items} rowKey={(product) => product.id} />
          </Card>
          <nav aria-label="Pages" className="flex items-center justify-between gap-4">
            <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>
              Previous
            </Button>
            <p className="text-body text-ink tabular-nums">
              Page {filters.page} of {pages}, {products.data.total} products
            </p>
            <Button variant="secondary" disabled={filters.page >= pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>
              Next
            </Button>
          </nav>
        </>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/')({ component: Products })
```

#### `src/routes/_staff/_admin/products/new.tsx` (new placeholder; task 3 replaces it)
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder so the products table's typed links compile; task 3 replaces it.
export const Route = createFileRoute('/_staff/_admin/products/new')({ component: () => <PageHeader title="New product" /> })
```

#### `src/routes/_staff/_admin/products/$productId.tsx` (new placeholder; task 3 replaces it)
```tsx
import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@shopperstop/ui'

// Placeholder so the products table's typed links compile; task 3 replaces it.
export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: () => <PageHeader title="Product" /> })
```

#### `src/routeTree.gen.ts`
Generated: `npm run build --workspace apps/admin` rewrites it with the two new routes (43 added lines). Commit it with the `feat:`; never edit it by hand. It does not change again in tasks 2 to 5.

### Task 2: categories page
#### `src/categories.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import type { components } from '@shopperstop/ui/api'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json } from './fake-core'
import { renderApp } from './render-app'

type CategoryNode = components['schemas']['CategoryNode']

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const signedIn = { 'GET /admin/me': () => json(200, admin) }

function names() {
  return within(screen.getByRole('table', { name: 'Categories' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[1].textContent?.replace('Name', ''))
}

// A fake core that keeps the tree: POST adds, PATCH merges, DELETE removes; GET answers it ordered by sortOrder like core.
function keepsCategories() {
  let parents: CategoryNode[] = [fruits, dairy]
  const sorted = () => [...parents].sort((a, b) => a.sortOrder - b.sortOrder)
  return fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree(sorted()),
    'POST /admin/categories': async (request) => {
      const body = await request.clone().json()
      const created = { id: '00000000-0000-4000-8000-000000000599', slug: 'curd', parentId: body.parentId, name: body.name, sortOrder: body.sortOrder }
      parents = parents.map((parent) => (parent.id === body.parentId ? { ...parent, children: [...parent.children, created] } : parent))
      return json(201, created)
    },
    [`PATCH /admin/categories/${dairy.id}`]: async (request) => {
      const body = await request.clone().json()
      parents = parents.map((parent) => (parent.id === dairy.id ? { ...parent, ...body } : parent))
      return json(200, { ...dairy, ...body, children: undefined })
    },
    [`DELETE /admin/categories/${dairy.children[0].id}`]: () => {
      parents = parents.map((parent) => (parent.id === dairy.id ? { ...parent, children: [] } : parent))
      return json(204)
    },
  })
}

test('the categories table lists parents, each followed by its children', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/categories': () => categoryTree([fruits, dairy]) })

  renderApp('/categories')

  const table = await screen.findByRole('table', { name: 'Categories' })
  expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs', 'Milk'])
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows[0]).toHaveTextContent('Top level')
  expect(rows[0]).toHaveTextContent('10')
  expect(rows[3]).toHaveTextContent('Dairy, Bread & Eggs')
  expect(rows[0].querySelector('img')).toHaveAttribute('src', fruits.imageUrl)
  expect(rows[2].querySelector('img')).toBeNull()
  expect(within(rows[3]).getByRole('button', { name: 'Edit Milk' })).toBeInTheDocument()
  expect(within(rows[3]).getByRole('button', { name: 'Delete Milk' })).toBeInTheDocument()
})

test('no categories shows the empty state', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'GET /admin/categories': () => categoryTree([]) })

  renderApp('/categories')

  expect(await screen.findByRole('heading', { level: 2, name: 'No categories yet' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New category' })).toBeInTheDocument()
})

test('categories load failure shows a retry that reloads', async () => {
  setToken('tok')
  let fail = true
  fakeCore({ ...signedIn, 'GET /admin/categories': () => (fail ? apiError(500, 'internal') : categoryTree([dairy])) })

  renderApp('/categories')

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Could not load the categories.')
  fail = false
  await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
  expect(await screen.findByRole('table', { name: 'Categories' })).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('create a child category', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog', { name: 'New category' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Create category'])
  expect(within(dialog).getByLabelText('Sort order')).toHaveValue('0')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.selectOptions(within(dialog).getByLabelText('Parent'), dairy.id)
  await userEvent.clear(within(dialog).getByLabelText('Sort order'))
  await userEvent.type(within(dialog).getByLabelText('Sort order'), '20')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({ name: 'Curd', sortOrder: 20, parentId: dairy.id })
  await waitFor(() => expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs', 'Milk', 'Curd']))
})

test('a change sends only the changed fields and reorders the tree', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Dairy, Bread & Eggs' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Dairy, Bread & Eggs' })
  expect(within(dialog).queryByLabelText('Parent')).not.toBeInTheDocument()
  await userEvent.clear(within(dialog).getByLabelText('Sort order'))
  await userEvent.type(within(dialog).getByLabelText('Sort order'), '5')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ sortOrder: 5 })
  await waitFor(() => expect(names()).toEqual(['Dairy, Bread & Eggs', 'Milk', 'Fruits & Vegetables', 'Fresh Fruits']))
})

test('a sort order the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const field = within(screen.getByRole('dialog')).getByLabelText('Sort order')
  await userEvent.clear(field)
  await userEvent.type(field, '-1')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))

  expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.')
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    'POST /admin/categories': () => apiError(400, 'validation', 'categories have two levels', 'parentId'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.selectOptions(within(dialog).getByLabelText('Parent'), dairy.id)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(within(dialog).getByLabelText('Parent')).toHaveAccessibleDescription('Choose a top-level category.'))
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('any other category save error shows a banner', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    [`PATCH /admin/categories/${dairy.id}`]: () => apiError(500, 'internal'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Dairy, Bread & Eggs' }))
  await userEvent.type(within(screen.getByRole('dialog')).getByLabelText('Name'), ' Co')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Could not save the category. Try again.')
})

test('delete asks first, then removes the category', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Milk' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Milk?' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Delete Milk' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(names()).toEqual(['Fruits & Vegetables', 'Fresh Fruits', 'Dairy, Bread & Eggs']))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
})

test('a category in use cannot be deleted', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    [`DELETE /admin/categories/${dairy.id}`]: () => apiError(409, 'conflict', 'category has products or subcategories'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Dairy, Bread & Eggs' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(
    'This category still has subcategories or products. Move or delete them first.',
  )
  expect(names()).toContain('Dairy, Bread & Eggs')
})
```

#### `src/categories.tsx` (new; task 4 adds the image line)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { categoriesQuery, type Category, type CategoryNode } from './catalog'

type Field = 'name' | 'parentId' | 'sortOrder'

const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  parentId: 'Choose a top-level category.',
  sortOrder: 'Enter a whole number from 0 to 9999.',
}

// Create (no category) or change a category in a dialog. Every save reloads the tree, which orders it.
export function CategoryDialog({ category, parents, onClose }: { category?: Category; parents: CategoryNode[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState('')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0))
  const [sortError, setSortError] = useState<string>()

  const save = useMutation({
    mutationFn: async (order: number) => {
      // PATCH sends only what differs from the loaded category; the parent never changes.
      const { error } = category
        ? await api.PATCH('/admin/categories/{id}', {
            params: { path: { id: category.id } },
            body: { ...(name !== category.name && { name }), ...(order !== category.sortOrder && { sortOrder: order }) },
          })
        : await api.POST('/admin/categories', { body: { name, sortOrder: order, ...(parentId && { parentId }) } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const order = sortOrder.trim()
    if (!/^\d{1,4}$/.test(order)) return setSortError(messages.sortOrder)
    setSortError(undefined)
    save.mutate(Number(order))
  }

  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => (serverField === field ? messages[field] : undefined)

  return (
    <Dialog open onClose={onClose} title={category ? `Edit ${category.name}` : 'New category'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !serverField && <ErrorBanner message="Could not save the category. Try again." />}
        <FormField label="Name" error={errorFor('name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        {!category && (
          <FormField label="Parent" error={errorFor('parentId')}>
            <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">None (top level)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Sort order" hint="Lower numbers come first." error={sortError ?? errorFor('sortOrder')}>
          <Input inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </FormField>
        <DialogFooter onCancel={onClose} className="mt-2">
          <Button type="submit" loading={save.isPending}>{category ? 'Save changes' : 'Create category'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// Confirm, then delete; a category with children or products stays and the dialog says why.
export function DeleteCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/categories/{id}', { params: { path: { id: category.id } } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })
  const inUse = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  return (
    <Dialog open onClose={onClose} title={`Delete ${category.name}?`}>
      {remove.error && (
        <ErrorBanner
          className="mt-4"
          message={inUse ? 'This category still has subcategories or products. Move or delete them first.' : 'Could not delete the category. Try again.'}
        />
      )}
      <DialogFooter onCancel={onClose}>
        <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
      </DialogFooter>
    </Dialog>
  )
}
```

#### `src/routes/_staff/_admin/categories.tsx` (replaces the placeholder)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, Table, cn, type Column } from '@shopperstop/ui'
import { CategoryDialog, DeleteCategory } from '../../../categories'
import { categoriesQuery, type Category } from '../../../catalog'
import { ImageTile } from '../../../image'

type Row = Category & { parentName?: string }

function Categories() {
  const tree = useQuery(categoriesQuery)
  const [editing, setEditing] = useState<Category | 'new'>()
  const [deleting, setDeleting] = useState<Category>()
  const parents = tree.data?.items ?? []
  // The tree as rows in core's order: each parent, then its children.
  const rows: Row[] = parents.flatMap(({ children, ...parent }) => [parent, ...children.map((child) => ({ ...child, parentName: parent.name }))])

  const columns: Column<Row>[] = [
    { key: 'image', header: 'Image', cell: (row) => <ImageTile src={row.imageUrl} className="w-10" /> },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className={cn(row.parentId ? 'sm:pl-6' : 'font-semibold')}>{row.name}</span>,
    },
    { key: 'parent', header: 'Parent', cell: (row) => row.parentName ?? 'Top level' },
    { key: 'sort', header: 'Sort order', cell: (row) => <span className="tabular-nums">{row.sortOrder}</span> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <span className="flex gap-2">
          <Button variant="ghost" aria-label={`Edit ${row.name}`} onClick={() => setEditing(row)}>Edit</Button>
          <Button variant="ghost-danger" aria-label={`Delete ${row.name}`} onClick={() => setDeleting(row)}>Delete</Button>
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categories" actions={<Button onClick={() => setEditing('new')}>New category</Button>} />
      {tree.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : tree.isError ? (
        <ErrorBanner message="Could not load the categories." onRetry={() => void tree.refetch()} />
      ) : rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No categories yet" description="Create a top-level category, then its subcategories." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table stack caption="Categories" columns={columns} rows={rows} rowKey={(row) => row.id} />
        </Card>
      )}
      {editing && (
        <CategoryDialog category={editing === 'new' ? undefined : editing} parents={parents} onClose={() => setEditing(undefined)} />
      )}
      {deleting && <DeleteCategory category={deleting} onClose={() => setDeleting(undefined)} />}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/categories')({ component: Categories })
```

### Task 3: product form, create and change

#### `src/product-form.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const productPath = `/admin/products/${tonedMilk.id}`
const milk = dairy.children[0]
const signedIn = { 'GET /admin/me': () => json(200, admin), 'GET /admin/categories': () => categoryTree([fruits, dairy]) }
const withProduct = { ...signedIn, [`GET ${productPath}`]: () => json(200, tonedMilk) }

async function replace(label: string, value: string) {
  const field = await screen.findByLabelText(label)
  await userEvent.clear(field)
  if (value) await userEvent.type(field, value)
}

test('create a product and open it', async () => {
  setToken('tok')
  const created = { ...tonedMilk, id: '00000000-0000-4000-8000-000000000699', name: 'Curd Cup', brand: undefined }
  const calls = fakeCore({
    ...signedIn,
    'POST /admin/products': () => json(201, created),
    // The new product's page refetches it on mount (staleTime 0); without this answer it shows not found.
    [`GET /admin/products/${created.id}`]: () => json(200, created),
  })

  const router = renderApp('/products/new')
  expect(await screen.findByRole('heading', { level: 1, name: 'New product' })).toBeInTheDocument()
  expect(await screen.findByLabelText('Status')).toHaveValue('active')
  await replace('Name', 'Curd Cup')
  await userEvent.selectOptions(screen.getByLabelText('Category'), milk.id)
  await replace('Unit', '400 g')
  await replace('MRP (₹)', '40')
  await replace('Price (₹)', '35.50')
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Curd Cup' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe(`/products/${created.id}`)
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({
    name: 'Curd Cup',
    brand: '',
    categoryId: milk.id,
    unitLabel: '400 g',
    mrpCents: 4000,
    priceCents: 3550,
    description: '',
    isActive: true,
  })
})

test('edit sends only the changed fields and confirms', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withProduct,
    [`PATCH ${productPath}`]: () => json(200, { ...tonedMilk, brand: undefined, priceCents: 2800 }),
  })

  renderApp(`/products/${tonedMilk.id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByLabelText('MRP (₹)')).toHaveValue('30')
  expect(screen.getByLabelText('Price (₹)')).toHaveValue('27.99')
  expect(screen.getByLabelText('Category')).toHaveValue(milk.id)
  await replace('Price (₹)', '28')
  await replace('Brand', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByText('Product saved.')).toBeInTheDocument()
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ brand: '', priceCents: 2800 })
  expect(screen.getByLabelText('Price (₹)')).toHaveValue('28')
})

test('a value the form cannot send is flagged without a request', async () => {
  setToken('tok')
  const calls = fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  await replace('MRP (₹)', '30.555')
  await replace('Price (₹)', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(screen.getByLabelText('MRP (₹)')).toHaveAccessibleDescription('Enter 0.01 to 1000000 rupees, at most two decimals.')
  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
    'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  )
  expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(0)
})

test('a validation error from core is shown on its field', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PATCH ${productPath}`]: () => apiError(400, 'validation', 'must be between 1 and mrpCents', 'priceCents') })

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '31')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await waitFor(() =>
    expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
      'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
    ),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  expect(screen.queryByText('Product saved.')).not.toBeInTheDocument()
})

test('any other product save error shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PATCH ${productPath}`]: () => apiError(500, 'internal') })

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the product. Try again.')
})

test('an unknown product shows not found', async () => {
  setToken('tok')
  fakeCore(signedIn)

  const router = renderApp('/products/00000000-0000-4000-8000-000000000000')

  expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/products/00000000-0000-4000-8000-000000000000')
  const nav = screen.getByRole('navigation', { name: 'Admin' })
  expect(within(nav).getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page')
})

// A fake core that keeps the product: PATCH merges the body, GETs answer the current values.
function keepsProduct() {
  let current = { ...tonedMilk }
  return fakeCore({
    ...signedIn,
    'GET /admin/products': () => productList([current]),
    [`GET ${productPath}`]: () => json(200, current),
    [`PATCH ${productPath}`]: async (request) => {
      current = { ...current, ...(await request.clone().json()) }
      return json(200, current)
    },
  })
}

test('a second product save sends only its own change', async () => {
  setToken('tok')
  const calls = keepsProduct()

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText('Product saved.')
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(await patches[1].json()).toEqual({ isActive: false })
})

test('the products table shows a saved change', async () => {
  setToken('tok')
  keepsProduct()

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await replace('Price (₹)', '28')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  await userEvent.click(within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: 'Products' }))

  expect(await within(await screen.findByRole('table', { name: 'Products' })).findByText('₹28')).toBeInTheDocument()
})
```

#### `src/product-form.tsx` (new)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { components } from '@shopperstop/ui/api'
import { Button, ErrorBanner, FormField, Input, Select, StatusMessage } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { productQuery, type Product } from './catalog'
import { toCents, toRupees } from './stores'

type ProductCreate = Required<components['schemas']['ProductCreate']>
type Field = keyof ProductCreate
type Values = Record<Field, string>

// One message per field: for a value the form cannot send, and for core's 400 naming the field (core's messages speak in cents).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  brand: 'Enter at most 60 characters.',
  categoryId: 'Choose a category.',
  unitLabel: 'Enter 1 to 30 characters, for example 500 g.',
  mrpCents: 'Enter 0.01 to 1000000 rupees, at most two decimals.',
  priceCents: 'Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  description: 'Enter at most 2000 characters.',
  isActive: 'Choose active or inactive.',
}

function initial(product?: Product): Values {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    categoryId: product?.categoryId ?? '',
    unitLabel: product?.unitLabel ?? '',
    mrpCents: product ? toRupees(product.mrpCents) : '',
    priceCents: product ? toRupees(product.priceCents) : '',
    description: product?.description ?? '',
    isActive: !product || product.isActive ? 'active' : 'inactive',
  }
}

// The request body for the values, and the amounts that cannot be sent. Text goes as typed: core trims and checks it.
function parse(values: Values): [ProductCreate, Partial<Values>] {
  const errors: Partial<Values> = {}
  const cents = (field: 'mrpCents' | 'priceCents') => {
    const value = toCents(values[field])
    if (value === undefined) errors[field] = messages[field]
    return value ?? 0
  }
  const body: ProductCreate = {
    name: values.name,
    brand: values.brand,
    categoryId: values.categoryId,
    unitLabel: values.unitLabel,
    mrpCents: cents('mrpCents'),
    priceCents: cents('priceCents'),
    description: values.description,
    isActive: values.isActive === 'active',
  }
  return [body, errors]
}

// PATCH sends only what differs from what the form would send for the loaded product; never null, "" clears brand or description.
function changed(body: ProductCreate, product: Product) {
  const [base] = parse(initial(product))
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => base[key as Field] !== value))
}

// Create when there is no product (then open it), change it otherwise.
export function ProductForm({ product, categories }: { product?: Product; categories: { id: string; label: string }[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initial(product))
  const [errors, setErrors] = useState<Partial<Values>>({})

  const save = useMutation({
    mutationFn: async (body: ProductCreate) => {
      const { data, error } = product
        ? await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: changed(body, product) })
        : await api.POST('/admin/products', { body })
      if (error) throw error.error
      return data
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(productQuery(saved.id).queryKey, saved)
      if (!product) await navigate({ to: '/products/$productId', params: { productId: saved.id } })
    },
  })

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [body, found] = parse(values)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate(body)
  }

  // A validation error naming a form field goes to that field; anything else to the banner.
  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => errors[field] ?? (serverField === field ? messages[field] : undefined)
  const text = (field: Field, label: string, props: { inputMode?: 'decimal'; hint?: string } = {}) => (
    <FormField label={label} hint={props.hint} error={errorFor(field)}>
      <Input inputMode={props.inputMode} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </FormField>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {save.error && !serverField && <ErrorBanner message="Could not save the product. Try again." />}
      {text('name', 'Name')}
      {text('brand', 'Brand', { hint: 'Optional.' })}
      <FormField label="Category" error={errorFor('categoryId')}>
        <Select value={values.categoryId} onChange={(event) => set('categoryId', event.target.value)}>
          <option value="">Choose a category</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </FormField>
      {text('unitLabel', 'Unit', { hint: 'For example 500 g, 1 L or 6 pcs.' })}
      {text('mrpCents', 'MRP (₹)', { inputMode: 'decimal' })}
      {text('priceCents', 'Price (₹)', { inputMode: 'decimal', hint: 'At most the MRP.' })}
      {text('description', 'Description', { hint: 'Optional.' })}
      <FormField label="Status" hint="Customers do not see inactive products." error={errorFor('isActive')}>
        <Select value={values.isActive} onChange={(event) => set('isActive', event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FormField>
      {product && save.isSuccess && <StatusMessage tone="success">Product saved.</StatusMessage>}
      <div>
        <Button type="submit" loading={save.isPending}>{product ? 'Save changes' : 'Create product'}</Button>
      </div>
    </form>
  )
}
```

#### `src/routes/_staff/_admin/products/new.tsx` (replaces task 1's placeholder)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { categoriesQuery, categoryOptions } from '../../../../catalog'
import { ProductForm } from '../../../../product-form'

function NewProduct() {
  const categories = useQuery(categoriesQuery)
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title="New product" />
      {categories.isPending ? (
        <Skeleton variant="list" count={3} />
      ) : categories.isError ? (
        <ErrorBanner message="Could not load the categories." onRetry={() => void categories.refetch()} />
      ) : (
        <Card className="p-6">
          <ProductForm categories={categoryOptions(categories.data.items)} />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/new')({ component: NewProduct })
```

#### `src/routes/_staff/_admin/products/$productId.tsx` (replaces task 1's placeholder; no delete, no image yet)
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import type { ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery } from '../../../../catalog'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

function ProductPage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const categories = useQuery(categoriesQuery)
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
    return <ErrorBanner message="Could not load the product." onRetry={retry} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={product.data.name} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
```

### Task 4: image upload

#### `src/image.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const imagePath = `/admin/products/${tonedMilk.id}/image`
const storedUrl = `/api/core/v1/files/products/${tonedMilk.id}.png`
const withProduct = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/categories': () => categoryTree([fruits, dairy]),
  [`GET /admin/products/${tonedMilk.id}`]: () => json(200, tonedMilk),
}
const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'milk.png', { type: 'image/png' })
// userEvent skips files the input's accept list excludes; the refusal tests need them to reach the page.
const user = () => userEvent.setup({ applyAccept: false })

test('upload a product image shows the stored image', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => json(200, { ...tonedMilk, imageUrl: storedUrl }) })

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  expect(input).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp')
  expect(screen.queryByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).not.toBeInTheDocument()
  await userEvent.upload(input, png())

  expect(await screen.findByText('Image saved.')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).toHaveAttribute('src', `${storedUrl}?v=1`)
  const puts = calls.filter((call) => call.method === 'PUT')
  expect(puts).toHaveLength(1)
  const file = (await puts[0].formData()).get('file') as File
  expect(file.type).toBe('image/png')
  expect(file.size).toBe(4)

  // A second upload keeps the URL; the tile still loads the new bytes.
  await userEvent.upload(input, png())
  await waitFor(() => expect(screen.getByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).toHaveAttribute('src', `${storedUrl}?v=2`))
})

test.each([
  ['a GIF', new File(['GIF89a'], 'milk.gif', { type: 'image/gif' })],
  ['a PNG over 5 MB', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })],
])('%s is refused without a request', async (_name, file) => {
  setToken('tok')
  const calls = fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  await user().upload(input, file)

  expect(input).toHaveAccessibleDescription(
    'PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it. Choose a PNG, JPEG or WebP image of at most 5 MB.',
  )
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(0)
})

test('a file core refuses is flagged on the field', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => apiError(400, 'validation', 'image must be PNG, JPEG or WebP', 'file') })

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  await userEvent.upload(input, png())

  await waitFor(() =>
    expect(input).toHaveAccessibleDescription(
      'PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it. Choose a PNG, JPEG or WebP image of at most 5 MB.',
    ),
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('any other upload failure shows a banner', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`PUT ${imagePath}`]: () => apiError(500, 'internal') })

  renderApp(`/products/${tonedMilk.id}`)
  await userEvent.upload(await screen.findByLabelText('Image'), png())

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not upload the image. Try again.')
})

test('upload a category image from its dialog', async () => {
  setToken('tok')
  const milk = dairy.children[0]
  const url = `/api/core/v1/files/categories/${milk.id}.png`
  let uploaded = false
  const calls = fakeCore({
    'GET /admin/me': () => json(200, admin),
    'GET /admin/categories': () =>
      categoryTree([fruits, uploaded ? { ...dairy, children: [{ ...milk, imageUrl: url }] } : dairy]),
    [`PUT /admin/categories/${milk.id}/image`]: () => {
      uploaded = true
      return json(200, { ...milk, imageUrl: url })
    },
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const dialog = screen.getByRole('dialog', { name: 'Edit Milk' })
  await userEvent.upload(within(dialog).getByLabelText('Image'), png())

  expect(await within(dialog).findByText('Image saved.')).toBeInTheDocument()
  expect(within(dialog).getByRole('img', { name: 'Image of Milk' })).toHaveAttribute('src', `${url}?v=1`)
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  const milkRow = within(screen.getByRole('table', { name: 'Categories' })).getAllByRole('row')[4]
  await waitFor(() => expect(milkRow.querySelector('img')).toHaveAttribute('src', url))
})
```

#### `src/image.tsx` (whole file; `ImageTile` unchanged from task 1, `ImageUpload` added)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { ErrorBanner, FormField, StatusMessage, cn } from '@shopperstop/ui'
import { api, type ApiError } from './api'

// A 1:1 image tile; the placeholder stands in until an image is uploaded.
// ponytail: an app-level recipe with an empty placeholder (no icon: lucide-react is not an apps/admin dependency); replace with the packages/ui ImageTile when ui adds it.
export function ImageTile({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control border border-line bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <div data-placeholder className="size-full bg-canvas" />
      )}
    </div>
  )
}

const types = ['image/png', 'image/jpeg', 'image/webp']
const maxBytes = 5 * 1024 * 1024
const fileMessage = 'Choose a PNG, JPEG or WebP image of at most 5 MB.'

// Picks an image and uploads it at once with one multipart PUT; the tile shows what core stored.
export function ImageUpload({ kind, id, name, imageUrl }: { kind: 'products' | 'categories'; id: string; name: string; imageUrl?: string }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(imageUrl)
  // A re-upload of the same type keeps the URL; the counter makes the browser load the new bytes.
  const [version, setVersion] = useState(0)
  const [fileError, setFileError] = useState<string>()

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const options = {
        params: { path: { id } },
        // openapi-typescript types a binary part as string; the serializer sends the File itself.
        body: { file: file as unknown as string },
        bodySerializer: (body: { file: string }) => {
          const form = new FormData()
          form.append('file', body.file)
          return form
        },
      }
      const { data, error } =
        kind === 'products'
          ? await api.PUT('/admin/products/{id}/image', options)
          : await api.PUT('/admin/categories/{id}/image', options)
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      setUrl(saved.imageUrl)
      setVersion((n) => n + 1)
      // The tree, the product lists and this product show the new image on their next read.
      void queryClient.invalidateQueries({ queryKey: ['admin', kind] })
    },
  })

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    upload.reset()
    if (!file) return
    if (!types.includes(file.type) || file.size > maxBytes) return setFileError(fileMessage)
    setFileError(undefined)
    upload.mutate(file)
  }

  const rejected = (upload.error as Partial<ApiError> | null)?.field === 'file'
  return (
    <div className="flex flex-col gap-3">
      <ImageTile src={url && (version ? `${url}?v=${version}` : url)} alt={`Image of ${name}`} className="w-32" />
      <FormField label="Image" hint="PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it." error={fileError ?? (rejected ? fileMessage : undefined)}>
        <input
          type="file"
          accept={types.join(',')}
          disabled={upload.isPending}
          onChange={pick}
          className="text-body text-ink file:mr-3 file:h-11 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-4 file:text-button file:text-ink sm:file:h-10"
        />
      </FormField>
      {upload.isError && !rejected && <ErrorBanner message="Could not upload the image. Try again." />}
      {upload.isSuccess && <StatusMessage tone="success">Image saved.</StatusMessage>}
    </div>
  )
}
```

#### `src/categories.tsx` (edit: two added lines)
After the line `import { categoriesQuery, type Category, type CategoryNode } from './catalog'` add:
```tsx
import { ImageUpload } from './image'
```
Between the "Sort order" `</FormField>` and the `<DialogFooter onCancel={onClose} className="mt-2">` line add (eight spaces of indent):
```tsx
        {category && <ImageUpload kind="categories" id={category.id} name={category.name} imageUrl={category.imageUrl} />}
```

#### `src/routes/_staff/_admin/products/$productId.tsx` (edit: one import, one card)
After the line `import { categoriesQuery, categoryOptions, productQuery } from '../../../../catalog'` add:
```tsx
import { ImageUpload } from '../../../../image'
```
After the `</Card>` that closes the `ProductForm` card, inside the same `<div>`, add:
```tsx
      <Card className="p-6">
        <ImageUpload kind="products" id={product.data.id} name={product.data.name} imageUrl={product.data.imageUrl} />
      </Card>
```
The file after this task:
```tsx
import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Card, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import type { ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery } from '../../../../catalog'
import { ImageUpload } from '../../../../image'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

function ProductPage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const categories = useQuery(categoriesQuery)
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
    return <ErrorBanner message="Could not load the product." onRetry={retry} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={product.data.name} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
      <Card className="p-6">
        <ImageUpload kind="products" id={product.data.id} name={product.data.name} imageUrl={product.data.imageUrl} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
```

### Task 5: product delete with "Deactivate instead"

#### `src/product-delete.test.tsx` (new)
```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { clearToken, setToken } from './session'
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
import { renderApp } from './render-app'

afterEach(() => {
  clearToken()
  vi.unstubAllGlobals()
})

const productPath = `/admin/products/${tonedMilk.id}`
const withProduct = {
  'GET /admin/me': () => json(200, admin),
  'GET /admin/categories': () => categoryTree([fruits, dairy]),
  [`GET ${productPath}`]: () => json(200, tonedMilk),
}

test('delete asks first, then removes the product', async () => {
  setToken('tok')
  const calls = fakeCore({ ...withProduct, [`DELETE ${productPath}`]: () => json(204), 'GET /admin/products': () => productList([]) })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog', { name: 'Delete Sunny Fields Toned Milk?' })
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(0)

  await userEvent.click(screen.getByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(await screen.findByRole('heading', { level: 2, name: 'No products found' })).toBeInTheDocument()
})

test('an ordered product offers to deactivate instead', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...withProduct,
    [`DELETE ${productPath}`]: () => apiError(409, 'conflict', 'product was ordered; set isActive to false instead'),
    [`PATCH ${productPath}`]: () => json(200, { ...tonedMilk, isActive: false }),
    'GET /admin/products': () => productList([{ ...tonedMilk, isActive: false }]),
  })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  const dialog = screen.getByRole('dialog')
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.',
  )
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Deactivate instead'])
  await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate instead' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/products'))
  expect(await calls.find((call) => call.method === 'PATCH')!.json()).toEqual({ isActive: false })
  const table = await screen.findByRole('table', { name: 'Products' })
  expect(within(table).getByText('Inactive')).toBeInTheDocument()
})
```

#### `src/routes/_staff/_admin/products/$productId.tsx` (whole file: `DeleteProduct`, its imports and the `PageHeader` `actions` are new; `ProductPage` is otherwise task 4's. If a review changed this file after task 4, keep that change and add only those three things)
```tsx
import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { api, type ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery, type Product } from '../../../../catalog'
import { ImageUpload } from '../../../../image'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

// Confirm, then delete. A product that was ordered stays (409); the dialog offers to deactivate it instead.
function DeleteProduct({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/products/{id}', { params: { path: { id: product.id } } })
      if (error) throw error.error
    },
    onSuccess: () => navigate({ to: '/products' }),
  })
  const deactivate = useMutation({
    mutationFn: async () => {
      const { error } = await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: { isActive: false } })
      if (error) throw error.error
    },
    onSuccess: () => navigate({ to: '/products' }),
  })
  const ordered = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  function close() {
    setOpen(false)
    remove.reset()
    deactivate.reset()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Delete product</Button>
      <Dialog open={open} onClose={close} title={`Delete ${product.name}?`}>
        {remove.error && (
          <ErrorBanner
            className="mt-4"
            message={ordered ? 'This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.' : 'Could not delete the product. Try again.'}
          />
        )}
        {deactivate.error && <ErrorBanner className="mt-4" message="Could not deactivate the product. Try again." />}
        <DialogFooter onCancel={close}>
          {ordered ? (
            <Button loading={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate instead</Button>
          ) : (
            <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  )
}

function ProductPage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const categories = useQuery(categoriesQuery)
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
    return <ErrorBanner message="Could not load the product." onRetry={retry} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={product.data.name} actions={<DeleteProduct product={product.data} />} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
      <Card className="p-6">
        <ImageUpload kind="products" id={product.data.id} name={product.data.name} imageUrl={product.data.imageUrl} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
```

### Task 5b: follow-ups from the reviews of tasks 1 to 5

Not spiked. The team lead wrote this task on 2026-10-13 by reading the code while the manager's `make e2e` held the worktree, so nothing below was compiled or run: every count is **expected, not measured**. A block that does not compile, a test in group A that is red, a test in group B that is green before the code, or a count that differs: the worker stops and reports. Paths are under `apps/admin/`.

Two groups of tests, in two commits:
- **Group A, test gaps.** The behaviour already exists (tasks 1 to 5), only its test was missing. These tests pass the moment they are written. That is expected and is not a test-first violation: there is no code commit for them.
- **Group B, behaviour.** Seven new tests that are red until the code of this task lands.

#### Group A: tests that pass at once (commit `test: catalog review test gaps`)

##### A1 `src/products.test.tsx` (two edits)
In "the pager moves between pages", replace these two lines (the end of the test)
```tsx
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
```
with
```tsx
  await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
  expect(await screen.findByText('Page 1 of 2, 30 products')).toBeInTheDocument()
  expect(await screen.findByRole('link', { name: 'Banana Robusta' })).toBeInTheDocument()
  await waitFor(() => expect(lastListQuery(calls).page).toBe('1'))
```
Then append at the end of the file:
```tsx

test('a filter changed on a later page asks for the first page', async () => {
  setToken('tok')
  const milk = dairy.children[0]
  const calls = fakeCore({ ...signedIn, 'GET /admin/products': () => productList([tonedMilk], 30) })

  renderApp('/products')
  await screen.findByRole('option', { name: 'Dairy, Bread & Eggs › Milk' })
  await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))
  await userEvent.selectOptions(screen.getByLabelText('Category'), milk.id)
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ categoryId: milk.id, page: '1', pageSize: '24' }))

  await userEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(lastListQuery(calls).page).toBe('2'))
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'Inactive')
  await waitFor(() => expect(lastListQuery(calls)).toEqual({ categoryId: milk.id, isActive: 'false', page: '1', pageSize: '24' }))
})
```

##### A2 `src/categories.test.tsx` (one test replaced, one appended)
Replace the whole test "a category in use cannot be deleted" (the last test of the file) with:
```tsx
test('a category in use cannot be deleted', async () => {
  setToken('tok')
  const calls = fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    [`DELETE /admin/categories/${dairy.id}`]: () => apiError(409, 'conflict', 'category has products or subcategories'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Dairy, Bread & Eggs' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  const dialog = screen.getByRole('dialog', { name: 'Delete Dairy, Bread & Eggs?' })
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    'This category still has subcategories or products. Move or delete them first.',
  )
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1)
  expect(names()).toContain('Dairy, Bread & Eggs')
})
```
Then append at the end of the file:
```tsx

test('create a top-level category sends no parent', async () => {
  setToken('tok')
  const calls = keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog', { name: 'New category' })
  expect(within(dialog).getByLabelText('Parent')).toHaveValue('')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Snacks')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(await calls.find((call) => call.method === 'POST')!.json()).toEqual({ name: 'Snacks', sortOrder: 0 })
})
```

##### A3 `src/product-form.test.tsx` (append at the end of the file)
```tsx

test('a failing create shows a banner and stays on the new page', async () => {
  setToken('tok')
  fakeCore({ ...signedIn, 'POST /admin/products': () => apiError(500, 'internal') })

  const router = renderApp('/products/new')
  await replace('Name', 'Curd Cup')
  await userEvent.selectOptions(screen.getByLabelText('Category'), milk.id)
  await replace('Unit', '400 g')
  await replace('MRP (₹)', '40')
  await replace('Price (₹)', '35.50')
  await userEvent.click(screen.getByRole('button', { name: 'Create product' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the product. Try again.')
  expect(router.state.location.pathname).toBe('/products/new')
  expect(screen.getByRole('heading', { level: 1, name: 'New product' })).toBeInTheDocument()
})
```

##### A4 `src/product-delete.test.tsx` (append at the end of the file)
```tsx

test('any other delete failure shows a banner in the dialog', async () => {
  setToken('tok')
  fakeCore({ ...withProduct, [`DELETE ${productPath}`]: () => apiError(500, 'internal') })

  const router = renderApp(`/products/${tonedMilk.id}`)
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not delete the product. Try again.')
  expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancel', 'Delete'])
  expect(router.state.location.pathname).toBe(`/products/${tonedMilk.id}`)
})
```

Expected after group A: `Tests  88 passed (88)`, `Test Files  14 passed (14)` (84 plus the four appended tests; the two edited tests keep their names).

#### Group B: tests that are red until the code lands (commit `test: catalog review follow-ups`)

##### B1 `src/product-delete.test.tsx` (one import edit, two tests appended)
Replace the import line
```tsx
import { admin, apiError, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
```
with
```tsx
import { admin, apiError, banana, categoryTree, dairy, fakeCore, fruits, json, productList, tonedMilk } from './fake-core'
```
Then append at the end of the file (after A4's test):
```tsx

test('after a delete the products table loads afresh', async () => {
  setToken('tok')
  let deleted = false
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => resolve()
  })
  fakeCore({
    ...withProduct,
    [`DELETE ${productPath}`]: () => {
      deleted = true
      return json(204)
    },
    // After the delete the list answers only when the test lets it, so a table kept from before would stay on screen.
    'GET /admin/products': async () => {
      if (!deleted) return productList([banana, tonedMilk])
      await held
      return productList([banana])
    },
  })

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  release()
  expect(await screen.findByRole('link', { name: 'Banana Robusta' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Sunny Fields Toned Milk' })).not.toBeInTheDocument()
})

test('after deactivate instead the table and the product show it inactive', async () => {
  setToken('tok')
  let current = { ...tonedMilk }
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => resolve()
  })
  fakeCore({
    ...withProduct,
    [`GET ${productPath}`]: () => json(200, current),
    [`DELETE ${productPath}`]: () => apiError(409, 'conflict', 'product was ordered; set isActive to false instead'),
    [`PATCH ${productPath}`]: () => {
      current = { ...current, isActive: false }
      return json(200, current)
    },
    // Once the product is inactive the list answers only when the test lets it.
    'GET /admin/products': async () => {
      if (current.isActive) return productList([current])
      await held
      return productList([current])
    },
  })

  renderApp('/products')
  await userEvent.click(await screen.findByRole('link', { name: 'Sunny Fields Toned Milk' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const dialog = screen.getByRole('dialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
  await userEvent.click(await within(dialog).findByRole('button', { name: 'Deactivate instead' }))

  expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  release()
  const table = await screen.findByRole('table', { name: 'Products' })
  expect(within(table).getByText('Inactive')).toBeInTheDocument()

  // The product page has its own "Status" field; wait for the page before reading it (the list has a "Status" filter).
  await userEvent.click(within(table).getByRole('link', { name: 'Sunny Fields Toned Milk' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Sunny Fields Toned Milk' })).toBeInTheDocument()
  expect(screen.getByLabelText('Status')).toHaveValue('inactive')
})
```
Expected red, both at `expect(screen.queryByRole('table')).not.toBeInTheDocument()`: today `/products` reopens with the table kept from the first visit.

##### B2 `src/product-form.test.tsx` (one edit in `keepsProduct`, two tests appended)
In `keepsProduct`, replace
```tsx
      current = { ...current, ...(await request.clone().json()) }
      return json(200, current)
```
with
```tsx
      current = { ...current, ...(await request.clone().json()) }
      // Core trims text.
      current.name = current.name.trim()
      return json(200, current)
```
Then append at the end of the file (after A3's test):
```tsx

test('after a save the form shows the product as core stored it', async () => {
  setToken('tok')
  const calls = keepsProduct()

  renderApp(`/products/${tonedMilk.id}`)
  await replace('Name', '  Toned Milk  ')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  await screen.findByText('Product saved.')
  expect(screen.getByLabelText('Name')).toHaveValue('Toned Milk')
  await userEvent.selectOptions(screen.getByLabelText('Status'), 'inactive')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

  await screen.findByText('Product saved.')
  const patches = calls.filter((call) => call.method === 'PATCH')
  expect(patches).toHaveLength(2)
  expect(await patches[0].json()).toEqual({ name: '  Toned Milk  ' })
  expect(await patches[1].json()).toEqual({ isActive: false })
})

test('an amount error clears when its field is edited', async () => {
  setToken('tok')
  fakeCore(withProduct)

  renderApp(`/products/${tonedMilk.id}`)
  await replace('MRP (₹)', '30.555')
  await replace('Price (₹)', '')
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription(
    'At most the MRP. Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  )
  await userEvent.type(screen.getByLabelText('Price (₹)'), '28')

  expect(screen.getByLabelText('Price (₹)')).toHaveAccessibleDescription('At most the MRP.')
  expect(screen.getByLabelText('MRP (₹)')).toHaveAccessibleDescription('Enter 0.01 to 1000000 rupees, at most two decimals.')
})
```
Expected red: the first at `toHaveValue('Toned Milk')` (the field still reads the typed spaces), the second at `toHaveAccessibleDescription('At most the MRP.')` (the error stays until the next submit).

##### B3 `src/categories.test.tsx` (two tests appended, after A2's test)
```tsx

test('a field error from core clears when its field is edited', async () => {
  setToken('tok')
  fakeCore({
    ...signedIn,
    'GET /admin/categories': () => categoryTree([fruits, dairy]),
    'POST /admin/categories': () => apiError(400, 'validation', 'must be between 0 and 9999', 'sortOrder'),
  })

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'New category' }))
  const dialog = screen.getByRole('dialog')
  const field = within(dialog).getByLabelText('Sort order')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Curd')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create category' }))
  await waitFor(() => expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.'))
  await userEvent.type(field, '5')

  expect(field).toHaveAccessibleDescription('Lower numbers come first.')
  expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
})

test('a sort order error clears when the field is edited', async () => {
  setToken('tok')
  keepsCategories()

  renderApp('/categories')
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Milk' }))
  const field = within(screen.getByRole('dialog')).getByLabelText('Sort order')
  await userEvent.clear(field)
  await userEvent.type(field, '-1')
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))
  expect(field).toHaveAccessibleDescription('Lower numbers come first. Enter a whole number from 0 to 9999.')
  await userEvent.clear(field)

  expect(field).toHaveAccessibleDescription('Lower numbers come first.')
})
```
Expected red, both at the last `toHaveAccessibleDescription('Lower numbers come first.')`.

##### B4 `src/image.test.tsx` (one test appended)
```tsx

test('a pick while an upload is pending is ignored and the field stays enabled', async () => {
  setToken('tok')
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => {
    release = () => resolve()
  })
  const calls = fakeCore({
    ...withProduct,
    // The upload answers only when the test lets it.
    [`PUT ${imagePath}`]: async () => {
      await held
      return json(200, { ...tonedMilk, imageUrl: storedUrl })
    },
  })

  renderApp(`/products/${tonedMilk.id}`)
  const input = await screen.findByLabelText('Image')
  await userEvent.upload(input, png())
  expect(await screen.findByText('Uploading the image…')).toBeInTheDocument()
  expect(input).toBeEnabled()
  await userEvent.upload(input, png())
  release()

  expect(await screen.findByText('Image saved.')).toBeInTheDocument()
  expect(screen.queryByText('Uploading the image…')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Image of Sunny Fields Toned Milk' })).toHaveAttribute('src', `${storedUrl}?v=1`)
  expect(calls.filter((call) => call.method === 'PUT')).toHaveLength(1)
})
```
Expected red at `findByText('Uploading the image…')` (the text does not exist yet; the test waits one second, then fails). The `…` is the single character U+2026, in the test and in the code: copy it, do not type three dots.

Expected after group B, before the code: `Tests  7 failed | 88 passed (95)`, `Test Files  4 failed | 10 passed (14)`. The seven red tests are exactly the seven appended in B1 to B4.

#### Code (commit `fix: catalog review follow-ups`)
Four files, each given whole: overwrite the file with the block. Each block is the file as it stands after task 5 with only the lines named in its heading changed. If the file in the worktree differs from that in any other line, stop and report.

##### `src/categories.tsx` (whole file; changed: the three `onChange` handlers and one comment)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { categoriesQuery, type Category, type CategoryNode } from './catalog'
import { ImageUpload } from './image'

type Field = 'name' | 'parentId' | 'sortOrder'

const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  parentId: 'Choose a top-level category.',
  sortOrder: 'Enter a whole number from 0 to 9999.',
}

// Create (no category) or change a category in a dialog. Every save reloads the tree, which orders it.
export function CategoryDialog({ category, parents, onClose }: { category?: Category; parents: CategoryNode[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState('')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0))
  const [sortError, setSortError] = useState<string>()

  const save = useMutation({
    mutationFn: async (order: number) => {
      // PATCH sends only what differs from the loaded category; the parent never changes.
      const { error } = category
        ? await api.PATCH('/admin/categories/{id}', {
            params: { path: { id: category.id } },
            body: { ...(name !== category.name && { name }), ...(order !== category.sortOrder && { sortOrder: order }) },
          })
        : await api.POST('/admin/categories', { body: { name, sortOrder: order, ...(parentId && { parentId }) } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const order = sortOrder.trim()
    if (!/^\d{1,4}$/.test(order)) return setSortError(messages.sortOrder)
    setSortError(undefined)
    save.mutate(Number(order))
  }

  // Editing a field clears its error: core's last answer (save.reset) and, on the sort order, the form's own.
  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => (serverField === field ? messages[field] : undefined)

  return (
    <Dialog open onClose={onClose} title={category ? `Edit ${category.name}` : 'New category'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !serverField && <ErrorBanner message="Could not save the category. Try again." />}
        <FormField label="Name" error={errorFor('name')}>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              save.reset()
            }}
          />
        </FormField>
        {!category && (
          <FormField label="Parent" error={errorFor('parentId')}>
            <Select
              value={parentId}
              onChange={(event) => {
                setParentId(event.target.value)
                save.reset()
              }}
            >
              <option value="">None (top level)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Sort order" hint="Lower numbers come first." error={sortError ?? errorFor('sortOrder')}>
          <Input
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value)
              setSortError(undefined)
              save.reset()
            }}
          />
        </FormField>
        {category && <ImageUpload kind="categories" id={category.id} name={category.name} imageUrl={category.imageUrl} />}
        <DialogFooter onCancel={onClose} className="mt-2">
          <Button type="submit" loading={save.isPending}>{category ? 'Save changes' : 'Create category'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// Confirm, then delete; a category with children or products stays and the dialog says why.
export function DeleteCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/categories/{id}', { params: { path: { id: category.id } } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })
  const inUse = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  return (
    <Dialog open onClose={onClose} title={`Delete ${category.name}?`}>
      {remove.error && (
        <ErrorBanner
          className="mt-4"
          message={inUse ? 'This category still has subcategories or products. Move or delete them first.' : 'Could not delete the category. Try again.'}
        />
      )}
      <DialogFooter onCancel={onClose}>
        <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
      </DialogFooter>
    </Dialog>
  )
}
```

##### `src/product-form.tsx` (whole file; changed: `onSuccess` of `save`, and `set`)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { components } from '@shopperstop/ui/api'
import { Button, ErrorBanner, FormField, Input, Select, StatusMessage } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { productQuery, type Product } from './catalog'
import { toCents, toRupees } from './stores'

type ProductCreate = Required<components['schemas']['ProductCreate']>
type Field = keyof ProductCreate
type Values = Record<Field, string>

// One message per field: for a value the form cannot send, and for core's 400 naming the field (core's messages speak in cents).
const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  brand: 'Enter at most 60 characters.',
  categoryId: 'Choose a category.',
  unitLabel: 'Enter 1 to 30 characters, for example 500 g.',
  mrpCents: 'Enter 0.01 to 1000000 rupees, at most two decimals.',
  priceCents: 'Enter a price from 0.01 rupees up to the MRP, at most two decimals.',
  description: 'Enter at most 2000 characters.',
  isActive: 'Choose active or inactive.',
}

function initial(product?: Product): Values {
  return {
    name: product?.name ?? '',
    brand: product?.brand ?? '',
    categoryId: product?.categoryId ?? '',
    unitLabel: product?.unitLabel ?? '',
    mrpCents: product ? toRupees(product.mrpCents) : '',
    priceCents: product ? toRupees(product.priceCents) : '',
    description: product?.description ?? '',
    isActive: !product || product.isActive ? 'active' : 'inactive',
  }
}

// The request body for the values, and the amounts that cannot be sent. Text goes as typed: core trims and checks it.
function parse(values: Values): [ProductCreate, Partial<Values>] {
  const errors: Partial<Values> = {}
  const cents = (field: 'mrpCents' | 'priceCents') => {
    const value = toCents(values[field])
    if (value === undefined) errors[field] = messages[field]
    return value ?? 0
  }
  const body: ProductCreate = {
    name: values.name,
    brand: values.brand,
    categoryId: values.categoryId,
    unitLabel: values.unitLabel,
    mrpCents: cents('mrpCents'),
    priceCents: cents('priceCents'),
    description: values.description,
    isActive: values.isActive === 'active',
  }
  return [body, errors]
}

// PATCH sends only what differs from what the form would send for the loaded product; never null, "" clears brand or description.
function changed(body: ProductCreate, product: Product) {
  const [base] = parse(initial(product))
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => base[key as Field] !== value))
}

// Create when there is no product (then open it), change it otherwise.
export function ProductForm({ product, categories }: { product?: Product; categories: { id: string; label: string }[] }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState(() => initial(product))
  const [errors, setErrors] = useState<Partial<Values>>({})

  const save = useMutation({
    mutationFn: async (body: ProductCreate) => {
      const { data, error } = product
        ? await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: changed(body, product) })
        : await api.POST('/admin/products', { body })
      if (error) throw error.error
      return data
    },
    onSuccess: async (saved) => {
      queryClient.setQueryData(productQuery(saved.id).queryKey, saved)
      // The form now shows what core stored (text trimmed), so the next save sends only its own change.
      if (product) setValues(initial(saved))
      else await navigate({ to: '/products/$productId', params: { productId: saved.id } })
    },
  })

  function set(field: Field, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    // Editing a field clears its own error and core's last answer.
    setErrors((current) => ({ ...current, [field]: undefined }))
    save.reset()
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const [body, found] = parse(values)
    setErrors(found)
    if (Object.keys(found).length === 0) save.mutate(body)
  }

  // A validation error naming a form field goes to that field; anything else to the banner.
  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => errors[field] ?? (serverField === field ? messages[field] : undefined)
  const text = (field: Field, label: string, props: { inputMode?: 'decimal'; hint?: string } = {}) => (
    <FormField label={label} hint={props.hint} error={errorFor(field)}>
      <Input inputMode={props.inputMode} value={values[field]} onChange={(event) => set(field, event.target.value)} />
    </FormField>
  )

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      {save.error && !serverField && <ErrorBanner message="Could not save the product. Try again." />}
      {text('name', 'Name')}
      {text('brand', 'Brand', { hint: 'Optional.' })}
      <FormField label="Category" error={errorFor('categoryId')}>
        <Select value={values.categoryId} onChange={(event) => set('categoryId', event.target.value)}>
          <option value="">Choose a category</option>
          {categories.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </Select>
      </FormField>
      {text('unitLabel', 'Unit', { hint: 'For example 500 g, 1 L or 6 pcs.' })}
      {text('mrpCents', 'MRP (₹)', { inputMode: 'decimal' })}
      {text('priceCents', 'Price (₹)', { inputMode: 'decimal', hint: 'At most the MRP.' })}
      {text('description', 'Description', { hint: 'Optional.' })}
      <FormField label="Status" hint="Customers do not see inactive products." error={errorFor('isActive')}>
        <Select value={values.isActive} onChange={(event) => set('isActive', event.target.value)}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </FormField>
      {product && save.isSuccess && <StatusMessage tone="success">Product saved.</StatusMessage>}
      <div>
        <Button type="submit" loading={save.isPending}>{product ? 'Save changes' : 'Create product'}</Button>
      </div>
    </form>
  )
}
```

##### `src/image.tsx` (whole file; changed: `pick` returns while an upload is pending, the input loses `disabled`, the "Uploading the image…" status)
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { ErrorBanner, FormField, StatusMessage, cn } from '@shopperstop/ui'
import { api, type ApiError } from './api'

// A 1:1 image tile; the placeholder stands in until an image is uploaded.
// ponytail: an app-level recipe with an empty placeholder (no icon: lucide-react is not an apps/admin dependency); replace with the packages/ui ImageTile when ui adds it.
export function ImageTile({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control border border-line bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <div data-placeholder className="size-full bg-canvas" />
      )}
    </div>
  )
}

const types = ['image/png', 'image/jpeg', 'image/webp']
const maxBytes = 5 * 1024 * 1024
const fileMessage = 'Choose a PNG, JPEG or WebP image of at most 5 MB.'

// Picks an image and uploads it at once with one multipart PUT; the tile shows what core stored.
export function ImageUpload({ kind, id, name, imageUrl }: { kind: 'products' | 'categories'; id: string; name: string; imageUrl?: string }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(imageUrl)
  // A re-upload of the same type keeps the URL; the counter makes the browser load the new bytes.
  const [version, setVersion] = useState(0)
  const [fileError, setFileError] = useState<string>()

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const options = {
        params: { path: { id } },
        // openapi-typescript types a binary part as string; the serializer sends the File itself.
        body: { file: file as unknown as string },
        bodySerializer: (body: { file: string }) => {
          const form = new FormData()
          form.append('file', body.file)
          return form
        },
      }
      const { data, error } =
        kind === 'products'
          ? await api.PUT('/admin/products/{id}/image', options)
          : await api.PUT('/admin/categories/{id}/image', options)
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      setUrl(saved.imageUrl)
      setVersion((n) => n + 1)
      // The tree, the product lists and this product show the new image on their next read.
      void queryClient.invalidateQueries({ queryKey: ['admin', kind] })
    },
  })

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    // The input stays enabled while an upload runs, so it keeps keyboard focus; a pick in that time is ignored.
    if (upload.isPending) return
    upload.reset()
    if (!file) return
    if (!types.includes(file.type) || file.size > maxBytes) return setFileError(fileMessage)
    setFileError(undefined)
    upload.mutate(file)
  }

  const rejected = (upload.error as Partial<ApiError> | null)?.field === 'file'
  return (
    <div className="flex flex-col gap-3">
      <ImageTile src={url && (version ? `${url}?v=${version}` : url)} alt={`Image of ${name}`} className="w-32" />
      <FormField label="Image" hint="PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it." error={fileError ?? (rejected ? fileMessage : undefined)}>
        <input
          type="file"
          accept={types.join(',')}
          onChange={pick}
          className="text-body text-ink file:mr-3 file:h-11 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-4 file:text-button file:text-ink sm:file:h-10"
        />
      </FormField>
      {upload.isError && !rejected && <ErrorBanner message="Could not upload the image. Try again." />}
      {upload.isPending && <StatusMessage>Uploading the image…</StatusMessage>}
      {upload.isSuccess && <StatusMessage tone="success">Image saved.</StatusMessage>}
    </div>
  )
}
```

##### `src/routes/_staff/_admin/products/$productId.tsx` (whole file; changed: the `useQueryClient` import, `leave`, both `onSuccess`, the deactivate `mutationFn` returns the product, `key` on `ImageUpload`)
```tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Skeleton } from '@shopperstop/ui'
import { api, type ApiError } from '../../../../api'
import { categoriesQuery, categoryOptions, productQuery, type Product } from '../../../../catalog'
import { ImageUpload } from '../../../../image'
import { NotFound } from '../../../../not-found'
import { ProductForm } from '../../../../product-form'

// Confirm, then delete. A product that was ordered stays (409); the dialog offers to deactivate it instead.
function DeleteProduct({ product }: { product: Product }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // The kept list pages still show the product as it was: drop them, so /products loads afresh.
  // Only inactive queries: this page's own product query is in use and stays.
  const leave = () => {
    queryClient.removeQueries({ queryKey: ['admin', 'products'], type: 'inactive' })
    return navigate({ to: '/products' })
  }
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/products/{id}', { params: { path: { id: product.id } } })
      if (error) throw error.error
    },
    onSuccess: leave,
  })
  const deactivate = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.PATCH('/admin/products/{id}', { params: { path: { id: product.id } }, body: { isActive: false } })
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      // The product's page reads this the next time it opens, so its form starts at Inactive.
      queryClient.setQueryData(productQuery(saved.id).queryKey, saved)
      return leave()
    },
  })
  const ordered = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  function close() {
    setOpen(false)
    remove.reset()
    deactivate.reset()
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Delete product</Button>
      <Dialog open={open} onClose={close} title={`Delete ${product.name}?`}>
        {remove.error && (
          <ErrorBanner
            className="mt-4"
            message={ordered ? 'This product was ordered, so it cannot be deleted. Deactivate it instead: customers no longer see it.' : 'Could not delete the product. Try again.'}
          />
        )}
        {deactivate.error && <ErrorBanner className="mt-4" message="Could not deactivate the product. Try again." />}
        <DialogFooter onCancel={close}>
          {ordered ? (
            <Button loading={deactivate.isPending} onClick={() => deactivate.mutate()}>Deactivate instead</Button>
          ) : (
            <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  )
}

function ProductPage() {
  const { productId } = Route.useParams()
  const product = useQuery(productQuery(productId))
  const categories = useQuery(categoriesQuery)
  if (product.isPending || categories.isPending) return <Skeleton variant="list" count={3} />
  if (product.isError && (product.error as Partial<ApiError>).code === 'not_found') return <NotFound />
  if (product.isError || categories.isError) {
    const retry = () => void Promise.all([product.refetch(), categories.refetch()])
    return <ErrorBanner message="Could not load the product." onRetry={retry} />
  }
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <PageHeader title={product.data.name} actions={<DeleteProduct product={product.data} />} />
      <Card className="p-6">
        <ProductForm key={product.data.id} product={product.data} categories={categoryOptions(categories.data.items)} />
      </Card>
      <Card className="p-6">
        <ImageUpload key={product.data.id} kind="products" id={product.data.id} name={product.data.name} imageUrl={product.data.imageUrl} />
      </Card>
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/products/$productId')({ component: ProductPage })
```

Expected after the code: `Tests  95 passed (95)`, `Test Files  14 passed (14)`; `make test-web` exit 0 (ui 54, admin 95, web 20); `src/routeTree.gen.ts` unchanged.

Why each edit is what it is:
- `leave` removes with `type: 'inactive'`, not `invalidateQueries` (the review's suggestion). The list queries are not mounted on the product page, so invalidating them only marks them stale, which at staleTime 0 they already are: the kept table would still show on the way back. And invalidating the prefix would refetch the mounted product query, a 404 after a delete. Removing the inactive queries drops every kept list page and leaves the mounted one alone.
- The deactivate writes core's answer with `setQueryData` because the product page builds its form once from the kept product: without it the form would reopen at Active and the next save would send `isActive: true`.
- `setValues(initial(saved))` only when changing (`product` set); a create navigates away instead.
- `key` on `ImageUpload` has no test (see Decision 19).

## Risks / Trade-offs
- The real-core e2e has run only against a `page.route` fake. Risks in task 6: the seed counts in the spec ("Page 1 of 7, 148 products"), the real multipart answer, the image served through the preview's `/api` proxy. A failure is recorded first, then fixed with `fix:`; an assertion is never weakened.
- Core's sign-in rate limit (10 per email per hour per process): the catalog spec adds one admin and one store-staff sign-in per run. A reused local core reaches the limit after a few full admin runs; restart core (the manager's call).
- Standalone admin e2e needs `SHOPPERSTOP_CORE_FILES_DIR` exported with the other four variables; `make e2e` sets it.
- A product the e2e creates leaves its uploaded PNG in `services/core/data/e2e-files` after the delete (core keeps the file). The directory is gitignored and the seed is reset per run.
- `file as unknown as string`: if core's OpenAPI ever types the part differently, the cast hides it from tsc; the image tests read the multipart body, so they would fail instead.
- `ImageTile` exists twice (web has the same recipe) until ui ships one; the placeholder has no icon (Decision 14).
- Typed `Link`s need their target routes: task 1 ships the two product placeholders for that reason, and `routeTree.gen.ts` must be regenerated by the build before typecheck in task 1.
- Task 5b was designed by reading, with the worktree held by the manager's e2e: its blocks were not compiled and its tests not run. The likeliest misses are a test that waits on a render differently than reasoned (the three tests that hold a response back) and a type the reading got wrong. The worker stops on the first count that differs; the fix is the team lead's.
- Tasks share `$productId.tsx`, `categories.tsx`, `image.tsx` and `fake-core.ts`, so they run in order on the one worktree. Tasks 2 and 3 are file-disjoint and could run in parallel worktrees; the measured counts in tasks.md assume the listed order.

## Accepted ceilings
- No reordering control beyond the sort-order number; no moving a category to another parent.
- Product filters are page state, not URL search.
- Description is a single-line input.
- No image removal, no upload progress, no leave-page warning for unsaved edits.
- A failed product load shows only the retry banner, no h1 (as admin-stores).
- An MRP from 1,000,000.01 to 9,999,999.99 rupees passes the form's shared `toCents` (7 digits) and reaches core's 400, which shows the field message. The message's "0.01 to 1000000 rupees" stays as worded (review 3, R3-6): core's 400 shows the same text, so it stays true.

Left out of task 5b on the manager's ruling (reviews of tasks 1 to 5), one line each:
- R1-4: every page or filter change shows the skeleton and hides the pager (no `placeholderData: keepPreviousData`); a flicker only.
- R2-5, R3-3: "Save" with nothing changed sends `PATCH {}` and confirms; core accepts it. A category name typed with a trailing space is sent and trimmed by core to the same value.
- R1-3: the products table's category cell is blank while the tree loads or if it fails; no error is shown for it.
- R4-3: the upload refuses by `file.type`, core judges by content; a real image the browser reports with an empty or wrong type is refused in the form. It never sends what core would refuse.
- R5-3: after a failed deactivate the dialog shows both banners (the 409 text and "Could not deactivate the product. Try again.").
- Review 4, further notes: the image tile ignores a later `imageUrl` from a background refetch; an upload still pending when the category dialog closes finishes and refreshes the table.
- Test gaps left: clearing the search (`q` omitted again); core field errors on a category's `name` and `parentId` clearing, and the name-only `PATCH` body; a core error naming an unknown field (banner); `toCents` for negative, exponent and zero input; no alert next to a file refused in the form; no "Image" field in the "New category" dialog; the deactivate-failure banner; Escape or reopen resetting the 409 state.
- Task 5b's own ceilings are in Decisions 15, 16 and 18.

## Migration Plan
None: no data, config or dependency change. `spike.patch` was a design input and is removed from the change with this file; the PR carries no patch. Rollback is reverting the PR; the two routes fall back to L1's placeholders.
