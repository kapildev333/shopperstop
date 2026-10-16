# Brief: web-rider-tracking task 3 (worker)

- LANE-ID: web-P3-L1-T3 (worker log `.claude/lanes/web-P3-L1-T3.md`); team lead web-P3-L1
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P3-L1`, branch `lane/web-P3-L1-rider-tracking`, after task 2 landed. Commit there; never push.
- Change: `openspec/changes/web-rider-tracking/`, task 3 "ui swaps". Read `specs/web-app/spec.md` ("Customer checkout address choice") and `design.md` Context (ui swaps) and Decision 7 first; read `packages/ui/src/choice-group.tsx` and `packages/ui/src/image-tile.tsx` (read only).
- Scope paths (edit nothing else):
  - `apps/web/src/checkout.tsx`, `apps/web/src/checkout.test.tsx`
  - `apps/web/src/product-card.tsx`, `apps/web/src/order-parts.tsx`, `apps/web/src/cart-drawer.tsx`, `apps/web/src/routes/index.tsx`, `apps/web/src/routes/p.$slug.tsx`
  - `apps/web/e2e/checkout.spec.ts`, `apps/web/e2e/flows.spec.ts`, `apps/web/e2e/orders.spec.ts` (only the line with `'Deliver to Home'` in the phone test)
  - `openspec/changes/web-rider-tracking/tasks.md` (checkboxes 3.1 to 3.3 only)
  - `.claude/lanes/web-P3-L1-T3.md`
  - Not `packages/ui`. If `ImageTile` or `ChoiceGroup` seems to need a change, stop and report.
- Scenarios: web-app › "Customer checkout address choice" › Default address chosen, Another address chosen, Address added at checkout.

## Commit 1: `test: checkout address choice is a radio group`

In `src/checkout.test.tsx`, every address control becomes a radio: `getByRole('button', { name: 'Deliver to X' })` becomes `getByRole('radio', { name: 'Deliver to X' })`, and `aria-pressed` becomes `aria-checked`. Concretely:

1. "default address chosen": after `const addresses = …` add `const group = within(addresses).getByRole('radiogroup', { name: 'Deliver to' })` and `expect(within(group).getAllByRole('radio').map((radio) => radio.textContent)).toEqual(['Deliver to Work', 'Deliver to Home'])`; the two assertions become `toHaveAttribute('aria-checked', 'true')` on "Deliver to Home" and `'false'` on "Deliver to Work", by role `radio`.
2. "another address chosen": the click and both assertions by role `radio`, `aria-checked`.
3. "address not served": the click on "Deliver to Work" by role `radio`.
4. "choosing another address clears the refusal alert": both clicks by role `radio`.
5. "the address chip is named by its visible text": rename to "the address choice is named by its visible text"; `const choice = within(addresses).getByRole('radio', { name: 'Deliver to Home' })`, `expect(choice.textContent)…`, and the Work line by role `radio`.

e2e (no run; the manager runs `make e2e`):
- `e2e/checkout.spec.ts` lines with `'Deliver to Home'` and `'Deliver to Work'`: `getByRole('button', …)` → `getByRole('radio', …)`, `toHaveAttribute('aria-pressed', 'true')` → `toHaveAttribute('aria-checked', 'true')`.
- `e2e/flows.spec.ts` the `'Deliver to Home'` line: the same two changes.
- `e2e/orders.spec.ts` the phone test's `addresses.getByRole('button', { name: 'Deliver to Home', exact: true })` → `getByRole('radio', …)`.

Red on this commit: exactly the five Vitest tests above. Lint and typecheck green. Write the red list in the commit body.

## Commit 2: `feat: checkout address choice from ui's ChoiceGroup`

`src/checkout.tsx`, design.md Decision 7 (checkout part): `Chip` out of the `@shopperstop/ui` import, `ChoiceGroup` and `Choice` in; the address `<ul>` wrapped in `<ChoiceGroup label="Deliver to" value={selected?.id} onChange={onChoose}>`; each `<Chip …>Deliver to {address.label}</Chip>` becomes `<Choice value={address.id}>Deliver to {address.label}</Choice>`. Nothing else in the file changes.

## Commit 3: `refactor: ImageTile from @shopperstop/ui`

design.md Decision 7 (`ImageTile` part). No test changes; the full suite is green before and after (say so in the commit body: "no behaviour change, so no failing test; suite green before and after").
- `src/product-card.tsx`: delete the app `ImageTile` function, its comment and the `ShoppingBasket` import; import `ImageTile` from `@shopperstop/ui`; the card renders `<ImageTile src={product.imageUrl} alt="" className="w-full" />`.
- `src/order-parts.tsx`, `src/cart-drawer.tsx`, `src/routes/index.tsx`, `src/routes/p.$slug.tsx`: import `ImageTile` from `@shopperstop/ui` instead of `./product-card` / `../product-card` (keep `ProductGrid` imported from `../product-card` in `routes/index.tsx`); each call becomes `<ImageTile src={…as before…} alt="" className="w-full" />`.
- `grep -rn "ImageTile" apps/web/src` afterwards shows only `@shopperstop/ui` imports and calls with `alt=""`.

Do not add: an `alt` text other than `""`, any other class, a wrapper, a re-export.

Tick 3.1 to 3.3 in `tasks.md` as each commit lands.

## Gates

As task 1 (`tasks.md` › Gates), after each commit. No Playwright and no docker. Commit as the repo's configured author, no trailers. Report the hashes, the red list, the gates and any deviation in your lane log; stop and report on any open design choice.
