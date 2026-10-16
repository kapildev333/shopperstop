# design-system

## Purpose
The visual system both web apps share: semantic colour tokens, type scale, shape, icons, motion and accessibility, delivered by `packages/ui` and mirrored in the Figma file.

## Requirements

### Requirement: Semantic colour tokens only
Feature code in `apps/web`, `apps/admin` and `packages/ui` SHALL use colours only through the semantic tokens `brand`, `brand-strong`, `on-brand`, `accent`, `accent-hover`, `accent-soft`, `on-accent`, `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `focus`, `danger`, `danger-soft`, `warning`, `warning-soft`, `success`, `success-soft`, defined once in `packages/ui/src/tokens.css`. The generated `tokens.ts` is the one other file under `packages/ui/src/` holding colour values.

#### Scenario: Literal colour fails the gate
- **WHEN** a source file under `src/` (other than `tokens.css`) contains a hex colour, a Tailwind palette utility such as `bg-gray-100`, `bg-white`, `text-white`, or a colour function such as `rgb(`
- **THEN** `no-literal-colors.test.ts` fails and names the file and the match

#### Scenario: Generated token module is exempt
- **WHEN** `packages/ui/src/no-literal-colors.test.ts` scans `packages/ui/src/` with the committed `tokens.ts`, which holds hex colours and `rgba(`
- **THEN** `matchLiteralColors` finds colours in `tokens.ts`, yet the scan with the test's ignore list reports no match from `tokens.ts`

### Requirement: Type scale
Text SHALL use Inter (bundled, no CDN) at the scale display 28/34 700, h1 24/30 700, h2 20/26 700, h3 16/22 600, body 14/20 400, small 12/16 400, button 14/20 600, and prices and order numbers SHALL use tabular numerals.

#### Scenario: Price uses tabular numerals
- **WHEN** a `Price` renders
- **THEN** its element has the `tabular-nums` class

### Requirement: Shared components
`packages/ui` SHALL export Button, ButtonLink, IconButton, Input, FormField, Select, Stepper, Badge, Chip, ChoiceGroup, Choice, Card, ImageTile, Dialog, Sheet, Table, EmptyState, ErrorBanner, StatusMessage, VisuallyHidden, Skeleton, PageHeader, TabNav, Price, `formatInr` and `cn`, each with a test, and the apps SHALL compose pages from them rather than define one-off recipes.

#### Scenario: Stepper at zero stock
- **WHEN** a Stepper renders with `max` 0
- **THEN** it shows a disabled control labelled "Out of stock" and never calls `onChange`

#### Scenario: Stepper at the maximum
- **WHEN** a Stepper renders with `value` equal to `max`
- **THEN** the increment control is disabled and the decrement control is enabled

#### Scenario: Price formatting
- **WHEN** `formatInr` receives 123400, 123450 and 12345600
- **THEN** it returns `₹1,234`, `₹1,234.50` and `₹1,23,456`

### Requirement: Accessibility baseline
Every interactive element SHALL be keyboard reachable with a visible focus ring, tap targets on phone SHALL be at least 44 px, dialogs SHALL trap focus and close on Escape, icon-only controls SHALL carry `aria-label`, and `prefers-reduced-motion` SHALL disable transitions.

#### Scenario: Dialog closes on Escape
- **WHEN** a Dialog is open and the user presses Escape
- **THEN** `onClose` is called

#### Scenario: Axe on every e2e page
- **WHEN** the Playwright suite visits a page
- **THEN** `@axe-core/playwright` reports no violations

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
`Button` SHALL render a native button of type `button` unless told otherwise, with variants `primary`, `secondary`, `ghost`, `ghost-danger` and sizes `md` (44 px on phone, 40 px from `sm`), `lg` (48 px) and `compact` (44 px on phone, 32 px from `sm`, 8 px side padding); `loading` SHALL disable it, set `aria-busy`, show an `aria-hidden` spinner and keep the label.

#### Scenario: Default type is button
- **WHEN** a Button without `type` is clicked inside a form
- **THEN** the form is not submitted

#### Scenario: Loading blocks clicks
- **WHEN** a Button renders with `loading`
- **THEN** it is disabled, has `aria-busy="true"`, still shows its label, and clicking it does not call `onClick`

#### Scenario: Primary uses the accent
- **WHEN** a Button renders with no variant
- **THEN** it has the classes `bg-accent` and `text-on-accent`

#### Scenario: Compact size keeps the phone tap target
- **WHEN** a Button and a ButtonLink render with `size="compact"`
- **THEN** each has the classes `h-11`, `sm:h-8` and `px-2`, and neither has `sm:h-10` or `px-4`

### Requirement: ButtonLink looks like a Button
`ButtonLink` SHALL render an anchor with the same variant and size classes as `Button` and pass every anchor attribute through, so apps can wrap it as a router link.

#### Scenario: Link keeps href and button style
- **WHEN** a ButtonLink renders with `href="/cart"` and variant `secondary`
- **THEN** it is a link to `/cart` with the classes of a secondary Button

### Requirement: IconButton has an accessible name
`IconButton` SHALL require an `aria-label` at the type level, render it as the button's accessible name, and render its icon `aria-hidden` at 20 px, with a 44 px target on phone; it SHALL be of type `button` unless the caller passes `type`.

#### Scenario: Name comes from aria-label
- **WHEN** an IconButton renders with `aria-label="Close"`
- **THEN** a button named "Close" exists and its svg is `aria-hidden`

#### Scenario: Missing label does not compile
- **WHEN** an IconButton is written without `aria-label`
- **THEN** `tsc` reports an error (pinned with `@ts-expect-error` in the test)

#### Scenario: IconButton submits when asked
- **WHEN** an IconButton with `type="submit"` and one without `type` are clicked inside a form
- **THEN** the form is submitted once, by the first

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
`Price` SHALL render `formatInr(cents)` in the `accent` colour and, when `mrpCents` is greater than `cents`, the MRP after it struck through in `ink-muted`, with "MRP" available to assistive technology; `formatInr(0)` SHALL be `₹0`. `formatInr` SHALL be defined in `src/format.ts`, a module with no imports, exported as `@shopperstop/ui/format` and still exported from `@shopperstop/ui`.

#### Scenario: Discounted price shows MRP
- **WHEN** a Price renders with `cents` 9900 and `mrpCents` 12000
- **THEN** it shows `₹99` and a struck-through `₹120` whose accessible text includes "MRP"

#### Scenario: No discount, no MRP
- **WHEN** a Price renders with `mrpCents` equal to `cents` or absent
- **THEN** no struck-through element is rendered

#### Scenario: Zero rupees
- **WHEN** `formatInr` receives 0
- **THEN** it returns `₹0`

#### Scenario: formatInr imports nothing
- **WHEN** `src/format.ts` is read and `formatInr` is called from it in a Vitest file running in the `node` environment (no DOM)
- **THEN** the file contains no `import` statement, and `formatInr` returns `₹1,234`, `₹1,234.50` and `₹0` for 123400, 123450 and 0

#### Scenario: The entry still exports formatInr
- **WHEN** `formatInr` is imported from `src/index.ts` and from `src/format.ts`
- **THEN** both are the same function

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
`Dialog` and `Sheet` SHALL render a modal dialog named by its title, move focus inside on open, keep Tab and Shift+Tab inside, call `onClose` on Escape, and return focus to the previously focused element after closing. When one modal opens while another is open, only the most recently opened one SHALL handle Escape and Tab.

#### Scenario: Focus is trapped
- **WHEN** a Dialog with two buttons is open and the user tabs past the last button
- **THEN** focus moves to the first button, and Shift+Tab from the first moves to the last

#### Scenario: Focus returns on close
- **WHEN** a Dialog opened from a button is closed
- **THEN** that button has focus again

#### Scenario: Sheet closes on Escape and on its close button
- **WHEN** a Sheet titled "Cart" is open and the user presses Escape or clicks "Close"
- **THEN** `onClose` is called, and the dialog is named "Cart"

#### Scenario: Stacked modals close top first
- **WHEN** a Sheet is opened from a page button, a Dialog is opened from a button inside the Sheet, and the user presses Escape twice
- **THEN** the first Escape closes only the Dialog and focus returns to the Sheet's button, and the second closes the Sheet and focus returns to the page button

#### Scenario: Tab stays in the top modal
- **WHEN** a Dialog with two buttons is open on top of an open Sheet and the user tabs past the Dialog's last button
- **THEN** focus moves to the Dialog's first button, never into the Sheet

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
`Table` SHALL render rows from `columns` and `rows` as a native table with header cells; with `stack` it SHALL also render each column header inside its cell for phone layouts, on its own line above the value, hidden from `sm` up.

#### Scenario: Rows and headers render
- **WHEN** a Table renders two rows and the columns "Product" and "Quantity"
- **THEN** there are two column headers and two body rows with the cell content

#### Scenario: Stack labels cells
- **WHEN** the same Table renders with `stack`
- **THEN** each body cell contains its column header text, and without `stack` it does not

#### Scenario: Stack label sits above the value
- **WHEN** a Table renders with `stack`
- **THEN** each in-cell label is the cell's first child and has the classes `block` and `sm:hidden`

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
`PageHeader` SHALL render the page title as the only level-1 heading with optional description and actions; `TabNav` SHALL render a navigation landmark named by `label` around its links, style the link with `aria-current="page"` as current, SHALL scroll horizontally without wrapping when its links exceed the width, and SHALL scroll the current link into view when it mounts.

#### Scenario: Page header
- **WHEN** a PageHeader renders with title "Orders" and an action
- **THEN** there is one level-1 heading "Orders" and the action

#### Scenario: Tab navigation landmark
- **WHEN** a TabNav labelled "Order views" wraps two links, one with `aria-current="page"`
- **THEN** a navigation landmark named "Order views" holds both links and the current one keeps `aria-current="page"`

#### Scenario: Tab navigation scrolls instead of wrapping
- **WHEN** a TabNav renders seven links in a narrow container
- **THEN** the nav has horizontal overflow scrolling, the links do not wrap or shrink, and the current-link styling and the landmark are unchanged

#### Scenario: Tab navigation reveals the current link
- **WHEN** a TabNav mounts with seven links, the last one with `aria-current="page"`
- **THEN** `scrollIntoView` is called once, on that link, with `{ block: "nearest", inline: "nearest" }`

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

### Requirement: Generated API types
`packages/ui` SHALL commit `src/api/core.d.ts` and `src/api/rider.d.ts`, generated by `openapi-typescript` from `services/core/openapi.json` and `services/rider/openapi.json` through the `gen:api` script, and SHALL export them as types only under `@shopperstop/ui/api` and `@shopperstop/ui/api/rider`; a test SHALL fail when either committed file differs from a fresh generation of its contract.

#### Scenario: Stale generated types fail the gate
- **WHEN** `src/api/core.d.ts` differs from the output of `openapi-typescript` run on `services/core/openapi.json`
- **THEN** the test `generated core types match the contract` fails

#### Scenario: Stale generated rider types fail the gate
- **WHEN** `src/api/rider.d.ts` differs from the output of `openapi-typescript` run on `services/rider/openapi.json`
- **THEN** the test `generated rider types match the contract` fails

#### Scenario: Response types are usable by name
- **WHEN** a TypeScript file imports `paths` and `components` from `@shopperstop/ui/api`
- **THEN** `paths['/readyz']['get']['responses'][200]['content']['application/json']` is `{ status: 'ok' }` and `components['schemas']['Error']['error']['code']` is the union of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `out_of_stock`, `not_serviceable`, `rate_limited` and `internal`, checked by `npm run typecheck`

#### Scenario: Rider response types are usable by name
- **WHEN** a TypeScript file imports `paths` and `components` from `@shopperstop/ui/api/rider`
- **THEN** `paths['/readyz']['get']['responses'][200]['content']['application/json']` is `{ status: 'ok' }` and `components['schemas']['Error']['error']['code']` is the union of `validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited` and `internal`, checked by `npm run typecheck` in the test `rider response types are usable by name`

#### Scenario: An absent rider contract is skipped
- **WHEN** the `gen:api` script runs from `packages/ui` in a tree that has `services/core/openapi.json` and no `services/rider/openapi.json`
- **THEN** it exits 0, prints the line `gen:api: services/rider/openapi.json absent, skipping`, writes `src/api/core.d.ts` and writes no `src/api/rider.d.ts`, checked by the test `gen:api skips an absent rider contract`

### Requirement: Image tile
`ImageTile`, exported from the package entry, SHALL render a square tile with the `control` radius showing `src` scaled to fit with the required `alt` (an empty `alt` marks it decorative), lazily loaded; without `src` it SHALL show a `canvas` placeholder with an `aria-hidden` Lucide icon and expose nothing to assistive technology.

#### Scenario: Tile shows the image
- **WHEN** an ImageTile renders with `src="/img/milk.png"` and `alt="Milk"`
- **THEN** an image named "Milk" with that `src` and `loading="lazy"` is inside an element with `aspect-square` and `rounded-control`

#### Scenario: Placeholder without an image
- **WHEN** an ImageTile renders without `src` and with `alt="Milk"`
- **THEN** no `img` role is exposed, and the tile holds a `bg-canvas` element with an `aria-hidden` svg

#### Scenario: Decorative tile
- **WHEN** an ImageTile renders with `src` and `alt=""`
- **THEN** its image has an empty `alt` and the `presentation` role

#### Scenario: Missing alt does not compile
- **WHEN** an ImageTile is written without `alt`
- **THEN** `tsc` reports an error (pinned with `@ts-expect-error` in the test)

### Requirement: Single-choice group
`ChoiceGroup`, exported with `Choice` from the package entry, SHALL render a `radiogroup` named by `label` whose `Choice` descendants are pill `radio` buttons styled like a `Chip`, checked when their `value` equals the group's `value`; clicking a choice, or an arrow key moving to it, SHALL call `onChange` with its value. Only the checked choice SHALL be a tab stop, or every choice when none is checked.

#### Scenario: Click chooses
- **WHEN** a ChoiceGroup labelled "Deliver to" with value "home" holds choices "home" and "work", and the user clicks "work"
- **THEN** a `radiogroup` named "Deliver to" holds two radios, "home" is checked, and `onChange` is called with "work"

#### Scenario: Arrow keys move and choose
- **WHEN** focus is on the last of three choices in a ChoiceGroup and the user presses ArrowRight, then ArrowLeft
- **THEN** ArrowRight focuses the first choice and calls `onChange` with its value (wrapping), and ArrowLeft focuses the last choice and calls `onChange` with its value; ArrowDown and ArrowUp act like ArrowRight and ArrowLeft

#### Scenario: One tab stop
- **WHEN** a ChoiceGroup with value "work" holds three choices, and another with no value holds two
- **THEN** in the first only "work" has `tabindex="0"` and the others `-1`, and in the second both have `tabindex="0"`

#### Scenario: Choices can sit anywhere inside the group
- **WHEN** each Choice of a ChoiceGroup is inside its own list item
- **THEN** the arrow keys move between them in document order

### Requirement: Visually hidden text and live region
`VisuallyHidden`, exported from the package entry, SHALL render its children with the `sr-only` class and pass other attributes through; with `live` it SHALL be an `aria-live="polite"` region.

#### Scenario: Hidden text names a control
- **WHEN** a button holds an `aria-hidden` icon and a VisuallyHidden "Close"
- **THEN** the button is named "Close" and the VisuallyHidden element has the class `sr-only`

#### Scenario: Live variant is polite
- **WHEN** a VisuallyHidden renders with `live` and "3 new orders"
- **THEN** its element has `aria-live="polite"`, the class `sr-only`, and the text; without `live` it has no `aria-live`

### Requirement: Unavailable buttons stay focusable
`Button` and `ButtonLink` with `aria-disabled="true"` SHALL look like a disabled Button (`opacity-50`, `cursor-not-allowed`) while staying in the tab order; the caller's handler decides what a press does.

#### Scenario: aria-disabled looks disabled and keeps focus
- **WHEN** a Button and a ButtonLink render with `aria-disabled="true"` and the user tabs
- **THEN** each has the classes `aria-disabled:opacity-50` and `aria-disabled:cursor-not-allowed`, the Button has no `disabled` attribute, and each receives focus in turn

### Requirement: Token values as a TypeScript module
`packages/ui` SHALL commit `src/tokens.ts`, generated from `src/tokens.css` by `scripts/gen-tokens.mjs` through the `gen:tokens` script, and SHALL export it as `@shopperstop/ui/tokens` with no DOM, React or CSS import; a test SHALL fail when the committed module differs from a fresh generation.

#### Scenario: Generated tokens match tokens.css
- **WHEN** `generateTokens` from `scripts/gen-tokens.mjs` runs in memory on the committed `src/tokens.css`
- **THEN** its output equals the committed `src/tokens.ts` byte for byte

#### Scenario: A drifted tokens.css fails the check
- **WHEN** `generateTokens` runs on `tokens.css` with `--brand` changed from `#F8CB46` to `#F8CB47`
- **THEN** its output differs from the committed `src/tokens.ts` and contains `"brand": "#F8CB47"`

#### Scenario: Package exports tokens and format
- **WHEN** `packages/ui/package.json` is read
- **THEN** `exports["./tokens"]` is `{ types: "./dist/tokens.d.ts", default: "./dist/tokens.js" }`, `exports["./format"]` is `{ types: "./dist/format.d.ts", default: "./dist/format.js" }`, and `scripts["gen:tokens"]` is `node scripts/gen-tokens.mjs`

### Requirement: Token module shape
`src/tokens.ts` SHALL export `colors` (every `:root` colour keyed by its camelCase name), `radius` (`control`, `card`, `pill`), `spacing` (`unit`, `gutter`, `gridGap`), `type` (`display`, `h1`, `h2`, `h3`, `body`, `small`, `button`, each with `size`, `lineHeight`, `weight`), `motion` (`duration`, `sheetDuration`, `easing`) and `shadows` (`card`, `sheet`, each with `boxShadow`, `offsetX`, `offsetY`, `blur`, `color`, `opacity`); lengths SHALL be numbers in px and durations numbers in ms.

#### Scenario: Every colour token is exported by camelCase name
- **WHEN** `colors` is imported from `src/tokens.ts`
- **THEN** it has exactly 20 keys, the camelCase forms of the 20 `:root` tokens, `colors.brand` is `#F8CB46`, `colors.brandStrong` is `#E5B51F` and `colors.lineStrong` is `#868C94`

#### Scenario: Scale values are numbers in px and ms
- **WHEN** `type`, `radius`, `spacing` and `motion` are imported from `src/tokens.ts`
- **THEN** `type.display` is `{ size: 28, lineHeight: 34, weight: 700 }`, `type.h3` is `{ size: 16, lineHeight: 22, weight: 600 }`, `type.body` is `{ size: 14, lineHeight: 20, weight: 400 }`, `radius` is `{ control: 8, card: 12, pill: 9999 }`, `spacing` is `{ unit: 4, gutter: 16, gridGap: 12 }` and `motion` is `{ duration: 150, sheetDuration: 200, easing: 'ease-out' }`

#### Scenario: Shadows carry offsets, blur, colour and opacity
- **WHEN** `shadows` is imported from `src/tokens.ts`
- **THEN** `shadows.card` is `{ boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)', offsetX: 0, offsetY: 1, blur: 3, color: '#000000', opacity: 0.08 }` and `shadows.sheet` is `{ boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.12)', offsetX: 0, offsetY: -4, blur: 16, color: '#000000', opacity: 0.12 }`

### Requirement: App token store
`createTokenStore(key)` from `@shopperstop/ui/app` SHALL return `{ get, set, subscribe }`. It SHALL read the token from `localStorage[key]` once at creation; `get` SHALL answer from memory (`undefined` when none); `set(token)` SHALL update memory, call every subscriber, and write the entry (`undefined` removes it). When storage throws, the store SHALL not throw and the token SHALL live in memory only. The store SHALL hold no expiry.

#### Scenario: Stored token is read at creation
- **WHEN** `localStorage` holds `shopperstop:staff-token` = `tok` and `createTokenStore('shopperstop:staff-token')` is called
- **THEN** `get()` returns `tok`

#### Scenario: Set and clear persist and notify
- **WHEN** a store for `shopperstop:customer-token` has one subscriber and `set('a')` then `set(undefined)` run
- **THEN** after the first `localStorage` holds `a` and `get()` is `a`, after the second the entry is gone and `get()` is `undefined`, and the subscriber was called twice

#### Scenario: Unsubscribed listener is not called
- **WHEN** a subscriber calls the function `subscribe` returned and then `set('a')` runs
- **THEN** the subscriber is not called

#### Scenario: Blocked storage keeps the token in memory
- **WHEN** `localStorage.getItem`, `setItem` and `removeItem` throw, a store is created, and `set('a')` runs
- **THEN** nothing throws, `get()` is `undefined` before the set and `a` after it

### Requirement: App API client
`createApiClient<Paths>({ baseUrl, session?, onUnauthorized?, failureMessage? })` SHALL return an `openapi-fetch` client on `baseUrl` that calls `globalThis.fetch` as it is at each request. With a `session` (any `{ get, set }`), every request SHALL carry `Authorization: Bearer <token>` while `session.get()` returns a token; without one, no `Authorization` header SHALL be added.

#### Scenario: Client attaches the bearer token
- **WHEN** a client on `http://localhost/api/core/v1` has a session holding `tok`, `globalThis.fetch` is replaced after the client was created, and `GET /admin/me` runs
- **THEN** the replacement receives one request to `http://localhost/api/core/v1/admin/me` with `Authorization: Bearer tok`, and the call resolves to its JSON body as `data`

#### Scenario: No session, no header
- **WHEN** a client without a session runs a request
- **THEN** the request has no `Authorization` header

#### Scenario: Empty session, no header
- **WHEN** a client's session holds no token and a request runs
- **THEN** the request has no `Authorization` header

### Requirement: Session ends only on a 401 to the current token
When a response has status 401 and its request carried `Authorization: Bearer <t>` where `t` equals `session.get()` at response time, the client SHALL call `session.set(undefined)` and then `onUnauthorized` once. A 401 to a request without a token, or with a token since replaced, and every other status SHALL leave the session alone and not call `onUnauthorized`.

#### Scenario: 401 to the current token clears it and reports the loss
- **WHEN** the session holds `tok` and the server answers the request 401 `unauthorized`
- **THEN** `session.get()` is `undefined` and `onUnauthorized` was called once

#### Scenario: 401 to a signed-out request keeps a session set meanwhile
- **WHEN** the session holds no token, the request goes out, the session is set to `fresh` before the answer, and the answer is 401
- **THEN** the request had no `Authorization` header, `session.get()` is `fresh` and `onUnauthorized` was not called

#### Scenario: 401 to a replaced token keeps the new session
- **WHEN** the session holds `old`, the request goes out, the session is set to `new` before the answer, and the answer is 401
- **THEN** `session.get()` is `new` and `onUnauthorized` was not called

#### Scenario: Other failures keep the session
- **WHEN** the session holds `tok` and the server answers 403 `forbidden`
- **THEN** `session.get()` is `tok` and `onUnauthorized` was not called

### Requirement: Failures without the error envelope become internal
A not-ok response whose JSON body lacks a string `error.code` and a string `error.message` SHALL be replaced by one with the same status, only `Content-Type: application/json`, and body `{ "error": { "code": "internal", "message": <failureMessage> } }`; `failureMessage` defaults to `The server did not answer as expected.`. Ok responses and enveloped failures SHALL pass unchanged.

#### Scenario: Plain-text 502 becomes internal
- **WHEN** a client without `failureMessage` gets a 502 with body `Bad Gateway` as `text/plain`
- **THEN** the call resolves with `response.status` 502 and `error` equal to `{ error: { code: 'internal', message: 'The server did not answer as expected.' } }`

#### Scenario: Empty failure uses the client's message
- **WHEN** a client with `failureMessage` `Could not reach ShopperStop. Try again.` gets a 503 with an empty body
- **THEN** `error.error` is `{ code: 'internal', message: 'Could not reach ShopperStop. Try again.' }` and the status is 503

#### Scenario: Enveloped failure passes unchanged
- **WHEN** the server answers 409 `{ "error": { "code": "conflict", "message": "Out of stock.", "field": "quantity" } }`
- **THEN** `error` deep-equals that body and the status is 409

#### Scenario: Bare 401 ends the session and becomes internal
- **WHEN** the session holds `tok` and the server answers 401 with no body
- **THEN** `session.get()` is `undefined`, `onUnauthorized` was called once, and `error.error.code` is `internal` with status 401

### Requirement: Relative and stamped times
`@shopperstop/ui/app` SHALL export `since(at, now)`: `just now` under one minute (or in the future), `<m> min ago` under an hour, else `<h> h <m> min ago`, in whole minutes; `when(at)`: `Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })` of `at`; and `useSince(at)`: the text of `since(at, Date.now())`, checked every 5 seconds.

#### Scenario: Relative times in whole minutes
- **WHEN** `since` runs with `at` = `2026-10-13T09:00:00Z` and `now` 59 s, 12 min 30 s and 75 min later, and 2 min earlier
- **THEN** it returns `just now`, `12 min ago`, `1 h 15 min ago` and `just now`

#### Scenario: Stamp in the stores' time zone
- **WHEN** `when('2026-10-13T09:20:00Z')` runs
- **THEN** it returns `13 Oct 2026, 2:50 pm`

#### Scenario: useSince keeps its text current
- **WHEN** a component renders `useSince(at)` with the clock at `at`, and the fake clock then advances 60 s with its timers
- **THEN** the component shows `just now` and then `1 min ago`

### Requirement: App entry
`packages/ui/package.json` SHALL export `./app` as `{ types: "./dist/app/index.d.ts", default: "./dist/app/index.js" }` and list `openapi-fetch` `0.17.0` under `peerDependencies` and `devDependencies`; every other entry SHALL be unchanged. The entry SHALL export `createTokenStore`, `createApiClient`, `since`, `useSince` and `when`, and import no CSS.

#### Scenario: Package exports the app entry
- **WHEN** `packages/ui/package.json` is read
- **THEN** `exports["./app"]` is `{ types: './dist/app/index.d.ts', default: './dist/app/index.js' }`, `peerDependencies["openapi-fetch"]` and `devDependencies["openapi-fetch"]` are `0.17.0`, and `exports["."]`, `["./format"]` and `["./tokens"]` are as before

#### Scenario: Entry exports the shared helpers
- **WHEN** `src/app/index.ts` is imported and its source read
- **THEN** `createTokenStore`, `createApiClient`, `since`, `useSince` and `when` are functions, and no line imports a `.css` file
