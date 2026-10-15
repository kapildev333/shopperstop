# Brief: web-phone-banner task 1 (worker)

- LANE-ID: web-P2-L9-T1 (worker log `.claude/lanes/web-P2-L9-T1.md`, format in `.claude/lanes/README.md`); team lead web-P2-L9
- Area: web
- Worktree: `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/web-P2-L9`, branch `lane/web-P2-L9-phone-banner`. Commit there; never push.
- Change: `openspec/changes/web-phone-banner/`, task 1 "Phone banner and pincode sheet focus". Read `proposal.md`, `specs/web-app/spec.md`, `design.md`, `tasks.md` first.
- Scope paths (edit nothing else):
  - `apps/web/src/account-link.tsx`
  - `apps/web/src/pincode-sheet.tsx`
  - `apps/web/src/pincode-sheet.test.tsx`
  - `apps/web/e2e/phone-layout.spec.ts`
  - `openspec/changes/web-phone-banner/tasks.md` (checkboxes only)
  - `.claude/lanes/web-P2-L9-T1.md`
  - Not `packages/ui`: if `Sheet` or `Input` seems to need a change, stop and report.
- Scenarios: web-app › "Customer banner on a phone" (Signed-in banner on a phone; Signed-in banner on desktop) and "Customer pincode sheet focus" (First visit focuses the pincode field; Banner control focuses the pincode field).

## Commit 1: `test: phone banner and pincode sheet focus`

Vitest, appended to `apps/web/src/pincode-sheet.test.tsx`, using its existing imports (`renderAt`, `store`, `setPincode`, `queryClient`, `keys`, `userEvent`):

1. "first visit focuses the pincode field": `renderAt('/')`; find the dialog "Your delivery pincode"; `await waitFor(() => expect(within(dialog).getByLabelText('Pincode')).toHaveFocus())`.
2. "banner control focuses the pincode field": set up as in "banner control opens the sheet" (pincode `560034`, `store()` in the serviceability cache); click the button "Delivery in 10 minutes 560034"; wait for the Pincode field to have focus; `await user.keyboard('{Escape}')`; wait for no dialog; expect the "Delivery in 10 minutes 560034" button to have focus.

Both must be red (focus is on the sheet's Close button) and every other test green. Write it in the `test:` commit body.

Playwright, appended to `apps/web/e2e/phone-layout.spec.ts`. You do not run it; the manager does.
- Import `freshShopper` and `signedIn` from `./shopper`.
- In `test.describe('phone', ...)`: "signed-in banner on a phone". Run `const shopper = await freshShopper(request, 'Walk Customer')`, then `await signedIn(page, shopper)`, then `await page.goto('/')`. Assert, using the file's `boxOf`, `tolerance` and `expectNoViolations`:
  - link = `banner.getByRole('link', { name: 'Walk Customer', exact: true })`: visible, `href` `/account`, height at least 44, width at most 56
  - `link.getByText('Walk Customer', { exact: true })`: box width at most 1
  - promise = `banner.getByText('Delivery in 10 minutes', { exact: true })`: box height at most 24
  - `banner.getByText('560034', { exact: true })`: `x` within `tolerance` of the promise's `x`
  - every visible `banner.locator('a, button, input')`: `x + width <= 390 + tolerance`
  - `await page.evaluate(() => document.documentElement.scrollWidth)` at most 390
  - axe clean
- In `test.describe('six columns', ...)`: "signed-in banner on desktop", with the same setup. The name text box is at least 20 px wide.
- Wait for the link to be visible before measuring: "Account" shows while `/me` loads, so the name locator waits on its own.

Lint and typecheck must be green on this commit.

## Commit 2: `fix: phone banner and pincode sheet focus`

Exactly design.md:
- Decision 1: `account-link.tsx`, the signed-in label in `<span className="max-sm:sr-only">`.
- Decision 2: `pincode-sheet.tsx` › `PincodeButton`, `whitespace-nowrap` on the "Delivery in … minutes" span.
- Decision 3: `PincodeSheet` holds `useRef<HTMLInputElement>(null)` and a `useEffect` on `[sheetOpen]` that focuses it, with the one-line comment. `PincodeForm` takes it as `field` and passes it to `<Input ref={field} …>`.

Do not add:
- `autoFocus` (it loses to `Sheet`, and `jsx-a11y` forbids it)
- `setTimeout` or `requestAnimationFrame`
- an `aria-label`
- a new component or a new export

Tick 1.1 and 1.2 in `tasks.md` as each commit lands.

## Gates

From the worktree root, prefix `PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH"`:
- `npm run build --workspace packages/ui`
- `npm run lint --workspace apps/web`
- `npm run typecheck --workspace apps/web`
- `npm run test --workspace apps/web -- --run`
- `npm run build --workspace apps/web`
- `git status` clean after the build
- `openspec validate web-phone-banner --strict`

No Playwright and no docker by the worker. Commit as the repo's configured author, no trailers. Report the commit hashes, the red list, the gate results and any deviation in your lane log.
