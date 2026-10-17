# rider-P5-L3-T1 - e2e: online dispatch flow (task 1 of rider-app-dispatch)
Status: brief

## Brief
- LANE-ID: rider-P5-L3 (task T1). Area: rider. Model: worker.
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/rider-P5-L3`, branch `lane/rider-P5-L3-app-dispatch`. Commit as `kapildev333 <47056817+kapildev333@users.noreply.github.com>`, no trailers. Never push. Never run `make e2e`, `make db`, `make dev` or `docker`.
- Scope (edit only these): `apps/rider/e2e/helpers.ts`, `apps/rider/e2e/online.spec.ts` (new), `openspec/changes/rider-app-dispatch/tasks.md` (tick 1.1), this file (your log below the brief).
- Change and task: `openspec/changes/rider-app-dispatch/`, task 1. Scenario: `specs/rider-app/spec.md` "Online dispatch flow end to end" / Online rider offered a readied order. Read design.md Decision 12 (why Indiranagar).
- Setup: `export PATH=$HOME/.local/node-v22.23.3/bin:$PATH`; `test -d node_modules || npm ci`.
- e2e scenarios are written before the pages (CLAUDE.md TDD). This test cannot pass until task 5 and you do not run it; the area manager runs it in `make e2e` at the end. Your gates prove it compiles and lints and that the Phase 3 specs are unchanged in behaviour.

### 1. `apps/rider/e2e/helpers.ts`: add, do not change behaviour
Keep every existing export and its default behaviour (Koramangala). Add:
- `export const indiranagar = '00000000-0000-4000-8000-000000000402'`
- `addAddress(request, shopper, pincode = '560034', line1 = '12 80 Feet Rd, Koramangala')`: the two new optional parameters go into the body; existing callers are unchanged.
- `fillCart(request, shopper, pick, storeId = koramangala)`: `storeId` goes into the body.
- `storePick(request, storeId): Promise<Pick>`: `GET /api/core/v1/stores/${storeId}/products?pageSize=100` and `GET /api/core/v1/stores/${storeId}` (`minOrderCents`); the first item with `inStock`, `priceCents >= 2000` and `quantity >= Math.ceil(minOrderCents / priceCents)`; returns `{ id, name, priceCents, units }`; throws naming the store when none qualifies. (No `quantity === 10` filter: that filter exists for stock assertions this spec does not make.)
- `staffHeaders(request, email = 'koramangala@shopperstop.local')`: memoise per email in a `Map<string, Promise<...>>` (as `riderToken` does) instead of the single variable; same password `staff12345`.

### 2. `apps/rider/e2e/online.spec.ts` (new), exactly this test
```ts
import { expect, test } from '@playwright/test'
import { addAddress, asRider, expectNoViolations, fillCart, freshShopper, indiranagar, placeByApi, riderToken, staffHeaders, storePick } from './helpers'

// Dispatch at Indiranagar, which no other rider spec uses (design.md Decision 12): the dispatcher works per store, so
// the Koramangala specs running in parallel can never be offered this order, and their riders never go online.
const riderEmail = 'rider1-indiranagar@shopperstop.local'
const riderPassword = 'rider12345'
const staffEmail = 'indiranagar@shopperstop.local'
const storeLocation = { latitude: 12.9719, longitude: 77.6412 } // core's seed for Indiranagar

test('online rider offered a readied order', async ({ page, context, request }) => {
  test.slow()
  const token = await riderToken(request, riderEmail, riderPassword)
  const auth = { Authorization: `Bearer ${token}` }
  await context.setGeolocation(storeLocation)
  await asRider(page, token)
  try {
    // Offline to start: the badge and the toggle.
    await page.goto('./')
    const banner = page.getByRole('banner')
    await expect(banner.getByText('Offline', { exact: true })).toBeVisible()
    const goOnline = banner.getByRole('button', { name: 'Go online', exact: true })
    await expect(goOnline).toHaveAttribute('aria-pressed', 'false')
    await expectNoViolations(page)

    // Online: the app reports the store's position.
    await goOnline.click()
    await expect(banner.getByText('Online', { exact: true })).toBeVisible()
    await expect(banner.getByRole('button', { name: 'Go offline', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expectNoViolations(page)

    // The staff ready a new order at Indiranagar.
    const shopper = await freshShopper(request, 'E2E Dispatch Customer')
    const addressId = await addAddress(request, shopper, '560038', '100 Feet Rd, Indiranagar')
    await fillCart(request, shopper, await storePick(request, indiranagar), indiranagar)
    const order = await placeByApi(request, shopper, addressId)
    const staff = await staffHeaders(request, staffEmail)
    for (const status of ['accepted', 'packing', 'ready']) {
      const answer = await request.post(`/api/core/v1/admin/orders/${order.id}/status`, { headers: staff, data: { status } })
      expect(answer.status()).toBe(200)
    }

    // The offer opens within 10 seconds (one 3 s tick plus one 3 s poll), with axe.
    const sheet = page.getByRole('dialog', { name: `New order ${order.number}`, exact: true })
    await expect(sheet).toBeVisible({ timeout: 10_000 })
    await expect(sheet.getByText('Cash', { exact: true })).toBeVisible()
    await expect(sheet.getByText('560038')).toBeVisible()
    await expectNoViolations(page)

    // Accept lands on the delivery page; deliver it.
    await sheet.getByRole('button', { name: 'Accept', exact: true }).click()
    await expect(page).toHaveURL(/\/rider\/deliveries\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { level: 1, name: `Order ${order.number}`, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    const delivered = page.getByRole('dialog', { name: `Mark ${order.number} delivered?`, exact: true })
    await delivered.getByRole('button', { name: 'Mark delivered', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: `${order.number} delivered.` })).toBeVisible()

    // Go offline from the banner; the service agrees.
    await banner.getByRole('button', { name: 'Go offline', exact: true }).click()
    await expect(banner.getByText('Offline', { exact: true })).toBeVisible()
    const me = await request.get('/api/rider/v1/me', { headers: auth })
    expect(((await me.json()) as { isOnline: boolean }).isOnline).toBe(false)
  } finally {
    // Never leave a rider online for a later spec or suite, whatever failed above.
    await request.put('/api/rider/v1/me/availability', { headers: auth, data: { online: false } })
  }
})
```
If lint or typecheck complains about a detail above (an unused import, a type), fix the detail without changing what the test asserts, and say so in your log.

### Commit
One commit: `test: online rider offered a readied order (e2e)` with both files, the tick of 1.1 in tasks.md, and your log. No `feat:` in this task.

### Gates (paste the tail of each into your log)
- `npm run lint --workspace apps/rider`
- `npm run typecheck --workspace apps/rider`
- `npm run test --workspace apps/rider -- --run` (unchanged, green)
- `npm run build --workspace apps/rider`
- `openspec validate --all --strict`
- `git diff --stat HEAD~1` lists only the scope files.

Stop and report under Blockers (do not improvise) if a helper change would alter what an existing spec sends.

## Log
