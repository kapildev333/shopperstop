# web-P1-L1 - apps/web shell (OpenSpec change web-apps-web)
Status: started
## Doing
Change proposed and validated; waiting for the owner's look, then one worker (web-P1-L1-T1) on tasks 1.1 to 1.3.
## Found
- New capability `web-app` (5 ADDED requirements, 6 scenarios); design-system seed scenarios "Literal colour fails the gate" and "Axe on every e2e page" get web tests here.
- Spike 2026-10-12 (scratchpad copy of 90c26f7 with apps/web added, Node 22.23.3, local Postgres up): lint, typecheck, Vitest 2 files / 3 tests, vite build, Playwright `CI=1` 4/4 against a real core on :18080 with the Makefile E2E_ENV (axe clean on Home and not-found with the `secondary` Button on the brand band; `/api` proxy 200). `routeTree.gen.ts` byte-identical to admin's.
- Branch base is 90c26f7; origin/main c3879e3 adds only a PLAN.md edit, so no rebase is needed for this lane's files. Lanes cannot merge; the manager rebases at landing if it wants.
- Web differs from admin: served at `/` (no base, no basepath), ports 5173/15173, no nav landmark (the TabNav request does not apply yet), `lucide-react` 1.55.0 declared for the header `MapPin`, not-found has an EmptyState with `createLink(ButtonLink)` "Go to Home".
## Requests
- to platform (via the web area plan): README can name web dev URL `http://localhost:5173/` once this lands.
## Blockers
