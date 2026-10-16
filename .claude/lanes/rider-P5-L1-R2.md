# rider-P5-L1-R2 - review of T2 (cc8f59a, bd7ddad)
Status: done, verdict approve
## Findings
None blocking. Notes:
- Order test then feat; tests assert the new text and Cash badge, so red without the feat.
- All rider-app scenarios have a test (ready.test.tsx cash orders marked; delivery.test.tsx cash on delivery, paid online, awaiting payment, delivered cod/online; e2e flow.spec.ts for cross-app).
- Conventions: Badge neutral, Price (tabular-nums), StatusMessage with warning tone only on Awaiting payment, no literal colours, icon aria-hidden inside StatusMessage. Core sends paymentStatus only on online orders, so at most one line shows.
- e2e: StatusMessage is role=status, textContent "Collect ₹339 in cash" (icon has no text), regex /^Collect ₹[\d,]+(\.\d{2})? in cash$/ matches whole and paise totals and en-IN grouping; one status on the page before delivered, so strict mode holds. Card Cash exact match is unique. Not run here (manager's make e2e).
- Nit: the flex wrapper div around Price and Badge is needed for the row; fine.
## Gates (scratch tree at bd7ddad)
lint, typecheck, test (64 passed), build for apps/rider: exit 0.
