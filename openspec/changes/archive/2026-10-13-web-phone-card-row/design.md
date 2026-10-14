# Design

## Context

`ProductCard` (`apps/web/src/product-card.tsx`) is the only card in every product grid (Home's picks, category, search). Its last row is `flex items-center justify-between gap-2` holding `Price` and `Stepper` from `@shopperstop/ui`. Neither shrinks: `Price` is unbreakable text, "ADD" has `min-w-20`, the quantity group is three fixed parts.

Widths, from the classes and the 390 px screenshot:

| Viewport | Columns | Card content width |
|---|---|---|
| 320 | 2 | (320 - 32 - 12) / 2 - 26 = 112 |
| 390 | 2 | (390 - 32 - 12) / 2 - 26 = 147 |
| 640 | 4 | (640 - 48 - 36) / 4 - 26 = 113 |
| 1024 | 6 | (1024 - 48 - 60) / 6 - 26 = 126.7 |

(26 = 12 px padding and 1 px border on each side.)

| Part | Width |
|---|---|
| "₹399 ₹450" (`Price` with MRP) | 74 measured |
| "₹70" | 30 measured |
| "ADD" | 80 (`min-w-20`) |
| quantity group | 44 + 24 + 44 = 112 on a phone, 36 + 24 + 36 = 96 from `sm` |
| "Out of stock" | about 116 at its natural width; shrinks by wrapping its label |

The row needs 74 + 8 + 80 = 162 with an MRP and "ADD", 194 with an MRP and the group, 30 + 8 + 112 = 150 with "₹70" and the group: more than 147 at 390 px, and more than the content width at 640 and 1024 px too.

## Decisions

### 1. Price above the Stepper, at every width

The row becomes a column: `flex flex-col items-start gap-2` in place of `flex items-center justify-between gap-2`. Nothing else in the card changes; `Price` and `Stepper` are used as they are.

Why not the alternatives:

- **Wrap only when needed (`flex-wrap`)**: at 390 px "₹70" and "ADD" fit on one line but "₹70" and the quantity group do not, so the control would jump to the next line, away from the finger, on the tap that adds the product. Cards in one grid row would also differ.
- **Stack below `sm` only**: the row is also too wide at 640 to about 830 px and at 1024 to about 1230 px, so a breakpoint fixes the report and leaves the defect.
- **A container query**: correct, but a threshold to tune for a gain of one line of height on wide cards.
- **A narrower Stepper or `Price`**: `packages/ui`, another area; not needed.

`items-start`, not the default stretch: `Stepper` takes no `className`, and a stretched quantity group would be a full-width pill with its three parts bunched at the left.

Ceiling: the widest part must fit the content width. The quantity group is the hard one, 112 px on a phone: it fits at 320 px with nothing to spare (not specified, not tested) and not below. "Out of stock" at about 116 px wraps its label to two lines inside its 44 px height wherever the content is narrower (320 to about 328 px, 640 to about 652 px); its box still stays inside. Cure for both, if ever wanted: a request to `ui` for a narrower Stepper. Cost: cards are 52 px taller on a phone, 44 px on desktop.

### 2. Wordmark: a 44 px box that takes 28 px of the banner

The link gets `-my-2 inline-flex min-h-11 items-center` beside its `text-h2 text-on-brand`. The box is 44 px tall; the negative margin gives back 16 px, so the banner's first row is 28 px instead of 26 px on a phone (the banner grows by 2 px) and nothing changes from `sm`, where the row is already 40 px tall.

The 8 px the box reaches upward lie in the banner's 12 px padding; the 8 px downward are exactly the row gap (`gap-y-2`), so the box ends where the next row's buttons begin and overlaps none. The scenario asserts that.

Why not plain `min-h-11`: at 390 px the wordmark sits alone on its row (the pincode and account buttons wrap below it), so the banner would grow by 18 px.

Ceiling: if the banner's `gap-y-2` or `py-3` is ever made smaller than 8 px, the box overlaps its neighbour or leaves the banner; the e2e test fails then.

### 3. Tests

Layout cannot be shown in jsdom, so the proving tests are Playwright, in a new file `apps/web/e2e/phone-layout.spec.ts` (a new file keeps this lane off every file of web-P2-L6 and off the other suites). No Vitest test is added: asserting a class name would only repeat the code. The existing `src/product-card.test.tsx` and `src/shell.test.tsx` stay untouched and green.

"Inside the card's content area" is measured as: horizontally within the box of the card's product link (`a[href="/p/<slug>"]`, which spans the content width), vertically within the box of the card's list item; tolerance 0.5 px. The card's border box is the wrong reference: the "₹70" overflow is 3 px, inside the 13 px of padding and border.

| Scenario | Test in `e2e/phone-layout.spec.ts` | Before the fix |
|---|---|---|
| Card controls stay inside the card on a phone | `phone` › "card controls stay inside the card on a phone" | red: "ADD" ends about 15 px right of the content area (162 against 147); after Add the group ends about 47 px right of it (194 against 147) |
| Out-of-stock card on a phone | `phone` › "out-of-stock card on a phone" | pin; green or red by the product's price width (the button shrinks by wrapping its label) |
| Card controls stay inside the card in the six-column grid | "card controls stay inside the card in the six-column grid" | red: "ADD" ends about 35 px right of the content area (162 against 126.7, less with a scrollbar) |
| Wordmark tap target on a phone | `phone` › "wordmark tap target on a phone" | red: the link's box is 26 px tall |

The numbers are read from classes and one screenshot, not from a run; the manager's e2e run on the `test:` commit confirms them.

## Acceptance (2026-10-13, on `eb4da56`)

Accepted: 4 of 4 scenarios have a passing named test, both tasks are ticked, nothing outside the brief landed (two class lists, one new e2e file). Done by reading; the runs are the manager's.

What the manager's runs showed:

- Pre-fix source with the final spec file, `make e2e`: all four tests of `e2e/phone-layout.spec.ts` red. Phone card: a control 14.9 px past the content area (the arithmetic above said about 15). Six-column: red, as computed. Wordmark: 26 px, needs 44. The out-of-stock pin was red on arrival, 39.9 px past: the "Out of stock" button did not shrink in the old row, so the table's "shrinks by wrapping its label" was wrong for that row and the pin is a fourth proving test.
- Tip: `make test-web` ui 54, admin 95, web 91; `make e2e` admin 8, web 28, the four layout tests green; `openspec validate --all --strict` 14 passed.

Scenario to test, as landed (`apps/web/e2e/phone-layout.spec.ts`):

| Scenario | Test | Read against THEN |
|---|---|---|
| Card controls stay inside the card on a phone | `phone` › "card controls stay inside the card on a phone" | product picked from core (in stock, MRP above price), one `s` asserted; every button, the `s` and each "₹" text measured before Add; the same plus the quantity group after it; axe both times |
| Out-of-stock card on a phone | `phone` › "out-of-stock card on a phone" | button asserted disabled; it and the price measured; axe (more than the scenario asks) |
| Card controls stay inside the card in the six-column grid | `six columns` › "card controls stay inside the card in the six-column grid" | 1024x768, same pick and measure; axe (more than asked) |
| Wordmark tap target on a phone | `phone` › "wordmark tap target on a phone" | height at least 44; no visible `a`, `button` or `input` of the banner intersects it by more than 0.5 px; axe (more than asked) |

Landed as designed: `product-card.tsx` wrapper `flex flex-col items-start gap-2`; `__root.tsx` link `-my-2 inline-flex min-h-11 items-center text-h2 text-on-brand`. Review fix: the struck MRP is measured only where the card shows one, and the two struck-MRP tests assert it is there first.

Ceilings, as they stand:

- 320 px: the quantity group (112 px) has 0 px to spare in the card; not specified, not tested.
- "Out of stock" (about 116 px) where the content is narrower (320 to about 328 px, 640 to about 652 px): given the pre-fix run it may stick out by up to about 4 px instead of wrapping; not tested. Cure: a narrower Stepper, a request to `ui`.
- Cards are taller: about 52 px on a phone, 44 px on desktop.
- Outside this change, from the review: a cart drawer line (`src/cart-drawer.tsx`) is tight at 320 px when "Remove" shows; not touched, not tested here.
- The product page (`routes/p.$slug.tsx`) also pairs `Price` with `Stepper`; not checked here.
