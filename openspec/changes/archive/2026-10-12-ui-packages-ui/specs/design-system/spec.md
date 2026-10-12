## ADDED Requirements

### Requirement: Token stylesheet is the Tailwind preset
`packages/ui/src/tokens.css` SHALL define each semantic colour as a `:root` custom property with the Spec 1 §8.1 value (`line-strong` #868C94 per PLAN.md D12), map it into Tailwind 4 so `bg-<token>`, `text-<token>` and `border-<token>` exist, define the type scale, radii `control` 8 px and `card` 12 px, and the shadows `card` and `sheet`, and SHALL switch off Tailwind's default colours (white and black included) and default shadows.

#### Scenario: Token values match the palette
- **WHEN** `tokens.css` is read
- **THEN** each of the 20 semantic tokens has a `:root` property whose value equals the Spec 1 §8.1 hex value, except `line-strong`, which is `#868C94`

#### Scenario: Semantic utilities compile
- **WHEN** Tailwind compiles `tokens.css` for the candidates `bg-brand`, `text-ink`, `border-line-strong`, `shadow-card`, `shadow-sheet`, `rounded-control`, `rounded-card` and `text-display`
- **THEN** each candidate produces a rule, and `text-display` sets 28 px size, 34 px line height and weight 700

#### Scenario: Default palette and shadows are off
- **WHEN** Tailwind compiles `tokens.css` for the candidates `bg-gray-100`, `text-red-500`, `bg-white`, `text-black` and `shadow-md`
- **THEN** none of them produces a rule

### Requirement: Inter is bundled
The package SHALL load Inter from the `@fontsource-variable/inter` dependency when its entry point is imported and SHALL set the Tailwind sans font to "Inter Variable"; no file in the package SHALL reference a font CDN.

#### Scenario: Font comes from the package
- **WHEN** the package entry `src/index.ts` and `src/tokens.css` are read
- **THEN** the entry imports `@fontsource-variable/inter`, the sans font is "Inter Variable", and neither file contains `http`

### Requirement: Motion and focus defaults
`tokens.css` SHALL make transitions default to 150 ms ease-out, SHALL turn transitions and animations off under `prefers-reduced-motion: reduce`, and SHALL give every `:focus-visible` element a 2 px outline in the `focus` token.

#### Scenario: Reduced motion turns transitions off
- **WHEN** Tailwind compiles `tokens.css` for the candidate `transition-colors`
- **THEN** the rule uses a 150 ms ease-out default, and the output contains a `prefers-reduced-motion: reduce` block setting transition and animation durations to 0

#### Scenario: Focus ring uses the focus token
- **WHEN** Tailwind compiles `tokens.css`
- **THEN** the output contains a `:focus-visible` rule with a 2 px outline coloured by the `focus` token

### Requirement: Component colour pairs meet contrast
Every text and background token pair the components use SHALL measure at least 4.5:1 by the WCAG relative-luminance formula; text on a `*-soft` background SHALL use `ink`, or `accent-hover` on `accent-soft`.

#### Scenario: Used pairs pass
- **WHEN** the contrast of ink on surface, ink on canvas, ink-muted on surface, accent on surface, accent on canvas, on-accent on accent, on-accent on accent-hover, on-brand on brand, danger on surface, accent-hover on accent-soft and ink on each `*-soft` token is computed from `tokens.css`
- **THEN** every ratio is at least 4.5

### Requirement: Literal colour matcher for every app
`@shopperstop/ui/testing` SHALL export `matchLiteralColors(text)`, returning every hex colour, Tailwind palette utility, `white`/`black` colour utility and CSS colour function in the text, and `findLiteralColors(dir, ignore)`, returning `{ file, match }` for every `.ts`, `.tsx` and `.css` file under `dir` except `tokens.css` and the ignored relative paths.

#### Scenario: Each literal kind is matched
- **WHEN** `matchLiteralColors` receives text containing `#fff`, `#0C831F`, `bg-gray-100`, `hover:text-red-500`, `bg-white`, `text-white`, `border-black`, `rgb(0 0 0)`, `rgba(`, `hsl(`, `oklch(` and `color-mix(`
- **THEN** it returns each of them

#### Scenario: Token utilities are not matched
- **WHEN** `matchLiteralColors` receives `bg-brand text-on-accent border-line-strong bg-ink/40 text-accent-hover href="#main"`
- **THEN** it returns an empty list

#### Scenario: Directory scan names the file
- **WHEN** `findLiteralColors` scans a directory holding `a.tsx` with `bg-white`, `tokens.css` with a hex value and an ignored `b.ts` with a hex value
- **THEN** it returns exactly `[{ file: "a.tsx", match: "bg-white" }]`

### Requirement: Class names join without a library
`cn(...parts)` SHALL join the truthy string parts with single spaces and drop `false`, `null`, `undefined` and empty strings.

#### Scenario: Falsy parts are dropped
- **WHEN** `cn("a", false, undefined, null, "", "b")` is called
- **THEN** it returns `"a b"`

### Requirement: Button variants and loading
`Button` SHALL render a native button of type `button` unless told otherwise, with variants `primary`, `secondary`, `ghost`, `ghost-danger` and sizes `md` (44 px on phone, 40 px from `sm`) and `lg` (48 px); `loading` SHALL disable it, set `aria-busy`, show an `aria-hidden` spinner and keep the label.

#### Scenario: Default type is button
- **WHEN** a Button without `type` is clicked inside a form
- **THEN** the form is not submitted

#### Scenario: Loading blocks clicks
- **WHEN** a Button renders with `loading`
- **THEN** it is disabled, has `aria-busy="true"`, still shows its label, and clicking it does not call `onClick`

#### Scenario: Primary uses the accent
- **WHEN** a Button renders with no variant
- **THEN** it has the classes `bg-accent` and `text-on-accent`

### Requirement: ButtonLink looks like a Button
`ButtonLink` SHALL render an anchor with the same variant and size classes as `Button` and pass every anchor attribute through, so apps can wrap it as a router link.

#### Scenario: Link keeps href and button style
- **WHEN** a ButtonLink renders with `href="/cart"` and variant `secondary`
- **THEN** it is a link to `/cart` with the classes of a secondary Button

### Requirement: IconButton has an accessible name
`IconButton` SHALL require an `aria-label` at the type level, render it as the button's accessible name, and render its icon `aria-hidden` at 20 px, with a 44 px target on phone.

#### Scenario: Name comes from aria-label
- **WHEN** an IconButton renders with `aria-label="Close"`
- **THEN** a button named "Close" exists and its svg is `aria-hidden`

#### Scenario: Missing label does not compile
- **WHEN** an IconButton is written without `aria-label`
- **THEN** `tsc` reports an error (pinned with `@ts-expect-error` in the test)

### Requirement: Form fields are labelled and described
`FormField` SHALL associate its label with its single control, describe the control by its hint and error, and mark it `aria-invalid` when an error is shown; `Input` and `Select` SHALL be native controls styled by the exported `inputClass`.

#### Scenario: Label finds the control
- **WHEN** a FormField labelled "Pincode" wraps an Input
- **THEN** the Input is found by the label "Pincode" and has the `inputClass` classes

#### Scenario: Error describes the control
- **WHEN** a FormField renders with hint "6 digits" and error "Enter a valid pincode"
- **THEN** the control is `aria-invalid="true"` and its accessible description contains both texts

#### Scenario: Select changes value
- **WHEN** the user selects an option in a Select inside a FormField
- **THEN** `onChange` is called and the Select shows that option

### Requirement: Stepper adds and removes
`Stepper` SHALL show an "ADD" button when `value` is 0 and `max` is above 0, which calls `onChange(1)`; above 0 it SHALL show decrement, the value and increment, calling `onChange(value - 1)` and `onChange(value + 1)`, every control named after the product `label`.

#### Scenario: ADD adds one
- **WHEN** a Stepper with `value` 0, `max` 5 and label "Milk" is clicked on "ADD"
- **THEN** `onChange` is called with 1 and the button's accessible name contains "Add" and "Milk"

#### Scenario: Decrement reaches zero
- **WHEN** a Stepper with `value` 1 and `max` 5 is clicked on decrement
- **THEN** `onChange` is called with 0

### Requirement: Price shows MRP when discounted
`Price` SHALL render `formatInr(cents)` in the `accent` colour and, when `mrpCents` is greater than `cents`, the MRP after it struck through in `ink-muted`, with "MRP" available to assistive technology; `formatInr(0)` SHALL be `₹0`.

#### Scenario: Discounted price shows MRP
- **WHEN** a Price renders with `cents` 9900 and `mrpCents` 12000
- **THEN** it shows `₹99` and a struck-through `₹120` whose accessible text includes "MRP"

#### Scenario: No discount, no MRP
- **WHEN** a Price renders with `mrpCents` equal to `cents` or absent
- **THEN** no struck-through element is rendered

#### Scenario: Zero rupees
- **WHEN** `formatInr` receives 0
- **THEN** it returns `₹0`

### Requirement: Badge and Chip
`Badge` SHALL render variants `neutral`, `success`, `warning`, `danger` and `accent` as `ink` text on the matching soft surface (`canvas` for neutral); `Chip` SHALL be a pill button exposing its `selected` state as `aria-pressed`.

#### Scenario: Badge variant surface
- **WHEN** a Badge renders with variant `danger`
- **THEN** it has the classes `bg-danger-soft` and `text-ink`

#### Scenario: Chip toggles
- **WHEN** a Chip with `selected` false is clicked
- **THEN** `onClick` is called, and a Chip with `selected` true has `aria-pressed="true"`

### Requirement: Card surface
`Card` SHALL render a `surface` container with a `line` border, the `card` radius and `shadow-card`, merging a caller `className`.

#### Scenario: Card classes
- **WHEN** a Card renders with `className="p-4"`
- **THEN** it has `bg-surface`, `border-line`, `rounded-card`, `shadow-card` and `p-4`

### Requirement: Modal focus management
`Dialog` and `Sheet` SHALL render a modal dialog named by its title, move focus inside on open, keep Tab and Shift+Tab inside, call `onClose` on Escape, and return focus to the previously focused element after closing.

#### Scenario: Focus is trapped
- **WHEN** a Dialog with two buttons is open and the user tabs past the last button
- **THEN** focus moves to the first button, and Shift+Tab from the first moves to the last

#### Scenario: Focus returns on close
- **WHEN** a Dialog opened from a button is closed
- **THEN** that button has focus again

#### Scenario: Sheet closes on Escape and on its close button
- **WHEN** a Sheet titled "Cart" is open and the user presses Escape or clicks "Close"
- **THEN** `onClose` is called, and the dialog is named "Cart"

### Requirement: DialogFooter puts Cancel first
`DialogFooter` SHALL render a secondary "Cancel" button calling `onCancel` before the actions passed as children.

#### Scenario: Cancel comes first
- **WHEN** a DialogFooter renders with a "Delete" action
- **THEN** the buttons in document order are "Cancel" then "Delete", and clicking "Cancel" calls `onCancel`

### Requirement: Sheet placement
`Sheet` SHALL be a bottom sheet below the `sm` breakpoint and a right-side drawer from `sm` up, cast `shadow-sheet`, and slide in over 200 ms.

#### Scenario: Placement classes
- **WHEN** a Sheet is open
- **THEN** its panel has `bottom-0`, `sm:right-0`, `shadow-sheet` and `duration-200`

### Requirement: Table stack mode
`Table` SHALL render rows from `columns` and `rows` as a native table with header cells; with `stack` it SHALL also render each column header inside its cell for phone layouts, hidden from `sm` up.

#### Scenario: Rows and headers render
- **WHEN** a Table renders two rows and the columns "Product" and "Quantity"
- **THEN** there are two column headers and two body rows with the cell content

#### Scenario: Stack labels cells
- **WHEN** the same Table renders with `stack`
- **THEN** each body cell contains its column header text, and without `stack` it does not

### Requirement: Feedback states
`EmptyState` SHALL show a heading, an optional description and action; `ErrorBanner` SHALL be an `alert` with its message and, when `onRetry` is given, a "Try again" button; `StatusMessage` SHALL be a `status` live region; `Skeleton` SHALL render `count` placeholders in `grid`, `list` or `table` layout inside a `status` named "Loading".

#### Scenario: Error banner retries
- **WHEN** an ErrorBanner with `onRetry` is shown and "Try again" is clicked
- **THEN** the message is in an `alert` and `onRetry` is called

#### Scenario: Empty state content
- **WHEN** an EmptyState renders with title "Your cart is empty" and an action
- **THEN** a heading with that title and the action are shown

#### Scenario: Status message is polite
- **WHEN** a StatusMessage renders "Saved"
- **THEN** a `status` region contains "Saved"

#### Scenario: Skeleton count
- **WHEN** a Skeleton renders with variant `list` and `count` 3
- **THEN** a `status` named "Loading" holds 3 placeholders

### Requirement: Page header and tab navigation
`PageHeader` SHALL render the page title as the only level-1 heading with optional description and actions; `TabNav` SHALL render a navigation landmark named by `label` around its links and style the link with `aria-current="page"` as current.

#### Scenario: Page header
- **WHEN** a PageHeader renders with title "Orders" and an action
- **THEN** there is one level-1 heading "Orders" and the action

#### Scenario: Tab navigation landmark
- **WHEN** a TabNav labelled "Order views" wraps two links, one with `aria-current="page"`
- **THEN** a navigation landmark named "Order views" holds both links and the current one keeps `aria-current="page"`

### Requirement: Figma token check
`packages/ui/scripts/check-figma-tokens.mjs <export.json>` SHALL compare the colour variables of a Figma JSON export with the `:root` colours in `tokens.css`, print one line per mismatch, token missing in Figma and token missing in CSS, and exit 1 on any difference, 0 when they match and 2 on a usage error.

#### Scenario: Matching export
- **WHEN** the script runs on a fixture export holding the 20 tokens with the same values
- **THEN** it exits 0

#### Scenario: Drifted export
- **WHEN** the script runs on a fixture where `brand` differs, `focus` is missing and `teal` is extra
- **THEN** it exits 1 and prints `mismatch brand`, `missing in figma: focus` and `missing in css: teal` lines

#### Scenario: Usage error
- **WHEN** the script runs without an argument
- **THEN** it prints usage and exits 2
