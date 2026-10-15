# web-phone-banner

## Why

Two findings from the manager's walk-throughs, in `.claude/areas/web.md` › Backlog:

1. At 390 px, signed in, the banner reads badly: the pincode control's "Delivery in 10 minutes" wraps to two lines with the pincode under it, and the account link wraps the customer's name ("Walk / Customer"). Nothing overflows.
2. The pincode sheet leaves focus on its Close button when it opens. On the first visit the customer has to tab once before typing a pincode.

## What Changes

- On a phone (viewport under 640 px, Tailwind `sm`) the account link shows only its icon. The customer's name stays its accessible name, hidden visually with `max-sm:sr-only`. The promise line "Delivery in N minutes" never wraps. Desktop is unchanged.
- When the pincode sheet opens, focus lands on its Pincode field. Closing the sheet still returns focus to the control that opened it (this is `Sheet`'s existing behaviour).

Area: web. Out of scope: `packages/ui` (`Sheet` keeps focusing its first focusable element; web moves focus after it, see design.md), the cart button (already hidden on a phone), the search form, admin, core.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-app`: two ADDED requirements, "Customer banner on a phone" and "Customer pincode sheet focus". "Customer header account control" and "Customer pincode sheet" are not modified: the link keeps the customer's name as its accessible name, and the sheet keeps its content.

## Impact

- `apps/web/src/account-link.tsx`, `apps/web/src/pincode-sheet.tsx` (class lists, one ref and one effect), `apps/web/src/pincode-sheet.test.tsx` (two tests), `apps/web/e2e/phone-layout.spec.ts` (two tests).
- Cross-area contracts relied on, unchanged: the `@shopperstop/ui` exports `Sheet`, `Input` (it forwards `ref`), `Button` and `ButtonLink`; `Sheet`'s focus order (it focuses its first focusable element in a passive effect and restores the previous focus on close); the `sr-only` utility from Tailwind 4 through `tokens.css`'s `@theme` build.
