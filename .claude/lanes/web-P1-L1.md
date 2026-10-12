# web-P1-L1 - apps/web shell (OpenSpec change web-apps-web)
Status: done (worker web-P1-L1-T1 landed tasks 1.1 to 1.3; acceptance by team lead pending)
## Doing
Tasks 1.1 to 1.3 landed on lane/web-P1-L1-apps-web (9f2e51c, 809a106, feat below). Next: opsx:verify by team lead.
## Found
- New capability `web-app` (5 ADDED requirements, 6 scenarios); design-system seed scenarios "Literal colour fails the gate" and "Axe on every e2e page" get web tests here.
- Spike 2026-10-12 (scratchpad copy of 90c26f7 with apps/web added, Node 22.23.3, local Postgres up): lint, typecheck, Vitest 2 files / 3 tests, vite build, Playwright `CI=1` 4/4 against a real core on :18080 with the Makefile E2E_ENV (axe clean on Home and not-found with the `secondary` Button on the brand band; `/api` proxy 200). `routeTree.gen.ts` byte-identical to admin's.
- Branch base is 90c26f7; origin/main c3879e3 adds only a PLAN.md edit, so no rebase is needed for this lane's files. Lanes cannot merge; the manager rebases at landing if it wants.
- Web differs from admin: served at `/` (no base, no basepath), ports 5173/15173, no nav landmark (the TabNav request does not apply yet), `lucide-react` 1.55.0 declared for the header `MapPin`, not-found has an EmptyState with `createLink(ButtonLink)` "Go to Home".
- Worker T1 red (commit 809a106, before the shell): `npm run test --workspace apps/web -- --run` gave `Test Files 1 failed | 1 passed (2)`, `Tests 2 failed | 1 passed (3)`; `home renders in the shell` and `unknown customer path` failed (no heading; body empty and `Not Found` default text). `CI=1 npm run e2e --workspace apps/web` gave `3 failed`, `1 passed`: `home passes axe` and `not found passes axe` failed on `heading level 1 Groceries in minutes / Page not found` not found, `not found link returns home` timed out waiting for link `Go to Home`; `web preview proxies to core` passed.
- Worker T1 green (feat commit): Vitest `Test Files 2 passed (2)`, `Tests 3 passed (3)`; lint and typecheck exit 0; `npm run build --workspace apps/web` built (vite v8.3.4, 106 modules); `git status` clean apart from the commit (routeTree.gen.ts no drift); e2e `CI=1` `4 passed (2.5s)` against core on :18080 with the Makefile E2E_ENV after `core-admin migrate` said `nothing to apply`.
- Scaffold gate note: typecheck fails before the first `vite build` because `main.tsx` imports the not-yet-generated `routeTree.gen.ts`; the build generates it, then typecheck passes.
- The e2e env used is in the worker scratchpad (`e2e.env`), not committed.
## Requests
- to platform (via the web area plan): README can name web dev URL `http://localhost:5173/` once this lands.
## Blockers
