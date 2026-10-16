# mobile-P4-L2-T15 - follow-up: category filters, store city, cancel dialog (mobile-serviceability-catalog task 15)
Status: started
## Doing
Red committed (15.1). Next: `feat:` filters (15.2).
## Found
- Contract grep passed on `packages/ui/src/api/core.d.ts`: `inStock?: boolean` and `sort?: "price_asc" | "price_desc"` on the products query (line ~5153), `city?` on Store (line ~1162).
- Read first: `.claude/lanes/mobile-P4-L4a.md`, `mobile-P4-L5a.md`, `mobile-P4-L1.md`, `mobile-P4-L2.md`, `mobile-P4-L2-T11.md`; design.md Decision 14; spec "Mobile category filters" and "Mobile header names the city".
- Red (15.1), `npx jest --ci` on the two new files, both fail on the element they name:
  - `src/catalog-category-filters.test.tsx` `filters sent to core`: `Unable to find an element with role: button, name: In stock`.
  - `src/catalog-home-city.test.tsx` `header names the city`: `Unable to find an element with role: button, name: Delivering to 560034, Bengaluru`.
  - The console shows act() warnings from `jest.setup.ts` clearing the pincode after each test while screens are mounted; the existing `catalog-category-tabs.test.tsx` shows the same warnings, so they are not new.
## Requests
None.
## Blockers
None.
