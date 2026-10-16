# web-P2-L5-T1 - web-e2e-flows task 1: the cross-app flows (worker)
Status: done
## Doing
Task 1 landed on `lane/web-P2-L5-e2e-flows`: `test: cross-app flows` (`0d4a7cf`, the spec file and the 1.1 tick; lint and typecheck green, `grep -c 15174 apps/web/playwright.config.ts` = 0), then `feat: serve the admin preview in the web suite` (the admin webServer entry, the 1.2 tick and this log; the last commit on the branch). Gates green. Nothing pushed. Nothing running: no Playwright, no `make e2e`, no server started by this lane.
## Found
- Gates on the feat commit: `npm run build --workspace packages/ui` (needed before the web Vitest run, as tasks.md says), `npm run lint --workspace apps/web` clean, `npm run typecheck --workspace apps/web` clean, `npm run test --workspace apps/web -- --run` 26 files, 153 tests passed, `openspec validate web-e2e-flows --strict` valid, `grep -c 15174 apps/web/playwright.config.ts` = 1, `git status` clean.
- Locators read against the source, not guessed: web (`account-link.tsx`, `cart-drawer.tsx`, `product-card.tsx`, `pincode-sheet.tsx`, `checkout.tsx`, `address-dialog.tsx`, `order-tracking.tsx`, `routes/__root.tsx`, `routes/account.tsx`, `packages/ui` Stepper, Chip, Sheet); admin (`e2e/catalog.spec.ts`, `e2e/orders.spec.ts`, `routes/_staff/stock.tsx`, `order-board.tsx`). No design.md locator was missing from the page source; no open design choice.
- Two small deliberate choices within the design text: every string `getByRole` in the flows carries `exact: true` (the brief's rule), and the Flow 1 status-history and sign-in steps follow design.md's wording. `staffSignIn` is byte for byte as design.md Decision 2 writes it.
- Playwright red is the manager's: on the `test:` commit both new tests fail at `http://localhost:15174/admin/sign-in`. Green on the feat commit: admin 14, web 42 expected.
- Config: `cwd: '../admin'` with `npx vite preview` so admin's own vite binary runs (vite is not hoisted); serve only, no build step (`make e2e` builds first).
## Requests
None to other areas. For the manager: the web suite's Flow 1 signs `koramangala@` in once and `admin@` in twice per run on top of the existing API sign-ins; design.md "Sign-ins per web run" carries the count.
## Blockers
None.
