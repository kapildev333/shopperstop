# web-phone-card-row

## Why

The manager's 390 px walk-through of the customer site (Chromium 390x844, demo seed) found two defects:

1. A product card's price row is wider than the card. The row holds `Price` and `Stepper` side by side; with a struck MRP the "ADD" button crosses the card's right edge, and after Add the Stepper's "+" crosses the card's padding.
2. The banner's "ShopperStop" link is 128x26 px, under the 44 px tap-target rule (Spec 1 §10, CLAUDE.md "UI conventions").

Read from the classes, the first defect is not only a phone defect: a card's content is narrower than the row at 640 to about 830 px (four columns) and at 1024 to about 1230 px (six columns) as well.

## What Changes

- A product card shows its `Price` on one line and its `Stepper` on the next, at every width. One layout, no breakpoint.
- The banner's "ShopperStop" link gets a 44 px tall hit area that overlaps no other banner control.
- Playwright tests at 390x844 and 1024x768 prove both with bounding boxes; jsdom has no layout.

No change to `packages/ui`, to core, to copy or to any behaviour.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: two ADDED requirements, "Customer product card layout" and "Customer banner tap targets". "Customer product card" is not modified.

## Impact

- `apps/web/src/product-card.tsx` (one class list), `apps/web/src/routes/__root.tsx` (one class list), new `apps/web/e2e/phone-layout.spec.ts`.
- Cards are about 52 px taller on a phone and 44 px taller on desktop.
- No file of web-P2-L6 (`store-gate.tsx`, `routes/index.tsx`, `routes/c.$slug.tsx`, `routes/p.$slug.tsx`, its four test files, `test-data.ts`) is touched.
