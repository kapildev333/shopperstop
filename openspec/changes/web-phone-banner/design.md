# Design: web-phone-banner

## Context

- `apps/web/src/routes/__root.tsx`: the banner is a wrapping flex row. At 390 px it stacks as wordmark; then `CartButton` (hidden below `sm`), `PincodeButton`, `AccountLink` in a `ml-auto` group; then the search form. The row has 358 px (390 minus two 16 px gutters).
- `apps/web/src/pincode-sheet.tsx` › `PincodeButton`: when an open store is resolved, the label is a `flex flex-col items-start` span holding "Delivery in N minutes" and the pincode in `text-small`. The first line wraps when the group runs out of room, which is what pushes the pincode out of line.
- `apps/web/src/account-link.tsx` › `AccountLink`: a secondary `ButtonLink` with the `UserRound` icon and `me.data?.name ?? 'Account'` as bare text, so a two-word name wraps.
- `packages/ui/src/sheet.tsx` and `use-modal.ts`: `Sheet` takes no initial-focus prop. `useModal` focuses the panel's first focusable element (the header's Close button) in a `useEffect` keyed on `open`, and its cleanup focuses the element that had focus before. `Input` forwards `ref` (`ComponentPropsWithRef<'input'>`).
- Checked in this worktree (scratch Vitest, not committed): `<input autoFocus>` inside an open `Sheet` ends with focus on Close, because React applies `autoFocus` at commit and `useModal`'s passive effect runs after it. A `useEffect` in the component that renders `Sheet` that focuses a ref'd input ends with focus on the input. React runs passive effects child first, so the parent's effect runs after `Sheet`'s, in the same commit. `jsx-a11y/no-autofocus` would flag `autoFocus` anyway.

## Decisions

### 1. Account link: icon only below `sm`, name kept as the accessible name

Wrap the label in `<span className="max-sm:sr-only">{me.data?.name ?? 'Account'}</span>`. Signed out ("Sign in") is unchanged.

Why this option: it is one class on one span, and it uses the same `max-sm:sr-only` pattern `Table`'s `stack` already uses. The link's accessible name stays the customer's name at every width, so the existing "Customer header account control" requirement, its scenario and `e2e/account.spec.ts` keep passing unchanged. No `aria-label` duplicates the visible text. Rejected options:
- First name: it needs a split rule (names with one word, very long first names), a second string, and an `aria-label` to keep the full name.
- `hidden sm:inline` with an `aria-label`: it repeats the name in two places, and a base-level `hidden` on `ButtonLink` loses to its `inline-flex` (see the comment on `CartButton`).

An `sr-only` span is out of flow, so `gap-2` leaves no gap after the icon. The link is `h-11` (44 px) on a phone, and `px-4` plus the 16 px icon plus the border is about 50 px wide.

### 2. Promise line: `whitespace-nowrap`

The "Delivery in {open.promisedMinutes} minutes" span gets `whitespace-nowrap`. With the account link at about 50 px, the group is about 225 px plus 8 px gap plus 50 px, well under 358 px. The pincode keeps `items-start`, so it starts at the promise's left edge. No other class changes; the "Enter pincode" and pincode-only labels are one word and do not wrap.

### 3. Pincode sheet focus: a ref and an effect in `PincodeSheet`

```tsx
export function PincodeSheet() {
  const { pincode, sheetOpen } = usePincode()
  const field = useRef<HTMLInputElement>(null)
  // After Sheet's own focus effect (child effects run first), so the field wins over Close.
  useEffect(() => {
    if (sheetOpen) field.current?.focus()
  }, [sheetOpen])
  return (
    <Sheet ...>
      <PincodeForm pincode={pincode} field={field} />
    </Sheet>
  )
}
```

`PincodeForm` takes `field: RefObject<HTMLInputElement | null>` and passes it to `<Input ref={field} .../>`. Nothing else changes. `useModal` captured the previous focus before this effect runs, so focus still returns to the banner control on close.

Simplification and ceiling: this depends on `Sheet` focusing in a passive effect of its own subtree. If `Sheet` ever focused later (a timeout or animation frame), Close would win again. The Vitest scenarios below would fail, so it cannot regress silently. The upgrade is an `initialFocus` ref prop on `Sheet` and `Dialog` in `packages/ui`. It is not requested now because nothing else needs it; admin's dialogs might, and if so that request goes to ui then.

## Tests

- Vitest, `apps/web/src/pincode-sheet.test.tsx`: "first visit focuses the pincode field" and "banner control focuses the pincode field" (the second presses `{Escape}` with `userEvent` and checks that focus is back on the button named "Delivery in 10 minutes 560034"). Both are red today: focus is on Close.
- Playwright, `apps/web/e2e/phone-layout.spec.ts`: jsdom cannot measure layout.
  - `phone` › "signed-in banner on a phone": `freshShopper(request, 'Walk Customer')` and `signedIn(page, shopper)` from `./shopper`. Today it is red on the link width (the name is shown) and on the promise height (two lines).
  - `six columns` › "signed-in banner on desktop" (a pin; green on arrival).
  - Measures: the link `banner.getByRole('link', { name: 'Walk Customer', exact: true })`; the name box `link.getByText('Walk Customer', { exact: true })`; the promise `banner.getByText('Delivery in 10 minutes', { exact: true })`; the pincode `banner.getByText('560034', { exact: true })`; every visible `a, button, input` in the banner has `x + width <= 390.5`; `await page.evaluate(() => document.documentElement.scrollWidth)` is at most 390. The spec's `boxOf`, `tolerance` and `expectNoViolations` are reused.
  - The file's `beforeEach` already stores `560034`. Koramangala is open in the e2e seed: `browse.spec.ts` already reads "Delivery in 10 minutes 560034".

## Files

All in `apps/web/`: `src/account-link.tsx`, `src/pincode-sheet.tsx`, `src/pincode-sheet.test.tsx`, `e2e/phone-layout.spec.ts`.

## Risks

- A promised time of three digits or a long pincode label could still crowd the row at 320 px. The row has room for about 100 more px at 390 px; 320 px is not a target width in Spec 1 §8.
- From 640 px up the name and the `sm:` cart button both return, and no test measures the row between 640 and 1024 px (the desktop pin runs at 1024). A long customer name there could wrap the banner; the fix would be a `max-w` with truncation on the name span.
- The `sr-only` name is still read by screen readers as the link name, which is intended.
