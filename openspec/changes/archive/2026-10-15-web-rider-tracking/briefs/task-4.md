# Brief: web-rider-tracking task 4 (worker)

- LANE-ID: web-P3-L1-T4 (worker log `.claude/lanes/web-P3-L1-T4.md`); team lead web-P3-L1
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P3-L1`, branch `lane/web-P3-L1-rider-tracking`, after task 3 landed. Commit there; never push.
- Change: `openspec/changes/web-rider-tracking/`, task 4 "e2e against core and rider". Read `specs/web-app/spec.md` and `design.md` Decision 8 and "Simplifications and ceilings" first; read (only) `apps/web/e2e/shopper.ts` and `apps/web/e2e/orders.spec.ts` for the helpers and style.
- Scope paths (edit nothing else):
  - `apps/web/vite.config.ts`, `apps/web/playwright.config.ts`, `apps/web/e2e/global-setup.ts`
  - `apps/web/e2e/smoke.spec.ts`, `apps/web/e2e/orders.spec.ts`
  - `openspec/changes/web-rider-tracking/tasks.md` (checkboxes 4.1 and 4.2 only)
  - `.claude/lanes/web-P3-L1-T4.md`
  - Not `services/`, not the Makefile, not `shopper.ts`.
- Scenarios: web-app › "Customer order rider card" › Seeded delivered order against core and rider, Rider picked up and located against core and rider; "Customer site reaches core through a same-origin proxy" › Web preview proxies to rider; "Customer site end-to-end suite with axe".
- You do not run Playwright, `make e2e` or any server. The manager runs `make e2e` on each commit: red on commit 1, green on commit 2.

## Commit 1: `test: rider card against core and rider`

`e2e/smoke.spec.ts`, after "web preview proxies to core":

```ts
test('web preview proxies to rider', async ({ request }) => {
  const response = await request.get('/api/rider/v1/healthz')
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
```

`e2e/orders.spec.ts`, after "tracking against core". Extend the comment above `const delivered` with: "The rider seed holds its delivery by Arjun Rao (`...0901`), delivered, no position."

```ts
test('seeded delivered order against core and rider', async ({ page, request }) => {
  const shopper = await demoShopper(request)
  await signedIn(page, shopper)
  await page.goto(`/orders/${delivered}`)

  const rider = page.getByRole('region', { name: 'Rider', exact: true })
  await expect(rider.getByText('Arjun Rao', { exact: true })).toBeVisible()
  await expect(rider.getByText('Delivered', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open in Maps/ })).toHaveCount(0)
  await expectNoViolations(page)
})

// The live delivery as the rider service makes it: staff move the order to ready, the seeded rider Meera Iyer claims it and puts a position.
test('rider picked up and located against core and rider', async ({ page, request }) => {
  const shopper = await freshShopper(request, 'E2E Rider Watch')
  const pick = await orderPick(request, 9)
  const addressId = await addAddress(request, shopper)
  await fillCart(request, shopper, pick)
  const placed = await placeByApi(request, shopper, addressId)

  const staff = await staffHeaders(request)
  for (const status of ['accepted', 'packing', 'ready']) {
    const answer = await request.post(`/api/core/v1/admin/orders/${placed.id}/status`, { headers: staff, data: { status } })
    expect(answer.status()).toBe(200)
  }
  const signIn = await request.post('/api/rider/v1/auth/sign-in', {
    data: { email: 'rider2-koramangala@shopperstop.local', password: 'rider12345' },
  })
  expect(signIn.status()).toBe(200)
  const riderHeaders = { Authorization: `Bearer ${((await signIn.json()) as { token: string }).token}` }
  const claimed = await request.post('/api/rider/v1/me/deliveries', { headers: riderHeaders, data: { orderId: placed.id } })
  expect(claimed.status()).toBe(201)
  const located = await request.put('/api/rider/v1/me/location', { headers: riderHeaders, data: { lat: 12.9352, lng: 77.6245 } })
  expect(located.status()).toBe(204)

  await signedIn(page, shopper)
  await page.goto(`/orders/${placed.id}`)
  const rider = page.getByRole('region', { name: 'Rider', exact: true })
  await expect(rider.getByText('Meera Iyer', { exact: true })).toBeVisible()
  await expect(rider.getByText('Out for delivery', { exact: true })).toBeVisible()
  await expect(rider.getByText('Last seen just now', { exact: true })).toBeVisible()
  await expect(rider.getByRole('link', { name: 'Open in Maps (opens in a new tab)', exact: true })).toHaveAttribute(
    'href',
    'https://www.google.com/maps?q=12.9352,77.6245',
  )
  const history = page.getByRole('region', { name: 'Status history', exact: true })
  await expect(history.getByRole('listitem').last().getByText('Picked up by Meera Iyer', { exact: true })).toBeVisible()
  await expectNoViolations(page)
})
```

Add `freshShopper` etc. to the `./shopper` import only if not already there (they are). Lint and typecheck green. Commit body: "red until commit 2: no rider service is started and /api/rider is proxied to core".

## Commit 2: `feat: start and proxy the rider service for the web suite`

Exactly design.md Decision 8:
- `vite.config.ts`: `server.proxy` and `preview.proxy` each get `'/api/rider'` first (8081 and 18081), then `'/api'` as before. Add a one-line comment: `// '/api/rider' first: Vite takes the first key that matches.`
- `playwright.config.ts`: the rider `webServer` entry right after core's, as written.
- `e2e/global-setup.ts`: after the core guard, the same guard for `SHOPPERSTOP_RIDER_DATABASE_URL` (message `e2e: set SHOPPERSTOP_RIDER_DATABASE_URL to an _e2e database (make e2e sets it); refusing to reset another database`); both guards run before any `execFileSync`. After core's two commands, `go run ./cmd/rider-admin migrate` and `go run ./cmd/rider-admin seed-demo --reset` with `cwd` `fileURLToPath(new URL('../../../services/rider', import.meta.url))`, `stdio: 'inherit'`. Update the file's top comment to say both seeds are reset.

Do not add: a rider env var with a default, a check for `services/rider` existing, retries, a second Playwright project.

Tick 4.1 and 4.2 in `tasks.md` as each commit lands.

## Gates

As task 1 (`tasks.md` › Gates), plus `npx playwright test --list` from `apps/web` (lists tests only; it starts no server) showing the three new tests. No `make e2e`, no Playwright run, no docker. Commit as the repo's configured author, no trailers. Report the hashes and gates in your lane log; the manager records the `make e2e` red and green.
