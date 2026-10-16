One worker task. Common rules:

- LANE-ID `mobile-P4-L5b-T1`, area `mobile`, worktree `/Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L5b`, branch `lane/mobile-P4-L5b-e2e-flow`, OpenSpec change `openspec/changes/mobile-e2e-flow/` (scenario in `specs/mobile-app/spec.md`, decisions in `design.md`). Paths below are under `apps/mobile/`.
- Starts only after mobile-P4-L3 (`mobile-cart`) and mobile-P4-L4b (`mobile-checkout`) are merged and the manager has merged origin/main into this branch.
- Commits by explicit path with `git -c user.name=kapildev333 -c user.email=47056817+kapildev333@users.noreply.github.com commit`, no trailers. Never push, pull, merge, amend, reset or rebase; never `git add -A` or `git add .`. Never run `make db`, `make dev`, `make prod-local` or docker. Log in `.claude/lanes/mobile-P4-L5b-T1.md`.

## 1. The §13 flow (`e2e/flow.spec.ts`)

Scope: `e2e/flow.spec.ts` (new) only. A needed change anywhere else (an app file, another spec, the Playwright config) stops the task: report it in your log with the failing line.

Scenario: Customer order to delivered against core.

Starts from: `e2e/flow.spec.ts` test `Customer order to delivered against core`, written whole from the scenario and design.md's step table (Decisions 1 to 4). Read first: `apps/web/e2e/flows.spec.ts` (the flow it mirrors), `e2e/orders.spec.ts` (helpers, staff route loop, tracking assertions), `e2e/catalog.spec.ts` (`sheet`, `savePincode`, `section`, search), `e2e/cart.spec.ts` (sheet name "My cart", bar "View cart…"), `e2e/checkout.spec.ts` (Proceed, "No addresses yet", the address sheet, "Place order"), `e2e/accounts.spec.ts` (register, sign out). Copy helpers (Decision 3), no import between spec files. `test.slow()`. Picks: `orderPick(request, 6)` is `a`, `orderPick(request, 7)` is `b`; `qa` as Decision 2. Steps, axe (`expectNoViolations`) after each screen or sheet appears:
1. `goto('/register')`, fill Name, Email (`freshEmail()`), Password `password123`, "Create account"; URL `/`.
2. The pincode sheet: `savePincode(page, '560034')`; sheet gone; "Delivering to 560034, Bengaluru".
3. "Dairy, Bread & Eggs" link; URL `/category/dairy-bread-eggs`; "Back".
4. Home "Search products" button; search `a.name` (fill the "Search products" textbox, Enter); "Add <a.name>"; group "Quantity of <a.name>" reads 1.
5. "Back" to Home; the "View cart…" button (name starts "View cart"); wait for dialog "My cart"; "Add one <a.name>" `qa - 1` times; the sheet's group reads `qa`; "Close".
6. "Account" button; heading "My account"; "Sign out"; URL `/`. Search `b.name`, "Add <b.name>", reads 1. "Back"; "Account"; URL `/sign-in?returnTo=%2Faccount`; Email, Password, "Sign in"; heading "My account"; "Back"; Home.
7. The bar's name contains `${qa + 1} items`; open it; dialog "My cart" lists `a` at `qa` and `b` at 1; "Proceed to checkout"; URL `/checkout`; "No addresses yet"; "Add address"; wait for dialog "Add address"; "House, flat, floor" `12 80 Feet Rd, Koramangala`, "Pincode" `560034`, "Save address"; "Delivering to Home"; both product names with "<qty> × <unit>" texts for `qa` and 1 (`unitLabel` from the product list).
8. "Place order"; URL `/orders/<uuid>` (take the id from it); level-1 heading `/^Order SS-\w{8}$/`; "Order placed. Waiting for the store to accept it.".
9. `staffHeaders(request)` (`koramangala@shopperstop.local` / `staff12345`); `POST ${core}/admin/orders/${id}/status` with `accepted`, `packing`, `ready`, `out_for_delivery`, `delivered`, each 200.
10. No reload: "Your order was delivered." within `{ timeout: 15_000 }`; axe.

Labels above are taken from main and the L3 and L4b changes; where the merged app names a control differently, use the merged name and note it in your log (no app change). A locator that matches twice because a covered screen stays mounted gets `.filter({ visible: true })` or a screen scope.

Commits: `test: customer order to delivered against core`. Design.md Decision 5: if the first run is green, prove it bites (change one expected text, see the failure on that line, revert, paste the line into your log); no `feat:` commit is expected. A red run caused by the spec file is fixed in a `fix:` commit to the spec; a red run caused by the app stops the task.

Gates, in order (paste the last lines into your log):
- `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L5b && npm run build --workspace packages/ui && npm run lint --workspace apps/mobile && npm run typecheck --workspace apps/mobile && openspec validate --all --strict`
- With the manager's e2e slot only (ask in your log and wait): `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L5b && make e2e`; paste every suite's summary line; the mobile suite all green, `flow.spec.ts` included.
- If `node_modules` is absent: `export PATH="$HOME/.local/node-v22.23.3/bin:$HOME/.local/bin:$PATH" && cd /Users/kapilsoni/KapilProjects/ShopperStop/.worktrees/mobile-P4-L5b && npm ci` first.

- [x] 1.1 `test:` `e2e/flow.spec.ts` with the scenario; lint and typecheck green; the bite check recorded
- [x] 1.2 `make e2e` exits 0 with the slot; mobile suite all green including the flow

## 2. Acceptance (team lead)

- [x] 2.1 `/opsx:verify mobile-e2e-flow`: the scenario maps to the passing test, task 1 ticked, nothing outside `e2e/flow.spec.ts` changed; `openspec validate --all --strict` green
