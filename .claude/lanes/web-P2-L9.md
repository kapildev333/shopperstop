# web-P2-L9 - web-phone-banner: phone banner labels and pincode sheet focus (team lead)
Status: done
## Doing
Acceptance (`/opsx:verify web-phone-banner`) on the tip after 9c64241: PASS, 4 of 4 scenarios.
## Found
- Change: `openspec/changes/web-phone-banner/` (proposal; `web-app` delta: 2 ADDED requirements, 4 scenarios; design; tasks; briefs/task-1.md). No `docs/design/web-P2-L9.md`: design.md was enough.
- Scenario coverage:
  - Customer banner on a phone › Signed-in banner on a phone: `e2e/phone-layout.spec.ts` `phone` › "signed-in banner on a phone" (link name and href, height >= 44, width <= 56, name box <= 1 px, promise <= 24 px tall, pincode x within tolerance, every visible banner control inside 390.5, scrollWidth <= 390, axe). Red on b1bfea0 (link width 153.75 > 56), green on the tip (manager).
  - Customer banner on a phone › Signed-in banner on desktop: `six columns` › "signed-in banner on desktop" (name box >= 20 px at 1024). Pin, green (manager).
  - Customer pincode sheet focus › First visit focuses the pincode field: `src/pincode-sheet.test.tsx` "first visit focuses the pincode field". Red on b1bfea0, green on the tip (re-run here: file 7 of 7).
  - Customer pincode sheet focus › Banner control focuses the pincode field: same file, "banner control focuses the pincode field" (focus on the field, Escape closes, focus back on "Delivery in 10 minutes 560034"). Red on b1bfea0, green on the tip.
- Code matches design Decisions 1 to 3 exactly: `max-sm:sr-only` span in `account-link.tsx`; `whitespace-nowrap` on the promise; ref and effect in `PincodeSheet`. No `packages/ui` change. Nothing outside the task scope landed.
- Tasks: 1.1, 1.2 ticked by the worker; the verify item ticked here.
- Existing "Customer header account control" scenarios unaffected: the accessible name is still the customer's name; `account.spec.ts` green in the manager's `make e2e` (web 40 passed, admin 10 passed).
- Manager evidence: Playwright on b1bfea0 red only on "signed-in banner on a phone", other 5 green; `make e2e` on the tip admin 10, web 40; walk at 390x844 and 1280x800 against core (e2e db), vite preview, "Walk Customer": phone link 50x44, no horizontal scroll, banner one line; desktop shows the name; pincode field focused on banner open and first visit; Escape returns focus to the banner button; 0 console errors.
- Reviewer nit 1 (web-P2-L9-R1): agreed; one risk line added to design.md (the 640 to 1024 px band is unmeasured: name and cart button both return there). The nit's text was not relayed, so the line is my reading of the gap; the manager confirms or I adjust.
- `openspec validate web-phone-banner --strict` valid.
## Requests
- to web manager: open the PR; archive the change by PR after it merges.
## Blockers
