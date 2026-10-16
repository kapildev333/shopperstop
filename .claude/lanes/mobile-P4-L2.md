# mobile-P4-L2 - mobile-serviceability-catalog: pincode, store notices, Home, Categories, Category, Product, Search, change store (team lead)
Status: started (proposal done; workers not launched)
## Doing
Proposal committed; waiting for the manager to launch group A (tasks 1 to 7).
## Found
- Change `openspec/changes/mobile-serviceability-catalog/`: proposal; `specs/mobile-app/spec.md` (2 MODIFIED: Mobile bottom tabs, Mobile end-to-end suite with axe; 20 ADDED); design.md (13 decisions, web-app mirror table, contract audit, scenario-to-test map); tasks.md (15 worker tasks + acceptance, parallel groups A to D). `docs/design/mobile-P4-L2.md` carries the artboard data and interfaces.
- `openspec validate --all --strict`: 20 passed. INFO: archive needs `openspec/specs/mobile-app` (on main since #255); rebase before archive.
- Home's level-1 heading changes from "Groceries in minutes" to "ShopperStop in N minutes" / "ShopperStop"; task 11 updates L1's tests that name it, task 15 the e2e line.
- For L4a: primitives in tasks 1 (Price), 2 (Stepper), 3 (Dialog + DialogFooter, L4a's shape), 4 (StatusMessage, ImageTile); `EXPO_PUBLIC_RIDER_URL` in the e2e script (task 6); focusManager + AppState (task 10). No Radio primitive: L4a's cancel reasons can use `Chip`.
- My MODIFIED "Mobile bottom tabs" drops "Categories and Orders SHALL show an empty state", so L4a need not modify it; L4a's e2e scenarios should go in a new requirement, not a MODIFIED "Mobile end-to-end suite with axe" (L2 modifies it).
- For L5a: L2 touches package.json only in task 6 (async-storage 2.2.0, rider URL in e2e); the test script and expo-splash-screen stay L5a's.
- 2026-10-16 manager FYI taken: dynamic routes 404 on direct load of the static export, so task 15 reaches them in-app only (design.md Decision 7, ceiling); L4a's "Main" tab-bar landmark lands first and L2 does not edit `(tabs)/_layout.tsx`.
## Requests
- to mobile manager: contract gaps (optional, non-blocking) in design.md "Contract audit": core `inStock`/`sort` on `GET /stores/{id}/products`; `city` on `Store`.
- to mobile manager: archive order: L2's change archives after a rebase onto main (L1's spec on main).
## Blockers
None.
